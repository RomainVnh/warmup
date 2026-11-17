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
  /** Écran principal : fréquence actuelle et fréquences possibles dans la définition actuelle, en Hz. */
  display: { hz: number; rates: number[] } | null;
  /** Lecteurs : lettre, type de disque (SSD, HDD ou inconnu), place libre et taille en Go. */
  disks: { letter: string; media: 'SSD' | 'HDD' | 'Inconnu'; freeGb: number; sizeGb: number }[];
  /** Vrai si Windows télécharge des mises à jour en ce moment ; null si Windows ne le dit pas. */
  updatesDownloading: boolean | null;
  /** Mesure des images par seconde : autorisée pour cette session, ou accordée mais en attente d'une reconnexion. */
  fpsAllowed: boolean | null;
  fpsPending: boolean;
  /** Compte Windows en cours (« PC\\Nom »), pour l'autorisation de mesure. */
  user: string | null;
}

export const emptyState = (): TuningState => ({ procs: [], gameMode: null, hags: null, display: null, disks: [], updatesDownloading: null, fpsAllowed: null, fpsPending: false, user: null });

/** Ce que l'évaluation doit savoir de la bibliothèque : où sont les jeux, et si l'outil de mesure est livré. */
export interface TuningContext {
  games: { title: string; folder: string; sizeGb: number }[];
  fpsTool: boolean;
}

/** Groupe « Utilisateurs du journal de performances » de Windows, désigné par son identifiant fixe (le nom change selon la langue). */
export const PERF_LOG_USERS = 'S-1-5-32-559';
export const validUser = (user: unknown): user is string => typeof user === 'string' && /^[\w.\- ]{1,64}\\[\w.\- $]{1,64}$/.test(user);

/**
 * Accès à l'écran principal par l'interface officielle de Windows (EnumDisplaySettings, ChangeDisplaySettingsEx).
 * Code fixe : il lit les modes d'affichage et ne change que la fréquence, dans la définition déjà choisie.
 */
export const DISPLAY_TYPE = `
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class WarmupDisplay {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra; public int dmFields;
    public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
    public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight; public int dmDisplayFlags; public int dmDisplayFrequency;
    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;
  }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplaySettings(string device, int mode, ref DEVMODE dm);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int ChangeDisplaySettingsEx(string device, ref DEVMODE dm, IntPtr hwnd, int flags, IntPtr param);
  static DEVMODE Blank() { DEVMODE dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE)); return dm; }
  public static int Current() { DEVMODE dm = Blank(); EnumDisplaySettings(null, -1, ref dm); return dm.dmDisplayFrequency; }
  public static int[] Rates() {
    DEVMODE now = Blank(); EnumDisplaySettings(null, -1, ref now);
    List<int> list = new List<int>(); DEVMODE dm = Blank();
    for (int i = 0; EnumDisplaySettings(null, i, ref dm); i++) {
      if (dm.dmPelsWidth == now.dmPelsWidth && dm.dmPelsHeight == now.dmPelsHeight && dm.dmBitsPerPel == now.dmBitsPerPel && dm.dmDisplayFrequency > 1 && !list.Contains(dm.dmDisplayFrequency)) list.Add(dm.dmDisplayFrequency);
    }
    return list.ToArray();
  }
  public static int Set(int hz) {
    DEVMODE dm = Blank(); EnumDisplaySettings(null, -1, ref dm);
    dm.dmDisplayFrequency = hz; dm.dmFields = 0x400000;
    return ChangeDisplaySettingsEx(null, ref dm, IntPtr.Zero, 0x01, IntPtr.Zero);
  }
}
'@
`;

// Script fixe, envoyé encodé à PowerShell (aucune valeur venue de l'extérieur n'y entre).
const STATE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$r = [ordered]@{}
$names = @(${HEAVY_EXE.map((exe) => `'${exe}'`).join(', ')})
$r.procs = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and ($names -contains $_.Name.ToLower()) } | ForEach-Object { @{ name = $_.Name.ToLower(); path = $_.ExecutablePath; memMb = [math]::Round($_.WorkingSetSize / 1MB) } })
${DISPLAY_TYPE}
$hz = [WarmupDisplay]::Current()
if ($hz -gt 1) { $r.display = @{ hz = $hz; rates = @([WarmupDisplay]::Rates()) } } else { $r.display = $null }
$g = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name AutoGameModeEnabled
$r.gameMode = if ($g) { [int]$g.AutoGameModeEnabled } else { $null }
$h = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name HwSchMode
$r.hags = if ($h) { [int]$h.HwSchMode } else { $null }
$disks = @()
foreach ($p in @(Get-Partition | Where-Object { $_.DriveLetter })) {
  $d = Get-PhysicalDisk | Where-Object { $_.DeviceId -eq [string]$p.DiskNumber } | Select-Object -First 1
  $v = Get-Volume -DriveLetter $p.DriveLetter
  if ($v -and $v.Size -gt 0) { $disks += @{ letter = [string]$p.DriveLetter; media = [string]$d.MediaType; freeGb = [math]::Round($v.SizeRemaining / 1GB, 1); sizeGb = [math]::Round($v.Size / 1GB, 1) } }
}
$r.disks = $disks
$do = Get-DeliveryOptimizationStatus
$r.updatesDownloading = if ($?) { @($do | Where-Object { [string]$_.Status -eq 'Downloading' }).Count -gt 0 } else { $null }
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$sids = @($id.Groups | ForEach-Object { $_.Value })
$admin = (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$r.fpsAllowed = ($sids -contains '${PERF_LOG_USERS}') -or $admin
$m = @(Get-LocalGroupMember -SID '${PERF_LOG_USERS}' | Where-Object { $_.Name -eq $id.Name })
$r.fpsPending = (-not $r.fpsAllowed) -and ($m.Count -gt 0)
$r.user = $id.Name
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
  const display = raw.display as { hz?: unknown; rates?: unknown } | null | undefined;
  const hz = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 24 && value <= 1000 ? value : null);
  if (display && hz(display.hz)) {
    const rates = list<unknown>(display.rates).map(hz).filter((v): v is number => v !== null);
    state.display = { hz: hz(display.hz)!, rates: [...new Set(rates)].sort((a, b) => a - b) };
  }
  state.disks = list<Record<string, unknown>>(raw.disks)
    .filter((d) => typeof d.letter === 'string' && /^[A-Z]$/i.test(d.letter) && Number(d.sizeGb) > 0)
    .map((d) => ({
      letter: String(d.letter).toUpperCase(),
      media: d.media === 'SSD' || d.media === 'HDD' ? d.media : 'Inconnu',
      freeGb: Math.max(0, Number(d.freeGb) || 0),
      sizeGb: Number(d.sizeGb)
    }));
  state.updatesDownloading = typeof raw.updatesDownloading === 'boolean' ? raw.updatesDownloading : null;
  state.fpsAllowed = typeof raw.fpsAllowed === 'boolean' ? raw.fpsAllowed : null;
  state.fpsPending = raw.fpsPending === true;
  state.user = validUser(raw.user) ? raw.user : null;
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
export function evaluate(state: TuningState, context: TuningContext = { games: [], fpsTool: false }): Tuning {
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

  // Fréquence de l'écran : un écran 144 Hz laissé sur 60 Hz est très courant (après un pilote neuf, un nouveau câble…).
  const best = state.display ? Math.max(state.display.hz, ...state.display.rates) : 0;
  if (state.display && best >= state.display.hz + 10) {
    parts.push({ name: 'Fréquence de l\'écran', big: `${state.display.hz} Hz sur ${best} possibles`, text: `L'écran peut afficher ${best} images par seconde, mais Windows le règle sur ${state.display.hz}.`, status: 'warn' });
    issues.push({
      title: `Passer l'écran à ${best} Hz`,
      why: `Votre écran sait afficher ${best} images par seconde, mais il est réglé sur ${state.display.hz}. Au-delà de ${state.display.hz} images par seconde, le jeu en calcule plus que l'écran n'en montre : tout paraît moins fluide qu'il ne l'est.`,
      change: `Warmup règle l'écran principal sur ${best} Hz, dans la même définition (comme dans Paramètres > Affichage > Affichage avancé). L'écran peut s'éteindre une seconde. « Annuler » dans le journal remet ${state.display.hz} Hz.`,
      action: `Passer à ${best} Hz`,
      fix: 'frequence'
    });
  } else if (state.display) {
    parts.push({ name: 'Fréquence de l\'écran', big: `${state.display.hz} Hz`, text: 'L\'écran est réglé sur sa fréquence la plus haute.', status: 'ok' });
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

  // Disques : de la place pour les mises à jour, et les jeux sur un disque rapide quand il y en a un.
  const driveOf = (folder: string) => /^([A-Z]):/i.exec(folder)?.[1]?.toUpperCase() ?? null;
  const system = (process.env.SystemDrive ?? 'C:').slice(0, 1).toUpperCase();
  const used = new Set([system, ...context.games.map((g) => driveOf(g.folder)).filter((d): d is string => d !== null)]);
  const full = state.disks.filter((d) => used.has(d.letter) && (d.freeGb < 20 || d.freeGb / d.sizeGb < 0.08));
  if (full.length) {
    const names = full.map((d) => `${d.letter}: (${Math.round(d.freeGb)} Go libres)`).join(', ');
    parts.push({ name: 'Place sur les disques', big: `${full.length > 1 ? `${full.length} disques presque pleins` : `${full[0].letter}: presque plein`}`, text: `${names}. Les mises à jour des jeux et le fichier d'échange de Windows ont besoin de place.`, status: 'warn' });
    issues.push({
      title: full.length > 1 ? 'Libérer de la place sur vos disques' : `Libérer de la place sur ${full[0].letter}:`,
      why: `${names}. Quand un disque est presque plein, les mises à jour des jeux échouent et Windows ralentit, faute de place pour sa mémoire de secours.`,
      change: 'Warmup ouvre la page « Stockage » des paramètres de Windows : elle montre ce qui prend de la place et propose de vider les fichiers temporaires. Rien n\'est supprimé sans votre accord.',
      action: 'Ouvrir le stockage de Windows',
      open: 'stockage'
    });
  } else if (state.disks.length) {
    parts.push({ name: 'Place sur les disques', big: 'Suffisante', text: 'Les disques du système et de vos jeux ont de la place pour les mises à jour.', status: 'ok' });
  }
  const ssd = state.disks.filter((d) => d.media === 'SSD');
  const slow = context.games
    .map((g) => ({ ...g, disk: state.disks.find((d) => d.letter === driveOf(g.folder)) }))
    .filter((g) => g.disk?.media === 'HDD' && ssd.some((d) => d.letter !== g.disk!.letter && d.freeGb > g.sizeGb + 20))
    .sort((a, b) => b.sizeGb - a.sizeGb);
  if (slow.length) {
    const target = [...ssd].sort((a, b) => b.freeGb - a.freeGb)[0];
    const names = slow.slice(0, 3).map((g) => g.title).join(', ') + (slow.length > 3 ? ` et ${slow.length - 3} autre${slow.length > 4 ? 's' : ''}` : '');
    parts.push({ name: 'Disque des jeux', big: `${slow.length} jeu${slow.length > 1 ? 'x' : ''} sur disque dur`, text: `${names} : sur un disque dur classique, alors que ${target.letter}: est un SSD avec ${Math.round(target.freeGb)} Go libres.`, status: 'warn' });
    issues.push({
      title: slow.length > 1 ? 'Déplacer vos jeux sur le SSD' : `Déplacer ${slow[0].title} sur le SSD`,
      why: `${names} ${slow.length > 1 ? 'sont installés' : 'est installé'} sur un disque dur classique. Sur le SSD ${target.letter}:, les chargements sont souvent deux à trois fois plus rapides, et les saccades dues au chargement des décors disparaissent.`,
      change: 'Le déplacement se fait par la plateforme du jeu, sans tout retélécharger. Dans Steam : clic droit sur le jeu > Propriétés > Fichiers installés > Déplacer le dossier d\'installation. Warmup ne déplace aucun fichier lui-même.',
      action: 'Voir comment faire'
    });
  }

  // Mises à jour de Windows : un téléchargement en cours prend du débit et du disque pendant la partie.
  if (state.updatesDownloading === true) {
    parts.push({ name: 'Mises à jour Windows', big: 'Téléchargement en cours', text: 'Windows télécharge des mises à jour en arrière-plan.', status: 'warn' });
    issues.push({
      title: 'Suspendre les mises à jour de Windows pendant le jeu',
      why: 'Windows télécharge des mises à jour en ce moment. Pendant une partie en ligne, ce téléchargement prend du débit (ping plus haut, saccades) et sollicite le disque.',
      change: 'Warmup ouvre la page « Windows Update ». Cliquez sur « Suspendre pendant 1 semaine », ou laissez le téléchargement finir avant de jouer. La reprise se fait au même endroit.',
      action: 'Ouvrir Windows Update',
      open: 'windows-update'
    });
  } else if (state.updatesDownloading === false) {
    parts.push({ name: 'Mises à jour Windows', big: 'Rien en cours', text: 'Aucun téléchargement de Windows ne gêne le jeu.', status: 'ok' });
  }

  // Images par seconde : Windows réserve leur mesure aux administrateurs et au groupe « Utilisateurs du journal de performances ».
  if (context.fpsTool && state.fpsAllowed !== null) {
    if (state.fpsAllowed) {
      parts.push({ name: 'Mesure des images', big: 'Autorisée', text: 'Warmup peut mesurer les images par seconde pendant vos parties.', status: 'ok' });
    } else if (state.fpsPending) {
      parts.push({ name: 'Mesure des images', big: 'Reconnexion nécessaire', text: 'L\'autorisation est donnée : elle prendra effet à votre prochaine connexion à Windows.', status: 'warn' });
    } else {
      parts.push({ name: 'Mesure des images', big: 'Non autorisée', text: 'Windows ne laisse pas encore Warmup mesurer les images par seconde.', status: 'warn' });
      issues.push({
        title: 'Autoriser la mesure des images par seconde',
        why: 'Windows réserve le compteur d\'images aux administrateurs et au groupe « Utilisateurs du journal de performances ». Sans cette autorisation, les bilans n\'ont ni images par seconde ni chutes.',
        change: 'Warmup ajoute votre compte Windows à ce groupe. Windows vous demande votre accord, puis l\'autorisation prend effet à votre prochaine connexion. Rien n\'est lu dans les jeux. « Annuler » dans le journal retire votre compte du groupe.',
        action: 'Autoriser la mesure',
        fix: 'mesure-fps'
      });
    }
  }

  return { parts, issues };
}
