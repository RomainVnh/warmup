import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FixId, FixResult } from '../shared/types';
import { logAction, markUndone, registerUndo } from './journal';
import { HEAVY_APPS, heavyApps, readState } from './tuning';

// Corrections réelles. Chacune est une action prédéfinie : expliquée avant (page Diagnostic, réglages),
// notée dans le journal, et annulable grâce à sa fonction d'annulation. Aucune commande libre, aucun accès au jeu.

const HEAVY_EXE = HEAVY_APPS.flatMap((app) => app.exe);
const system32 = (file: string) => path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', file);

function exec(file: string, args: string[], timeout = 15_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, windowsHide: true }, (error, stdout) => resolve({ ok: !error, out: String(stdout ?? '') }));
  });
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ───── Programmes gourmands ───── */

/** Un chemin du journal n'est rouvert que s'il désigne un programme de la liste et existe encore. */
export function relaunchable(file: unknown): file is string {
  return typeof file === 'string' && /\.exe$/i.test(file) && HEAVY_EXE.includes(path.win32.basename(file).toLowerCase()) && fs.existsSync(file);
}

export function parsePaths(data: string | undefined): string[] {
  try {
    const raw: unknown = JSON.parse(data ?? '[]');
    return Array.isArray(raw) ? raw.filter(relaunchable).slice(0, HEAVY_APPS.length) : [];
  } catch {
    return [];
  }
}

/** Rouvre les programmes fermés par Warmup. */
export async function relaunch(paths: string[]): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  let opened = 0;
  for (const file of paths.filter(relaunchable)) {
    try {
      const child = spawn(file, [], { detached: true, stdio: 'ignore', shell: false, windowsHide: false });
      child.once('error', () => undefined);
      child.unref();
      opened += 1;
    } catch {
      // Un programme qui refuse de s'ouvrir n'empêche pas les autres.
    }
  }
  return opened > 0;
}

/**
 * Ferme les programmes gourmands, normalement : « taskkill » sans option de force envoie la même demande que la croix
 * de la fenêtre. Renvoie les programmes fermés et l'emplacement de ceux à rouvrir, ou null s'il n'y avait rien à fermer.
 */
export async function closeHeavy(): Promise<{ labels: string[]; paths: string[] } | null> {
  if (process.platform !== 'win32') return null;
  const apps = heavyApps(await readState());
  if (!apps.length) return null;
  for (const app of apps) {
    for (const exe of app.exe) await exec(system32('taskkill.exe'), ['/IM', exe]);
  }
  await wait(2500);
  const still = new Set(heavyApps(await readState()).map((app) => app.label));
  const closed = apps.filter((app) => !still.has(app.label));
  return closed.length ? { labels: closed.map((app) => app.label), paths: closed.flatMap((app) => app.paths) } : null;
}

const listing = (labels: string[]) => (labels.length > 1 ? `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}` : labels[0]);

/** Fermeture pendant une partie : notée dans le journal, puis les programmes sont rouverts à la fin. Renvoie de quoi les rouvrir. */
export async function closeForGame(gameTitle: string, gameId: string): Promise<(() => void) | null> {
  const closed = await closeHeavy();
  if (!closed) return null;
  const entry = logAction({
    kind: 'programmes',
    title: `${listing(closed.labels)} ${closed.labels.length > 1 ? 'fermés' : 'fermé'} pendant la partie`,
    detail: `Pour laisser plus de mémoire à ${gameTitle}. ${closed.labels.length > 1 ? 'Ils seront rouverts' : 'Il sera rouvert'} à la fin de la partie.`,
    gameId,
    data: JSON.stringify(closed.paths)
  });
  return () => void relaunch(closed.paths).then(() => markUndone(entry));
}

/* ───── Application depuis le diagnostic ───── */

export async function applyFix(id: FixId): Promise<FixResult> {
  if (process.platform !== 'win32') return { ok: false, message: 'Les corrections s\'appliquent sous Windows.' };
  switch (id) {
    case 'programmes': {
      const closed = await closeHeavy();
      if (!closed) return { ok: false, message: 'Aucun programme n\'a été fermé : ils sont peut-être déjà fermés, ou attendent votre réponse.' };
      logAction({ kind: 'programmes', title: `${listing(closed.labels)} ${closed.labels.length > 1 ? 'fermés' : 'fermé'}`, detail: 'Depuis le diagnostic, pour laisser plus de mémoire aux jeux. « Annuler » les rouvre.', data: JSON.stringify(closed.paths) });
      return { ok: true, message: `${listing(closed.labels)} ${closed.labels.length > 1 ? 'ont été fermés' : 'a été fermé'}. Le journal permet de ${closed.labels.length > 1 ? 'les' : 'le'} rouvrir.` };
    }
    default:
      return { ok: false, message: 'Cette correction n\'est pas encore disponible.' };
  }
}

/** Fonctions d'annulation, une par correction. */
export function registerCorrections(): void {
  registerUndo('programmes', (entry) => relaunch(parsePaths(entry.data)));
}
