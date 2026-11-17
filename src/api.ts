import { snapshot } from '../shared/mock-data';
import { simulateLaunch } from '../shared/launch-sim';
import { buildRealSnapshot } from '../shared/real-data';
import { cleanFavorites, cleanAllGameOptions, cleanGameOptions, defaultGameOptions, cleanAccount, cleanCollections, cleanProfileCard, defaultAccount, defaultProfileCard, defaultSettings, settingKeys, type Account, type Collection, type DetectionReport, type GameActionResult, type GameOptions, type JournalEntry, type WarmupApi, type ProfileCard, type Settings } from '../shared/types';

declare global {
  interface Window {
    warmup?: WarmupApi;
  }
}

// Ancien nom du projet : les données enregistrées sous « nominal.* » sont reprises une seule fois.
try {
  for (const name of ['settings', 'profile', 'collections', 'account']) {
    const old = localStorage.getItem(`nominal.${name}`);
    if (old !== null && localStorage.getItem(`warmup.${name}`) === null) localStorage.setItem(`warmup.${name}`, old);
    localStorage.removeItem(`nominal.${name}`);
  }
} catch {
  // Stockage indisponible : rien à reprendre.
}

const KEY = 'warmup.settings';

function loadSettings(): Settings {
  const next = { ...defaultSettings };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    for (const key of settingKeys) if (typeof saved[key] === 'boolean') next[key] = saved[key] as boolean;
  } catch {
    // Stockage indisponible ou illisible : on garde les réglages par défaut.
  }
  return next;
}

const PROFILE_KEY = 'warmup.profile';

function loadProfileCard(): ProfileCard {
  try {
    return cleanProfileCard(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}'), defaultProfileCard);
  } catch {
    return { ...defaultProfileCard };
  }
}

const COLLECTIONS_KEY = 'warmup.collections';

function loadCollections(): Collection[] {
  try {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    return cleanCollections(saved ? JSON.parse(saved) : undefined);
  } catch {
    return cleanCollections(undefined);
  }
}

const ACCOUNT_KEY = 'warmup.account';

function loadAccount(): Account {
  try {
    return cleanAccount(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? '{}'), defaultAccount);
  } catch {
    return { ...defaultAccount };
  }
}

const GAME_OPTIONS_KEY = 'warmup.gameOptions';

function loadGameOptions(): Record<string, GameOptions> {
  try {
    return cleanAllGameOptions(JSON.parse(localStorage.getItem(GAME_OPTIONS_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

// Dans le navigateur, rien n'est modifié sur le PC : chaque action le dit.
const simulated = (message: string): Promise<GameActionResult> => Promise.resolve({ ok: true, simulated: true, message });

// Dans le navigateur, rien ne peut être lu sur le PC : on montre un exemple de résultat.
const exampleDetection: DetectionReport = {
  example: true,
  stores: [
    { source: 'Steam', found: true, note: '4 jeux installés.' },
    { source: 'GOG', found: true, note: '2 jeux installés.' },
    { source: 'Battle.net', found: true, note: '2 jeux installés.' },
    { source: 'Rockstar', found: true, note: '1 jeu installé.' }
  ],
  games: [
    { source: 'Steam', storeId: '1086940', title: 'Baldur\'s Gate 3', folder: 'D:\\SteamLibrary\\steamapps\\common\\Baldurs Gate 3', sizeGb: 139.6, complete: true, libraryId: 'baldurs-gate-3', canLaunch: true },
    { source: 'Battle.net', storeId: 'auks', title: 'Call of Duty', folder: 'D:\\Jeux\\Call of Duty', sizeGb: 212.4, complete: true, libraryId: 'call-of-duty-mw4', canLaunch: true },
    { source: 'Steam', storeId: '730', title: 'Counter-Strike 2', folder: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive', sizeGb: 34.2, complete: true, libraryId: 'counter-strike-2', canLaunch: true },
    { source: 'GOG', storeId: '1423049311', title: 'Cyberpunk 2077', folder: 'D:\\GOG Games\\Cyberpunk 2077', sizeGb: null, complete: true, libraryId: 'cyberpunk-2077', canLaunch: true },
    { source: 'Battle.net', storeId: 'fenris', title: 'Diablo IV', folder: 'D:\\Jeux\\Diablo IV', sizeGb: 88.1, complete: true, libraryId: 'diablo-4', canLaunch: true },
    { source: 'Steam', storeId: '1245620', title: 'ELDEN RING', folder: 'D:\\SteamLibrary\\steamapps\\common\\ELDEN RING', sizeGb: 68.9, complete: true, libraryId: 'elden-ring', canLaunch: true },
    { source: 'Rockstar', storeId: 'rdr2', title: 'Red Dead Redemption 2', folder: 'D:\\Rockstar Games\\Red Dead Redemption 2', sizeGb: 121.3, complete: true, libraryId: 'red-dead-redemption-2', canLaunch: true },
    { source: 'Steam', storeId: '2246340', title: 'Monster Hunter Wilds', folder: 'D:\\SteamLibrary\\steamapps\\common\\MonsterHunterWilds', sizeGb: 51.3, complete: false, libraryId: 'monster-hunter-wilds', canLaunch: false },
    { source: 'GOG', storeId: '1207664663', title: 'The Witcher 3: Wild Hunt', folder: 'D:\\GOG Games\\The Witcher 3 Wild Hunt GOTY', sizeGb: null, complete: true, libraryId: 'the-witcher-3', canLaunch: true }
  ]
};

// Modes de démonstration, dans le navigateur seulement : ?demo=vide (aucun jeu), ?demo=hors-ligne (pas de connexion)
// ou ?demo=vierge (aperçu de la version vierge, sans aucune donnée d'exemple).
export const demo = ((): string => {
  try {
    return new URLSearchParams(window.location.search).get('demo') ?? '';
  } catch {
    return '';
  }
})();

// Journal d'exemple : « Annuler » y marque seulement la ligne, rien n'est modifié sur le PC.
let demoJournal: JournalEntry[] = demo === 'vierge' ? [] : snapshot.pc.log.map((entry, index) => ({ id: `exemple-${index}`, at: Date.now() - (index + 1) * 5_400_000, title: entry.what, detail: entry.detail, undoable: true, undone: false }));

const testOnly: GameActionResult = { ok: false, simulated: true, message: 'Dans la version de test, la bibliothèque est un exemple. L\'ajout d\'un jeu fonctionne dans la version vierge, une fois l\'application installée.' };

// Version « navigateur » : sert à travailler l'interface sans Electron (npm run dev).
const webApi: WarmupApi = {
  getSnapshot: async () => (demo === 'vierge' ? buildRealSnapshot({ games: [], parts: snapshot.pc.parts, sessions: [], journal: [], now: Date.now() }) : demo === 'vide' ? { ...snapshot, games: [], notices: snapshot.notices.filter((n) => !n.gameId), reports: [], mods: [] } : snapshot),
  getSettings: async () => loadSettings(),
  setSettings: async (patch) => {
    const next = { ...loadSettings(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Le réglage vaut au moins pour cette session.
    }
    return next;
  },
  getProfileCard: async () => loadProfileCard(),
  setProfileCard: async (patch) => {
    const next = cleanProfileCard(patch, loadProfileCard());
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      // La personnalisation vaut au moins pour cette session.
    }
    return next;
  },
  getCollections: async () => loadCollections(),
  setCollections: async (list) => {
    const next = cleanCollections(list);
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
    } catch {
      // Les collections valent au moins pour cette session.
    }
    return next;
  },
  getAccount: async () => loadAccount(),
  setAccount: async (patch) => {
    const next = cleanAccount(patch, loadAccount());
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
    } catch {
      // Le compte vaut au moins pour cette session.
    }
    return next;
  },
  getFavorites: async () => {
    try {
      const saved = localStorage.getItem('warmup.favoris');
      return saved ? cleanFavorites(JSON.parse(saved)) : snapshot.games.filter((g) => g.favorite).map((g) => g.id);
    } catch {
      return [];
    }
  },
  setFavorites: async (ids) => {
    const next = cleanFavorites(ids);
    try {
      localStorage.setItem('warmup.favoris', JSON.stringify(next));
    } catch {
      // Les favoris valent au moins pour cette session.
    }
    return next;
  },
  // Dans le navigateur, il n'y a pas de service en ligne : la connexion reste l'exemple.
  linkSteam: async () => ({ ok: false, message: 'Dans la version de test, les plateformes sont un exemple.' }),
  unlinkSteam: async () => ({ ok: false, message: 'Dans la version de test, les plateformes sont un exemple.' }),
  getAccountService: async () => ({ online: false }),
  requestLoginCode: async () => ({ ok: false, message: 'Le service en ligne n\'est pas disponible dans le navigateur.' }),
  verifyLoginCode: async () => ({ ok: false, message: 'Le service en ligne n\'est pas disponible dans le navigateur.' }),
  addGame: async () => testOnly,
  renameGame: async () => testOnly,
  removeGame: async () => testOnly,
  getJournal: async () => demoJournal,
  undoFix: async (id) => (demoJournal = demoJournal.map((entry) => (entry.id === id && entry.undoable ? { ...entry, undone: true } : entry))),
  getGameOptions: async () => loadGameOptions(),
  setGameOptions: async (gameId, patch) => {
    const all = loadGameOptions();
    const next = cleanAllGameOptions({ ...all, [gameId]: cleanGameOptions(patch, all[gameId] ?? defaultGameOptions) });
    try {
      localStorage.setItem(GAME_OPTIONS_KEY, JSON.stringify(next));
    } catch {
      // Les options valent au moins pour cette session.
    }
    return next;
  },
  getGameFiles: async (gameId) => {
    const game = snapshot.games.find((g) => g.id === gameId);
    const source = game && ['Steam', 'GOG', 'Battle.net', 'Rockstar'].includes(game.source) ? (game.source as 'Steam') : null;
    return { found: Boolean(game), example: true, folder: game?.location ?? '', sizeGb: game?.sizeGb ?? null, source, canUninstall: Boolean(game), canVerify: source === 'Steam' };
  },
  openGameFolder: () => simulated('Exemple : dans l\'application installée, le dossier du jeu s\'ouvre dans l\'explorateur.'),
  verifyGameFiles: () => simulated('Exemple : dans l\'application installée, Steam vérifie les fichiers et répare ceux qui manquent.'),
  uninstallGame: (gameId) => simulated(`${snapshot.games.find((g) => g.id === gameId)?.title ?? 'Le jeu'} est désinstallé (exemple : rien n'a été supprimé sur ce PC).`),
  applyFix: async () => ({ ok: true, message: 'Exemple : la correction s\'applique dans l\'application installée sous Windows. Rien n\'a été modifié.' }),
  openOfficial: async () => ({ ok: true, message: 'Exemple : la page officielle s\'ouvre dans l\'application installée.' }),
  getPcReport: async () => ({ example: true, checkedAt: 'Contrôlé il y a 2 minutes', parts: snapshot.pc.parts, issues: snapshot.pc.issues }),
  detectGames: async () => exampleDetection,
  startLaunch(gameId, onEvent) {
    const game = snapshot.games.find((g) => g.id === gameId);
    if (!game) return () => undefined;
    // Contrôles désactivés pour ce jeu : il « s'ouvre » tout de suite.
    if (!(loadGameOptions()[gameId] ?? defaultGameOptions).checks) {
      const timer = setTimeout(() => onEvent({ type: 'started', real: false }), 300);
      return () => clearTimeout(timer);
    }
    return simulateLaunch(game.launch.steps.length, onEvent);
  }
};

export const api: WarmupApi = window.warmup ?? webApi;
