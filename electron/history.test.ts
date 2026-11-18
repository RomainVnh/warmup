import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanEnv, diffEnv, gameEnv } from '../shared/env';
import { fixEffects } from '../shared/effects';
import { buildRealSnapshot, type RealGameInput } from '../shared/real-data';
import type { JournalEntry, SessionRecord } from '../shared/types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 17, 20, 0);
const PC = { 'Carte graphique': 'NVIDIA GeForce RTX 4070', 'Pilote graphique': '551.86', Système: 'Windows 11 Famille (version 26100)', Écran: '2560 × 1440 à 144 Hz', 'Mode Jeu': 'Activé' };
const GAME: RealGameInput = { id: 'elden-ring', title: 'ELDEN RING', source: 'Steam', folder: 'D:\\Jeux\\ELDEN RING', sizeGb: 60, complete: true, catalogueId: 'elden-ring', steamId: '1245620', version: 'build 1000', manual: false, platformMinutes: null, platformLastPlayed: null };

const session = (daysAgo: number, extra: Partial<SessionRecord> = {}): SessionRecord => {
  const start = NOW - daysAgo * DAY;
  return { id: `elden-ring-${start}`, gameId: 'elden-ring', start, end: start + 3600_000, seconds: 3600, peakMemMb: 6000, avgCpu: 40, samples: [], ...extra };
};

test('photo : textes courts, différences classées du plus suspect au moins suspect', () => {
  assert.equal(cleanEnv('pas un objet'), undefined);
  assert.equal(cleanEnv({ a: 'x'.repeat(500) })?.a.length, 120);
  const before = gameEnv(PC, { version: 'build 1000', args: '' });
  const after = gameEnv({ ...PC, 'Pilote graphique': '566.36', 'Mode Jeu': 'Désactivé' }, { version: 'build 1000', args: '-dx11' });
  assert.deepEqual(diffEnv(before, after).map((c) => [c.key, c.level]), [['Arguments de lancement', 0], ['Pilote graphique', 0], ['Mode Jeu', 2]]);
  assert.deepEqual(diffEnv(before, { ...before, Nouveau: 'x' }), []); // une valeur absente d'un côté n'est pas un changement
});

test('ce qui a changé : depuis la dernière partie réussie, pour le jeu et pour la partie ratée', () => {
  const good = session(10, { env: gameEnv(PC, { version: 'build 1000' }) });
  const newEnv = gameEnv({ ...PC, 'Pilote graphique': '566.36' }, { version: 'build 1000' });
  const crash = session(1, { seconds: 20, end: NOW - DAY + 20_000, env: newEnv });
  const snap = buildRealSnapshot({ games: [GAME], parts: [], sessions: [good, crash], journal: [], now: NOW, facts: { ...PC, 'Pilote graphique': '566.36' } });
  const game = snap.games[0];
  assert.equal(game.changes.length, 1);
  assert.equal(game.changes[0].title, 'Pilote graphique : 551.86 → 566.36');
  assert.equal(game.changes[0].level, 0);
  assert.equal(game.changes[0].when, 'Hier'); // vu pour la première fois lors de la partie ratée
  const crashReport = snap.reports.find((r) => r.id === crash.id);
  assert.equal(crashReport?.changes?.[0].title, 'Pilote graphique : 551.86 → 566.36');
  assert.equal(snap.reports.find((r) => r.id === good.id)?.changes, undefined); // partie réussie : rien à expliquer
  // Sans partie réussie de référence, Warmup ne dit rien plutôt que d'inventer.
  const alone = buildRealSnapshot({ games: [GAME], parts: [], sessions: [crash], journal: [], now: NOW, facts: PC });
  assert.deepEqual(alone.games[0].changes, []);
  assert.equal(alone.reports[0].changes, undefined);
});

test('effet des corrections : avant / après jeu par jeu, et avec / sans à chaque lancement', () => {
  const fix: JournalEntry = { id: `frequence-${NOW - 5 * DAY}`, at: NOW - 5 * DAY, title: 'Écran passé de 60 à 144 Hz', detail: '', undoable: true, undone: false };
  const before = [8, 7, 6].map((d) => session(d, { fps: { avg: 60, low1: 40, samples: [] } }));
  const after = [3, 2].map((d) => session(d, { fps: { avg: 75, low1: 52, samples: [] } }));
  const effects = fixEffects([fix], [...before, ...after], () => false);
  const effect = effects[fix.id];
  assert.equal(effect.better, true);
  assert.equal(effect.headline, '+25 % d\'images par seconde depuis');
  assert.ok(effect.lines.includes('Images par seconde : 60 → 75 (+25 %)'));
  assert.equal(effect.basis, '3 parties avant, 2 après, sur 1 jeu');
  // Pas encore de partie après : l'effet sera mesuré plus tard. Correction annulée : rien.
  assert.equal(fixEffects([fix], before, () => false)[fix.id].better, null);
  assert.equal(fixEffects([{ ...fix, undone: true }], [...before, ...after], () => false)[fix.id], undefined);

  const boost = (d: number): JournalEntry => ({ id: `alimentation-${NOW - d * DAY}`, at: NOW - d * DAY, title: 'Performances élevées', detail: '', gameId: 'elden-ring', undoable: true, undone: true });
  const withBoost = [4, 2].map((d) => session(d, { fps: { avg: 90, low1: 70, samples: [] } }));
  const without = [9, 8].map((d) => session(d, { fps: { avg: 90, low1: 70, samples: [] } }));
  const neutral = fixEffects([boost(2), boost(4)], [...withBoost, ...without], () => false);
  assert.equal(neutral[boost(2).id].headline, 'Aucune différence nette avec cette correction');
  assert.equal(neutral[boost(2).id].basis, '2 parties avec, 2 sans, sur 1 jeu');
});

test('visuels Steam : adresses exactes du catalogue, images d\'actualités, et adresses lues chez Steam vérifiées', async () => {
  const { STEAM_ASSETS, NEWS_IMAGES } = await import('../shared/catalogue-steam-assets');
  const { assetsFrom } = await import('./steam-assets');
  // Call of Duty MW4 range ses visuels dans un dossier à code : l'adresse habituelle ne marche pas pour lui.
  assert.match(STEAM_ASSETS['call-of-duty-mw4'].art ?? '', /^https:\/\/shared\.akamai\.steamstatic\.com\/store_item_assets\/steam\/apps\/4435490\/[0-9a-f]{40}\/library_hero/);
  const snap = buildRealSnapshot({ games: [{ ...GAME, id: 'call-of-duty-mw4', catalogueId: 'call-of-duty-mw4', steamId: '4435490' }], parts: [], sessions: [], journal: [], now: NOW });
  const cod = snap.games[0];
  assert.equal(cod.art, STEAM_ASSETS['call-of-duty-mw4'].art);
  assert.ok(cod.screenshots.length > 0);
  const images = cod.news.map((n) => n.image).filter(Boolean);
  assert.equal(new Set(images).size, images.length); // une image différente par actualité
  assert.ok(images.every((url) => url.startsWith('https://clan.akamai.steamstatic.com/images/')));
  assert.ok(Object.values(NEWS_IMAGES).flat().filter(Boolean).length > 50);

  const read = assetsFrom({ asset_url_format: 'steam/apps/42/${FILENAME}?t=1', library_hero: 'abc123/library_hero.jpg', library_capsule_2x: 'def/library_capsule_2x.jpg', header: '../../piege.jpg' });
  assert.equal(read.art, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/abc123/library_hero.jpg?t=1');
  assert.equal(read.cover, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/def/library_capsule_2x.jpg?t=1');
  assert.equal(read.header, undefined); // chemin qui cherche à sortir du dossier : refusé
  assert.deepEqual(assetsFrom({ asset_url_format: 'https://ailleurs.example/${FILENAME}', library_hero: 'x.jpg' }), {});
});
