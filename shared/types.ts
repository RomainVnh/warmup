// Types partagés entre l'interface et la partie système.
// L'interface ne connaît le PC qu'à travers WarmupApi : c'est la seule porte.

export type Status = 'ok' | 'warn';
export type Source = 'Steam' | 'Epic' | 'GOG' | 'Battle.net' | 'Rockstar' | 'Riot' | 'Manuel';
export type Platform = 'Steam' | 'Epic' | 'Riot' | 'GOG' | 'PlayStation' | 'Xbox' | 'Battle.net';

export interface Check { name: string; value: string; status: Status }
export interface Change { level: 0 | 1 | 2; title: string; text: string; when: string }
/** when : date d'obtention, ou null si le succès n'est pas encore obtenu. hidden : succès caché tant qu'il n'est pas obtenu. */
export interface Achievement { name: string; text: string; when: string | null; rarity: number; icon: string; hidden: boolean }
export interface Friend { name: string; platform: Platform; state: string; online: boolean }
/** Ami vu depuis la page Amis : gameId est le jeu auquel il joue en ce moment, joinable dit si l'on peut le rejoindre. */
export interface FriendGame { gameId: string; hours: number }
export interface FriendEvent { when: string; text: string; gameId: string | null }
export interface FriendStatus extends Friend {
  gameId: string | null;
  joinable: boolean;
  since: string;
  /** Profil affiché sur la page Amis. */
  tagline: string;
  friendSince: string;
  /** Jeux les plus joués, du plus joué au moins joué. */
  games: FriendGame[];
  activity: FriendEvent[];
}
/** image : visuel de l'article, vide s'il n'y en a pas. */
export interface NewsItem { tag: string; title: string; date: string; text: string; image: string }
export interface Review { author: string; positive: boolean; hours: number; text: string }
export interface Session { date: string; length: string; result: string; ok: boolean }
export interface LaunchStep { name: string; value: string; fixed: boolean }

export interface Game {
  id: string;
  title: string;
  source: Source;
  installed: boolean;
  favorite: boolean;
  /** Grand visuel horizontal, 1920 × 1080 au moins. Vide : fond sobre avec le titre. */
  art: string;
  /** Visuel réservé à la mise en avant sur l'accueil. Absent : on utilise `art`. */
  featuredArt?: string;
  /** Jaquette verticale (2:3). */
  cover: string;
  /** Logo du jeu sur fond transparent, ou null : le titre est alors écrit en toutes lettres. */
  logo: string | null;
  /** Captures du jeu, 1920 × 1080. Peut être vide. */
  screenshots: string[];
  sizeGb: number;
  hours: number;
  lastPlayed: string;
  recentRank: number;
  status: Status;
  statusLabel: string;
  genre: string;
  developer: string;
  year: number;
  multiplayer: boolean;
  version: string;
  location: string;
  region: string | null;
  summary: string;
  modCount: number;
  achievements: { done: number; total: number; list: Achievement[] };
  friends: Friend[];
  news: NewsItem[];
  reviews: { percent: number; count: number; label: string; list: Review[] };
  checks: Check[];
  changes: Change[];
  sessions: Session[];
  launch: { steps: LaunchStep[]; resultTitle: string; resultText: string };
  /** Réglages graphiques conseillés pour ce PC. */
  graphics: GraphicsAdvice;
}

export interface GraphicsRow { name: string; value: string; why: string }
export interface GraphicsAdvice {
  preset: string;
  resolution: string;
  upscaling: string;
  /** Images par seconde attendues en moyenne, et dans les passages les plus lourds. */
  fps: number;
  low: number;
  rows: GraphicsRow[];
  note: string;
}

export interface PcPart { name: string; big: string; text: string; status: Status }
export interface PcIssue { title: string; why: string; change: string; action: string; guideId?: string }
/** Matériel du PC. example vaut vrai dans le navigateur, où rien ne peut être lu. */
export interface PcReport { example: boolean; checkedAt: string; parts: PcPart[]; issues: PcIssue[] }
export interface ServerState { game: string; region: string; ping: string; state: string; status: Status }
export interface FixLog { what: string; detail: string }
export interface Mod { order: number; name: string; note: string; version: string; state: string; level: 'ok' | 'warn' | 'update'; enabled: boolean }
export interface ModSnapshot { when: string; result: string; ok: boolean }
export interface ReportEvent { time: string; title: string; text: string; ok: boolean }
export interface Tile { big: string; label: string }

export type ReportCause = 'Aucun incident' | 'Réseau' | 'Disque' | 'Mods' | 'Surchauffe';

export interface ReportChart {
  title: string;
  unit: string;
  summary: string;
  values: number[];
  /** Les valeurs au-delà de ce seuil sont signalées (au-dessus si above, en dessous sinon). */
  limit: number;
  above: boolean;
  axis: string[];
}

export interface Report {
  id: string;
  gameId: string;
  /** Date courte pour les listes (« Hier ») et période complète pour la page du bilan. */
  date: string;
  when: string;
  length: string;
  ok: boolean;
  cause: ReportCause;
  headline: string;
  text: string;
  tiles: Tile[];
  chart: ReportChart;
  events: ReportEvent[];
  advice: { title: string; text: string; action: string; href: string } | null;
}

export interface ModSet { gameId: string; headline: string; text: string; list: Mod[]; snapshots: ModSnapshot[] }

export type DownloadState = 'active' | 'queued' | 'paused' | 'done' | 'failed';
/** error : pourquoi le téléchargement a échoué, en clair (seulement quand state vaut « failed »). */
export interface Download { id: string; gameId: string; kind: 'install' | 'update'; label: string; sizeGb: number; doneGb: number; state: DownloadState; when: string; error?: string }

export type NoticeKind = 'update' | 'friend' | 'achievement' | 'fix';
export interface Notice {
  id: string;
  kind: NoticeKind;
  title: string;
  text: string;
  when: string;
  href: string;
  unread: boolean;
  /** Jeu concerné : sa jaquette illustre la notification. */
  gameId?: string;
  /** Ami concerné : son avatar illustre la notification. */
  friend?: string;
  /** Nom du succès obtenu : son icône illustre la notification. */
  achievement?: string;
}

/** Illustration d'une étape de guide : un écran schématique, avec une ligne mise en avant et une touche à presser. */
export interface GuideVisual { screen: string; lines: string[]; highlight: number; key?: string }
export interface GuideStep { title: string; text: string; tip?: string; visual: GuideVisual }
export interface Guide { id: string; title: string; intro: string; duration: string; level: string; warmupDoes: string; back: { label: string; href: string }; steps: GuideStep[] }

export interface Collection { id: string; name: string; gameIds: string[] }

export interface Profile {
  name: string;
  since: string;
  accounts: { platform: string; linked: boolean; detail: string }[];
  pc: { label: string; value: string }[];
  stats: Tile[];
}

export interface Snapshot {
  games: Game[];
  week: { hours: number[]; total: string; cleanLaunches: string; fixes: string };
  pc: { parts: PcPart[]; issues: PcIssue[]; servers: ServerState[]; log: FixLog[] };
  /** Un jeu de mods par jeu qui en a. */
  mods: ModSet[];
  /** Bilans de toutes les parties, du plus récent au plus ancien. */
  reports: Report[];
  friends: FriendStatus[];
  downloads: { items: Download[]; speedMbPerSec: number; diskFreeGb: number; diskTotalGb: number };
  notices: Notice[];
  guides: Guide[];
  profile: Profile;
}

export interface Settings {
  launchWindow: boolean;
  askBeforeFix: boolean;
  pauseDownloads: boolean;
  shareCatalog: boolean;
  startWithWindows: boolean;
}

export const defaultSettings: Settings = {
  launchWindow: true,
  askBeforeFix: true,
  pauseDownloads: true,
  shareCatalog: false,
  startWithWindows: false
};

export const settingKeys = Object.keys(defaultSettings) as (keyof Settings)[];

// Carte de profil : ce que le joueur personnalise lui-même. Une valeur vide signifie « par défaut ».
export interface ProfileCard {
  /** Pseudo affiché. Vide : nom par défaut. */
  name: string;
  /** Courte phrase sous le pseudo. */
  tagline: string;
  /** Jeu dont le visuel sert de bannière. Vide : le jeu le plus joué. */
  bannerGameId: string;
  /** Jeux mis en vitrine, 4 au plus. Vide : les favoris. */
  showcase: string[];
  /** Icône importée par le joueur : petite image carrée encodée dans le texte (data:image/...). Vide : initiale du pseudo. */
  avatar: string;
}

export const defaultProfileCard: ProfileCard = { name: '', tagline: '', bannerGameId: '', showcase: [], avatar: '' };

const GAME_ID = /^[a-z0-9-]{1,60}$/;
// Une icône est une image JPEG, PNG ou WebP encodée en base64, de 200 000 caractères au plus. Rien d'autre n'est accepté.
const AVATAR = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const AVATAR_MAX_LENGTH = 200_000;

// On ne garde que les champs connus, du bon type, et raccourcis à une longueur raisonnable.
export function cleanProfileCard(input: unknown, base: ProfileCard): ProfileCard {
  const next: ProfileCard = { ...base, showcase: [...base.showcase] };
  if (!input || typeof input !== 'object') return next;
  const raw = input as Record<string, unknown>;
  if (typeof raw.name === 'string') next.name = raw.name.trim().slice(0, 24);
  if (typeof raw.tagline === 'string') next.tagline = raw.tagline.trim().slice(0, 90);
  if (typeof raw.bannerGameId === 'string' && (raw.bannerGameId === '' || GAME_ID.test(raw.bannerGameId))) next.bannerGameId = raw.bannerGameId;
  if (typeof raw.avatar === 'string' && (raw.avatar === '' || (raw.avatar.length <= AVATAR_MAX_LENGTH && AVATAR.test(raw.avatar)))) next.avatar = raw.avatar;
  if (Array.isArray(raw.showcase)) next.showcase = [...new Set(raw.showcase.filter((id): id is string => typeof id === 'string' && GAME_ID.test(id)))].slice(0, 4);
  return next;
}

export const defaultCollections: Collection[] = [
  { id: 'a-finir', name: 'À finir', gameIds: ['expedition-33', 'red-dead-redemption-2', 'the-witcher-3'] },
  { id: 'entre-amis', name: 'Entre amis', gameIds: ['call-of-duty-mw4', 'valorant', 'counter-strike-2', 'baldurs-gate-3'] }
];

// Collections : 12 au plus, nom de 1 à 28 caractères, identifiants de jeux bien formés et sans doublon.
export function cleanCollections(input: unknown): Collection[] {
  if (!Array.isArray(input)) return defaultCollections.map((c) => ({ ...c, gameIds: [...c.gameIds] }));
  const seen = new Set<string>();
  const result: Collection[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, name, gameIds } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !GAME_ID.test(id) || seen.has(id)) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    seen.add(id);
    const ids = Array.isArray(gameIds) ? [...new Set(gameIds.filter((g): g is string => typeof g === 'string' && GAME_ID.test(g)))].slice(0, 200) : [];
    result.push({ id, name: name.trim().slice(0, 28), gameIds: ids });
    if (result.length === 12) break;
  }
  return result;
}

// Compte Warmup et premier lancement. Aucun mot de passe n'est demandé ni conservé :
// la connexion à Warmup se fait par un lien envoyé par e-mail, celle aux plateformes par leur page officielle.
export const LINKABLE = ['Steam', 'Epic', 'GOG', 'Battle.net', 'Rockstar', 'Riot', 'PlayStation', 'Xbox'] as const;
export type Linkable = (typeof LINKABLE)[number];
export interface Account {
  /** Faux : le parcours de premier lancement s'affiche à l'ouverture. */
  onboarded: boolean;
  /** Adresse du compte Warmup. Vide : utilisation sans compte. */
  email: string;
  signedIn: boolean;
  /** Plateformes reliées. */
  linked: Linkable[];
}

export const defaultAccount: Account = { onboarded: false, email: '', signedIn: false, linked: [] };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,80}\.[^\s@]{2,24}$/;
export const isEmail = (value: string): boolean => value.length <= 120 && EMAIL.test(value);

// On ne garde que les champs connus et bien formés. Sans adresse valide, on n'est pas connecté.
export function cleanAccount(input: unknown, base: Account): Account {
  const next: Account = { ...base, linked: [...base.linked] };
  if (!input || typeof input !== 'object') return next;
  const raw = input as Record<string, unknown>;
  if (typeof raw.onboarded === 'boolean') next.onboarded = raw.onboarded;
  if (typeof raw.email === 'string') {
    const email = raw.email.trim().toLowerCase();
    if (email === '' || isEmail(email)) next.email = email;
  }
  if (typeof raw.signedIn === 'boolean') next.signedIn = raw.signedIn;
  if (Array.isArray(raw.linked)) next.linked = LINKABLE.filter((name) => (raw.linked as unknown[]).includes(name));
  if (!next.email) next.signedIn = false;
  return next;
}

// Options de lancement propres à un jeu (bouton « Paramètres » de sa fiche).
export type LaunchWindowChoice = 'default' | 'always' | 'never';
export interface GameOptions {
  /** Fenêtre de lancement : comme dans les réglages, toujours ou jamais pour ce jeu. */
  launchWindow: LaunchWindowChoice;
  /** Faux : le jeu s'ouvre directement, sans les contrôles avant lancement. */
  checks: boolean;
  /** Arguments transmis au jeu à chaque lancement, par exemple « -dx12 -skipintro ». */
  args: string;
}
export const defaultGameOptions: GameOptions = { launchWindow: 'default', checks: true, args: '' };

// Arguments : 200 caractères au plus, lettres, chiffres et quelques signes. Jamais de guillemets, de point-virgule
// ni de symbole de commande : ce sont des réglages pour le jeu, pas un script.
export const LAUNCH_ARGS = /^[A-Za-z0-9 _\-=.:+,/]{0,200}$/;
export const splitArgs = (args: string): string[] => (LAUNCH_ARGS.test(args) ? args.split(/\s+/).filter(Boolean).slice(0, 20) : []);

export function cleanGameOptions(input: unknown, base: GameOptions): GameOptions {
  const next = { ...base };
  if (!input || typeof input !== 'object') return next;
  const raw = input as Record<string, unknown>;
  if (raw.launchWindow === 'default' || raw.launchWindow === 'always' || raw.launchWindow === 'never') next.launchWindow = raw.launchWindow;
  if (typeof raw.checks === 'boolean') next.checks = raw.checks;
  if (typeof raw.args === 'string' && LAUNCH_ARGS.test(raw.args.trim())) next.args = raw.args.trim().replace(/\s+/g, ' ');
  return next;
}

/** Toutes les options, par identifiant de jeu. Les jeux réglés comme par défaut n'y figurent pas. */
export function cleanAllGameOptions(input: unknown): Record<string, GameOptions> {
  const out: Record<string, GameOptions> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [id, value] of Object.entries(input as Record<string, unknown>).slice(0, 500)) {
    if (!GAME_ID.test(id)) continue;
    const options = cleanGameOptions(value, defaultGameOptions);
    if (JSON.stringify(options) !== JSON.stringify(defaultGameOptions)) out[id] = options;
  }
  return out;
}

/** Fichiers d'un jeu sur ce PC, tels que la détection les a trouvés. */
export interface GameFiles {
  /** Faux : Warmup n'a pas trouvé ce jeu sur le PC (ou ne peut pas le chercher, dans le navigateur). */
  found: boolean;
  example: boolean;
  folder: string;
  sizeGb: number | null;
  source: DetectSource | null;
  canUninstall: boolean;
  canVerify: boolean;
}
/** Résultat d'une action sur un jeu : simulated vaut vrai quand rien n'a réellement été fait sur le PC. */
export interface GameActionResult { ok: boolean; simulated: boolean; message: string }

// Jeux trouvés sur le PC en lisant les fichiers de Steam, Epic et GOG.
export type DetectSource = 'Steam' | 'Epic' | 'GOG' | 'Battle.net' | 'Rockstar' | 'Riot';
export interface DetectedGame {
  source: DetectSource;
  /** Numéro ou nom du jeu chez la plateforme. */
  storeId: string;
  title: string;
  folder: string;
  /** Place prise sur le disque, null si la plateforme ne la donne pas. */
  sizeGb: number | null;
  /** Faux : installation ou mise à jour inachevée. */
  complete: boolean;
  /** Jeu correspondant dans la bibliothèque de Warmup, null s'il n'y figure pas encore. */
  libraryId: string | null;
  /** Vrai : le bouton « Jouer » lance réellement ce jeu. */
  canLaunch: boolean;
}
export interface DetectedStore { source: DetectSource; found: boolean; note: string }
export interface DetectionReport {
  /** Vrai dans le navigateur : la liste est un exemple, pas le contenu du PC. */
  example: boolean;
  stores: DetectedStore[];
  games: DetectedGame[];
}

// Déroulé d'un lancement : chaque contrôle validé, puis le résultat, puis le jeu.
// started : real vaut vrai quand le jeu a réellement été ouvert, faux pour la simulation.
// failed : le jeu n'a pas pu être ouvert ; reason l'explique en clair.
export type LaunchEvent = { type: 'step'; index: number } | { type: 'done' } | { type: 'started'; real: boolean } | { type: 'failed'; reason: string };

// Liste fermée des actions que l'interface peut demander.
export interface WarmupApi {
  getSnapshot(): Promise<Snapshot>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Lance le contrôle puis le jeu. Renvoie une fonction qui annule. */
  getProfileCard(): Promise<ProfileCard>;
  setProfileCard(patch: Partial<ProfileCard>): Promise<ProfileCard>;
  getCollections(): Promise<Collection[]>;
  setCollections(list: Collection[]): Promise<Collection[]>;
  getAccount(): Promise<Account>;
  setAccount(patch: Partial<Account>): Promise<Account>;
  getGameOptions(): Promise<Record<string, GameOptions>>;
  setGameOptions(gameId: string, patch: Partial<GameOptions>): Promise<Record<string, GameOptions>>;
  /** Emplacement et taille d'un jeu installé, et ce que Warmup peut faire de ses fichiers. */
  getGameFiles(gameId: string): Promise<GameFiles>;
  openGameFolder(gameId: string): Promise<GameActionResult>;
  /** Vérifie les fichiers par la plateforme du jeu (Steam). */
  verifyGameFiles(gameId: string): Promise<GameActionResult>;
  /** Désinstalle par le programme officiel de la plateforme, qui demande lui-même confirmation. */
  uninstallGame(gameId: string): Promise<GameActionResult>;
  /** Lit le matériel du PC (écran, carte graphique, mémoire…). Lecture seule. */
  getPcReport(): Promise<PcReport>;
  /** Cherche les jeux installés sur le PC. Lecture seule. */
  detectGames(): Promise<DetectionReport>;
  startLaunch(gameId: string, onEvent: (event: LaunchEvent) => void): () => void;
}
