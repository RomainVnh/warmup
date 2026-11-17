import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, screen } from 'electron';
import type { OpenTarget, PcIssue, PcPart, PcReport } from '../shared/types';

// Lecture du matériel, en lecture seule : écran, carte graphique, processeur, mémoire, disque, système.
// Sous Windows, deux interrogations fixes de Windows (aucune commande libre) complètent ce que donne Electron.

interface WindowsInfo {
  gpu: { Name?: string; DriverVersion?: string; DriverDate?: string }[];
  ram: { Capacity?: number; Speed?: number; ConfiguredClockSpeed?: number }[];
  os: { Caption?: string; BuildNumber?: string } | null;
}

// Commande fixe : liste des cartes graphiques, des barrettes de mémoire et version de Windows, au format JSON.
const WINDOWS_QUERY = [
  '$g = @(Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,DriverDate);',
  '$r = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed);',
  '$o = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,BuildNumber;',
  '@{ gpu = $g; ram = $r; os = $o } | ConvertTo-Json -Compress -Depth 3'
].join(' ');

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 10_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

export function parseWindowsInfo(json: string): WindowsInfo {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : value && typeof value === 'object' ? [value as T] : []);
    return { gpu: list(raw.gpu), ram: list(raw.ram), os: raw.os && typeof raw.os === 'object' ? (raw.os as WindowsInfo['os']) : null };
  } catch {
    return { gpu: [], ram: [], os: null };
  }
}

async function windowsInfo(): Promise<WindowsInfo> {
  if (process.platform !== 'win32') return { gpu: [], ram: [], os: null };
  const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return parseWindowsInfo(await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_QUERY]));
}

async function macGpu(): Promise<string> {
  if (process.platform !== 'darwin') return '';
  try {
    const data = JSON.parse(await run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json'])) as { SPDisplaysDataType?: { sppci_model?: string }[] };
    return data.SPDisplaysDataType?.[0]?.sppci_model ?? '';
  } catch {
    return '';
  }
}

const VENDORS: Record<number, string> = { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x8086: 'Intel', 0x106b: 'Apple' };

/** Date au format de PowerShell (« /Date(1700000000000)/ ») ou ISO, en millisecondes. */
export function driverTime(value: string | undefined): number | null {
  if (!value) return null;
  const ms = /\/Date\((\d+)/.exec(value)?.[1];
  const time = ms ? Number(ms) : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const gb = (bytes: number) => Math.round(bytes / 1024 ** 3);

/** Choisit la carte graphique principale : une carte dédiée plutôt que la puce intégrée ou un adaptateur virtuel. */
export function mainGpu(gpus: WindowsInfo['gpu']): WindowsInfo['gpu'][number] | undefined {
  const real = gpus.filter((g) => g.Name && !/basic|virtual|remote|parsec|meta/i.test(g.Name));
  return real.find((g) => /nvidia|geforce|rtx|radeon|amd|arc/i.test(g.Name ?? '')) ?? real[0];
}

/** Fabricant d'une carte graphique, d'après son nom, et la page officielle de ses pilotes. */
export function driverVendor(name: string): { name: string; target: OpenTarget } | null {
  if (/nvidia|geforce|quadro|rtx|gtx/i.test(name)) return { name: 'NVIDIA', target: 'pilote-nvidia' };
  if (/amd|radeon/i.test(name)) return { name: 'AMD', target: 'pilote-amd' };
  if (/intel|arc|iris|uhd/i.test(name)) return { name: 'Intel', target: 'pilote-intel' };
  return null;
}

export async function readPc(): Promise<PcReport> {
  const [win, macModel] = await Promise.all([windowsInfo(), macGpu()]);
  const parts: PcPart[] = [];

  // Écran
  const displays = screen.getAllDisplays();
  const main = screen.getPrimaryDisplay();
  const width = Math.round(main.size.width * main.scaleFactor);
  const height = Math.round(main.size.height * main.scaleFactor);
  const hz = Math.round(main.displayFrequency || 0);
  parts.push({
    name: 'Écran',
    big: hz ? `${hz} Hz actifs` : `${width} × ${height}`,
    text: `${width} × ${height}${displays.length > 1 ? `, ${plural(displays.length, 'écran branché', 'écrans branchés')}` : ''}.${hz && hz <= 60 ? ' Si votre écran monte plus haut, réglez-le dans les paramètres d\'affichage.' : ''}`,
    status: 'ok'
  });

  // Carte graphique
  const gpu = mainGpu(win.gpu);
  let gpuName = gpu?.Name?.trim() ?? macModel;
  if (!gpuName) {
    try {
      const info = (await app.getGPUInfo('basic')) as { gpuDevice?: { vendorId?: number; active?: boolean }[] };
      const device = info.gpuDevice?.find((d) => d.active) ?? info.gpuDevice?.[0];
      gpuName = device?.vendorId ? `Carte ${VENDORS[device.vendorId] ?? 'graphique'}` : '';
    } catch {
      gpuName = '';
    }
  }
  const driverAt = driverTime(gpu?.DriverDate);
  const driverDays = driverAt ? Math.floor((Date.now() - driverAt) / 86_400_000) : null;
  // Les fabricants publient un pilote chaque mois ou presque : au-delà de six mois, les jeux récents en profitent.
  const oldDriver = driverDays !== null && driverDays > 180;
  parts.push({
    name: 'Carte graphique',
    big: gpuName || 'Non reconnue',
    text: driverDays === null
      ? 'Pilote fourni par le système.'
      : oldDriver
        ? `Pilote installé il y a ${driverDays > 365 ? 'plus d\'un an' : `${Math.floor(driverDays / 30)} mois`} (version ${gpu?.DriverVersion ?? 'inconnue'}). Une version récente améliore souvent les jeux.`
        : `Pilote ${gpu?.DriverVersion ?? ''} installé il y a ${driverDays < 1 ? 'moins d\'un jour' : plural(driverDays, 'jour', 'jours')}.`,
    status: oldDriver ? 'warn' : 'ok'
  });

  const issues: PcIssue[] = [];
  const vendor = driverVendor(gpuName);
  if (oldDriver && vendor) {
    issues.push({
      title: 'Mettre à jour le pilote graphique',
      why: `Le pilote de votre ${gpuName} date de ${driverDays > 365 ? 'plus d\'un an' : `${Math.floor(driverDays / 30)} mois`}. Les fabricants corrigent chaque mois des plantages et des baisses d'images par seconde dans les jeux récents.`,
      change: `Warmup ouvre la page officielle de ${vendor.name}, qui reconnaît votre carte et propose le bon pilote. L'installation se fait par le programme du fabricant ; Warmup ne télécharge rien lui-même.`,
      action: `Ouvrir la page de ${vendor.name}`,
      open: vendor.target
    });
  }

  // Processeur
  const cpus = os.cpus();
  parts.push({
    name: 'Processeur',
    big: (cpus[0]?.model ?? 'Processeur').replace(/\(R\)|\(TM\)|CPU|Processor|\s+@.*$/gi, '').replace(/\s+/g, ' ').trim(),
    text: `${plural(cpus.length, 'cœur logique', 'cœurs logiques')}.`,
    status: 'ok'
  });

  // Mémoire vive
  const total = gb(os.totalmem());
  const speeds = win.ram.map((r) => r.ConfiguredClockSpeed || r.Speed || 0).filter((s) => s > 0);
  const speed = speeds.length ? Math.min(...speeds) : 0;
  parts.push({
    name: 'Mémoire vive',
    big: speed ? `${total} Go à ${speed} MHz` : `${total} Go`,
    text: total < 8
      ? 'Moins de 8 Go : la plupart des jeux récents en demandent 16.'
      : win.ram.length ? `${plural(win.ram.length, 'barrette', 'barrettes')}.` : 'Quantité installée sur ce PC.',
    status: total < 8 ? 'warn' : 'ok'
  });

  // Stockage
  try {
    const root = process.platform === 'win32' ? `${process.env.SystemDrive ?? 'C:'}\\` : '/';
    const stat = await fs.promises.statfs(root);
    const free = gb(stat.bavail * stat.bsize);
    const size = gb(stat.blocks * stat.bsize);
    parts.push({
      name: 'Stockage',
      big: `${free} Go libres`,
      text: free < 50 ? `Sur ${size} Go. Moins de 50 Go libres : les mises à jour des jeux risquent de manquer de place.` : `Sur ${size} Go, disque du système.`,
      status: free < 50 ? 'warn' : 'ok'
    });
  } catch {
    // Disque illisible : on ne l'affiche pas plutôt que d'inventer une valeur.
  }

  // Système
  const system = win.os?.Caption?.replace(/^Microsoft\s+/, '').trim()
    || (process.platform === 'darwin' ? `macOS (noyau ${os.release()})` : `${os.type()} ${os.release()}`);
  parts.push({ name: 'Système', big: system, text: win.os?.BuildNumber ? `Version ${win.os.BuildNumber}.` : 'Version reconnue.', status: 'ok' });

  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return { example: false, checkedAt: `Contrôlé à ${time}`, parts, issues };
}
