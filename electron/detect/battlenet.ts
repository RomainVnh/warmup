import path from 'node:path';
import { cleanText, isDirectory, safeProgram } from './files';
import type { FoundGame, StoreResult } from './types';
import type { InstalledProgram } from './uninstall';

// Battle.net inscrit chaque jeu dans la liste des programmes installés, avec une commande de désinstallation
// qui porte l'identifiant du jeu :  "…\Blizzard Uninstaller.exe" --lang=frFR --uid=fenris --displayname="Diablo IV"
// Le jeu se lance ensuite par Battle.net :  Battle.net.exe --exec="launch Fen"
// Correspondance identifiant → code de lancement, relevée sur les jeux connus (à vérifier sur un vrai PC).
export const BATTLENET_CODES: Record<string, string> = {
  fenris: 'Fen', // Diablo IV
  osi: 'OSI', // Diablo II: Resurrected
  diablo3: 'D3',
  anbs: 'ANBS', // Diablo Immortal
  prometheus: 'Pro', // Overwatch 2
  hs_beta: 'WTCG', // Hearthstone
  heroes: 'Hero', // Heroes of the Storm
  s2: 'S2', // StarCraft II
  s1: 'S1', // StarCraft Remastered
  wow: 'WoW', // World of Warcraft
  w3: 'W3', // Warcraft III: Reforged
  auks: 'AUKS', // Call of Duty
  odin: 'ODIN', // Call of Duty: Modern Warfare (2019)
  zeus: 'ZEUS', // Call of Duty: Black Ops Cold War
  fore: 'FORE', // Call of Duty: Vanguard
  viper: 'VIPR', // Call of Duty: Black Ops 4
  lazarus: 'LAZR', // Call of Duty: Modern Warfare 2 Campaign Remastered
  wlby: 'WLBY', // Crash Bandicoot 4
  rtro: 'RTRO' // Blizzard Arcade Collection
};

const UID = /--uid=([a-z0-9_]{1,40})/i;

export async function detectBattlenet(programs: InstalledProgram[]): Promise<StoreResult> {
  const client = programs.find((p) => p.name === 'Battle.net' && p.folder);
  const launcher = client ? path.join(client.folder, 'Battle.net.exe') : '';
  const games: FoundGame[] = [];
  for (const program of programs) {
    if (!/Blizzard Uninstaller\.exe/i.test(program.uninstall)) continue;
    const uid = UID.exec(program.uninstall)?.[1]?.toLowerCase();
    const title = cleanText(program.name);
    if (!uid || !title || !program.folder || uid === 'battle.net' || uid === 'agent') continue;
    const folder = path.normalize(program.folder);
    if (!(await isDirectory(folder))) continue;
    const code = BATTLENET_CODES[uid];
    const uninstaller = /^"([^"]+Blizzard Uninstaller\.exe)"/i.exec(program.uninstall.trim())?.[1] ?? '';
    games.push({
      source: 'Battle.net',
      storeId: uid,
      title,
      folder,
      sizeGb: program.sizeKb ? Math.round((program.sizeKb / 1024 ** 2) * 10) / 10 : null,
      complete: true,
      launch: code && safeProgram(launcher) ? { kind: 'exe', file: launcher, args: [`--exec=launch ${code}`], cwd: path.dirname(launcher) } : null,
      uninstall: safeProgram(uninstaller) ? { kind: 'exe', file: uninstaller, args: ['--lang=frFR', `--uid=${uid}`, `--displayname=${title}`], cwd: path.dirname(uninstaller) } : null
    });
  }
  return { source: 'Battle.net', found: Boolean(client) || games.length > 0, games };
}
