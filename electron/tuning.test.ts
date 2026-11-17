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
