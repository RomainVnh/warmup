import assert from 'node:assert/strict';
import test from 'node:test';
import { deniedMessage, frameColumn, frameTime, FrameStats, presentMonArgs, watchFps } from './fps';

test('images par seconde : la colonne utile est trouvée dans l\'en-tête de PresentMon', () => {
  assert.equal(frameColumn('Application,ProcessID,SwapChainAddress,Runtime,SyncInterval,PresentFlags,AllowsTearing,PresentMode,TimeInSeconds,MsInPresentAPI,MsBetweenPresents,MsBetweenDisplayChange'), 10);
  assert.equal(frameColumn('Application,ProcessID,FrameTime,CPUBusy'), 2); // PresentMon 2, sans les anciennes colonnes
  assert.equal(frameColumn('rien,à,voir'), -1);
  assert.equal(frameTime('eldenring.exe,4242,0x1,DXGI,1,0,0,Hardware,12.5,0.2,16.667,16.6', 10), 16.667);
  assert.equal(frameTime('eldenring.exe,4242,NA', 2), null);
  assert.equal(frameTime('eldenring.exe,4242,0', 2), null);
});

test('images par seconde : moyenne, 1 % le plus lent et relevé par période', () => {
  const stats = new FrameStats();
  assert.equal(stats.summary(), null); // pas assez d'images
  for (let i = 0; i < 990; i += 1) stats.add(1000 / 120); // 120 images par seconde…
  for (let i = 0; i < 10; i += 1) stats.add(50); // … et dix images à 20 par seconde : une saccade
  const window = stats.takeWindow();
  assert.ok(window !== null && window > 100 && window < 120);
  assert.equal(stats.takeWindow(), null); // rien de neuf depuis le relevé précédent
  const summary = stats.summary();
  assert.ok(summary);
  assert.ok(summary.avg > 100 && summary.avg < 120);
  assert.ok(summary.low1 >= 19 && summary.low1 <= 21, `1 % le plus lent : ${summary.low1}`);
});

test('images par seconde : arguments fixes, refus de Windows reconnu, rien hors de Windows', () => {
  assert.deepEqual(presentMonArgs(4242).slice(0, 2), ['--process_id', '4242']);
  assert.ok(!presentMonArgs(4242).some((arg) => /[;&|]/.test(arg)));
  assert.ok(deniedMessage('error: Access is denied. PresentMon requires either administrative privileges or to be run by a user in the "Performance Log Users" user group.'));
  assert.ok(!deniedMessage('error: process not found'));
  if (process.platform !== 'win32') assert.equal(watchFps('C:\\\\PresentMon.exe', 4242).missing(), 'windows');
});

test('images par seconde : le numéro du programme du jeu est lu, sous Windows comme sur Mac', async () => {
  const { parsePs, parseWindowsProcesses } = await import('./sessions');
  assert.equal(parseWindowsProcesses('[{"ProcessId":4242,"ExecutablePath":"D:\\\\Jeux\\\\jeu.exe","WorkingSetSize":1048576}]')[0].pid, 4242);
  assert.deepEqual(parsePs('  321  20480 /Applications/Chess.app/Contents/MacOS/Chess\n'), [{ path: '/Applications/Chess.app/Contents/MacOS/Chess', memMb: 20, pid: 321 }]);
});
