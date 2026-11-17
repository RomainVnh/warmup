import { reportTimeline } from './timeline';
import type { FixEffect, JournalEntry, SessionRecord } from './types';

// Effet des corrections, mesuré sur de vraies parties : Warmup compare les parties d'avant et d'après.
// Deux cas :
// - une correction qui reste en place (mode Jeu, fréquence de l'écran) : parties avant / après, jeu par jeu ;
// - une correction appliquée à chaque lancement (mode d'alimentation, programmes fermés) : parties avec / sans.
// Pour être juste, on ne compare un jeu qu'à lui-même : un jeu léger ne doit pas faire croire à un gain.

const LASTING = ['mode-jeu', 'frequence'];
const PER_LAUNCH = ['alimentation', 'programmes'];
const WINDOW = 30 * 86_400_000; // parties de référence : les 30 jours précédant la correction
const MIN_SECONDS = 120; // une partie trop courte ne dit rien des performances

interface Stats { fps: number | null; low1: number | null; ping: number | null; drops: number | null; incidents: number; count: number }

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

function stats(list: SessionRecord[], bad: (s: SessionRecord) => boolean): Stats {
  const hours = list.reduce((sum, s) => sum + s.seconds, 0) / 3600;
  const withLine = list.filter((s) => s.timeline);
  const drops = withLine.reduce((sum, s) => sum + (reportTimeline(s.timeline, s.start, () => '')?.marks.length ?? 0), 0);
  const lineHours = withLine.reduce((sum, s) => sum + s.seconds, 0) / 3600;
  return {
    fps: mean(list.flatMap((s) => (s.fps ? [s.fps.avg] : []))),
    low1: mean(list.flatMap((s) => (s.fps ? [s.fps.low1] : []))),
    ping: mean(list.flatMap((s) => (s.ping ? [s.ping.avg] : []))),
    drops: lineHours >= 0.2 ? drops / lineHours : null,
    incidents: list.length ? list.filter(bad).length / list.length : 0,
    count: hours > 0 ? list.length : 0
  };
}

const kindOf = (entry: JournalEntry) => entry.id.replace(/-\d+$/, '');
const round = (n: number) => Math.round(n);
const pct = (before: number, after: number) => Math.round(((after - before) / before) * 100);
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/** Compare deux groupes de parties d'un même jeu, puis fait la moyenne des jeux comparés. */
function compare(pairs: { before: SessionRecord[]; after: SessionRecord[] }[], bad: (s: SessionRecord) => boolean) {
  const usable = pairs.filter((p) => p.before.length && p.after.length);
  const both = usable.map((p) => ({ b: stats(p.before, bad), a: stats(p.after, bad) }));
  const avg = (pick: (s: Stats) => number | null) => {
    const found = both.filter((x) => pick(x.b) !== null && pick(x.a) !== null);
    return found.length ? { before: mean(found.map((x) => pick(x.b)!))!, after: mean(found.map((x) => pick(x.a)!))! } : null;
  };
  return {
    games: usable.length,
    before: usable.reduce((n, p) => n + p.before.length, 0),
    after: usable.reduce((n, p) => n + p.after.length, 0),
    fps: avg((s) => s.fps),
    low1: avg((s) => s.low1),
    ping: avg((s) => s.ping),
    drops: avg((s) => s.drops),
    incidents: avg((s) => s.incidents)
  };
}

/** Effet d'une comparaison, en phrases simples ; null s'il n'y a pas encore assez de parties. */
function describe(c: ReturnType<typeof compare>, words: { before: string; after: string }): Pick<FixEffect, 'headline' | 'lines' | 'better'> | null {
  if (!c.games) return null;
  const lines: string[] = [];
  let score = 0;
  if (c.fps && c.fps.before > 0) {
    const change = pct(c.fps.before, c.fps.after);
    lines.push(`Images par seconde : ${round(c.fps.before)} → ${round(c.fps.after)} (${signed(change)} %)`);
    score += change >= 3 ? 2 : change <= -3 ? -2 : 0;
  }
  if (c.low1 && c.low1.before > 0) {
    const change = pct(c.low1.before, c.low1.after);
    lines.push(`Moments les plus lents : ${round(c.low1.before)} → ${round(c.low1.after)} images par seconde`);
    score += change >= 5 ? 1 : change <= -5 ? -1 : 0;
  }
  if (c.drops) {
    lines.push(`Chutes : ${c.drops.before.toFixed(1).replace('.', ',')} → ${c.drops.after.toFixed(1).replace('.', ',')} par heure de jeu`);
    score += c.drops.after < c.drops.before * 0.8 ? 1 : c.drops.after > c.drops.before * 1.25 ? -1 : 0;
  }
  if (c.ping) lines.push(`Ping moyen : ${round(c.ping.before)} → ${round(c.ping.after)} ms`);
  if (c.incidents && (c.incidents.before > 0 || c.incidents.after > 0)) {
    lines.push(`Parties avec un incident : ${round(c.incidents.before * 100)} % → ${round(c.incidents.after * 100)} %`);
    score += c.incidents.after < c.incidents.before ? 1 : c.incidents.after > c.incidents.before ? -1 : 0;
  }
  if (!lines.length) return null;
  const fps = c.fps && c.fps.before > 0 ? pct(c.fps.before, c.fps.after) : null;
  const headline = score > 0
    ? fps !== null && fps >= 3 ? `${signed(fps)} % d'images par seconde ${words.after}` : `Parties plus régulières ${words.after}`
    : score < 0 ? `Pas d'amélioration ${words.after} : à surveiller` : `Aucune différence nette ${words.after}`;
  return { headline, lines, better: score > 0 ? true : score < 0 ? false : null };
}

/** Effet de chaque correction du journal, par identifiant de ligne. */
export function fixEffects(journal: JournalEntry[], sessions: SessionRecord[], bad: (s: SessionRecord) => boolean): Record<string, FixEffect> {
  const played = sessions.filter((s) => s.seconds >= MIN_SECONDS);
  const games = [...new Set(played.map((s) => s.gameId))];
  const effects: Record<string, FixEffect> = {};

  for (const entry of journal) {
    const kind = kindOf(entry);
    if (!LASTING.includes(kind) || entry.undone) continue;
    const pairs = games.map((id) => ({
      before: played.filter((s) => s.gameId === id && s.start < entry.at && s.start > entry.at - WINDOW),
      after: played.filter((s) => s.gameId === id && s.start > entry.at)
    }));
    const c = compare(pairs, bad);
    const text = describe(c, { before: 'avant', after: 'depuis' });
    effects[entry.id] = text
      ? { ...text, basis: `${c.before} partie${c.before > 1 ? 's' : ''} avant, ${c.after} après, sur ${c.games} jeu${c.games > 1 ? 'x' : ''}` }
      : { headline: 'Effet mesuré après vos prochaines parties', lines: [], better: null, basis: 'Il faut au moins une partie du même jeu avant et après la correction.' };
  }

  // Corrections à chaque lancement : la ligne la plus récente de chaque sorte porte la comparaison « avec / sans ».
  for (const kind of PER_LAUNCH) {
    const entries = journal.filter((e) => kindOf(e) === kind && e.gameId);
    if (!entries.length) continue;
    const helped = (s: SessionRecord) => entries.some((e) => e.gameId === s.gameId && e.at >= s.start - 10 * 60_000 && e.at <= s.start + 60_000);
    const pairs = games.map((id) => ({
      before: played.filter((s) => s.gameId === id && !helped(s)),
      after: played.filter((s) => s.gameId === id && helped(s))
    }));
    const c = compare(pairs, bad);
    const text = describe(c, { before: 'sans', after: 'avec cette correction' });
    effects[entries[0].id] = text
      ? { ...text, basis: `${c.after} partie${c.after > 1 ? 's' : ''} avec, ${c.before} sans, sur ${c.games} jeu${c.games > 1 ? 'x' : ''}` }
      : { headline: 'Effet mesuré quand vous aurez joué avec et sans', lines: [], better: null, basis: 'Il faut des parties du même jeu avec et sans cette correction.' };
  }
  return effects;
}
