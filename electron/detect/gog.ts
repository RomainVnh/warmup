import path from 'node:path';
import { cleanText, isDirectory, readText } from './files';
import { parseRegOutput } from './registry';
import type { FoundGame, StoreResult } from './types';

// GOG inscrit chaque jeu installé dans le registre Windows :
//   HKLM\SOFTWARE\WOW6432Node\GOG.com\Games\<numéro>   (gameName, path, dependsOn…)
// et dépose un fichier goggame-<numéro>.info dans le dossier du jeu.

/** Jeux cités par le registre. Un contenu additionnel (dependsOn rempli) n'est pas un jeu. */
export function gamesFromRegistry(regOutput: string): FoundGame[] {
  const games: FoundGame[] = [];
  for (const [key, values] of parseRegOutput(regOutput)) {
    const id = /\\Games\\(\d{1,12})$/i.exec(key)?.[1];
    const title = cleanText(values.gamename);
    const folder = (values.path ?? '').slice(0, 400);
    if (!id || !title || !folder || values.dependson) continue;
    games.push({ source: 'GOG', storeId: id, title, folder: path.normalize(folder), sizeGb: null, complete: true });
  }
  return games;
}

/** `regOutput` : texte de « reg query » sur la clé des jeux GOG (vide si GOG n'est pas installé). */
export async function detectGog(regOutput: string): Promise<StoreResult> {
  const listed = gamesFromRegistry(regOutput);
  const games: FoundGame[] = [];
  for (const game of listed) {
    // Le registre peut citer un jeu désinstallé à la main : on vérifie que son dossier existe encore.
    if (!(await isDirectory(game.folder))) continue;
    const info = await readText(path.join(game.folder, `goggame-${game.storeId}.info`));
    games.push({ ...game, complete: info !== null });
  }
  return { source: 'GOG', found: regOutput.trim().length > 0, games };
}
