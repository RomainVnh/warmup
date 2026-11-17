import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ago, buildRealSnapshot, duration, incident, type RealGameInput } from '../shared/real-data';
import type { SessionRecord } from '../shared/types';
import { readPlaytime } from './detect/steam';
import { cleanJournal } from './journal';
import { cleanManualGames, slug } from './library';
import { cleanSessions, insideFolder, parseNvidia, parsePing, parsePs, parseWindowsProcesses, thin } from './sessions';

// Version vierge : tout ce qui est affiché doit venir du PC. Ces tests vérifient les lectures et les calculs, sans PC Windows.

const NOW = new Date(2026, 10, 18, 21, 0).getTime(); // mercredi 18 novembre 2026, 21 h
const HOUR = 3_600_000;

const input = (over: Partial<RealGameInput>): RealGameInput => ({ id: 'jeu', title: 'Jeu', source: 'Steam', folder: '/jeux/jeu', sizeGb: 12, complete: true, catalogueId: null, steamId: null, manual: false, platformMinutes: null, platformLastPlayed: null, ...over });
const session = (gameId: string, start: number, seconds: number): SessionRecord => ({ id: `${gameId}-${start}`, gameId, start, end: start + seconds * 1000, seconds, peakMemMb: 4096, avgCpu: 37, samples: [2048, 3072, 4096] });

test('programmes ouverts : réponse de Windows', () => {
  const list = parseWindowsProcesses('[{"ExecutablePath":"D:\\\\Jeux\\\\Elden Ring\\\\Game\\\\eldenring.exe","WorkingSetSize":6442450944},{"ExecutablePath":null}]');
  assert.deepEqual(list, [{ path: 'D:\\Jeux\\Elden Ring\\Game\\eldenring.exe', memMb: 6144 }]);
  assert.deepEqual(parseWindowsProcesses('{"ExecutablePath":"C:\\\\a.exe","WorkingSetSize":1048576}'), [{ path: 'C:\\a.exe', memMb: 1 }]);
  assert.deepEqual(parseWindowsProcesses('pas du json'), []);
});

test('programmes ouverts : sortie de ps, et tri par dossier du jeu', () => {
  const procs = parsePs('  20480 /Applications/Chess.app/Contents/MacOS/Chess\n   1024 /usr/sbin/cfprefsd\n ligne étrange\n');
  assert.deepEqual(procs, [{ path: '/Applications/Chess.app/Contents/MacOS/Chess', memMb: 20 }, { path: '/usr/sbin/cfprefsd', memMb: 1 }]);
  assert.equal(insideFolder(procs, '/Applications/Chess.app').length, 1);
  assert.equal(insideFolder(procs, '/Applications/Chess').length, 0); // « Chess.app » n'est pas dans « Chess »
});

test('courbe de mémoire : 48 valeurs au plus, première et dernière gardées', () => {
  const long = Array.from({ length: 500 }, (_, i) => i);
  const short = thin(long);
  assert.equal(short.length, 48);
  assert.equal(short[0], 0);
  assert.equal(short[47], 499);
  assert.deepEqual(thin([1, 2, 3]), [1, 2, 3]);
});

test('temps de jeu tenu par Steam', () => {
  const text = '"UserLocalConfigStore"\n{\n "Software" { "Valve" { "Steam" { "apps" {\n  "730" { "LastPlayed" "1794000000" "Playtime" "38412" }\n  "1245620" { "Playtime" "90" }\n  "abc" { "Playtime" "5" }\n } } } }\n}';
  const played = readPlaytime(text);
  assert.deepEqual(played.get('730'), { minutes: 38412, lastPlayed: 1794000000000 });
  assert.deepEqual(played.get('1245620'), { minutes: 90, lastPlayed: 0 });
  assert.equal(played.has('abc'), false);
  assert.equal(readPlaytime('fichier abîmé {{').size, 0);
});

test('fichiers enregistrés : seules les lignes bien formées sont gardées', () => {
  assert.equal(cleanSessions([session('jeu', NOW, 120), { id: 'x' }, 'texte']).length, 1);
  assert.equal(cleanSessions('pas une liste').length, 0);
  assert.equal(cleanJournal([{ id: 'a', at: 1, title: 't', detail: 'd', undoable: false, undone: false }, { id: 'b' }]).length, 1);
  assert.equal(cleanManualGames([{ id: 'manuel-jeu', title: 'Jeu', file: '/Applications/Jeu.app', folder: '/Applications/Jeu.app', addedAt: 1 }, { id: 'piège', title: 'x', file: '/bin/sh', folder: '/' }, { id: 'manuel-b', title: 'B', file: 'relatif.exe', folder: '.' }]).length, 1);
  assert.equal(slug('Clair Obscur : Expédition 33 !'), 'clair-obscur-expedition-33');
});

test('dates et durées en clair', () => {
  assert.equal(duration(45), '1 min');
  assert.equal(duration(3725), '1 h 02');
  assert.equal(ago(null, NOW), 'Jamais lancé');
  assert.equal(ago(NOW - HOUR, NOW), 'Aujourd\'hui');
  assert.equal(ago(NOW - 24 * HOUR, NOW), 'Hier');
  assert.equal(ago(NOW - 3 * 24 * HOUR, NOW), 'Il y a 3 jours');
});

test('bibliothèque vierge : rien d\'inventé, heures et parties réelles', () => {
  const games = [
    input({ id: 'elden-ring', title: 'ELDEN RING', catalogueId: 'elden-ring', steamId: '1245620', platformMinutes: 600, platformLastPlayed: NOW - 2 * 24 * HOUR }),
    input({ id: 'inconnu', title: 'Jeu inconnu', steamId: '4242' }),
    input({ id: 'manuel-chess', title: 'Chess', source: 'Manuel', manual: true, sizeGb: null })
  ];
  const sessions = [session('manuel-chess', NOW - 3 * HOUR, 5400), session('manuel-chess', NOW - 26 * HOUR, 30), session('ancien-jeu', NOW - HOUR, 600)];
  const snap = buildRealSnapshot({ games, parts: [{ name: 'Stockage', big: '12 Go libres', text: 'Peu de place.', status: 'warn' }], sessions, journal: [], now: NOW });

  assert.equal(snap.demo, false);
  assert.deepEqual([snap.friends.length, snap.mods.length, snap.notices.length], [0, 0, 0]);
  // Le dernier jeu joué vient en premier.
  assert.deepEqual(snap.games.map((g) => g.id), ['manuel-chess', 'elden-ring', 'inconnu']);

  const elden = snap.games.find((g) => g.id === 'elden-ring')!;
  assert.equal(elden.title, 'Elden Ring'); // titre et visuels du catalogue
  assert.equal(elden.hours, 10); // 600 minutes d'après Steam
  assert.equal(elden.lastPlayed, 'Il y a 2 jours');
  assert.deepEqual([elden.friends.length, elden.reviews.list.length, elden.achievements.done, elden.changes.length], [0, 0, 0, 0]);
  assert.ok(elden.art.startsWith('art/elden-ring/'));

  const unknown = snap.games.find((g) => g.id === 'inconnu')!;
  assert.equal(unknown.cover, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4242/library_600x900_2x.jpg');
  assert.equal(unknown.hours, 0);

  const chess = snap.games.find((g) => g.id === 'manuel-chess')!;
  assert.equal(chess.hours, 1.5); // 5400 s + 30 s mesurées par Warmup
  assert.deepEqual(chess.sessions.map((s) => [s.length, s.ok]), [['1 h 30', true], ['1 min', false]]);
  assert.equal(chess.cover, '');
  assert.equal(chess.checks.find((c) => c.name === 'Stockage')?.status, 'warn');

  // Les parties d'un jeu qui n'est plus dans la bibliothèque ne sont pas affichées.
  assert.deepEqual(snap.reports.map((r) => [r.gameId, r.ok]), [['manuel-chess', true], ['manuel-chess', false]]);
  assert.equal(snap.week.total, '1 h 31'); // 5400 s + 30 s
  assert.equal(snap.week.cleanLaunches, '1 sur 2');
  assert.equal(snap.week.hours[2], 1.5); // mercredi
});

test('mesures en jeu : ping et carte graphique', () => {
  assert.equal(parsePing('Réponse de 1.1.1.1 : octets=32 temps=14 ms TTL=57'), 14);
  assert.equal(parsePing('Reply from 1.1.1.1: bytes=32 time<1ms TTL=57'), 1);
  assert.equal(parsePing('64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=12.6 ms'), 13);
  assert.equal(parsePing('Délai d\'attente de la demande dépassé.'), null);
  assert.deepEqual(parseNvidia('67, 93\n'), { temp: 67, load: 93 });
  assert.equal(parseNvidia('nvidia-smi introuvable'), null);
});

test('incidents repérés pendant une partie', () => {
  const calm = { ...session('jeu', NOW, 3600), ping: { avg: 18, max: 41, lossPercent: 0, samples: [18, 20] }, gpu: { maxTemp: 71, avgLoad: 88 } };
  assert.equal(incident(calm), null);
  assert.equal(incident({ ...calm, ping: { avg: 30, max: 240, lossPercent: 0, samples: [] } })?.cause, 'Réseau');
  assert.equal(incident({ ...calm, ping: { avg: 30, max: 60, lossPercent: 6, samples: [] } })?.cause, 'Réseau');
  assert.equal(incident({ ...calm, gpu: { maxTemp: 91, avgLoad: 99 } })?.cause, 'Surchauffe');
  // Dans le bilan : la cause, un conseil, et la partie n'est plus comptée « sans incident ».
  const snap = buildRealSnapshot({ games: [input({ id: 'jeu' })], parts: [], sessions: [{ ...calm, ping: { avg: 30, max: 240, lossPercent: 0, samples: [30, 240] } }], journal: [], now: NOW });
  assert.deepEqual([snap.reports[0].ok, snap.reports[0].cause, snap.reports[0].advice?.href], [false, 'Réseau', '#/guide/box']);
  assert.equal(snap.week.cleanLaunches, '0 sur 1');
});
