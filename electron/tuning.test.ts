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
  assert.deepEqual(parseState('pas du json'), { procs: [] });
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
