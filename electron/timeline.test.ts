import assert from 'node:assert/strict';
import test from 'node:test';
import { reportTimeline, thinTimeline } from '../shared/timeline';

const clock = (at: number) => new Date(at).toISOString().slice(11, 16);

test('déroulé : une longue partie est réduite sans effacer ses chutes', () => {
  const fps = Array.from({ length: 1000 }, () => 120 as number | null);
  fps[500] = 30;
  const ping = Array.from({ length: 1000 }, () => 20 as number | null);
  ping[700] = null;
  const thin = thinTimeline({ step: 5, fps, ping, temp: [] });
  assert.ok(thin.fps.length <= 120);
  assert.equal(thin.step, 5 * Math.ceil(1000 / 120));
  assert.equal(Math.min(...thin.fps.filter((v): v is number => v !== null)), 30); // la chute reste visible
  assert.equal(Math.max(...thin.ping.filter((v): v is number => v !== null)), 20); // un seul essai perdu dans un groupe : le groupe a répondu
});

test('déroulé : chutes, ping élevé, réseau muet et surchauffe sont marqués une fois chacun', () => {
  const fps: (number | null)[] = Array.from({ length: 60 }, () => 100);
  fps[10] = 40;
  fps[11] = 30; // même chute, sur deux relevés : une seule marque, au plus bas
  const ping: (number | null)[] = Array.from({ length: 60 }, () => 25);
  ping[30] = 210;
  ping[45] = null;
  const temp: (number | null)[] = Array.from({ length: 60 }, () => 70);
  temp[50] = 91;
  const t = reportTimeline({ step: 5, fps, ping, temp }, Date.UTC(2026, 10, 17, 21, 0), clock);
  assert.ok(t);
  assert.deepEqual(t.series.map((s) => s.key), ['fps', 'ping', 'temp']);
  assert.deepEqual(t.marks.map((m) => [m.kind, m.index]), [['fps', 11], ['ping', 30], ['ping', 45], ['temp', 50]]);
  assert.match(t.marks[0].text, /30 images par seconde \(100 d'habitude\)/);
  assert.equal(t.marks[0].time, '21:00'); // 11 × 5 s après 21 h
  assert.equal(t.marks[2].text, 'Le réseau n\'a plus répondu');
  assert.equal(t.axis[0], '21:00');
});

test('déroulé : rien à tracer sans relevés, et pas de marque sur une partie régulière', () => {
  assert.equal(reportTimeline(undefined, 0, clock), null);
  assert.equal(reportTimeline({ step: 5, fps: [60], ping: [], temp: [] }, 0, clock), null);
  const calm = reportTimeline({ step: 5, fps: [], ping: [20, 22, 21, 19], temp: [] }, 0, clock);
  assert.ok(calm);
  assert.deepEqual(calm.marks, []);
  assert.deepEqual(calm.series.map((s) => s.key), ['ping']);
});
