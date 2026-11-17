import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FixId, FixResult } from '../shared/types';
import { logAction, markUndone, registerUndo } from './journal';
import { DISPLAY_TYPE, HEAVY_APPS, PERF_LOG_USERS, heavyApps, powershellFile, readState, runScript, validUser } from './tuning';

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

/* ───── Mode Jeu ───── */

const GAME_BAR = 'HKCU\\Software\\Microsoft\\GameBar';

/** Écrit la valeur du mode Jeu (1 ou 0), ou l'efface pour revenir au réglage par défaut de Windows. */
async function setGameMode(value: '0' | '1' | 'absent'): Promise<boolean> {
  const reg = system32('reg.exe');
  const result = value === 'absent'
    ? await exec(reg, ['delete', GAME_BAR, '/v', 'AutoGameModeEnabled', '/f'])
    : await exec(reg, ['add', GAME_BAR, '/v', 'AutoGameModeEnabled', '/t', 'REG_DWORD', '/d', value, '/f']);
  return result.ok;
}

/* ───── Fréquence de l'écran ───── */

/** Règle l'écran principal sur `hz`, à condition que l'écran propose cette fréquence. Renvoie vrai si c'est fait. */
async function setRefresh(hz: number): Promise<boolean> {
  if (!Number.isInteger(hz) || hz < 24 || hz > 1000) return false;
  const display = (await readState()).display;
  if (!display || !display.rates.includes(hz)) return false;
  // Seul un nombre entier vérifié entre dans le script.
  const out = await runScript(`${DISPLAY_TYPE}\n[WarmupDisplay]::Set(${hz}) | Out-Null\n[WarmupDisplay]::Current()`);
  return Number(out.trim()) === hz;
}

/* ───── Autorisation de mesurer les images par seconde ───── */

/**
 * Ajoute (ou retire) le compte Windows au groupe « Utilisateurs du journal de performances ».
 * Windows demande lui-même l'accord du joueur (fenêtre de contrôle de compte). Seul un nom de compte vérifié entre dans la commande.
 */
async function setPerfGroup(user: string, add: boolean): Promise<boolean> {
  if (!validUser(user)) return false;
  const inner = `${add ? 'Add' : 'Remove'}-LocalGroupMember -SID '${PERF_LOG_USERS}' -Member '${user}' -ErrorAction Stop`;
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  const out = await runScript([
    '$ErrorActionPreference = \'Stop\'',
    'try {',
    `  $p = Start-Process -FilePath '${powershellFile()}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @('-NoProfile', '-NonInteractive', '-EncodedCommand', '${encoded}')`,
    '  $p.ExitCode',
    '} catch { 1 }'
  ].join('\n'), 120_000);
  return out.trim() === '0';
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
    case 'mode-jeu': {
      const before = (await readState()).gameMode;
      if (before === 1 || before === null) return { ok: false, message: 'Le mode Jeu est déjà activé.' };
      if (!(await setGameMode('1'))) return { ok: false, message: 'Windows a refusé le changement. Rien n\'a été modifié.' };
      logAction({ kind: 'mode-jeu', title: 'Mode Jeu de Windows activé', detail: 'Windows donne la priorité au jeu en cours et ne redémarre plus pendant une partie. « Annuler » le désactive à nouveau.', data: String(before) });
      return { ok: true, message: 'Le mode Jeu est activé.' };
    }
    case 'frequence': {
      const display = (await readState()).display;
      const best = display ? Math.max(...display.rates, display.hz) : 0;
      if (!display || best <= display.hz) return { ok: false, message: 'L\'écran est déjà réglé sur sa fréquence la plus haute.' };
      if (!(await setRefresh(best))) return { ok: false, message: 'Windows a refusé la nouvelle fréquence. L\'écran garde son réglage.' };
      logAction({ kind: 'frequence', title: `Écran passé de ${display.hz} à ${best} Hz`, detail: `L'écran principal affiche maintenant jusqu'à ${best} images par seconde. « Annuler » remet ${display.hz} Hz.`, data: String(display.hz) });
      return { ok: true, message: `L'écran est réglé sur ${best} Hz.` };
    }
    case 'mesure-fps': {
      const state = await readState();
      if (state.fpsAllowed) return { ok: false, message: 'La mesure des images par seconde est déjà autorisée.' };
      if (state.fpsPending) return { ok: false, message: 'L\'autorisation est déjà donnée : reconnectez-vous à Windows pour qu\'elle prenne effet.' };
      if (!state.user) return { ok: false, message: 'Le compte Windows n\'a pas pu être reconnu. Rien n\'a été modifié.' };
      if (!(await setPerfGroup(state.user, true))) return { ok: false, message: 'L\'autorisation n\'a pas été donnée (Windows a peut-être demandé votre accord). Rien n\'a été modifié.' };
      logAction({ kind: 'mesure-fps', title: 'Mesure des images par seconde autorisée', detail: 'Votre compte Windows fait partie du groupe « Utilisateurs du journal de performances ». Effet à la prochaine connexion à Windows. « Annuler » l\'en retire.', data: state.user });
      return { ok: true, message: 'C\'est autorisé. Déconnectez-vous puis reconnectez-vous à Windows pour que la mesure démarre.' };
    }
    default:
      return { ok: false, message: 'Cette correction n\'est pas encore disponible.' };
  }
}

/** Fonctions d'annulation, une par correction. */
export function registerCorrections(): void {
  registerUndo('programmes', (entry) => relaunch(parsePaths(entry.data)));
  // Valeur d'origine notée dans le journal : 0 (désactivé). Toute autre valeur rétablit le réglage par défaut.
  registerUndo('mesure-fps', (entry) => setPerfGroup(entry.data ?? '', false));
  registerUndo('frequence', (entry) => setRefresh(Number(entry.data)));
  registerUndo('mode-jeu', (entry) => setGameMode(entry.data === '0' ? '0' : 'absent'));
}
