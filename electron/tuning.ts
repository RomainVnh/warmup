import { execFile } from 'node:child_process';
import path from 'node:path';
import type { PcIssue, PcPart } from '../shared/types';

// Réglages de Windows qui comptent pour jouer, lus en lecture seule par un script fixe (aucune commande libre).
// Ce fichier ne modifie rien : il dit ce qui peut être amélioré. Les corrections sont dans electron/corrections.ts.

/** Programmes connus pour occuper beaucoup de mémoire en arrière-plan, et que l'on peut fermer puis rouvrir sans perte. */
export const HEAVY_APPS: { label: string; exe: string[] }[] = [
  { label: 'Google Chrome', exe: ['chrome.exe'] },
  { label: 'Microsoft Edge', exe: ['msedge.exe'] },
  { label: 'Firefox', exe: ['firefox.exe'] },
  { label: 'Opera', exe: ['opera.exe'] },
  { label: 'Brave', exe: ['brave.exe'] },
  { label: 'OneDrive', exe: ['onedrive.exe'] },
  { label: 'Dropbox', exe: ['dropbox.exe'] },
  { label: 'Google Drive', exe: ['googledrivefs.exe'] },
  { label: 'Microsoft Teams', exe: ['ms-teams.exe', 'teams.exe'] },
  { label: 'Adobe Creative Cloud', exe: ['creative cloud.exe'] }
];
const HEAVY_EXE = HEAVY_APPS.flatMap((app) => app.exe);
/** À partir de cette quantité de mémoire occupée par ces programmes, Warmup propose de les fermer. */
export const HEAVY_LIMIT_MB = 800;

export interface TuningState {
  /** Programmes de la liste ci-dessus actuellement ouverts. */
  procs: { name: string; path: string; memMb: number }[];
  /** Mode Jeu de Windows (registre de l'utilisateur) : 1 activé, 0 désactivé, null valeur absente (activé par défaut). */
  gameMode: number | null;
  /** Planification GPU à accélération matérielle : 2 activée, 1 désactivée, null non proposée par la carte. */
  hags: number | null;
}

export const emptyState = (): TuningState => ({ procs: [], gameMode: null, hags: null });

// Script fixe, envoyé encodé à PowerShell (aucune valeur venue de l'extérieur n'y entre).
const STATE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$r = [ordered]@{}
$names = @(${HEAVY_EXE.map((exe) => `'${exe}'`).join(', ')})
$r.procs = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and ($names -contains $_.Name.ToLower()) } | ForEach-Object { @{ name = $_.Name.ToLower(); path = $_.ExecutablePath; memMb = [math]::Round($_.WorkingSetSize / 1MB) } })
$g = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name AutoGameModeEnabled
$r.gameMode = if ($g) { [int]$g.AutoGameModeEnabled } else { $null }
$h = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name HwSchMode
$r.hags = if ($h) { [int]$h.HwSchMode } else { $null }
$r | ConvertTo-Json -Compress -Depth 4
`;

const windowsTool = (...parts: string[]) => path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', ...parts);
export const powershellFile = () => windowsTool('WindowsPowerShell', 'v1.0', 'powershell.exe');

/** Lance PowerShell avec un script fixe. Renvoie la sortie, ou une chaîne vide en cas d'échec. */
export function runScript(script: string, timeout = 20_000): Promise<string> {
  if (process.platform !== 'win32') return Promise.resolve('');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile(powershellFile(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : value && typeof value === 'object' ? [value as T] : []);

/** Lit la réponse du script. Toute valeur inattendue est écartée. */
export function parseState(json: string): TuningState {
  const state = emptyState();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return state;
  }
  state.procs = list<Record<string, unknown>>(raw.procs)
    .filter((p) => typeof p.name === 'string' && typeof p.path === 'string' && HEAVY_EXE.includes(p.name.toLowerCase()))
    .map((p) => ({ name: String(p.name).toLowerCase(), path: String(p.path), memMb: Math.max(0, Math.round(Number(p.memMb) || 0)) }));
  const flag = (value: unknown, allowed: number[]) => (typeof value === 'number' && allowed.includes(value) ? value : null);
  state.gameMode = flag(raw.gameMode, [0, 1]);
  state.hags = flag(raw.hags, [1, 2]);
  return state;
}

export async function readState(): Promise<TuningState> {
  return parseState(await runScript(STATE_SCRIPT));
}

const size = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go` : `${mb} Mo`);

/** Programmes gourmands ouverts, regroupés par application, du plus gourmand au moins gourmand. */
export function heavyApps(state: TuningState): { label: string; memMb: number; exe: string[]; paths: string[] }[] {
  return HEAVY_APPS.map((app) => {
    const procs = state.procs.filter((p) => app.exe.includes(p.name));
    // Le programme à rouvrir : celui qui porte le nom principal de l'application, un seul par application.
    const main = procs.find((p) => p.name === app.exe[0]) ?? procs[0];
    return { label: app.label, exe: app.exe, memMb: procs.reduce((sum, p) => sum + p.memMb, 0), paths: main ? [main.path] : [] };
  })
    .filter((app) => app.paths.length > 0)
    .sort((a, b) => b.memMb - a.memMb);
}

export interface Tuning { parts: PcPart[]; issues: PcIssue[] }

/** Ce que Warmup conclut de l'état de Windows : une ligne d'état par point, et un point à améliorer quand il y a lieu. */
export function evaluate(state: TuningState): Tuning {
  const parts: PcPart[] = [];
  const issues: PcIssue[] = [];

  const apps = heavyApps(state);
  const heavy = apps.reduce((sum, app) => sum + app.memMb, 0);
  if (heavy >= HEAVY_LIMIT_MB) {
    const names = apps.map((app) => `${app.label} (${size(app.memMb)})`).join(', ');
    parts.push({ name: 'Arrière-plan', big: `${apps.length} programme${apps.length > 1 ? 's' : ''} gourmand${apps.length > 1 ? 's' : ''}`, text: `${names} : ${size(heavy)} de mémoire occupée pendant que vous jouez.`, status: 'warn' });
    issues.push({
      title: `Fermer ${apps.length > 1 ? `${apps.length} programmes gourmands` : apps[0].label} avant de jouer`,
      why: `${names} occupent ${size(heavy)} de mémoire. Le jeu en dispose d'autant moins, ce qui peut provoquer des saccades.`,
      change: 'Warmup ferme ces programmes normalement, comme si vous cliquiez sur la croix : vos onglets et documents sont proposés à la réouverture. « Annuler » dans le journal les rouvre.',
      action: 'Fermer ces programmes',
      fix: 'programmes'
    });
  } else {
    parts.push({ name: 'Arrière-plan', big: apps.length ? `${size(heavy)} occupés` : 'Rien de gourmand', text: apps.length ? 'Les programmes ouverts laissent assez de mémoire au jeu.' : 'Aucun programme gourmand connu n\'est ouvert.', status: 'ok' });
  }

  // Mode Jeu : Windows donne la priorité au jeu et repousse ses propres tâches de fond.
  if (state.gameMode === 0) {
    parts.push({ name: 'Mode Jeu', big: 'Désactivé', text: 'Windows ne donne pas la priorité aux jeux.', status: 'warn' });
    issues.push({
      title: 'Activer le mode Jeu de Windows',
      why: 'Le mode Jeu donne la priorité au jeu en cours et empêche Windows d\'installer des mises à jour ou de redémarrer pendant la partie. Il est désactivé sur ce PC.',
      change: 'Warmup active le réglage « Mode Jeu » de Windows (le même que dans Paramètres > Jeux). « Annuler » dans le journal le remet comme avant.',
      action: 'Activer le mode Jeu',
      fix: 'mode-jeu'
    });
  } else {
    parts.push({ name: 'Mode Jeu', big: 'Activé', text: 'Windows donne la priorité au jeu en cours.', status: 'ok' });
  }

  // Planification GPU : la carte graphique gère elle-même sa file d'images. Le réglage demande un redémarrage
  // et des droits d'administrateur : Warmup ouvre la page de Windows plutôt que de le changer lui-même.
  if (state.hags === 1) {
    parts.push({ name: 'Planification GPU', big: 'Désactivée', text: 'La carte graphique la propose, mais elle n\'est pas activée.', status: 'warn' });
    issues.push({
      title: 'Activer la planification GPU',
      why: 'Avec la « planification GPU à accélération matérielle », la carte graphique organise elle-même ses images : un peu moins de latence, et parfois quelques images par seconde en plus. Votre carte la propose.',
      change: 'Warmup ouvre la page « Graphiques » des paramètres de Windows. Activez « Planification GPU à accélération matérielle », puis redémarrez le PC. Pour revenir en arrière, désactivez-la au même endroit.',
      action: 'Ouvrir les réglages graphiques',
      open: 'reglages-graphiques'
    });
  } else if (state.hags === 2) {
    parts.push({ name: 'Planification GPU', big: 'Activée', text: 'La carte graphique organise elle-même ses images.', status: 'ok' });
  }

  return { parts, issues };
}
