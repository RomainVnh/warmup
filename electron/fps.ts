import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';

// Images par seconde, relevées de l'extérieur du jeu.
// Warmup s'appuie sur PresentMon, l'outil libre d'Intel (licence MIT) : il écoute les compteurs que Windows tient
// pour chaque image affichée, sans rien injecter dans le jeu. C'est ce qui le rend compatible avec les anti-triche.
// PresentMon n'est pas dans le dépôt : il est ajouté aux installateurs Windows (voir build/presentmon/LISEZ-MOI.txt).
//
// Windows réserve ces compteurs aux administrateurs et au groupe « Utilisateurs du journal de performances ».
// Sans cette autorisation, PresentMon s'arrête aussitôt : le bilan l'explique et le diagnostic propose la correction.

/** Pourquoi les images par seconde n'ont pas été mesurées. */
export type FpsMissing = 'absent' | 'autorisation' | 'echec' | 'windows';

/** Colonne qui donne la durée entre deux images, selon la version de PresentMon. */
const FRAME_COLUMNS = ['msbetweenpresents', 'frametime', 'msbetweendisplaychange'];

/** Position de la colonne utile dans l'en-tête CSV ; -1 si l'en-tête n'en contient aucune. */
export function frameColumn(header: string): number {
  const names = header.split(',').map((name) => name.trim().toLowerCase());
  for (const wanted of FRAME_COLUMNS) {
    const index = names.indexOf(wanted);
    if (index >= 0) return index;
  }
  return -1;
}

/** Durée d'une image en ms lue sur une ligne CSV ; null si la valeur est absente ou absurde. */
export function frameTime(line: string, column: number): number | null {
  const value = Number(line.split(',')[column]);
  return Number.isFinite(value) && value > 0.2 && value < 5000 ? value : null;
}

/** Vrai si le message d'erreur de PresentMon dit qu'il manque l'autorisation de Windows. */
export const deniedMessage = (text: string): boolean => /access is denied|accès refusé|administrat|elevat|privilege|performance log users/i.test(text);

// Les durées d'image sont rangées par tranches de 0,25 ms (jusqu'à 250 ms) : de quoi calculer le « 1 % le plus lent »
// d'une longue partie sans garder chaque image en mémoire.
const STEP = 0.25;
const BUCKETS = 1000;

export class FrameStats {
  private buckets = new Array<number>(BUCKETS + 1).fill(0);
  private frames = 0;
  private totalMs = 0;
  private windowFrames = 0;
  private windowMs = 0;

  add(ms: number): void {
    this.buckets[Math.min(BUCKETS, Math.floor(ms / STEP))] += 1;
    this.frames += 1;
    this.totalMs += ms;
    this.windowFrames += 1;
    this.windowMs += ms;
  }

  /** Images par seconde depuis le relevé précédent ; null si aucune image n'a été vue. */
  takeWindow(): number | null {
    const fps = this.windowFrames && this.windowMs > 0 ? Math.round((this.windowFrames * 1000) / this.windowMs) : null;
    this.windowFrames = 0;
    this.windowMs = 0;
    return fps;
  }

  /** Moyenne de la partie, et images par seconde du 1 % des images les plus lentes. */
  summary(): { avg: number; low1: number } | null {
    if (this.frames < 30 || this.totalMs <= 0) return null;
    const avg = Math.round((this.frames * 1000) / this.totalMs);
    const slowest = Math.max(1, Math.ceil(this.frames * 0.01));
    let seen = 0;
    let bucket = BUCKETS;
    for (; bucket > 0; bucket -= 1) {
      seen += this.buckets[bucket];
      if (seen >= slowest) break;
    }
    const ms = (bucket + 0.5) * STEP;
    return { avg, low1: Math.min(avg, Math.round(1000 / ms)) };
  }
}

export interface FpsWatch {
  stats: FrameStats;
  /** null tant que la mesure fonctionne ; sinon la raison de son arrêt. */
  missing(): FpsMissing | null;
  stop(): void;
}

/** Arguments fixes de PresentMon 2 : un seul programme suivi, résultats sur la sortie standard, aucune fenêtre. */
export const presentMonArgs = (pid: number): string[] => [
  '--process_id', String(pid),
  '--output_stdout',
  '--no_console_stats',
  '--v1_metrics',
  '--stop_existing_session',
  '--session_name', 'WarmupFps',
  '--terminate_on_proc_exit'
];

/** Commence à mesurer les images du programme `pid`. `tool` est l'emplacement de PresentMon, fixé par la partie système. */
export function watchFps(tool: string | null, pid: number): FpsWatch {
  const stats = new FrameStats();
  if (process.platform !== 'win32') return { stats, missing: () => 'windows', stop: () => undefined };
  if (!tool || !fs.existsSync(tool) || !Number.isInteger(pid) || pid <= 0) return { stats, missing: () => 'absent', stop: () => undefined };

  let missing: FpsMissing | null = null;
  let child: ChildProcessWithoutNullStreams | null = null;
  let column = -1;
  let pending = '';
  let errors = '';
  let frames = 0;
  try {
    child = spawn(tool, presentMonArgs(pid), { windowsHide: true, shell: false });
  } catch {
    return { stats, missing: () => 'echec', stop: () => undefined };
  }
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (column < 0) {
        column = frameColumn(line);
        continue;
      }
      const ms = frameTime(line, column);
      if (ms !== null) {
        stats.add(ms);
        frames += 1;
      }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    if (errors.length < 4000) errors += chunk;
  });
  child.once('error', () => {
    missing = 'echec';
  });
  child.once('exit', () => {
    child = null;
    if (!frames) missing = deniedMessage(errors) ? 'autorisation' : missing ?? 'echec';
  });
  return {
    stats,
    missing: () => missing,
    stop: () => {
      child?.kill();
      child = null;
    }
  };
}
