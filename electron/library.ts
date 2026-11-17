import path from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import { snapshot as catalogue } from '../shared/mock-data';
import { buildRealSnapshot, type RealGameInput } from '../shared/real-data';
import { ago } from '../shared/real-data';
import type { DetectionReport, DetectSource, FriendStatus, GameActionResult, PcIssue, PcPart, Snapshot, Source } from '../shared/types';
import { steamData } from './online';
import { detectAll, type MatchedGame } from './detect';
import { cleanText, safeProgram } from './detect/files';
import type { LaunchPlan } from './detect/types';
import { journal } from './journal';
import { allSessions } from './sessions';
import { readJson, writeJson } from './store';

// Bibliothèque de la version vierge : les jeux trouvés sur ce PC, plus ceux que le joueur ajoute à la main.
// Les emplacements et les manières de lancer restent ici ; l'interface ne reçoit que des identifiants.

const FILE = 'games.json';

interface ManualGame { id: string; title: string; file: string; folder: string; addedAt: number }

export interface LibraryGame {
  id: string;
  title: string;
  source: Source;
  /** Plateforme d'origine, ou null pour un jeu ajouté à la main. */
  store: DetectSource | null;
  folder: string;
  /** Version installée (build Steam), quand la plateforme la note. */
  version?: string | null;
  sizeGb: number | null;
  complete: boolean;
  launch: LaunchPlan | null;
  uninstall: LaunchPlan | null;
  verify: LaunchPlan | null;
  manual: boolean;
}

const titles = catalogue.games.map((g) => ({ id: g.id, title: g.title }));

/** Identifiant à partir d'un texte : minuscules, chiffres et tirets, 60 caractères au plus. */
export const slug = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'jeu';

function unique(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base.slice(0, 56)}-${n}`;
  used.add(id);
  return id;
}

export function cleanManualGames(input: unknown): ManualGame[] {
  if (!Array.isArray(input)) return [];
  const list: ManualGame[] = [];
  for (const raw of input.slice(0, 300)) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, title, file, folder, addedAt } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(id) || list.some((g) => g.id === id)) continue;
    if (typeof title !== 'string' || !cleanText(title, 80) || typeof file !== 'string' || !safeProgram(file) || typeof folder !== 'string') continue;
    list.push({ id, title: cleanText(title, 80), file, folder, addedAt: typeof addedAt === 'number' ? addedAt : 0 });
  }
  return list;
}

let manual: ManualGame[] = [];
let games: LibraryGame[] = [];
let inputs: RealGameInput[] = [];

export const loadManualGames = (): void => {
  manual = cleanManualGames(readJson(FILE));
};
export const libraryGames = (): LibraryGame[] => games;
export const findLibraryGame = (id: unknown): LibraryGame | undefined => (typeof id === 'string' ? games.find((g) => g.id === id) : undefined);

function rebuild(found: MatchedGame[]): string[] {
  const used = new Set<string>(manual.map((g) => g.id));
  const ids: string[] = [];
  const nextGames: LibraryGame[] = [];
  const nextInputs: RealGameInput[] = [];
  for (const g of found) {
    // Un jeu reconnu garde l'identifiant du catalogue ; les autres en reçoivent un tiré de leur titre.
    const id = unique(g.libraryId ?? slug(g.title), used);
    ids.push(id);
    nextGames.push({ id, title: g.title, source: g.source, store: g.source, folder: g.folder, version: g.version ?? null, sizeGb: g.sizeGb, complete: g.complete, launch: g.launch, uninstall: g.uninstall ?? null, verify: g.verify ?? null, manual: false });
    nextInputs.push({ id, title: g.title, source: g.source, folder: g.folder, sizeGb: g.sizeGb, complete: g.complete, catalogueId: g.libraryId, steamId: g.source === 'Steam' ? g.storeId : null, version: g.version ?? null, manual: false, platformMinutes: g.minutes ?? null, platformLastPlayed: g.lastPlayed ?? null });
  }
  for (const g of manual) {
    nextGames.push({ id: g.id, title: g.title, source: 'Manuel', store: null, folder: g.folder, sizeGb: null, complete: true, launch: { kind: 'exe', file: g.file, args: [], cwd: path.dirname(g.file) }, uninstall: null, verify: null, manual: true });
    nextInputs.push({ id: g.id, title: g.title, source: 'Manuel', folder: g.folder, sizeGb: null, complete: true, catalogueId: null, steamId: null, manual: true, platformMinutes: null, platformLastPlayed: null });
  }
  games = nextGames;
  inputs = nextInputs;
  return ids;
}

let lastFound: MatchedGame[] = [];

/** Relit les plateformes et reconstruit la bibliothèque. Renvoie le compte rendu de la recherche, avec les identifiants de la bibliothèque. */
export async function refreshLibrary(): Promise<DetectionReport> {
  const { report, found } = await detectAll(titles);
  lastFound = found;
  const ids = rebuild(found);
  return { ...report, games: report.games.map((g, index) => ({ ...g, libraryId: ids[index] ?? null })) };
}

type SteamInput = NonNullable<Parameters<typeof buildRealSnapshot>[0]['steam']>;
let steam: SteamInput | undefined;

/** Relit Steam (amis, succès obtenus) si le compte est relié. Les données venues du service sont raccourcies et rapprochées de la bibliothèque. */
export async function refreshSteam(force = false): Promise<void> {
  const steamGames = inputs.filter((g) => g.steamId && g.catalogueId);
  const { profile, achieved } = await steamData(steamGames.map((g) => g.steamId!), force);
  if (!profile.linked) {
    steam = undefined;
    return;
  }
  const now = Date.now();
  const friends = profile.friends.filter((f) => typeof f.name === 'string').map((f): FriendStatus => {
    const playing = f.appId ? inputs.find((g) => g.steamId === f.appId) : undefined;
    return {
      name: cleanText(f.name, 40) || 'Ami Steam',
      platform: 'Steam',
      online: f.online === true,
      state: f.online ? (f.game ? `Joue à ${cleanText(f.game, 80)}` : 'En ligne') : 'Hors ligne',
      gameId: f.online && playing ? playing.id : null,
      joinable: false,
      since: f.online ? 'En ce moment' : f.lastSeen ? `Vu ${ago(f.lastSeen, now).toLowerCase()}` : '',
      tagline: '',
      friendSince: f.since ? `Ami sur Steam depuis ${new Date(f.since).getFullYear()}` : 'Ami sur Steam',
      games: [],
      activity: []
    };
  });
  const obtained: SteamInput['achieved'] = {};
  for (const g of steamGames) {
    const list = achieved.get(g.steamId!);
    if (list?.length) obtained[g.id] = Object.fromEntries(list.filter((a) => typeof a.name === 'string').map((a) => [a.name, Number(a.at) || 0]));
  }
  steam = { name: cleanText(profile.name, 40), friends, achieved: obtained };
}

export function realSnapshot(parts: PcPart[], issues: PcIssue[] = [], facts?: Record<string, string>, args?: Record<string, string>): Snapshot {
  return buildRealSnapshot({ games: inputs, parts, issues, facts, args, sessions: allSessions(), journal: journal(), now: Date.now(), steam });
}

const done = (message: string, gameId?: string): GameActionResult & { gameId?: string } => ({ ok: true, simulated: false, message, gameId });
const failed = (message: string): GameActionResult => ({ ok: false, simulated: false, message });

/** Ajout à la main : le joueur désigne lui-même le programme du jeu dans le sélecteur de fichiers du système. */
export async function addManualGame(win: BrowserWindow | null): Promise<GameActionResult & { gameId?: string }> {
  const mac = process.platform === 'darwin';
  const options = {
    title: 'Choisir le programme du jeu',
    buttonLabel: 'Ajouter ce jeu',
    properties: ['openFile' as const],
    filters: [{ name: mac ? 'Applications' : 'Programmes', extensions: mac ? ['app'] : ['exe'] }]
  };
  const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  const file = picked.filePaths[0];
  if (picked.canceled || !file) return failed('Aucun jeu ajouté.');
  if (!safeProgram(file)) return failed('Ce fichier n\'est pas un programme. Choisissez le fichier qui lance le jeu.');
  const already = manual.find((g) => g.file === file) ?? games.find((g) => !g.manual && file.toLowerCase().startsWith(g.folder.toLowerCase()));
  if (already) return { ...failed(`${already.title} est déjà dans votre bibliothèque.`), gameId: already.id };
  const title = cleanText(path.basename(file).replace(/\.(exe|app)$/i, '').replace(/[_-]+/g, ' '), 80) || 'Jeu ajouté';
  const id = unique(`manuel-${slug(title)}`.slice(0, 60), new Set(games.map((g) => g.id)));
  // Sur Mac, une application est un dossier : c'est lui que l'on surveille. Sous Windows, c'est le dossier du programme.
  manual = [...manual, { id, title, file, folder: mac ? file : path.dirname(file), addedAt: Date.now() }];
  writeJson(FILE, manual);
  rebuild(lastFound);
  return done(`${title} est ajouté à votre bibliothèque.`, id);
}

export function renameManualGame(gameId: unknown, title: unknown): GameActionResult {
  const game = typeof gameId === 'string' ? manual.find((g) => g.id === gameId) : undefined;
  const name = cleanText(title, 80);
  if (!game) return failed('Seuls les jeux ajoutés à la main peuvent être renommés.');
  if (!name) return failed('Le nom du jeu ne peut pas être vide.');
  manual = manual.map((g) => (g.id === game.id ? { ...g, title: name } : g));
  writeJson(FILE, manual);
  rebuild(lastFound);
  return done(`Le jeu s'appelle maintenant ${name}.`);
}

export function removeManualGame(gameId: unknown): GameActionResult {
  const game = typeof gameId === 'string' ? manual.find((g) => g.id === gameId) : undefined;
  if (!game) return failed('Seuls les jeux ajoutés à la main peuvent être retirés ici. Les autres se désinstallent par leur plateforme.');
  manual = manual.filter((g) => g.id !== game.id);
  writeJson(FILE, manual);
  rebuild(lastFound);
  return done(`${game.title} est retiré de votre bibliothèque. Ses fichiers n'ont pas été touchés.`);
}
