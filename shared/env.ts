import type { Change, SessionRecord } from './types';

// « Photo » de l'environnement d'une partie : pilote, système, écran, réglages de Windows, version du jeu…
// Warmup la prend à chaque partie. Quand un jeu se met à mal tourner, il compare avec la dernière partie réussie :
// ce qui a changé entre les deux est presque toujours la cause.

export type Env = Record<string, string>;

/** Ce qui peut casser un jeu, du plus suspect (0) au moins suspect (2). Une clé absente compte comme « à surveiller ». */
const LEVEL: Record<string, Change['level']> = {
  'Pilote graphique': 0,
  'Version du jeu': 0,
  'Taille du jeu': 0,
  'Arguments de lancement': 0,
  'Carte graphique': 0,
  Système: 1,
  Écran: 1,
  'Mémoire vive': 1,
  'Planification GPU': 1,
  'Mode Jeu': 2
};

/** Explication en clair de chaque changement. */
const WHY: Record<string, string> = {
  'Pilote graphique': 'Un nouveau pilote graphique est la cause la plus fréquente d\'un jeu qui se met à planter ou à ramer.',
  'Version du jeu': 'Le jeu a été mis à jour par sa plateforme : une mise à jour peut apporter un bug, ou casser des mods.',
  'Taille du jeu': 'Les fichiers du jeu ont changé : il a probablement été mis à jour par sa plateforme.',
  'Arguments de lancement': 'Les options de lancement du jeu ont été modifiées dans ses paramètres.',
  'Carte graphique': 'La carte graphique utilisée n\'est plus la même.',
  Système: 'Windows a été mis à jour.',
  Écran: 'La définition ou la fréquence de l\'écran a changé.',
  'Mémoire vive': 'La quantité de mémoire vive a changé.',
  'Planification GPU': 'Ce réglage de Windows modifie la façon dont la carte graphique organise ses images.',
  'Mode Jeu': 'Le mode Jeu change seulement la priorité donnée au jeu : il cause rarement un problème.'
};

const MAX_KEYS = 20;
const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : '');

/** Garde une photo lisible : des textes courts, en nombre limité. */
export function cleanEnv(input: unknown): Env | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const env: Env = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, MAX_KEYS)) {
    const k = clean(key);
    const v = clean(value);
    if (k && v) env[k] = v;
  }
  return Object.keys(env).length ? env : undefined;
}

/** Photo d'un jeu : celle du PC, plus ce qui est propre au jeu. */
export function gameEnv(pc: Env, game: { version?: string | null; sizeGb?: number | null; args?: string }): Env {
  const env: Env = { ...pc };
  if (game.version) env['Version du jeu'] = game.version;
  else if (game.sizeGb) env['Taille du jeu'] = `${game.sizeGb.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;
  env['Arguments de lancement'] = game.args?.trim() || 'Aucun';
  return env;
}

export interface EnvChange { key: string; before: string; after: string; level: Change['level'] }

/** Différences entre deux photos, du plus suspect au moins suspect. Une valeur qui manque d'un côté n'est pas un changement. */
export function diffEnv(before: Env, after: Env): EnvChange[] {
  return Object.keys(after)
    .filter((key) => before[key] !== undefined && before[key] !== after[key])
    .map((key) => ({ key, before: before[key], after: after[key], level: LEVEL[key] ?? 1 }))
    .sort((a, b) => a.level - b.level || a.key.localeCompare(b.key, 'fr'));
}

/** Une partie réussie : jouée plus d'une minute, sans incident. */
export type IsGood = (s: SessionRecord) => boolean;

/** Dernière partie réussie d'un jeu avant l'instant `before`, avec sa photo. */
export function lastGood(sessions: SessionRecord[], gameId: string, good: IsGood, before = Infinity): SessionRecord | undefined {
  return sessions
    .filter((s) => s.gameId === gameId && s.env && s.start < before && good(s))
    .sort((a, b) => b.start - a.start)[0];
}

/** Changements présentés à l'écran, avec le moment où chacun a été vu pour la première fois. */
export function toChanges(changes: EnvChange[], seenAt: (change: EnvChange) => string): Change[] {
  return changes.map((c) => ({
    level: c.level,
    title: `${c.key} : ${c.before} → ${c.after}`,
    text: WHY[c.key] ?? 'Ce réglage a changé depuis la dernière partie réussie.',
    when: seenAt(c)
  }));
}

/** Première partie, après `since`, où la nouvelle valeur apparaît : c'est le moment du changement. */
export function firstSeen(sessions: SessionRecord[], gameId: string, since: number, change: EnvChange): SessionRecord | undefined {
  return sessions
    .filter((s) => s.gameId === gameId && s.start > since && s.env?.[change.key] === change.after)
    .sort((a, b) => a.start - b.start)[0];
}
