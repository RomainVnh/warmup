import path from 'node:path';
import { bytesToGb, cleanText, listFiles, readText } from './files';
import type { FoundGame, StoreResult } from './types';

// Epic Games écrit un fichier .item (du JSON) par jeu installé, dans
// C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests.

/** Lit un fichier .item. Renvoie null pour un contenu additionnel, un outil ou un fichier illisible. */
export function readItem(text: string): FoundGame | null {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    raw = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const id = cleanText(raw.AppName, 80);
  const title = cleanText(raw.DisplayName);
  const folder = typeof raw.InstallLocation === 'string' ? raw.InstallLocation.trim().slice(0, 400) : '';
  if (!id || !title || !folder) return null;
  // Un contenu additionnel porte le nom du jeu principal dans MainGameAppName.
  if (typeof raw.MainGameAppName === 'string' && raw.MainGameAppName && raw.MainGameAppName !== raw.AppName) return null;
  const categories = Array.isArray(raw.AppCategories) ? raw.AppCategories.filter((c): c is string => typeof c === 'string') : [];
  if (categories.length > 0 && !categories.includes('games')) return null; // moteur Unreal, outils…
  return {
    source: 'Epic',
    storeId: id,
    title,
    folder: path.normalize(folder),
    sizeGb: bytesToGb(raw.InstallSize),
    complete: raw.bIsIncompleteInstall !== true
  };
}

/** `dirs` : dossiers où Epic peut ranger ses fichiers .item. */
export async function detectEpic(dirs: string[]): Promise<StoreResult> {
  for (const dir of dirs) {
    const names = (await listFiles(dir)).filter((name) => name.toLowerCase().endsWith('.item'));
    if (names.length === 0 && (await listFiles(dir, 1)).length === 0) continue;
    const games = new Map<string, FoundGame>();
    for (const name of names) {
      const text = await readText(path.join(dir, name));
      const game = text ? readItem(text) : null;
      if (game && !games.has(game.storeId)) games.set(game.storeId, game);
    }
    return { source: 'Epic', found: true, games: [...games.values()] };
  }
  return { source: 'Epic', found: false, games: [] };
}
