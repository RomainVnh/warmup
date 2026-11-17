import type { RawTimeline, ReportMark, ReportTimeline } from './types';

// Déroulé d'une partie : images par seconde, ping et température, relevés toutes les cinq secondes,
// puis les moments où ça a décroché. Le même calcul sert aux vraies parties et aux bilans d'exemple.

/** Seuils au-delà desquels un moment est marqué sur le graphique. */
export const FPS_DROP = 0.6; // moins de 60 % des images par seconde habituelles
export const FPS_FLOOR = 20; // en dessous de 20 images par seconde de moyenne, on ne parle plus de chute
export const PING_HIGH = 150; // ms
export const TEMP_HIGH = 87; // °C
const MAX_POINTS = 120;
const MAX_MARKS = 8;

const numbers = (values: (number | null)[]) => values.filter((v): v is number => v !== null);

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Regroupe les relevés pour garder `max` points au plus, sans effacer les problèmes :
 * pour chaque groupe, on garde les images par seconde les plus basses, le ping et la température les plus hauts.
 * Un ping sans réponse (null) l'emporte quand la moitié du groupe est restée sans réponse.
 */
export function thinTimeline(raw: RawTimeline, max = MAX_POINTS): RawTimeline {
  const length = Math.max(raw.fps.length, raw.ping.length, raw.temp.length);
  if (length <= max) return raw;
  const size = Math.ceil(length / max);
  const group = <T>(list: (number | null)[], pick: (values: number[]) => T, lost?: boolean) => {
    const out: (number | null)[] = [];
    for (let i = 0; i < length; i += size) {
      const slice = list.slice(i, i + size);
      const found = numbers(slice);
      if (lost && slice.length && slice.filter((v) => v === null).length * 2 >= slice.length && found.length < slice.length) out.push(null);
      else out.push(found.length ? (pick(found) as number) : null);
    }
    return out;
  };
  return {
    step: raw.step * size,
    fps: raw.fps.length ? group(raw.fps, (v) => Math.min(...v)) : [],
    ping: raw.ping.length ? group(raw.ping, (v) => Math.max(...v), true) : [],
    temp: raw.temp.length ? group(raw.temp, (v) => Math.max(...v)) : []
  };
}

/** Moments à signaler : une suite de points hors limite ne donne qu'une marque, au point le plus marqué. */
function runs(values: (number | null)[], bad: (v: number | null) => boolean, worst: (a: number | null, b: number | null) => boolean): number[] {
  const found: number[] = [];
  let current = -1;
  values.forEach((v, i) => {
    if (!bad(v)) {
      current = -1;
      return;
    }
    if (current < 0) {
      found.push(i);
      current = found.length - 1;
    } else if (worst(v, values[found[current]])) {
      found[current] = i;
    }
  });
  return found;
}

/** Graphique du bilan à partir des relevés d'une partie ; null s'il n'y a rien à tracer. */
export function reportTimeline(raw: RawTimeline | undefined, start: number, clock: (at: number) => string): ReportTimeline | null {
  if (!raw) return null;
  const t = thinTimeline(raw);
  const length = Math.max(t.fps.length, t.ping.length, t.temp.length);
  if (length < 3) return null;
  const at = (index: number) => clock(start + index * t.step * 1000);
  const marks: ReportMark[] = [];

  const fpsValues = numbers(t.fps);
  const usual = Math.round(median(fpsValues));
  if (fpsValues.length >= 3 && usual >= FPS_FLOOR) {
    for (const i of runs(t.fps, (v) => v !== null && v < usual * FPS_DROP, (a, b) => (a ?? 0) < (b ?? 0))) {
      marks.push({ index: i, kind: 'fps', time: at(i), text: `Chute à ${t.fps[i]} images par seconde (${usual} d'habitude)` });
    }
  }
  const answered = numbers(t.ping);
  if (answered.length) {
    for (const i of runs(t.ping, (v) => v === null || v >= PING_HIGH, (a, b) => a === null || (b !== null && a > b))) {
      marks.push({ index: i, kind: 'ping', time: at(i), text: t.ping[i] === null ? 'Le réseau n\'a plus répondu' : `Ping monté à ${t.ping[i]} ms` });
    }
  }
  for (const i of runs(t.temp, (v) => v !== null && v >= TEMP_HIGH, (a, b) => (a ?? 0) > (b ?? 0))) {
    marks.push({ index: i, kind: 'temp', time: at(i), text: `Carte graphique à ${t.temp[i]} °C` });
  }
  // Les plus marquants d'abord s'il y en a trop, puis dans l'ordre de la partie.
  const kept = marks.slice(0, MAX_MARKS).sort((a, b) => a.index - b.index);

  const series: ReportTimeline['series'] = [];
  if (fpsValues.length) series.push({ key: 'fps', label: 'Images par seconde', unit: 'i/s', values: t.fps, limit: Math.round(usual * FPS_DROP), above: false });
  if (answered.length) series.push({ key: 'ping', label: 'Ping', unit: 'ms', values: t.ping, limit: PING_HIGH, above: true });
  if (numbers(t.temp).length) series.push({ key: 'temp', label: 'Carte graphique', unit: '°C', values: t.temp, limit: TEMP_HIGH, above: true });
  if (!series.length) return null;
  const ticks = 5;
  return {
    axis: Array.from({ length: ticks }, (_, i) => at(Math.round((i * (length - 1)) / (ticks - 1)))),
    length,
    series,
    marks: kept
  };
}
