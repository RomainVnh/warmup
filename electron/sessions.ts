import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { SessionRecord } from '../shared/types';
import { pathKey } from './detect/files';
import { watchFps, type FpsMissing, type FpsWatch } from './fps';
import { thinTimeline } from '../shared/timeline';
import { readJson, writeJson } from './store';

// Suivi des vraies parties, de l'extérieur du jeu : Warmup regarde seulement la liste des programmes ouverts.
// Une partie commence quand un programme rangé dans le dossier du jeu apparaît, et finit quand il n'y en a plus.
// Pendant la partie, il relève la mémoire utilisée par le jeu, la charge du processeur et, sous Windows, les images
// par seconde (electron/fps.ts, par les compteurs de Windows). Il ne lit rien dans le jeu.

const FILE = 'sessions.json';
const POLL_MS = 5000;
/** Délai laissé au jeu pour apparaître après le lancement (certains passent par leur plateforme). */
const WAIT_MS = 5 * 60_000;
const MAX_RECORDS = 1000;

export interface Proc { path: string; memMb: number; pid?: number }

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
      .filter((p): p is { ExecutablePath: string; WorkingSetSize?: number; ProcessId?: number } => Boolean(p) && typeof (p as { ExecutablePath?: unknown }).ExecutablePath === 'string')
      .map((p) => {
        const proc: Proc = { path: p.ExecutablePath, memMb: Math.round((Number(p.WorkingSetSize) || 0) / 1024 ** 2) };
        if (Number.isInteger(p.ProcessId) && Number(p.ProcessId) > 0) proc.pid = Number(p.ProcessId);
        return proc;
      });
  } catch {
    return [];
  }
}

/** Sortie de « ps -axo pid=,rss=,comm= » (Mac, Linux) : numéro du programme (facultatif), mémoire en Ko, emplacement. */
export function parsePs(text: string): Proc[] {
  const list: Proc[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(?:(\d+)\s+)?(\d+)\s+(\/.+)$/.exec(line);
    if (!match) continue;
    const proc: Proc = { path: match[3].trim(), memMb: Math.round(Number(match[2]) / 1024) };
    if (match[1]) proc.pid = Number(match[1]);
    list.push(proc);
  }
  return list;
}

// Commande fixe : emplacement et mémoire de chaque programme ouvert.
const WINDOWS_QUERY = 'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | Select-Object ProcessId,ExecutablePath,WorkingSetSize | ConvertTo-Json -Compress';

async function listProcesses(): Promise<Proc[]> {
  if (process.platform === 'win32') {
    const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return parseWindowsProcesses(await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_QUERY]));
  }
  return parsePs(await run('/bin/ps', ['-axo', 'pid=,rss=,comm=']));
}

/** Temps de réponse lu dans la sortie de « ping » (Windows en français ou en anglais, Mac, Linux) ; null sans réponse. */
export function parsePing(text: string): number | null {
  const match = /(?:time|temps)\s*[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i.exec(text);
  return match ? Math.round(Number(match[1].replace(',', '.'))) : null;
}

/** Sortie de « nvidia-smi --query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits » : « 67, 93 ». */
export function parseNvidia(text: string): { temp: number; load: number } | null {
  const match = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/m.exec(text);
  return match ? { temp: Number(match[1]), load: Number(match[2]) } : null;
}

// Réseau : un seul essai vers un serveur public (Cloudflare), à chaque relevé. Aucune donnée du joueur n'est envoyée.
const PING_TARGET = '1.1.1.1';
async function pingOnce(): Promise<number | null> {
  const windows = process.platform === 'win32';
  const file = windows ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'PING.EXE') : '/sbin/ping';
  const args = windows ? ['-n', '1', '-w', '1500', PING_TARGET] : process.platform === 'darwin' ? ['-c', '1', '-W', '1500', PING_TARGET] : ['-c', '1', '-W', '2', PING_TARGET];
  return parsePing(await run(file, args));
}

// Carte graphique : l'outil fourni avec les pilotes NVIDIA, s'il est présent. Sans lui, rien n'est relevé.
let nvidiaMissing = false;
async function gpuOnce(): Promise<{ temp: number; load: number } | null> {
  if (nvidiaMissing || process.platform !== 'win32') return null;
  const tool = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'nvidia-smi.exe');
  const out = await run(tool, ['--query-gpu=temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits']);
  if (!out) nvidiaMissing = true;
  return parseNvidia(out);
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
  /** Un essai par relevé : temps en ms, ou null sans réponse. */
  pings: (number | null)[];
  gpuTemps: number[];
  gpuLoads: number[];
  /** Images par seconde de chaque relevé (null : aucune image vue), et la mesure en cours. */
  fps: (number | null)[];
  fpsWatch: FpsWatch | null;
  /** Relevés alignés pour le graphique : un point par relevé pendant la partie. */
  line: { fps: (number | null)[]; ping: (number | null)[]; temp: (number | null)[] };
  lastCpu: { busy: number; total: number };
  timer: ReturnType<typeof setInterval>;
  onEnd: (record: SessionRecord | null) => void;
}

let watch: Watch | null = null;

/** Emplacement de PresentMon, fixé par la partie système au démarrage (null s'il n'est pas livré). */
let fpsTool: string | null = null;
export const setFpsTool = (file: string | null): void => {
  fpsTool = file;
};

function finish(): void {
  if (!watch) return;
  const w = watch;
  clearInterval(w.timer);
  watch = null;
  if (w.start === null) {
    w.fpsWatch?.stop();
    return w.onEnd(null); // le jeu n'est jamais apparu
  }
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
  const answered = w.pings.filter((p): p is number => p !== null);
  if (w.pings.length >= 3 && answered.length) {
    record.ping = {
      avg: Math.round(answered.reduce((a, b) => a + b, 0) / answered.length),
      max: Math.max(...answered),
      lossPercent: Math.round(((w.pings.length - answered.length) / w.pings.length) * 100),
      samples: thin(answered)
    };
  }
  const frames = w.fpsWatch?.stats.summary() ?? null;
  const missing: FpsMissing | null = w.fpsWatch ? w.fpsWatch.missing() : process.platform !== 'win32' ? 'windows' : fpsTool ? 'echec' : 'absent';
  w.fpsWatch?.stop();
  if (frames) record.fps = { ...frames, samples: thin(w.fps.filter((v): v is number => v !== null)) };
  else if (missing) record.fpsMissing = missing;
  // Graphique : seules les mesures réellement relevées sont gardées.
  const has = (list: (number | null)[]) => list.some((v) => v !== null);
  if (w.line.ping.length >= 3 && (has(w.line.fps) || has(w.line.ping) || has(w.line.temp))) {
    record.timeline = thinTimeline({ step: POLL_MS / 1000, fps: has(w.line.fps) ? w.line.fps : [], ping: has(w.line.ping) ? w.line.ping : [], temp: has(w.line.temp) ? w.line.temp : [] });
  }
  if (w.gpuTemps.length) record.gpu = { maxTemp: Math.max(...w.gpuTemps), avgLoad: Math.round(w.gpuLoads.reduce((a, b) => a + b, 0) / w.gpuLoads.length) };
  records = [...records, record].slice(-MAX_RECORDS);
  writeJson(FILE, records);
  w.onEnd(record);
}

async function poll(): Promise<void> {
  const w = watch;
  if (!w) return;
  const [procs, ping, gpu] = await Promise.all([listProcesses(), w.start !== null ? pingOnce() : Promise.resolve(undefined), w.start !== null ? gpuOnce() : Promise.resolve(null)]);
  const mine = insideFolder(procs, w.folder);
  if (watch !== w) return; // un autre lancement a pris le relais pendant le relevé
  const now = Date.now();
  if (mine.length) {
    if (w.start === null) {
      w.start = now;
      // Images par seconde : le programme du jeu qui occupe le plus de mémoire est celui qui affiche les images.
      const main = [...mine].sort((a, b) => b.memMb - a.memMb).find((p) => p.pid);
      if (main?.pid) w.fpsWatch = watchFps(fpsTool, main.pid);
    } else {
      const fps = w.fpsWatch ? w.fpsWatch.stats.takeWindow() : null;
      if (w.fpsWatch) w.fps.push(fps);
      w.line.fps.push(fps);
      w.line.ping.push(ping ?? null);
      w.line.temp.push(gpu ? gpu.temp : null);
    }
    w.lastSeen = now;
    w.misses = 0;
    w.mem.push(mine.reduce((sum, p) => sum + p.memMb, 0));
    const cpu = cpuNow();
    const total = cpu.total - w.lastCpu.total;
    if (total > 0) w.cpu.push(((cpu.busy - w.lastCpu.busy) / total) * 100);
    w.lastCpu = cpu;
    if (ping !== undefined) w.pings.push(ping);
    if (gpu) {
      w.gpuTemps.push(gpu.temp);
      w.gpuLoads.push(gpu.load);
    }
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
    pings: [],
    gpuTemps: [],
    gpuLoads: [],
    fps: [],
    fpsWatch: null,
    line: { fps: [], ping: [], temp: [] },
    lastCpu: cpuNow(),
    timer: setInterval(() => void poll(), POLL_MS),
    onEnd
  };
}

export const stopTracking = (): void => finish();
