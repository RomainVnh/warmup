import os from 'node:os';
import path from 'node:path';
import type { DetectedGame, DetectedStore, DetectionReport, DetectSource } from '../../shared/types';
import { detectBattlenet } from './battlenet';
import { detectGog } from './gog';
import { parseRegOutput, queryRegistry, REGISTRY_KEYS, type RegistryKey } from './registry';
import { detectRockstar } from './rockstar';
import { detectSteam } from './steam';
import type { FoundGame, StoreResult } from './types';
import { installedPrograms } from './uninstall';

// Détection des jeux installés : lecture seule des fichiers que Steam, GOG, Battle.net et Rockstar tiennent eux-mêmes à jour.
// Epic Games et Riot ne sont pas pris en charge.
// Rien n'est modifié, aucun jeu n'est ouvert, aucun compte n'est consulté.

export interface DetectContext {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  home: string;
  /** Lecture du registre Windows ; remplacée par un texte d'exemple dans les tests. */
  registry(key: RegistryKey): Promise<string>;
}

export const systemContext = (): DetectContext => ({ platform: process.platform, env: process.env, home: os.homedir(), registry: queryRegistry });

const unique = (list: (string | undefined)[]): string[] => [...new Set(list.filter((dir): dir is string => Boolean(dir)))];

/** Dossiers où Steam peut se trouver, selon le système. */
export async function steamRoots(ctx: DetectContext): Promise<string[]> {
  if (ctx.platform === 'win32') {
    const user = [...parseRegOutput(await ctx.registry(REGISTRY_KEYS.steamUser)).values()][0]?.steampath;
    const machine = [...parseRegOutput(await ctx.registry(REGISTRY_KEYS.steamMachine)).values()][0]?.installpath;
    return unique([
      user && path.normalize(user),
      machine && path.normalize(machine),
      ctx.env['ProgramFiles(x86)'] && path.join(ctx.env['ProgramFiles(x86)'], 'Steam'),
      ctx.env.ProgramFiles && path.join(ctx.env.ProgramFiles, 'Steam')
    ]);
  }
  if (ctx.platform === 'darwin') return [path.join(ctx.home, 'Library', 'Application Support', 'Steam')];
  return [path.join(ctx.home, '.local', 'share', 'Steam'), path.join(ctx.home, '.steam', 'steam')];
}


// Rapprochement avec la bibliothèque : même titre, sans tenir compte des majuscules, des accents ni de la ponctuation.
const normalize = (title: string): string => title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchLibrary(title: string, library: { id: string; title: string }[]): string | null {
  const wanted = normalize(title);
  if (!wanted) return null;
  const exact = library.find((g) => normalize(g.title) === wanted);
  if (exact) return exact.id;
  // « The Witcher 3: Wild Hunt » correspond à « The Witcher 3 » : l'un commence par l'autre, sur 6 caractères au moins.
  const close = library.find((g) => {
    const known = normalize(g.title);
    return known.length >= 6 && wanted.length >= 6 && (wanted.startsWith(known) || known.startsWith(wanted));
  });
  return close?.id ?? null;
}

const NOTES: Record<DetectSource, { missing: string; windowsOnly?: string }> = {
  Steam: { missing: 'Steam n\'a pas été trouvé sur ce PC.' },
  GOG: { missing: 'GOG n\'a pas été trouvé sur ce PC.', windowsOnly: 'La recherche des jeux GOG fonctionne sous Windows.' },
  'Battle.net': { missing: 'Battle.net n\'a pas été trouvé sur ce PC.', windowsOnly: 'La recherche des jeux Battle.net fonctionne sous Windows.' },
  Rockstar: { missing: 'Le Rockstar Games Launcher n\'a pas été trouvé sur ce PC.', windowsOnly: 'La recherche des jeux Rockstar fonctionne sous Windows.' }
};

function describe(result: StoreResult, ctx: DetectContext): DetectedStore {
  const notes = NOTES[result.source];
  if (!result.found) return { source: result.source, found: false, note: ctx.platform !== 'win32' && notes.windowsOnly ? notes.windowsOnly : notes.missing };
  const count = result.games.length;
  return { source: result.source, found: true, note: count === 0 ? 'Aucun jeu installé.' : count === 1 ? '1 jeu installé.' : `${count} jeux installés.` };
}

const safely = async (source: DetectSource, run: () => Promise<StoreResult>): Promise<StoreResult> => {
  try {
    return await run();
  } catch {
    return { source, found: false, games: [] }; // une plateforme illisible ne bloque pas les autres
  }
};

// Un même jeu peut être vu deux fois : déclaré par deux plateformes (un jeu Rockstar acheté sur Steam passe aussi
// par le Rockstar Games Launcher), inscrit dans les deux listes de programmes de Windows, ou installé deux fois.
// On n'en garde qu'un : complet plutôt qu'inachevé, puis lançable, puis par ordre de plateforme.
const PLATFORM_ORDER: DetectSource[] = ['Steam', 'GOG', 'Battle.net', 'Rockstar'];
const sameTitle = (title: string) => title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const folderKey = (folder: string) => folder.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
const rank = (g: FoundGame) => (g.complete ? 0 : 100) + (g.launch ? 0 : 10) + PLATFORM_ORDER.indexOf(g.source);

export function withoutDuplicates<T extends FoundGame & { libraryId: string | null }>(games: T[]): T[] {
  const kept: T[] = [];
  for (const game of [...games].sort((a, b) => rank(a) - rank(b))) {
    const twin = kept.some((other) =>
      folderKey(other.folder) === folderKey(game.folder) ||
      (game.libraryId !== null && other.libraryId === game.libraryId) ||
      sameTitle(other.title) === sameTitle(game.title));
    if (!twin) kept.push(game);
  }
  return kept;
}

/** Jeu trouvé et rapproché de la bibliothèque, avec sa manière de se lancer (gardée côté système). */
export type MatchedGame = FoundGame & { libraryId: string | null };

export async function detectAll(library: { id: string; title: string }[], ctx: DetectContext = systemContext()): Promise<{ report: DetectionReport; found: MatchedGame[] }> {
  const windows = ctx.platform === 'win32';
  // La liste des programmes installés n'est lue qu'une fois, pour Battle.net et Rockstar.
  const programs = windows ? installedPrograms(await ctx.registry(REGISTRY_KEYS.uninstall32), await ctx.registry(REGISTRY_KEYS.uninstall64)) : [];
  const results = await Promise.all([
    safely('Steam', async () => detectSteam(await steamRoots(ctx))),
    safely('GOG', async () => detectGog(windows ? await ctx.registry(REGISTRY_KEYS.gogGames) : '')),
    safely('Battle.net', () => detectBattlenet(programs)),
    safely('Rockstar', () => detectRockstar(programs)),
  ]);
  const found: MatchedGame[] = withoutDuplicates(results.flatMap((result) => result.games).map((game) => ({ ...game, libraryId: matchLibrary(game.title, library) })))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  // L'interface reçoit tout sauf la manière de lancer : chemins de programmes et arguments restent ici.
  const games: DetectedGame[] = found.map(({ launch, uninstall: _u, verify: _v, minutes: _m, lastPlayed: _l, ...game }) => ({ ...game, canLaunch: launch !== null && game.complete }));
  return { report: { example: false, stores: results.map((result) => describe(result, ctx)), games }, found };
}

export async function detectGames(library: { id: string; title: string }[], ctx: DetectContext = systemContext()): Promise<DetectionReport> {
  return (await detectAll(library, ctx)).report;
}
