import path from 'node:path';
import { cleanText, isDirectory, safeProgram } from './files';
import type { FoundGame, StoreResult } from './types';
import type { InstalledProgram } from './uninstall';

// Le Rockstar Games Launcher inscrit chaque jeu dans la liste des programmes installés :
//   "C:\Program Files\Rockstar Games\Launcher\Launcher.exe" -uninstall=rdr2
// Le jeu se lance par ce même programme :  Launcher.exe -launchTitleInFolder "<dossier du jeu>"
// (commande relevée sur les versions connues du lanceur, à vérifier sur un vrai PC).
const ENTRY = /^"([^"]+[\\/]Launcher\.exe)"\s+-uninstall=([a-z0-9_]{1,40})/i;

export async function detectRockstar(programs: InstalledProgram[]): Promise<StoreResult> {
  const games: FoundGame[] = [];
  let launcherSeen = false;
  for (const program of programs) {
    if (program.name === 'Rockstar Games Launcher') launcherSeen = true;
    const match = ENTRY.exec(program.uninstall.trim());
    const title = cleanText(program.name);
    if (!match || !title || !program.folder || title === 'Rockstar Games Launcher') continue;
    const [, launcher, id] = match;
    const folder = path.normalize(program.folder);
    if (!(await isDirectory(folder))) continue;
    games.push({
      source: 'Rockstar',
      storeId: id.toLowerCase(),
      title,
      folder,
      sizeGb: program.sizeKb ? Math.round((program.sizeKb / 1024 ** 2) * 10) / 10 : null,
      complete: true,
      launch: safeProgram(path.normalize(launcher)) ? { kind: 'exe', file: path.normalize(launcher), args: ['-launchTitleInFolder', folder], cwd: path.dirname(path.normalize(launcher)) } : null,
      uninstall: safeProgram(path.normalize(launcher)) ? { kind: 'exe', file: path.normalize(launcher), args: [`-uninstall=${id.toLowerCase()}`], cwd: path.dirname(path.normalize(launcher)) } : null
    });
  }
  return { source: 'Rockstar', found: launcherSeen || games.length > 0, games };
}
