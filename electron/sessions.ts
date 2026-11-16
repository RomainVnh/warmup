import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { SessionRecord } from '../shared/types';
import { pathKey } from './detect/files';
import { readJson, writeJson } from './store';

// Suivi des vraies parties, de l'extérieur du jeu : Warmup regarde seulement la liste des programmes ouverts.
// Une partie commence quand un programme rangé dans le dossier du jeu apparaît, et finit quand il n'y en a plus.
// Pendant la partie, il relève la mémoire utilisée par le jeu et la charge du processeur. Il ne lit rien dans le jeu.

const FILE = 'sessions.json';
const POLL_MS = 5000;
/** Délai laissé au jeu pour apparaître après le lancement (certains passent par leur plateforme). */
const WAIT_MS = 5 * 60_000;
const MAX_RECORDS = 1000;

export interface Proc { path: string; memMb: number }

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 15_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

/** Réponse de Windows : liste des programmes ouverts, avec leur emplacement et leur mémoire. */
export function parseWindowsProcesses(json: string): Proc[] {
  try {
    const raw: unknown = JSON.parse(json);
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .filter((p): p is { ExecutablePath: string; WorkingSetSize?: number } => Boolean(p) && typeof (p as { ExecutablePath?: unknown }).ExecutablePath === 'string')
      .map((p) => ({ path: p.ExecutablePath, memMb: Math.round((Number(p.WorkingSetSize) || 0) / 1024 ** 2) }));
  } catch {
    return [];
  }
}

/** Sortie de « ps -axo rss=,comm= » (Mac, Linux) : mémoire en Ko, puis emplacement du programme. */
export function parsePs(text: string): Proc[] {
  const list: Proc[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s+(\/.+)$/.exec(line);
    if (match) list.push({ path: match[2].trim(), memMb: Math.round(Number(match[1]) / 1024) });
  }
  return list;
}

// Commande fixe : emplacement et mémoire de chaque programme ouvert.
const WINDOWS_QUERY = 'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | Select-Object ExecutablePath,WorkingSetSize | ConvertTo-Json -Compress';

async function listProcesses(): Promise<Proc[]> {
  if (process.platform === 'win32') {
    const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return parseWindowsProcesses(await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_QUERY]));
  }
  return parsePs(await run('/bin/ps', ['-axo', 'rss=,comm=']));
}

/** Programmes rangés dans le dossier du jeu. */
export function insideFolder(procs: Proc[], folder: string): Proc[] {
  const root = pathKey(folder);
  return procs.filter((p) => {
    const key = pathKey(p.path);
    return key.startsWith(`${root}/`) || key.startsWith(`${root}\\`);
  });
}

/** Garde `max` valeurs au plus, réparties sur toute la partie. */
export function thin(values: number[], max = 48): number[] {
  if (values.length <= max) return values;
  return Array.from({ length: max }, (_, i) => values[Math.round((i * (values.length - 1)) / (max - 1))]);
}

const isRecord = (value: unknown): value is SessionRecord => {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.gameId === 'string' && /^[a-z0-9-]{1,60}$/.test(s.gameId) && typeof s.start === 'number' && typeof s.end === 'number' && typeof s.seconds === 'number' && Array.isArray(s.samples);
};

export function cleanSessions(input: unknown): SessionRecord[] {
  return Array.isArray(input) ? input.filter(isRecord).slice(-MAX_RECORDS) : [];
}

let records: SessionRecord[] = [];
export const loadSessions = (): void => {
  records = cleanSessions(readJson(FILE));
};
export const allSessions = (): SessionRecord[] => records;

/** Part des cœurs occupée entre deux relevés, en pour cent. */
function cpuNow(): { busy: number; total: number } {
  let busy = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    busy += t.user + t.nice + t.sys + t.irq;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { busy, total };
}

interface Watch {
  gameId: string;
  folder: string;
  launchedAt: number;
  start: number | null;
  lastSeen: number;
  misses: number;
  mem: number[];
  cpu: number[];
  lastCpu: { busy: number; total: number };
  timer: ReturnType<typeof setInterval>;
  onEnd: (record: SessionRecord | null) => void;
}

let watch: Watch | null = null;

function finish(): void {
  if (!watch) return;
  const w = watch;
  clearInterval(w.timer);
  watch = null;
  if (w.start === null) return w.onEnd(null); // le jeu n'est jamais apparu
  const seconds = Math.max(1, Math.round((w.lastSeen - w.start) / 1000));
  const record: SessionRecord = {
    id: `${w.gameId}-${w.start}`.slice(0, 80),
    gameId: w.gameId,
    start: w.start,
    end: w.lastSeen,
    seconds,
    peakMemMb: w.mem.length ? Math.max(...w.mem) : null,
    avgCpu: w.cpu.length ? Math.round(w.cpu.reduce((a, b) => a + b, 0) / w.cpu.length) : null,
    samples: thin(w.mem)
  };
  records = [...records, record].slice(-MAX_RECORDS);
  writeJson(FILE, records);
  w.onEnd(record);
}

async function poll(): Promise<void> {
  const w = watch;
  if (!w) return;
  const mine = insideFolder(await listProcesses(), w.folder);
  if (watch !== w) return; // un autre lancement a pris le relais pendant le relevé
  const now = Date.now();
  if (mine.length) {
    if (w.start === null) w.start = now;
    w.lastSeen = now;
    w.misses = 0;
    w.mem.push(mine.reduce((sum, p) => sum + p.memMb, 0));
    const cpu = cpuNow();
    const total = cpu.total - w.lastCpu.total;
    if (total > 0) w.cpu.push(((cpu.busy - w.lastCpu.busy) / total) * 100);
    w.lastCpu = cpu;
  } else if (w.start !== null) {
    w.misses += 1;
    if (w.misses >= 2) finish(); // deux relevés de suite sans le jeu : la partie est finie
  } else if (now - w.launchedAt > WAIT_MS) {
    finish();
  }
}

/** Commence à suivre un jeu qui vient d'être lancé. `onEnd` reçoit la partie mesurée, ou null si le jeu n'est jamais apparu. */
export function trackGame(gameId: string, folder: string, onEnd: (record: SessionRecord | null) => void = () => undefined): void {
  if (watch?.gameId === gameId) return;
  finish(); // un seul jeu suivi à la fois
  watch = {
    gameId,
    folder,
    launchedAt: Date.now(),
    start: null,
    lastSeen: Date.now(),
    misses: 0,
    mem: [],
    cpu: [],
    lastCpu: cpuNow(),
    timer: setInterval(() => void poll(), POLL_MS),
    onEnd
  };
}

export const stopTracking = (): void => finish();
