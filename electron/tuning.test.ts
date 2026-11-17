import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePaths, relaunchable } from './corrections';
import { evaluate, heavyApps, parseState } from './tuning';

const SAMPLE = JSON.stringify({
  procs: [
    { name: 'chrome.exe', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', memMb: 900 },
    { name: 'chrome.exe', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', memMb: 600 },
    { name: 'OneDrive.exe', path: 'C:\\Users\\Joueur\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe', memMb: 150 },
    { name: 'cmd.exe', path: 'C:\\Windows\\System32\\cmd.exe', memMb: 5 }
  ]
});

test('programmes gourmands : seuls ceux de la liste sont gardés, regroupés par application', () => {
  const state = parseState(SAMPLE);
  assert.equal(state.procs.length, 3); // cmd.exe n'est pas dans la liste
  const apps = heavyApps(state);
  assert.deepEqual(apps.map((a) => [a.label, a.memMb, a.paths.length]), [['Google Chrome', 1500, 1], ['OneDrive', 150, 1]]);
  assert.deepEqual(parseState('pas du json').procs, []);
});

test('programmes gourmands : au-delà de 800 Mo, une correction est proposée, et rien en dessous', () => {
  const heavy = evaluate(parseState(SAMPLE));
  assert.equal(heavy.parts[0].status, 'warn');
  assert.equal(heavy.issues[0].fix, 'programmes');
  assert.match(heavy.issues[0].why, /Google Chrome \(1,5 Go\), OneDrive \(150 Mo\)/);
  const light = evaluate(parseState(JSON.stringify({ procs: [{ name: 'onedrive.exe', path: 'C:\\o\\OneDrive.exe', memMb: 120 }] })));
  assert.equal(light.parts[0].status, 'ok');
  assert.equal(light.issues.length, 0);
});

test('programmes gourmands : seul un programme de la liste, encore présent, peut être rouvert', () => {
  assert.equal(relaunchable('C:\\Windows\\System32\\cmd.exe'), false);
  assert.equal(relaunchable('C:\\nulle-part\\chrome.exe'), false); // n'existe pas
  assert.equal(relaunchable(42), false);
  assert.deepEqual(parsePaths('["C:\\\\Windows\\\\System32\\\\cmd.exe"]'), []);
  assert.deepEqual(parsePaths('pas du json'), []);
});

test('mode Jeu et planification GPU : lus dans le registre, corrigés ou expliqués', () => {
  const off = evaluate(parseState(JSON.stringify({ procs: [], gameMode: 0, hags: 1 })));
  assert.deepEqual(off.parts.map((p) => [p.name, p.status]), [['Arrière-plan', 'ok'], ['Mode Jeu', 'warn'], ['Planification GPU', 'warn']]);
  assert.equal(off.issues.find((i) => i.fix === 'mode-jeu')?.action, 'Activer le mode Jeu');
  assert.equal(off.issues.find((i) => i.open === 'reglages-graphiques')?.action, 'Ouvrir les réglages graphiques');
  // Valeur absente : le mode Jeu est actif par défaut ; carte sans planification GPU : rien n'est affiché.
  const fresh = evaluate(parseState(JSON.stringify({ procs: [] })));
  assert.deepEqual(fresh.parts.map((p) => [p.name, p.status]), [['Arrière-plan', 'ok'], ['Mode Jeu', 'ok']]);
  assert.equal(fresh.issues.length, 0);
  // Valeurs inattendues écartées.
  assert.equal(parseState(JSON.stringify({ gameMode: 7, hags: 'oui' })).gameMode, null);
});

test('fréquence de l\'écran : un écran 144 Hz réglé sur 60 Hz est repéré, sinon rien', () => {
  const low = evaluate(parseState(JSON.stringify({ procs: [], display: { hz: 60, rates: [60, 120, 144, 59] } })));
  const part = low.parts.find((p) => p.name === 'Fréquence de l\'écran');
  assert.equal(part?.status, 'warn');
  assert.equal(part?.big, '60 Hz sur 144 possibles');
  assert.equal(low.issues.find((i) => i.fix === 'frequence')?.action, 'Passer à 144 Hz');
  const good = evaluate(parseState(JSON.stringify({ procs: [], display: { hz: 144, rates: [60, 144] } })));
  assert.equal(good.parts.find((p) => p.name === 'Fréquence de l\'écran')?.status, 'ok');
  // 59 et 60 Hz : la même chose, rien à proposer ; valeurs absurdes écartées.
  assert.equal(evaluate(parseState(JSON.stringify({ display: { hz: 59, rates: [59, 60] } }))).issues.length, 0);
  assert.equal(parseState(JSON.stringify({ display: { hz: 1, rates: [1] } })).display, null);
  assert.deepEqual(parseState(JSON.stringify({ display: { hz: 60, rates: [60, 'x', 5000, 75] } })).display?.rates, [60, 75]);
});

test('disques : place manquante et jeux sur disque dur alors qu\'un SSD a de la place', async () => {
  const state = parseState(JSON.stringify({
    procs: [],
    disks: [
      { letter: 'C', media: 'SSD', freeGb: 310, sizeGb: 1000 },
      { letter: 'D', media: 'HDD', freeGb: 12, sizeGb: 2000 },
      { letter: 'z', media: 'Unspecified', freeGb: 5, sizeGb: 64 }
    ]
  }));
  assert.deepEqual(state.disks.map((d) => [d.letter, d.media]), [['C', 'SSD'], ['D', 'HDD'], ['Z', 'Inconnu']]);
  const result = evaluate(state, { games: [{ title: 'Elden Ring', folder: 'D:\\SteamLibrary\\steamapps\\common\\ELDEN RING', sizeGb: 60 }], fpsTool: false });
  const full = result.issues.find((i) => i.open === 'stockage');
  assert.ok(full);
  assert.match(full.why, /D: \(12 Go libres\)/); // Z: ne porte ni le système ni un jeu : il n'est pas signalé
  assert.ok(!full.why.includes('Z:'));
  const slow = result.issues.find((i) => i.title === 'Déplacer Elden Ring sur le SSD');
  assert.ok(slow && !slow.fix && !slow.open); // explication seulement : Warmup ne déplace aucun fichier
  // Plus de place sur le SSD que le jeu n'en demande : rien à proposer.
  const tight = evaluate(state, { games: [{ title: 'Énorme', folder: 'D:\\Jeux\\Enorme', sizeGb: 400 }], fpsTool: false });
  assert.ok(!tight.issues.some((i) => i.title.startsWith('Déplacer')));
});

test('mises à jour Windows et autorisation de mesure des images', () => {
  const busy = evaluate(parseState(JSON.stringify({ procs: [], updatesDownloading: true, fpsAllowed: false, fpsPending: false, user: 'PC-JEU\\Joueur' })), { games: [], fpsTool: true });
  assert.ok(busy.issues.some((i) => i.open === 'windows-update'));
  assert.ok(busy.issues.some((i) => i.fix === 'mesure-fps'));
  const pending = evaluate(parseState(JSON.stringify({ procs: [], fpsAllowed: false, fpsPending: true })), { games: [], fpsTool: true });
  assert.equal(pending.parts.find((p) => p.name === 'Mesure des images')?.big, 'Reconnexion nécessaire');
  assert.ok(!pending.issues.some((i) => i.fix === 'mesure-fps'));
  // Sans l'outil de mesure livré, rien n'est proposé ; mises à jour inconnues : rien n'est affiché.
  const none = evaluate(parseState(JSON.stringify({ procs: [], fpsAllowed: false })), { games: [], fpsTool: false });
  assert.ok(!none.parts.some((p) => p.name === 'Mesure des images' || p.name === 'Mises à jour Windows'));
});

test('compte Windows et fabricant du pilote reconnus sans rien laisser passer', async () => {
  const { validUser } = await import('./tuning');
  assert.ok(validUser('PC-JEU\\Joueur'));
  assert.ok(validUser('AzureAD\\Romain Vanhove'));
  assert.ok(!validUser("PC\\x'; Remove-Item C:\\ -Recurse; '"));
  assert.ok(!validUser('Joueur'));
  assert.equal(parseState(JSON.stringify({ user: "PC\\a'b" })).user, null);
  const { driverVendor } = await import('./hardware');
  assert.equal(driverVendor('NVIDIA GeForce RTX 4070')?.target, 'pilote-nvidia');
  assert.equal(driverVendor('AMD Radeon RX 7800 XT')?.target, 'pilote-amd');
  assert.equal(driverVendor('Intel(R) Arc(TM) A770')?.target, 'pilote-intel');
  assert.equal(driverVendor('Microsoft Basic Display Adapter'), null);
});
