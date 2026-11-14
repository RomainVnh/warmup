import path from 'node:path';
import { bytesToGb, cleanText, listFiles, pathKey, readText } from './files';
import { parseVdf, vdfNode, vdfText, type VdfNode } from './vdf';
import type { FoundGame, StoreResult } from './types';

// Steam range ses jeux dans une ou plusieurs « bibliothèques » (une par disque, en général).
// - <Steam>/steamapps/libraryfolders.vdf donne la liste des bibliothèques ;
// - <bibliothèque>/steamapps/appmanifest_<numéro>.acf décrit chaque jeu installé.

// Outils installés par Steam lui-même : ce ne sont pas des jeux.
const TOOL_IDS = new Set(['228980', '1070560', '1391110', '1628350', '1493710', '2180100', '961940', '1887720', '2348590', '2805730', '1161040', '1580130', '250820']);
const TOOL_NAME = /^(steamworks common redistributables|steam linux runtime|proton\b|steamvr$|steam controller configs)/i;

/** Dossiers des bibliothèques citées par libraryfolders.vdf. Les deux formats (récent et ancien) sont acceptés. */
export function libraryPaths(vdfText_: string): string[] {
  const root = parseVdf(vdfText_);
  const folders = vdfNode(root, 'libraryfolders') ?? vdfNode(root, 'libraryfolder') ?? root;
  const paths: string[] = [];
  for (const [key, value] of Object.entries(folders)) {
    if (!/^\d+$/.test(key)) continue;
    const dir = typeof value === 'string' ? value : vdfText(value as VdfNode, 'path');
    if (dir) paths.push(dir);
  }
  return paths;
}

/** Lit un fichier appmanifest. Renvoie null si ce n'est pas un jeu lisible. */
export function readManifest(text: string, library: string): FoundGame | null {
  const state = vdfNode(parseVdf(text), 'appstate');
  const id = vdfText(state, 'appid');
  const title = cleanText(vdfText(state, 'name'));
  const dir = vdfText(state, 'installdir');
  if (!/^\d{1,10}$/.test(id) || !title || !dir) return null;
  if (TOOL_IDS.has(id) || TOOL_NAME.test(title)) return null;
  // installdir est un simple nom de dossier : on refuse tout ce qui chercherait à en sortir.
  if (dir.includes('..') || /[\\/:]/.test(dir)) return null;
  const flags = Number(vdfText(state, 'stateflags'));
  return {
    source: 'Steam',
    storeId: id,
    title,
    folder: path.join(library, 'steamapps', 'common', dir),
    sizeGb: bytesToGb(vdfText(state, 'sizeondisk')),
    // Le bit 4 signifie « entièrement installé » ; sinon, le jeu est en cours de téléchargement ou de mise à jour.
    complete: Number.isFinite(flags) && (flags & 4) === 4
  };
}

/** `roots` : dossiers où Steam peut être installé, du plus probable au moins probable. */
export async function detectSteam(roots: string[]): Promise<StoreResult> {
  for (const root of roots) {
    const listing = (await readText(path.join(root, 'steamapps', 'libraryfolders.vdf'))) ?? (await readText(path.join(root, 'config', 'libraryfolders.vdf')));
    if (listing === null && (await listFiles(path.join(root, 'steamapps'), 1)).length === 0) continue;

    const libraries = new Map<string, string>([[pathKey(root), root]]);
    for (const dir of listing ? libraryPaths(listing) : []) if (!libraries.has(pathKey(dir))) libraries.set(pathKey(dir), dir);

    const games = new Map<string, FoundGame>();
    for (const library of libraries.values()) {
      const apps = path.join(library, 'steamapps');
      for (const name of await listFiles(apps)) {
        if (!/^appmanifest_\d{1,10}\.acf$/.test(name)) continue;
        const text = await readText(path.join(apps, name));
        const game = text ? readManifest(text, library) : null;
        if (game && !games.has(game.storeId)) games.set(game.storeId, game);
      }
    }
    return { source: 'Steam', found: true, games: [...games.values()] };
  }
  return { source: 'Steam', found: false, games: [] };
}
