import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { snapshot as demoSnapshot } from '../shared/mock-data';
import { detectAll, type MatchedGame } from './detect';
import { readPc } from './hardware';
import { journal, loadDemoJournal, loadJournal, logAction, undo } from './journal';
import { openFolder, openGame, withArgs } from './launch';
import { addManualGame, findLibraryGame, loadManualGames, realSnapshot, refreshLibrary, removeManualGame, renameManualGame } from './library';
import { isAdmin } from './admin';
import { forcedTest } from './mode';
import { loadSessions, stopTracking, trackGame } from './sessions';
import { simulateLaunch } from '../shared/launch-sim';
import { cleanAccount, cleanAllGameOptions, cleanGameOptions, cleanCollections, defaultGameOptions, splitArgs, cleanProfileCard, defaultAccount, defaultProfileCard, defaultSettings, settingKeys, type Account, type Collection, type GameActionResult, type GameFiles, type GameOptions, type LaunchEvent, type PcReport, type ProfileCard, type Settings, type Snapshot, type Source } from '../shared/types';

// Partie système. C'est le seul endroit qui a le droit de toucher au PC.
// Version vierge (la règle) : elle ne montre que ce qu'elle lit sur ce PC (electron/library.ts).
// Version de test : elle répond avec les données d'exemple (shared/mock-data.ts). Elle est réservée au compte admin.
let demo = false;

/** Jeux actuellement affichés : ceux de l'exemple, ou ceux de la bibliothèque réelle. */
let realData: Snapshot | null = null;
const gamesNow = () => (demo ? demoSnapshot.games : realData?.games ?? []);

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
  if (!demo && !realData) return card; // bibliothèque pas encore lue : on ne retire rien
  const known = (id: string) => gamesNow().some((g) => g.id === id);
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
// Les collections de la version de test citent des jeux d'exemple : elles sont rangées à part de celles de la vraie bibliothèque.
const collectionsFile = () => path.join(app.getPath('userData'), demo ? 'collections.json' : 'collections-bibliotheque.json');

// Une collection ne peut contenir que des jeux de la bibliothèque.
const knownOnly = (list: Collection[]): Collection[] =>
  demo || realData ? list.map((c) => ({ ...c, gameIds: c.gameIds.filter((id) => gamesNow().some((g) => g.id === id)) })) : list;

function readCollections(): Collection[] {
  try {
    return cleanCollections(JSON.parse(fs.readFileSync(collectionsFile(), 'utf8')));
  } catch {
    // Première ouverture : les collections d'exemple dans la version de test, aucune dans la version vierge.
    return demo ? cleanCollections(undefined) : [];
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
const knownGame = (gameId: unknown) => (typeof gameId === 'string' ? gamesNow().find((g) => g.id === gameId) : undefined);

// Dernière recherche des jeux installés. Elle reste ici : les manières de lancer ne quittent jamais la partie système.
let found: MatchedGame[] | null = null;
async function detect() {
  const result = await detectAll(demoSnapshot.games.map((g) => ({ id: g.id, title: g.title })));
  found = result.found;
  return result;
}

/** Ce que la partie système sait d'un jeu installé : où il est, comment le lancer, le vérifier, le désinstaller. */
interface Copy { title: string; source: Source; folder: string; sizeGb: number | null; complete: boolean; launch: MatchedGame['launch']; uninstall: MatchedGame['launch']; verify: MatchedGame['launch']; manual: boolean }
async function copyOf(gameId: unknown): Promise<Copy | undefined> {
  const game = knownGame(gameId);
  if (!game) return undefined;
  if (!demo) return findLibraryGame(game.id);
  // Version de test : le jeu d'exemple est rapproché d'un jeu réellement installé, s'il y en a un.
  const match = (found ?? (await detect()).found).find((g) => g.libraryId === game.id);
  return match ? { title: game.title, source: match.source, folder: match.folder, sizeGb: match.sizeGb, complete: match.complete, launch: match.launch, uninstall: match.uninstall ?? null, verify: match.verify ?? null, manual: false } : undefined;
}

// Version vierge : la bibliothèque et le matériel sont relus, au plus une fois toutes les dix secondes.
let pcCache: { at: number; report: PcReport } | null = null;
let builtAt = 0;
async function buildReal(force = false): Promise<Snapshot> {
  if (!force && realData && Date.now() - builtAt < 10_000) return realData;
  await refreshLibrary();
  if (!pcCache || Date.now() - pcCache.at > 60_000) pcCache = { at: Date.now(), report: await readPc() };
  realData = realSnapshot(pcCache.report.parts);
  builtAt = Date.now();
  return realData;
}
const rebuildReal = (): void => {
  if (pcCache) realData = realSnapshot(pcCache.report.parts);
  builtAt = Date.now();
};
let collections: Collection[] = [];

/** Choisit la version à afficher d'après le compte connecté, et recharge ce qui en dépend. Renvoie vrai si elle a changé. */
let modeSet = false;
function applyMode(): boolean {
  const next = forcedTest() || (account.signedIn && isAdmin(account.email));
  if (modeSet && next === demo) return false;
  modeSet = true;
  demo = next;
  found = null;
  realData = null;
  builtAt = 0;
  collections = readCollections();
  if (demo) {
    loadDemoJournal(demoSnapshot.pc.log);
  } else {
    loadJournal();
    loadSessions();
    loadManualGames();
  }
  return true;
}
let settings: Settings = { ...defaultSettings };
let cancelLaunch: (() => void) | null = null;

function registerActions(): void {
  ipcMain.handle('data:snapshot', () => (demo ? demoSnapshot : buildReal()));
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_event, patch: unknown) => {
    settings = cleanSettings(patch, settings);
    writeSettings(settings);
    // Seul réglage qui touche au système : l'ouverture de Warmup au démarrage (application installée, version vierge).
    if (!demo && app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
    return settings;
  });

  ipcMain.handle('profile:get', () => knownGames(profileCard));
  ipcMain.handle('profile:set', (_event, patch: unknown) => {
    profileCard = knownGames(cleanProfileCard(patch, profileCard));
    writeProfileCard(profileCard);
    return profileCard;
  });

  ipcMain.handle('collections:get', () => knownOnly(collections));
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
    applyMode(); // le compte admin garde la version de test ; tout autre compte voit la version vierge
    return account;
  });

  // Aucun paramètre : l'interface ne choisit ni les dossiers ni les clés lus.
  ipcMain.handle('games:detect', async () => {
    if (demo) return (await detect()).report;
    const report = await refreshLibrary();
    rebuildReal();
    return report;
  });
  // Version de test : le matériel reste celui de l'exemple.
  ipcMain.handle('pc:report', async (): Promise<PcReport> => {
    if (demo) return { example: true, checkedAt: 'Contrôlé il y a 2 minutes', parts: demoSnapshot.pc.parts, issues: demoSnapshot.pc.issues };
    pcCache = { at: Date.now(), report: await readPc() };
    rebuildReal();
    return pcCache.report;
  });

  // Ajout d'un jeu à la main : c'est la partie système qui ouvre le sélecteur de fichiers ; l'interface n'envoie aucun chemin.
  const testOnly: GameActionResult = { ok: false, simulated: true, message: 'Dans la version de test, la bibliothèque est un exemple. L\'ajout d\'un jeu fonctionne dans la version vierge.' };
  ipcMain.handle('game:add', async (event) => {
    if (demo) return testOnly;
    const result = await addManualGame(BrowserWindow.fromWebContents(event.sender));
    rebuildReal();
    return result;
  });
  ipcMain.handle('game:rename', (_event, gameId: unknown, title: unknown) => {
    if (demo) return testOnly;
    const result = renameManualGame(gameId, title);
    rebuildReal();
    return result;
  });
  ipcMain.handle('game:remove', (_event, gameId: unknown) => {
    if (demo) return testOnly;
    const result = removeManualGame(gameId);
    rebuildReal();
    return result;
  });

  ipcMain.handle('journal:get', () => journal());
  ipcMain.handle('journal:undo', (_event, id: unknown) => undo(id));

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
  const installedCopy = copyOf;
  ipcMain.handle('game:files', async (_event, gameId: unknown): Promise<GameFiles> => {
    const copy = await installedCopy(gameId);
    if (!copy) return { found: false, example: false, folder: '', sizeGb: null, source: null, canUninstall: false, canVerify: false };
    return { found: true, example: false, folder: copy.folder, sizeGb: copy.sizeGb, source: copy.source === 'Manuel' ? null : copy.source, canUninstall: Boolean(copy.uninstall), canVerify: Boolean(copy.verify) };
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
    logAction({ kind: 'desinstallation', title: `Désinstallation de ${copy.title} lancée`, detail: `Par le programme officiel de ${copy.source}. Pour revenir en arrière, réinstallez le jeu depuis ${copy.source}.`, gameId: typeof gameId === 'string' ? gameId : undefined });
    return { ok: true, simulated: false, message: `Le programme de désinstallation de ${copy.source} s'est ouvert. Confirmez-y la désinstallation.` };
  });

  ipcMain.on('launch:start', async (event, gameId: unknown) => {
    const game = knownGame(gameId);
    if (!game) return; // Identifiant inconnu : on ne fait rien.
    cancelLaunch?.();
    const send = (launchEvent: LaunchEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send('launch:event', launchEvent);
    };
    // Le jeu est-il réellement installé sur ce PC, avec une manière connue de le lancer ?
    const installed = await copyOf(game.id);
    const options = optionsFor(game.id);
    const plan = installed?.launch && installed.complete ? withArgs(installed.launch, splitArgs(options.args)) : null;
    let cancelled = false;
    const start = () => {
      if (!plan) return send(demo ? { type: 'started', real: false } : { type: 'failed', reason: 'Warmup ne sait pas encore lancer ce jeu. Ouvrez-le depuis sa plateforme.' });
      void openGame(plan).then((result) => {
        if (cancelled) return;
        send(result.ok ? { type: 'started', real: true } : { type: 'failed', reason: result.reason });
        // Version vierge : la partie est suivie de l'extérieur, pour de vraies heures de jeu et un vrai bilan.
        if (result.ok && !demo && installed) trackGame(game.id, installed.folder, () => rebuildReal());
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
  account = readAccount();
  gameOptions = readGameOptions();
  applyMode();
  if (process.platform === 'darwin' && fs.existsSync(iconFile)) app.dock?.setIcon(iconFile);
  registerActions();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cancelLaunch?.();
  stopTracking();
  if (process.platform !== 'darwin') app.quit();
});
