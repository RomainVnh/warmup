import path from 'node:path';
import { isDirectory, listFiles, readText, safeProgram } from './files';
import type { FoundGame, StoreResult } from './types';

// Riot range ses fichiers dans C:\ProgramData\Riot Games :
// - RiotClientInstalls.json donne le programme du Riot Client (« rc_default ») ;
// - Metadata\<jeu>.<version>\<jeu>.<version>.product_settings.yaml donne le dossier de chaque jeu
//   (« product_install_full_path »).
// Le jeu se lance par le Riot Client :  RiotClientServices.exe --launch-product=valorant --launch-patchline=live

export const RIOT_TITLES: Record<string, string> = {
  valorant: 'VALORANT',
  league_of_legends: 'League of Legends',
  bacon: 'Legends of Runeterra',
  lion: '2XKO'
};

/** Valeur d'une ligne « clé: valeur » d'un fichier YAML simple, sans guillemets. */
export function yamlValue(text: string, key: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

export function riotClient(json: string | null): string {
  if (!json) return '';
  try {
    const value = (JSON.parse(json) as Record<string, unknown>).rc_default;
    return typeof value === 'string' ? path.normalize(value) : '';
  } catch {
    return '';
  }
}

/** `root` : dossier « Riot Games » de ProgramData. */
export async function detectRiot(root: string): Promise<StoreResult> {
  const client = riotClient(await readText(path.join(root, 'RiotClientInstalls.json')));
  const metadata = path.join(root, 'Metadata');
  const games: FoundGame[] = [];
  for (const name of await listFiles(metadata, 200)) {
    const match = /^([a-z0-9_]{1,40})\.([a-z0-9_]{1,20})$/.exec(name);
    if (!match) continue;
    const [, product, patchline] = match;
    const title = RIOT_TITLES[product];
    if (!title) continue; // le Riot Client lui-même et les produits inconnus ne sont pas des jeux
    const settings = await readText(path.join(metadata, name, `${name}.product_settings.yaml`));
    const folder = settings ? path.normalize(yamlValue(settings, 'product_install_full_path')) : '';
    if (!folder || folder === '.' || !(await isDirectory(folder))) continue;
    games.push({
      source: 'Riot',
      storeId: name,
      title,
      folder,
      sizeGb: null,
      complete: true,
      launch: safeProgram(client) ? { kind: 'exe', file: client, args: [`--launch-product=${product}`, `--launch-patchline=${patchline}`], cwd: path.dirname(client) } : null,
      uninstall: safeProgram(client) ? { kind: 'exe', file: client, args: [`--uninstall-product=${product}`, `--uninstall-patchline=${patchline}`], cwd: path.dirname(client) } : null
    });
  }
  return { source: 'Riot', found: Boolean(client) || games.length > 0, games };
}
