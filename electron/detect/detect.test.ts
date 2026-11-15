import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { BATTLENET_CODES } from './battlenet';
import { readItem } from './epic';
import { gamesFromRegistry } from './gog';
import { detectAll, detectGames, matchLibrary, type DetectContext } from './index';
import { parseRegOutput, REGISTRY_KEYS } from './registry';
import { riotClient, yamlValue } from './riot';
import { libraryPaths, readManifest } from './steam';
import { installedPrograms } from './uninstall';
import { parseVdf } from './vdf';

// Les tests construisent un faux PC dans un dossier temporaire à partir des fichiers de `exemples/`,
// puis vérifient que la détection y retrouve les bons jeux. Lancer : npm test.

const samples = path.join(process.cwd(), 'electron', 'detect', 'exemples');
const sample = (name: string, values: Record<string, string> = {}): string => {
  let text = fs.readFileSync(path.join(samples, name), 'utf8');
  for (const [key, value] of Object.entries(values)) text = text.split(`{{${key}}}`).join(value);
  return text;
};
// Dans un fichier Steam, la barre oblique inverse s'écrit en double.
const vdfPath = (dir: string): string => dir.replace(/\\/g, '\\\\');

let pc = '';
const library = [
  { id: 'baldurs-gate-3', title: 'Baldur\'s Gate 3' },
  { id: 'monster-hunter-wilds', title: 'Monster Hunter Wilds' },
  { id: 'the-witcher-3', title: 'The Witcher 3' },
  { id: 'cyberpunk-2077', title: 'Cyberpunk 2077' },
  { id: 'hades-2', title: 'Hades II' },
  { id: 'diablo-4', title: 'Diablo IV' },
  { id: 'red-dead-redemption-2', title: 'Red Dead Redemption 2' },
  { id: 'valorant', title: 'Valorant' }
];

// Dossiers du faux PC cités par la liste des programmes installés.
const programFolders = () => ({
  BATTLENET: path.join(pc, 'Battle.net'),
  DIABLO: path.join(pc, 'Jeux', 'Diablo IV'),
  INCONNU: path.join(pc, 'Jeux', 'Inconnu'),
  ROCKSTAR: path.join(pc, 'Rockstar Games', 'Launcher'),
  RDR2: path.join(pc, 'Rockstar Games', 'Red Dead Redemption 2'),
  ABSENT: path.join(pc, 'Rockstar Games', 'GTA V'),
  AGENT: path.join(pc, 'ProgramData', 'Battle.net', 'Agent')
});

function context(platform: NodeJS.Platform): DetectContext {
  const witcher = path.join(pc, 'GOG', 'The Witcher 3');
  const cyberpunk = path.join(pc, 'GOG', 'Cyberpunk 2077');
  return {
    platform,
    home: path.join(pc, 'home'),
    env: { 'ProgramFiles(x86)': path.join(pc, 'Program Files (x86)'), ProgramData: path.join(pc, 'ProgramData') },
    registry: async (key) => {
      if (key === REGISTRY_KEYS.gogGames) return sample('gog-registre.txt', { 'DOSSIER-WITCHER': witcher, 'EXE-WITCHER': path.join(witcher, 'bin', 'x64', 'witcher3.exe'), 'DOSSIER-CYBERPUNK': cyberpunk, 'DOSSIER-ABSENT': path.join(pc, 'GOG', 'Absent') });
      if (key === REGISTRY_KEYS.uninstall32) return sample('windows-programmes.txt', programFolders());
      if (key === REGISTRY_KEYS.steamUser) return `HKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    ${path.join(pc, 'Program Files (x86)', 'Steam')}\r\n`;
      return '';
    }
  };
}

before(() => {
  pc = fs.mkdtempSync(path.join(os.tmpdir(), 'warmup-detection-'));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
  };
  const steam = path.join(pc, 'Program Files (x86)', 'Steam');
  const second = path.join(pc, 'D', 'SteamLibrary');
  write(path.join(steam, 'steamapps', 'libraryfolders.vdf'), sample('steam-libraryfolders.vdf', { 'BIBLIOTHEQUE-0': vdfPath(steam), 'BIBLIOTHEQUE-1': vdfPath(second) }));
  write(path.join(steam, 'steamapps', 'appmanifest_228980.acf'), sample('steam-appmanifest_228980.acf'));
  write(path.join(second, 'steamapps', 'appmanifest_1086940.acf'), sample('steam-appmanifest_1086940.acf'));
  write(path.join(second, 'steamapps', 'appmanifest_2246340.acf'), sample('steam-appmanifest_2246340.acf'));
  write(path.join(second, 'steamapps', 'appmanifest_999.acf'), 'fichier abîmé {{{ "');

  const manifests = path.join(pc, 'ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  const epicFolder = JSON.stringify(path.join(pc, 'Epic Games', 'rocketleague')).slice(1, -1);
  write(path.join(manifests, 'A1.item'), sample('epic-jeu.item', { DOSSIER: epicFolder }));
  write(path.join(manifests, 'A2.item'), sample('epic-contenu.item', { DOSSIER: epicFolder }));
  write(path.join(manifests, 'A3.item'), sample('epic-moteur.item', { DOSSIER: epicFolder }));
  write(path.join(manifests, 'A4.item'), '{ ceci n\'est pas du JSON');

  write(path.join(pc, 'GOG', 'The Witcher 3', 'goggame-1207664663.info'), '{"gameId":"1207664663","name":"The Witcher 3: Wild Hunt"}');
  fs.mkdirSync(path.join(pc, 'GOG', 'Cyberpunk 2077'), { recursive: true }); // dossier présent, fichier .info manquant

  const folders = programFolders();
  for (const name of ['BATTLENET', 'DIABLO', 'INCONNU', 'ROCKSTAR', 'RDR2'] as const) fs.mkdirSync(folders[name], { recursive: true }); // GTA V : dossier absent

  const riot = path.join(pc, 'ProgramData', 'Riot Games');
  const valorant = path.join(pc, 'Riot Games', 'VALORANT');
  fs.mkdirSync(valorant, { recursive: true });
  const json = (value: string) => JSON.stringify(value).slice(1, -1);
  write(path.join(riot, 'RiotClientInstalls.json'), sample('riot-installs.json', { CLIENT: json(path.join(pc, 'Riot Games', 'Riot Client', 'RiotClientServices.exe')) }));
  write(path.join(riot, 'Metadata', 'valorant.live', 'valorant.live.product_settings.yaml'), sample('riot-valorant.product_settings.yaml', { DOSSIER: json(valorant) }));
  write(path.join(riot, 'Metadata', 'riot_client.live', 'riot_client.live.product_settings.yaml'), 'product_install_full_path: "C:/Riot Games/Riot Client"');
});

after(() => fs.rmSync(pc, { recursive: true, force: true }));

test('format Steam : clés, sous-niveaux et barres obliques inverses', () => {
  const node = parseVdf('"A"\n{\n\t"Chemin"\t"C:\\\\Jeux\\\\Steam"\n\t"b" { "c" "1" }\n}');
  assert.deepEqual(JSON.parse(JSON.stringify(node)), { a: { chemin: 'C:\\Jeux\\Steam', b: { c: '1' } } });
});

test('format Steam : un fichier abîmé ne fait rien planter', () => {
  assert.doesNotThrow(() => parseVdf('"a" { "b" '));
  assert.doesNotThrow(() => parseVdf('}}}{{{'));
  assert.deepEqual(Object.keys(parseVdf('')), []);
});

test('Steam : bibliothèques de l\'ancien format, avec des chemins Windows', () => {
  assert.deepEqual(libraryPaths(sample('steam-libraryfolders-ancien.vdf')), ['D:\\SteamLibrary', 'E:\\Jeux\\Steam']);
});

test('Steam : lecture d\'un jeu installé', () => {
  const game = readManifest(sample('steam-appmanifest_1086940.acf'), '/bibli');
  assert.deepEqual(game, { source: 'Steam', storeId: '1086940', title: 'Baldur\'s Gate 3', folder: path.join('/bibli', 'steamapps', 'common', 'Baldurs Gate 3'), sizeGb: 139.6, complete: true, launch: { kind: 'url', url: 'steam://rungameid/1086940' }, uninstall: { kind: 'url', url: 'steam://uninstall/1086940' }, verify: { kind: 'url', url: 'steam://validate/1086940' } });
});

test('Steam : outil ignoré, mise à jour en cours signalée, dossier piégé refusé', () => {
  assert.equal(readManifest(sample('steam-appmanifest_228980.acf'), '/bibli'), null);
  assert.equal(readManifest(sample('steam-appmanifest_2246340.acf'), '/bibli')?.complete, false);
  assert.equal(readManifest('"AppState" { "appid" "5" "name" "Piège" "installdir" "..\\\\..\\\\Windows" }', '/bibli'), null);
});

test('Epic : jeu lu, contenu additionnel et moteur ignorés', () => {
  const game = readItem(sample('epic-jeu.item', { DOSSIER: '/jeux/rocketleague' }));
  assert.equal(game?.title, 'Rocket League');
  assert.equal(game?.storeId, 'Sugar');
  assert.equal(game?.sizeGb, 27.4);
  assert.equal(readItem(sample('epic-contenu.item', { DOSSIER: '/x' })), null);
  assert.equal(readItem(sample('epic-moteur.item', { DOSSIER: '/x' })), null);
  assert.equal(readItem('[]'), null);
  assert.deepEqual(game?.launch, { kind: 'url', url: 'com.epicgames.launcher://apps/Sugar?action=launch&silent=true' });
  // Un identifiant qui pourrait détourner l'adresse de lancement est refusé.
  assert.equal(readItem(JSON.stringify({ AppName: 'x&y=1', DisplayName: 'Piège', InstallLocation: '/x' })), null);
});

test('liste des programmes installés : nom, dossier, taille', () => {
  const programs = installedPrograms(sample('windows-programmes.txt', { BATTLENET: 'C:\\Battle.net', DIABLO: 'D:\\Diablo IV', INCONNU: 'D:\\x', ROCKSTAR: 'C:\\Rockstar', RDR2: 'D:\\RDR2', ABSENT: 'D:\\GTA' }));
  assert.equal(programs.length, 7);
  const diablo = programs.find((p) => p.name === 'Diablo IV');
  assert.equal(diablo?.folder, 'D:\\Diablo IV');
  assert.equal(diablo?.sizeKb, 0x5800000);
});

test('Riot : fichier YAML et emplacement du client', () => {
  assert.equal(yamlValue('a: 1\nproduct_install_full_path: "C:/Riot Games/VALORANT"\n', 'product_install_full_path'), 'C:/Riot Games/VALORANT');
  assert.equal(riotClient('{ pas du json'), '');
  assert.equal(BATTLENET_CODES.fenris, 'Fen');
});

test('registre : lecture de la sortie de « reg query »', () => {
  const keys = parseRegOutput(sample('gog-registre.txt'));
  assert.equal(keys.size, 5);
  assert.equal(keys.get('HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1423049311')?.gamename, 'Cyberpunk 2077');
});

test('GOG : les contenus additionnels ne sont pas des jeux', () => {
  const titles = gamesFromRegistry(sample('gog-registre.txt')).map((g) => g.title);
  assert.deepEqual(titles, ['The Witcher 3: Wild Hunt', 'Cyberpunk 2077', 'Jeu supprime a la main']);
});

test('rapprochement avec la bibliothèque', () => {
  assert.equal(matchLibrary('BALDUR’S GATE 3', library), 'baldurs-gate-3');
  assert.equal(matchLibrary('The Witcher 3: Wild Hunt', library), 'the-witcher-3');
  assert.equal(matchLibrary('Hades', library), null);
  assert.equal(matchLibrary('Rocket League', library), null);
});

test('faux PC Windows : les six plateformes sont lues', async () => {
  const { report, found } = await detectAll(library, context('win32'));
  assert.deepEqual(report.stores.map((s) => [s.source, s.found, s.note]), [
    ['Steam', true, '2 jeux installés.'],
    ['Epic', true, '1 jeu installé.'],
    ['GOG', true, '2 jeux installés.'],
    ['Battle.net', true, '2 jeux installés.'],
    ['Rockstar', true, '1 jeu installé.'],
    ['Riot', true, '1 jeu installé.']
  ]);
  assert.deepEqual(report.games.map((g) => [g.title, g.source, g.complete, g.libraryId, g.canLaunch]), [
    ['Baldur\'s Gate 3', 'Steam', true, 'baldurs-gate-3', true],
    ['Cyberpunk 2077', 'GOG', false, 'cyberpunk-2077', false],
    ['Diablo IV', 'Battle.net', true, 'diablo-4', true],
    ['Jeu Blizzard inconnu', 'Battle.net', true, null, false],
    ['Monster Hunter Wilds', 'Steam', false, 'monster-hunter-wilds', false],
    ['Red Dead Redemption 2', 'Rockstar', true, 'red-dead-redemption-2', true],
    ['Rocket League', 'Epic', true, null, true],
    ['The Witcher 3: Wild Hunt', 'GOG', true, 'the-witcher-3', true],
    ['VALORANT', 'Riot', true, 'valorant', true]
  ]);
  assert.equal(report.games[0].folder, path.join(pc, 'D', 'SteamLibrary', 'steamapps', 'common', 'Baldurs Gate 3'));
  // Ce que reçoit l'interface ne contient jamais la manière de lancer.
  assert.ok(report.games.every((g) => !('launch' in g)));

  const plan = (title: string) => found.find((g) => g.title === title)?.launch;
  assert.deepEqual(plan('Diablo IV'), { kind: 'exe', file: path.join(pc, 'Battle.net', 'Battle.net.exe'), args: ['--exec=launch Fen'], cwd: path.join(pc, 'Battle.net') });
  assert.deepEqual(plan('VALORANT'), { kind: 'exe', file: path.join(pc, 'Riot Games', 'Riot Client', 'RiotClientServices.exe'), args: ['--launch-product=valorant', '--launch-patchline=live'], cwd: path.join(pc, 'Riot Games', 'Riot Client') });
  assert.deepEqual(plan('Red Dead Redemption 2')?.kind === 'exe' && plan('Red Dead Redemption 2'), { kind: 'exe', file: path.normalize(`${programFolders().ROCKSTAR}\\Launcher.exe`), args: ['-launchTitleInFolder', programFolders().RDR2], cwd: path.dirname(path.normalize(`${programFolders().ROCKSTAR}\\Launcher.exe`)) });
  // Désinstallation par le programme officiel de chaque plateforme.
  const removal = (title: string) => found.find((g) => g.title === title)?.uninstall;
  const agent = `${programFolders().AGENT}\\Blizzard Uninstaller.exe`;
  assert.deepEqual(removal('Diablo IV'), { kind: 'exe', file: agent, args: ['--lang=frFR', '--uid=fenris', '--displayname=Diablo IV'], cwd: path.dirname(agent) });
  const args = (title: string) => { const plan = removal(title); return plan?.kind === 'exe' ? plan.args : null; };
  assert.deepEqual(args('VALORANT'), ['--uninstall-product=valorant', '--uninstall-patchline=live']);
  assert.deepEqual(args('Red Dead Redemption 2'), ['-uninstall=rdr2']);
  assert.equal(removal('Cyberpunk 2077'), null); // pas de désinstalleur GOG dans le dossier
  assert.deepEqual(plan('The Witcher 3: Wild Hunt'), { kind: 'exe', file: path.join(pc, 'GOG', 'The Witcher 3', 'bin', 'x64', 'witcher3.exe'), args: [], cwd: path.join(pc, 'GOG', 'The Witcher 3') });
});

test('PC sans aucune plateforme : liste vide, sans erreur', async () => {
  const empty: DetectContext = { platform: 'win32', home: path.join(pc, 'vide'), env: { ProgramData: path.join(pc, 'vide') }, registry: async () => '' };
  const report = await detectGames(library, empty);
  assert.equal(report.games.length, 0);
  assert.ok(report.stores.every((s) => !s.found));
});

test('Mac : GOG annoncé comme réservé à Windows', async () => {
  const report = await detectGames(library, { ...context('darwin'), home: path.join(pc, 'vide') });
  assert.equal(report.stores.find((s) => s.source === 'GOG')?.note, 'La recherche des jeux GOG fonctionne sous Windows.');
});

test('arguments de lancement : seuls les réglages simples passent', async () => {
  const { splitArgs, cleanGameOptions, defaultGameOptions } = await import('../../shared/types');
  const { withArgs } = await import('../launch');
  assert.deepEqual(splitArgs('-dx12  -skipintro'), ['-dx12', '-skipintro']);
  assert.deepEqual(splitArgs('-dx12; rm -rf'), []);
  assert.deepEqual(splitArgs('"-x" & calc'), []);
  assert.equal(cleanGameOptions({ args: '-a | b', checks: false }, defaultGameOptions).args, '');
  assert.equal(cleanGameOptions({ args: '-a | b', checks: false }, defaultGameOptions).checks, false);
  assert.deepEqual(withArgs({ kind: 'exe', file: '/jeu.exe', args: ['--exec=launch Fen'], cwd: '/' }, ['-dx12']).kind === 'exe' && withArgs({ kind: 'exe', file: '/jeu.exe', args: ['--exec=launch Fen'], cwd: '/' }, ['-dx12']), { kind: 'exe', file: '/jeu.exe', args: ['--exec=launch Fen', '-dx12'], cwd: '/' });
  assert.deepEqual(withArgs({ kind: 'url', url: 'steam://rungameid/730' }, ['-novid', '-high']), { kind: 'url', url: 'steam://run/730//-novid%20-high/' });
});
