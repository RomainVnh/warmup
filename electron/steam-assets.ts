import type { SteamAssets } from '../shared/catalogue-steam-assets';
import { readJson, writeJson } from './store';

// Visuels officiels des jeux Steam que le catalogue ne connaît pas.
// Les jeux récents rangent leurs visuels dans des dossiers à code : Warmup demande à Steam les vraies adresses
// (service public, sans compte ni clé), puis les garde une semaine. Seules des adresses d'images sont gardées.

const FILE = 'visuels-steam.json';
const KEEP_MS = 7 * 86_400_000;
const STORE = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const API = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';

type Cache = Record<string, { at: number; assets: SteamAssets }>;

const isUrl = (value: unknown): value is string => typeof value === 'string' && value.startsWith(STORE) && value.length < 400 && !/["'<>\s]/.test(value);

/** Adresses lues dans la réponse de Steam pour un jeu. Toute valeur inattendue est écartée. */
export function assetsFrom(raw: unknown): SteamAssets {
  const a = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const format = typeof a.asset_url_format === 'string' && /^steam\/apps\/\d{1,10}\/\$\{FILENAME\}(\?t=\d+)?$/.test(a.asset_url_format) ? a.asset_url_format : '';
  const url = (...keys: string[]) => {
    for (const key of keys) {
      const file = a[key];
      if (format && typeof file === 'string' && /^[\w./-]{1,200}$/.test(file) && !file.includes('..')) {
        const full = STORE + format.replace('${FILENAME}', file);
        if (isUrl(full)) return full;
      }
    }
    return undefined;
  };
  const found: SteamAssets = { art: url('library_hero_2x', 'library_hero'), cover: url('library_capsule_2x', 'library_capsule'), logo: url('library_logo_2x', 'library_logo'), header: url('header_2x', 'header') };
  return Object.fromEntries(Object.entries(found).filter(([, v]) => v)) as SteamAssets;
}

function readCache(): Cache {
  const raw = readJson(FILE);
  const cache: Cache = {};
  if (raw && typeof raw === 'object') {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const entry = value as { at?: unknown; assets?: Record<string, unknown> };
      if (!/^\d{1,10}$/.test(id) || typeof entry?.at !== 'number' || !entry.assets) continue;
      const assets: SteamAssets = {};
      for (const key of ['art', 'cover', 'logo', 'header'] as const) if (isUrl(entry.assets[key])) assets[key] = entry.assets[key] as string;
      cache[id] = { at: entry.at, assets };
    }
  }
  return cache;
}

/** Visuels de chaque jeu demandé, par numéro Steam. Sans connexion, ceux déjà gardés servent. */
export async function steamAssets(appIds: string[]): Promise<Record<string, SteamAssets>> {
  const ids = [...new Set(appIds.filter((id) => /^\d{1,10}$/.test(id)))];
  const cache = readCache();
  const stale = ids.filter((id) => !cache[id] || Date.now() - cache[id].at > KEEP_MS);
  for (let i = 0; i < stale.length; i += 50) {
    const batch = stale.slice(i, i + 50);
    const query = JSON.stringify({ ids: batch.map((id) => ({ appid: Number(id) })), context: { language: 'french', country_code: 'FR' }, data_request: { include_assets: true } });
    try {
      const response = await fetch(`${API}?input_json=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) });
      const data = (await response.json()) as { response?: { store_items?: { appid?: number; assets?: unknown }[] } };
      for (const item of data.response?.store_items ?? []) {
        if (item.appid && batch.includes(String(item.appid))) cache[String(item.appid)] = { at: Date.now(), assets: assetsFrom(item.assets) };
      }
    } catch {
      // Pas de connexion : on garde ce qui est déjà connu, et on réessaiera plus tard.
    }
  }
  if (stale.length) writeJson(FILE, cache);
  return Object.fromEntries(ids.filter((id) => cache[id]).map((id) => [id, cache[id].assets]));
}
