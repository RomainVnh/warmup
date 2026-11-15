import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { snapshot } from '../shared/mock-data';
import { detectAll, type MatchedGame } from './detect';
import { readPc } from './hardware';
import { openFolder, openGame, withArgs } from './launch';
import { simulateLaunch } from '../shared/launch-sim';
import { cleanAccount, cleanAllGameOptions, cleanGameOptions, cleanCollections, defaultGameOptions, splitArgs, cleanProfileCard, defaultAccount, defaultProfileCard, defaultSettings, settingKeys, type Account, type Collection, type GameActionResult, type GameFiles, type GameOptions, type LaunchEvent, type ProfileCard, type Settings } from '../shared/types';

// Partie système. C'est le seul endroit qui a le droit de toucher au PC.
// Pour l'instant elle répond avec des données factices (shared/mock-data.ts).

const devUrl = process.env.VITE_DEV_SERVER_URL;
// Icône de la fenêtre (Windows, Linux) et du Dock (Mac, en développement). Les fichiers sont dans build/.
const iconFile = path.join(__dirname, '../../build/icon.png');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// On ne garde que les réglages connus, et seulement s'ils valent vrai ou faux.
function cleanSettings(input: unknown, base: Settings): Settings {
  const next = { ...base };
  if (input && typeof input === 'object') {
    for (const key of settingKeys) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === 'boolean') next[key] = value;
    }
  }
  return next;
}

function readSettings(): Settings {
  try {
    return cleanSettings(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')), defaultSettings);
  } catch {
    return { ...defaultSettings };
  }
}

function writeSettings(settings: Settings): void {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    // Un échec d'écriture ne doit pas empêcher de jouer : le réglage vaut pour cette session.
  }
}

const profileFile = () => path.join(app.getPath('userData'), 'profile.json');

// Les jeux cités dans la carte de profil doivent exister dans la bibliothèque.
function knownGames(card: ProfileCard): ProfileCard {
  const known = (id: string) => snapshot.games.some((g) => g.id === id);
  return { ...card, bannerGameId: known(card.bannerGameId) ? card.bannerGameId : '', showcase: card.showcase.filter(known) };
}

function readProfileCard(): ProfileCard {
  try {
    return knownGames(cleanProfileCard(JSON.parse(fs.readFileSync(profileFile(), 'utf8')), defaultProfileCard));
  } catch {
    return { ...defaultProfileCard };
  }
}

function writeProfileCard(card: ProfileCard): void {
  try {
    fs.writeFileSync(profileFile(), JSON.stringify(card, null, 2), 'utf8');
  } catch {
    // La personnalisation vaut au moins pour cette session.
  }
}

let profileCard: ProfileCard = { ...defaultProfileCard };
const collectionsFile = () => path.join(app.getPath('userData'), 'collections.json');

// Une collection ne peut contenir que des jeux de la bibliothèque.
const knownOnly = (list: Collection[]): Collection[] =>
  list.map((c) => ({ ...c, gameIds: c.gameIds.filter((id) => snapshot.games.some((g) => g.id === id)) }));

function readCollections(): Collection[] {
  try {
    return knownOnly(cleanCollections(JSON.parse(fs.readFileSync(collectionsFile(), 'utf8'))));
  } catch {
    return cleanCollections(undefined);
  }
}

function writeCollections(list: Collection[]): void {
  try {
    fs.writeFileSync(collectionsFile(), JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // Les collections valent au moins pour cette session.
  }
}

const accountFile = () => path.join(app.getPath('userData'), 'account.json');

function readAccount(): Account {
  try {
    return cleanAccount(JSON.parse(fs.readFileSync(accountFile(), 'utf8')), defaultAccount);
  } catch {
    return { ...defaultAccount };
  }
}

function writeAccount(value: Account): void {
  try {
    fs.writeFileSync(accountFile(), JSON.stringify(value, null, 2), 'utf8');
  } catch {
    // Le compte vaut au moins pour cette session.
  }
}

let account: Account = { ...defaultAccount };

// Options de lancement de chaque jeu (fiche du jeu > Paramètres).
const gameOptionsFile = () => path.join(app.getPath('userData'), 'game-options.json');
let gameOptions: Record<string, GameOptions> = {};
function readGameOptions(): Record<string, GameOptions> {
  try {
    return cleanAllGameOptions(JSON.parse(fs.readFileSync(gameOptionsFile(), 'utf8')));
  } catch {
    return {};
  }
}
const optionsFor = (id: string): GameOptions => gameOptions[id] ?? defaultGameOptions;
const knownGame = (gameId: unknown) => (typeof gameId === 'string' ? snapshot.games.find((g) => g.id === gameId) : undefined);

// Dernière recherche des jeux installés. Elle reste ici : les manières de lancer ne quittent jamais la partie système.
let found: MatchedGame[] | null = null;
async function detect() {
  const result = await detectAll(snapshot.games.map((g) => ({ id: g.id, title: g.title })));
  found = result.found;
  return result;
}
let collections: Collection[] = cleanCollections(undefined);
let settings: Settings = { ...defaultSettings };
let cancelLaunch: (() => void) | null = null;

function registerActions(): void {
  ipcMain.handle('data:snapshot', () => snapshot);
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_event, patch: unknown) => {
    settings = cleanSettings(patch, settings);
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle('profile:get', () => profileCard);
  ipcMain.handle('profile:set', (_event, patch: unknown) => {
    profileCard = knownGames(cleanProfileCard(patch, profileCard));
    writeProfileCard(profileCard);
    return profileCard;
  });

  ipcMain.handle('collections:get', () => collections);
  ipcMain.handle('collections:set', (_event, list: unknown) => {
    // Une valeur qui n'est pas une liste est refusée : on garde les collections actuelles.
    if (Array.isArray(list)) {
      collections = knownOnly(cleanCollections(list));
      writeCollections(collections);
    }
    return collections;
  });

  ipcMain.handle('account:get', () => account);
  ipcMain.handle('account:set', (_event, patch: unknown) => {
    account = cleanAccount(patch, account);
    writeAccount(account);
    return account;
  });

  // Aucun paramètre : l'interface ne choisit ni les dossiers ni les clés lus.
  ipcMain.handle('games:detect', async () => (await detect()).report);
  ipcMain.handle('pc:report', () => readPc());

  ipcMain.handle('game-options:get', () => gameOptions);
  ipcMain.handle('game-options:set', (_event, gameId: unknown, patch: unknown) => {
    const game = knownGame(gameId);
    if (!game) return gameOptions; // identifiant inconnu : rien ne change
    gameOptions = cleanAllGameOptions({ ...gameOptions, [game.id]: cleanGameOptions(patch, optionsFor(game.id)) });
    try {
      fs.writeFileSync(gameOptionsFile(), JSON.stringify(gameOptions, null, 2), 'utf8');
    } catch {
      // Les options valent au moins pour cette session.
    }
    return gameOptions;
  });

  // Fichiers d'un jeu : seule la partie système connaît les dossiers et les programmes ; l'interface envoie un identifiant.
  const installedCopy = async (gameId: unknown) => {
    const game = knownGame(gameId);
    return game ? (found ?? (await detect()).found).find((g) => g.libraryId === game.id) : undefined;
  };
  ipcMain.handle('game:files', async (_event, gameId: unknown): Promise<GameFiles> => {
    const copy = await installedCopy(gameId);
    if (!copy) return { found: false, example: false, folder: '', sizeGb: null, source: null, canUninstall: false, canVerify: false };
    return { found: true, example: false, folder: copy.folder, sizeGb: copy.sizeGb, source: copy.source, canUninstall: Boolean(copy.uninstall), canVerify: Boolean(copy.verify) };
  });
  const notFound: GameActionResult = { ok: false, simulated: false, message: 'Warmup n\'a pas trouvé ce jeu sur ce PC. Relancez la recherche des jeux dans les réglages.' };
  ipcMain.handle('game:open-folder', async (_event, gameId: unknown): Promise<GameActionResult> => {
    const copy = await installedCopy(gameId);
    if (!copy) return notFound;
    const result = await openFolder(copy.folder);
    return result.ok ? { ok: true, simulated: false, message: 'Le dossier du jeu est ouvert.' } : { ok: false, simulated: false, message: result.reason };
  });
  ipcMain.handle('game:verify', async (_event, gameId: unknown): Promise<GameActionResult> => {
    const copy = await installedCopy(gameId);
    if (!copy) return notFound;
    if (!copy.verify) return { ok: false, simulated: false, message: `La vérification des fichiers se fait depuis ${copy.source}.` };
    const result = await openGame(copy.verify);
    return result.ok ? { ok: true, simulated: false, message: `${copy.source} vérifie les fichiers du jeu et répare ceux qui manquent.` } : { ok: false, simulated: false, message: result.reason };
  });
  ipcMain.handle('game:uninstall', async (_event, gameId: unknown): Promise<GameActionResult> => {
    const copy = await installedCopy(gameId);
    if (!copy) return notFound;
    if (!copy.uninstall) return { ok: false, simulated: false, message: `Warmup ne sait pas encore désinstaller les jeux ${copy.source}. Faites-le depuis ${copy.source} : clic droit sur le jeu, puis Désinstaller.` };
    const result = await openGame(copy.uninstall);
    if (!result.ok) return { ok: false, simulated: false, message: result.reason };
    found = null; // la prochaine recherche tiendra compte de la désinstallation
    return { ok: true, simulated: false, message: `Le programme de désinstallation de ${copy.source} s'est ouvert. Confirmez-y la désinstallation.` };
  });

  ipcMain.on('launch:start', async (event, gameId: unknown) => {
    const game = typeof gameId === 'string' ? snapshot.games.find((g) => g.id === gameId) : undefined;
    if (!game) return; // Identifiant inconnu : on ne fait rien.
    cancelLaunch?.();
    const send = (launchEvent: LaunchEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send('launch:event', launchEvent);
    };
    // Le jeu est-il réellement installé sur ce PC, avec une manière connue de le lancer ?
    const installed = (found ?? (await detect()).found).find((g) => g.libraryId === game.id && g.complete && g.launch);
    const options = optionsFor(game.id);
    const plan = installed?.launch ? withArgs(installed.launch, splitArgs(options.args)) : null;
    let cancelled = false;
    const start = () => {
      if (!plan) return send({ type: 'started', real: false });
      void openGame(plan).then((result) => {
        if (!cancelled) send(result.ok ? { type: 'started', real: true } : { type: 'failed', reason: result.reason });
      });
    };
    // Contrôles désactivés pour ce jeu : il s'ouvre tout de suite.
    if (!options.checks) {
      start();
      cancelLaunch = () => { cancelled = true; };
      return;
    }
    const stopSimulation = simulateLaunch(game.launch.steps.length, (launchEvent: LaunchEvent) => {
      if (launchEvent.type !== 'started') return send(launchEvent);
      start();
    });
    cancelLaunch = () => {
      cancelled = true;
      stopSimulation();
    };
  });

  ipcMain.on('launch:cancel', () => {
    cancelLaunch?.();
    cancelLaunch = null;
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#09090B',
    title: 'Warmup',
    icon: iconFile,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  // L'interface ne peut ni ouvrir de fenêtre, ni quitter l'application pour un site.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '../../dist/index.html'));
}

app.whenReady().then(() => {
  settings = readSettings();
  profileCard = readProfileCard();
  collections = readCollections();
  account = readAccount();
  gameOptions = readGameOptions();
  if (process.platform === 'darwin' && fs.existsSync(iconFile)) app.dock?.setIcon(iconFile);
  registerActions();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cancelLaunch?.();
  if (process.platform !== 'darwin') app.quit();
});
