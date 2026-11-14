import { snapshot } from '../shared/mock-data';
import { simulateLaunch } from '../shared/launch-sim';
import { cleanAccount, cleanCollections, cleanProfileCard, defaultAccount, defaultProfileCard, defaultSettings, settingKeys, type Account, type Collection, type DetectionReport, type NominalApi, type ProfileCard, type Settings } from '../shared/types';

declare global {
  interface Window {
    nominal?: NominalApi;
  }
}

const KEY = 'nominal.settings';

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

const PROFILE_KEY = 'nominal.profile';

function loadProfileCard(): ProfileCard {
  try {
    return cleanProfileCard(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}'), defaultProfileCard);
  } catch {
    return { ...defaultProfileCard };
  }
}

const COLLECTIONS_KEY = 'nominal.collections';

function loadCollections(): Collection[] {
  try {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    return cleanCollections(saved ? JSON.parse(saved) : undefined);
  } catch {
    return cleanCollections(undefined);
  }
}

const ACCOUNT_KEY = 'nominal.account';

function loadAccount(): Account {
  try {
    return cleanAccount(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? '{}'), defaultAccount);
  } catch {
    return { ...defaultAccount };
  }
}

// Dans le navigateur, rien ne peut être lu sur le PC : on montre un exemple de résultat.
const exampleDetection: DetectionReport = {
  example: true,
  stores: [
    { source: 'Steam', found: true, note: '4 jeux installés.' },
    { source: 'Epic', found: true, note: '1 jeu installé.' },
    { source: 'GOG', found: true, note: '2 jeux installés.' }
  ],
  games: [
    { source: 'Steam', storeId: '1086940', title: 'Baldur\'s Gate 3', folder: 'D:\\SteamLibrary\\steamapps\\common\\Baldurs Gate 3', sizeGb: 139.6, complete: true, libraryId: 'baldurs-gate-3' },
    { source: 'Steam', storeId: '730', title: 'Counter-Strike 2', folder: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive', sizeGb: 34.2, complete: true, libraryId: 'counter-strike-2' },
    { source: 'GOG', storeId: '1423049311', title: 'Cyberpunk 2077', folder: 'D:\\GOG Games\\Cyberpunk 2077', sizeGb: null, complete: true, libraryId: 'cyberpunk-2077' },
    { source: 'Steam', storeId: '1245620', title: 'ELDEN RING', folder: 'D:\\SteamLibrary\\steamapps\\common\\ELDEN RING', sizeGb: 68.9, complete: true, libraryId: 'elden-ring' },
    { source: 'Epic', storeId: 'Sugar', title: 'Rocket League', folder: 'D:\\Epic Games\\rocketleague', sizeGb: 27.4, complete: true, libraryId: null },
    { source: 'Steam', storeId: '2246340', title: 'Monster Hunter Wilds', folder: 'D:\\SteamLibrary\\steamapps\\common\\MonsterHunterWilds', sizeGb: 51.3, complete: false, libraryId: 'monster-hunter-wilds' },
    { source: 'GOG', storeId: '1207664663', title: 'The Witcher 3: Wild Hunt', folder: 'D:\\GOG Games\\The Witcher 3 Wild Hunt GOTY', sizeGb: null, complete: true, libraryId: 'the-witcher-3' }
  ]
};

// Version « navigateur » : sert à travailler l'interface sans Electron (npm run dev).
const webApi: NominalApi = {
  getSnapshot: async () => snapshot,
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
  detectGames: async () => exampleDetection,
  startLaunch(gameId, onEvent) {
    const game = snapshot.games.find((g) => g.id === gameId);
    if (!game) return () => undefined;
    return simulateLaunch(game.launch.steps.length, onEvent);
  }
};

export const api: NominalApi = window.nominal ?? webApi;
