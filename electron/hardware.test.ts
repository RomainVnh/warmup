import assert from 'node:assert/strict';
import { test } from 'node:test';
import { driverTime, mainGpu, parseWindowsInfo } from './hardware';

// Lecture du matériel : on vérifie ici la lecture des réponses de Windows, sans PC Windows.

test('réponse de Windows : une seule carte ou une liste', () => {
  const one = parseWindowsInfo('{"gpu":{"Name":"NVIDIA GeForce RTX 4070","DriverVersion":"32.0.15.6094","DriverDate":"/Date(1727740800000)/"},"ram":[{"Capacity":17179869184,"Speed":3600,"ConfiguredClockSpeed":2133}],"os":{"Caption":"Microsoft Windows 11 Famille","BuildNumber":"26100"}}');
  assert.equal(one.gpu.length, 1);
  assert.equal(one.ram[0].ConfiguredClockSpeed, 2133);
  assert.equal(one.os?.Caption, 'Microsoft Windows 11 Famille');
  assert.deepEqual(parseWindowsInfo('pas du json'), { gpu: [], ram: [], os: null });
});

test('date du pilote : format de PowerShell et format ISO', () => {
  assert.equal(driverTime('/Date(1727740800000)/'), 1727740800000);
  assert.equal(driverTime('2024-10-01T00:00:00Z'), Date.parse('2024-10-01T00:00:00Z'));
  assert.equal(driverTime('n\'importe quoi'), null);
  assert.equal(driverTime(undefined), null);
});

test('carte graphique principale : la carte dédiée plutôt que la puce intégrée ou un adaptateur virtuel', () => {
  const gpus = [{ Name: 'Microsoft Basic Display Adapter' }, { Name: 'Intel(R) UHD Graphics 770' }, { Name: 'AMD Radeon RX 7800 XT' }];
  assert.equal(mainGpu(gpus)?.Name, 'AMD Radeon RX 7800 XT');
  assert.equal(mainGpu([{ Name: 'Intel(R) Iris(R) Xe Graphics' }])?.Name, 'Intel(R) Iris(R) Xe Graphics');
  assert.equal(mainGpu([]), undefined);
});
