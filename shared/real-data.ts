import { steamAchievements } from './achievements-data';
import { CATALOGUE_STEAM_IDS, steamAchievementIcon, steamArt } from './catalogue-steam';
import { guides } from './mock-extra';
import { snapshot as catalogue } from './mock-data';
import { gameNews } from './news-data';
import type { Check, FriendStatus, Game, JournalEntry, LaunchStep, PcPart, Report, Session, SessionRecord, Snapshot, Source } from './types';

// Version vierge : la bibliothèque n'est faite que de ce qui est lu sur ce PC.
// Le catalogue (les jeux d'exemple) ne sert plus qu'à habiller un jeu reconnu : visuels, résumé, liste des succès, actualités.
// Rien d'inventé n'est repris : ni heures, ni amis, ni avis, ni incidents.

export interface RealGameInput {
  id: string;
  title: string;
  source: Source;
  folder: string;
  sizeGb: number | null;
  complete: boolean;
  /** Jeu correspondant dans le catalogue, pour ses visuels ; null si Warmup ne le connaît pas. */
  catalogueId: string | null;
  /** Numéro du jeu chez Steam, pour retrouver ses visuels officiels. */
  steamId: string | null;
  manual: boolean;
  /** Minutes jouées et dernière partie, d'après la plateforme (Steam) ; null si elle ne les donne pas. */
  platformMinutes: number | null;
  platformLastPlayed: number | null;
}

const DAY = 86_400_000;

export function duration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** « Aujourd'hui », « Hier », « Il y a 3 jours »… à partir d'un instant. */
export function ago(at: number | null, now: number): string {
  if (!at) return 'Jamais lancé';
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return 'Aujourd\'hui';
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${days >= 14 ? 's' : ''}`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an${days >= 730 ? 's' : ''}`;
}

const dateTime = (at: number) => new Date(at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const clock = (at: number) => new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Une partie fermée moins d'une minute après son lancement est signalée : c'est le seul incident que Warmup sait voir pour l'instant. */
const tooShort = (s: SessionRecord) => s.seconds < 60;

/** Seuils au-delà desquels une mesure est signalée comme un incident. */
const PING_SPIKE = 150; // ms
const LOSS_LIMIT = 3; // % d'essais sans réponse
const GPU_HOT = 87; // °C

/** Incident repéré pendant une partie, du plus gênant au moins gênant ; null si tout va bien. */
export function incident(s: SessionRecord): { cause: Report['cause']; headline: string; text: string } | null {
  if (tooShort(s)) return null; // traité à part : le jeu s'est fermé presque aussitôt
  if (s.gpu && s.gpu.maxTemp >= GPU_HOT) {
    return { cause: 'Surchauffe', headline: `La carte graphique est montée à ${s.gpu.maxTemp} °C`, text: 'Au-delà de 87 °C, la carte graphique ralentit pour se protéger, ce qui fait baisser les images par seconde. Vérifiez que l\'air circule bien dans le boîtier et que les ventilateurs ne sont pas encrassés.' };
  }
  if (s.ping && (s.ping.lossPercent >= LOSS_LIMIT || s.ping.max >= PING_SPIKE)) {
    return {
      cause: 'Réseau',
      headline: s.ping.lossPercent >= LOSS_LIMIT ? `La connexion a perdu ${s.ping.lossPercent} % des échanges` : `Le ping est monté à ${s.ping.max} ms`,
      text: 'Le réseau a été instable pendant la partie : c\'est ce qui cause les saccades et les retards dans les jeux en ligne. Le PC n\'est pas en cause. Un branchement par câble, ou la priorité donnée au PC sur la box, règle souvent le problème.'
    };
  }
  return null;
}

function report(s: SessionRecord, title: string, now: number): Report {
  const short = tooShort(s);
  const issue = incident(s);
  const peak = s.peakMemMb ? `${(s.peakMemMb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go` : 'Non mesurée';
  const values = s.samples.length > 1 ? s.samples.map((mb) => Math.round(mb / 102.4) / 10) : [0, 0];
  return {
    id: s.id,
    gameId: s.gameId,
    date: ago(s.start, now),
    when: `${dateTime(s.start)} – ${clock(s.end)}`,
    length: duration(s.seconds),
    ok: !short && !issue,
    cause: issue?.cause ?? 'Aucun incident',
    headline: short ? `${title} s'est fermé au bout de ${Math.max(1, Math.round(s.seconds))} secondes` : issue ? issue.headline : `Partie de ${duration(s.seconds)} sans incident repéré`,
    text: short
      ? 'Le jeu s\'est arrêté moins d\'une minute après son lancement. Cela arrive quand il plante au démarrage, ou quand on le ferme tout de suite.'
      : issue ? issue.text : 'Warmup a suivi la partie de l\'extérieur du jeu : durée, mémoire, processeur, réseau et, avec une carte NVIDIA, température de la carte graphique. Les images par seconde ne sont pas encore mesurées.',
    tiles: [
      { big: duration(s.seconds), label: 'Durée de la partie' },
      { big: peak, label: 'Mémoire du jeu, au plus haut' },
      { big: s.avgCpu === null ? 'Non mesurée' : `${Math.round(s.avgCpu)} %`, label: 'Charge moyenne du processeur' },
      ...(s.ping ? [{ big: `${s.ping.avg} ms`, label: `Ping moyen (au plus haut : ${s.ping.max} ms)` }, { big: `${s.ping.lossPercent} %`, label: 'Échanges perdus sur le réseau' }] : []),
      ...(s.gpu ? [{ big: `${s.gpu.maxTemp} °C`, label: `Carte graphique, au plus chaud (charge moyenne ${s.gpu.avgLoad} %)` }] : [])
    ],
    chart: {
      title: 'Mémoire utilisée par le jeu',
      unit: 'Go',
      summary: s.samples.length > 1 ? `Au plus haut : ${peak}.` : 'Partie trop courte pour tracer une courbe.',
      values,
      limit: Math.max(...values) + 1,
      above: true,
      axis: [clock(s.start), clock(s.end)]
    },
    events: [
      { time: clock(s.start), title: 'Jeu lancé', text: 'Warmup a vu le jeu démarrer.', ok: true },
      { time: clock(s.end), title: short ? 'Jeu fermé presque aussitôt' : 'Jeu fermé', text: short ? 'Moins d\'une minute après le lancement.' : `Après ${duration(s.seconds)}.`, ok: !short }
    ],
    advice: issue?.cause === 'Réseau' ? { title: 'Donner la priorité au PC de jeu sur votre box', text: 'Un guide pas à pas, en dix minutes.', action: 'Voir le guide', href: '#/guide/box' } : short ? { title: 'Si le jeu plante au démarrage', text: 'Vérifiez ses fichiers depuis les paramètres du jeu, puis relancez-le.', action: 'Ouvrir la fiche du jeu', href: `#/game/${s.gameId}` } : null
  };
}

/** Contrôles réels d'un jeu, tirés du matériel lu sur le PC. */
function checks(input: RealGameInput, parts: PcPart[]): { checks: Check[]; steps: LaunchStep[] } {
  const files: Check = input.complete
    ? { name: 'Fichiers du jeu', value: 'Présents sur le disque', status: 'ok' }
    : { name: 'Fichiers du jeu', value: 'Installation ou mise à jour inachevée', status: 'warn' };
  const wanted = ['Écran', 'Carte graphique', 'Mémoire vive', 'Stockage'];
  const hardware = wanted.map((name) => parts.find((p) => p.name === name)).filter((p): p is PcPart => Boolean(p));
  return {
    checks: [files, ...hardware.map((p): Check => ({ name: p.name, value: `${p.big}. ${p.text}`, status: p.status }))],
    steps: [{ name: files.name, value: files.status === 'ok' ? 'Présents' : 'Incomplets', fixed: false }, ...hardware.map((p): LaunchStep => ({ name: p.name, value: p.big, fixed: false }))]
  };
}


function game(input: RealGameInput, parts: PcPart[], sessions: SessionRecord[], rank: number, now: number): Game {
  const known = input.catalogueId ? catalogue.games.find((g) => g.id === input.catalogueId) : undefined;
  const mine = sessions.filter((s) => s.gameId === input.id).sort((a, b) => b.start - a.start);
  const trackedMinutes = mine.reduce((sum, s) => sum + s.seconds, 0) / 60;
  const minutes = input.platformMinutes ?? trackedMinutes;
  const last = Math.max(input.platformLastPlayed ?? 0, mine[0]?.end ?? 0) || null;
  const real = checks(input, parts);
  const warn = real.checks.filter((c) => c.status === 'warn').length;
  // Visuels officiels chargés chez Steam (le dépôt et l'application publiés n'en contiennent aucun) :
  // d'après le numéro du catalogue pour un jeu reconnu, sinon d'après celui trouvé par la détection.
  const appId = (known && CATALOGUE_STEAM_IDS[known.id]) || input.steamId;
  const remote = appId ? steamArt(appId) : null;
  const list = known ? (steamAchievements[known.id] ?? []).map((a) => ({ ...a, icon: steamAchievementIcon(known.id, a.icon), when: null })) : [];
  return {
    id: input.id,
    title: known?.title ?? input.title,
    source: input.source,
    installed: true,
    favorite: false,
    art: remote?.art ?? '',
    cover: remote?.cover ?? '',
    // Un jeu dont la bannière contient déjà le titre n'a pas de logo dans le catalogue : on n'en ajoute pas.
    logo: remote && (!known || known.logo) ? remote.logo : null,
    screenshots: [],
    sizeGb: input.sizeGb ?? 0,
    hours: Math.round(minutes / 6) / 10,
    lastPlayed: ago(last, now),
    recentRank: rank,
    status: 'ok',
    statusLabel: 'Prêt',
    genre: known?.genre ?? (input.manual ? 'Jeu ajouté à la main' : `Jeu ${input.source}`),
    developer: known?.developer ?? '',
    year: known?.year ?? 0,
    multiplayer: known?.multiplayer ?? false,
    version: '',
    location: input.folder,
    region: null,
    summary: known?.summary ?? '',
    modCount: 0,
    achievements: { done: 0, total: list.length, list },
    friends: [],
    // Actualités du catalogue, sans leur image (qui n'est pas publiée) : la bannière du jeu la remplace.
    news: known ? (gameNews[known.id] ?? []).map((n) => ({ ...n, image: '' })) : [],
    reviews: { percent: 0, count: 0, label: '', list: [] },
    checks: real.checks,
    changes: [],
    sessions: mine.slice(0, 8).map((s): Session => ({ date: ago(s.start, now), length: duration(s.seconds), result: tooShort(s) ? 'Fermé presque aussitôt' : incident(s)?.headline ?? 'Sans incident repéré', ok: !tooShort(s) && !incident(s) })),
    launch: {
      steps: real.steps,
      resultTitle: `${real.steps.length} points vérifiés`,
      resultText: warn ? `${warn} point${warn > 1 ? 's' : ''} à surveiller : le détail est dans le diagnostic.` : 'Tout est en ordre. Bon jeu.'
    },
    graphics: { preset: '', resolution: '', upscaling: '', fps: 0, low: 0, rows: [], note: '' },
    manual: input.manual
  };
}

export interface RealInput {
  games: RealGameInput[];
  parts: PcPart[];
  sessions: SessionRecord[];
  journal: JournalEntry[];
  now: number;
  /** Steam relié : pseudo, amis, et succès obtenus par identifiant de jeu (nom du succès → date). */
  steam?: { name: string; friends: FriendStatus[]; achieved: Record<string, Record<string, number>> };
}

export function buildRealSnapshot({ games, parts, sessions, journal, now, steam }: RealInput): Snapshot {
  // Jeux récents : la dernière partie d'abord, puis l'ordre alphabétique.
  const lastOf = (g: RealGameInput) => Math.max(g.platformLastPlayed ?? 0, ...sessions.filter((s) => s.gameId === g.id).map((s) => s.end), 0);
  const ordered = [...games].sort((a, b) => lastOf(b) - lastOf(a) || a.title.localeCompare(b.title, 'fr'));
  const list = ordered.map((g, index) => game(g, parts, sessions, index + 1, now)).map((g) => {
    // Succès réellement obtenus, d'après Steam : rapprochés par leur nom.
    const got = steam?.achieved[g.id];
    if (!got) return g;
    const achievements = g.achievements.list.map((a) => (got[a.name] !== undefined ? { ...a, when: ago(got[a.name] || now, now) } : a));
    return { ...g, achievements: { ...g.achievements, list: achievements, done: achievements.filter((a) => a.when).length } };
  });

  // Semaine en cours, du lundi au dimanche.
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = sessions.filter((s) => s.start >= monday.getTime() && list.some((g) => g.id === s.gameId));
  const hours = [0, 0, 0, 0, 0, 0, 0];
  for (const s of week) hours[(new Date(s.start).getDay() + 6) % 7] += s.seconds / 3600;
  const totalMinutes = Math.round(week.reduce((sum, s) => sum + s.seconds, 0) / 60);
  const clean = week.filter((s) => !tooShort(s) && !incident(s)).length;

  const titleOf = (id: string) => list.find((g) => g.id === id)?.title ?? 'Le jeu';
  return {
    demo: false,
    steam: { linked: Boolean(steam), name: steam?.name ?? '' },
    games: list,
    week: {
      hours: hours.map((h) => Math.round(h * 10) / 10),
      total: totalMinutes < 60 ? `${totalMinutes} min` : `${Math.floor(totalMinutes / 60)} h ${String(totalMinutes % 60).padStart(2, '0')}`,
      cleanLaunches: week.length ? `${clean} sur ${week.length}` : '0',
      fixes: String(journal.filter((j) => j.at >= monday.getTime() && j.undoable && !j.undone).length)
    },
    pc: { parts, issues: [], servers: [], log: [] },
    mods: [],
    reports: [...sessions].filter((s) => list.some((g) => g.id === s.gameId)).sort((a, b) => b.start - a.start).slice(0, 200).map((s) => report(s, titleOf(s.gameId), now)),
    friends: steam?.friends ?? [],
    notices: [],
    guides,
    profile: { name: 'Joueur', since: '', accounts: [], pc: parts.map((p) => ({ label: p.name, value: p.big })), stats: [] }
  };
}
