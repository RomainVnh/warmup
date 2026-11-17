import path from 'node:path';
import { app, net, safeStorage, shell } from 'electron';
import { readJson, writeJson } from './store';

// Lien avec le service en ligne de Warmup (dossier serveur/) : connexion par code reçu par e-mail et synchronisation.
// Son adresse vient du champ « warmupServer » de package.json, ou de WARMUP_SERVER en développement.
// Sans adresse, l'application fonctionne seule : le compte reste enregistré sur le PC.

const FILE = 'session.json';

function serverUrl(): string {
  let url = app.isPackaged ? '' : process.env.WARMUP_SERVER ?? '';
  if (!url) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      url = (require(path.join(app.getAppPath(), 'package.json')) as { warmupServer?: string }).warmupServer ?? '';
    } catch {
      url = '';
    }
  }
  // Uniquement une adresse sécurisée, ou la machine locale pendant le développement.
  return /^https:\/\/[\w.-]+(:\d+)?$/.test(url) || (!app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url)) ? url : '';
}

export const serviceAvailable = (): boolean => serverUrl() !== '';

interface Stored { token: string; admin: boolean; syncedAt: number }
let session: { token: string; admin: boolean; syncedAt: number } | null = null;

/** Le jeton de session est chiffré par le système (trousseau de macOS, protection des données de Windows). */
export function loadSession(): void {
  const raw = readJson(FILE) as Partial<Stored> | undefined;
  if (!raw || typeof raw.token !== 'string' || !safeStorage.isEncryptionAvailable()) return;
  try {
    session = { token: safeStorage.decryptString(Buffer.from(raw.token, 'base64')), admin: raw.admin === true, syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0 };
  } catch {
    session = null;
  }
}

function storeSession(): void {
  if (!session || !safeStorage.isEncryptionAvailable()) return writeJson(FILE, {});
  writeJson(FILE, { token: safeStorage.encryptString(session.token).toString('base64'), admin: session.admin, syncedAt: session.syncedAt });
}

export const onlineAdmin = (): boolean => session?.admin === true;
export const hasSession = (): boolean => session !== null;

async function call(method: string, route: string, body?: unknown, auth = false): Promise<{ status: number; data: Record<string, unknown> }> {
  const base = serverUrl();
  if (!base) return { status: 0, data: {} };
  try {
    const response = await net.fetch(`${base}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth && session ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    const data: unknown = await response.json().catch(() => ({}));
    return { status: response.status, data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {} };
  } catch {
    return { status: 0, data: {} };
  }
}

const message = (result: { status: number; data: Record<string, unknown> }, fallback: string): string =>
  result.status === 0 ? 'Le service de Warmup est injoignable. Vérifiez votre connexion internet, puis réessayez.' : typeof result.data.error === 'string' ? result.data.error.slice(0, 200) : fallback;

export async function requestCode(email: string): Promise<{ ok: boolean; message: string }> {
  const result = await call('POST', '/auth/code', { email });
  return result.status === 200 ? { ok: true, message: 'Un code à 6 chiffres vient de vous être envoyé par e-mail. Il est valable 15 minutes.' } : { ok: false, message: message(result, 'Le code n\'a pas pu être envoyé.') };
}

/** Échange le code contre une session. Renvoie les données synchronisées du compte, s'il y en a. */
export async function verifyCode(email: string, code: string): Promise<{ ok: boolean; message: string; data?: Record<string, unknown>; dataAt?: number }> {
  const result = await call('POST', '/auth/verifier', { email, code });
  const account = result.data.account as { admin?: boolean; data?: Record<string, unknown>; dataAt?: number } | undefined;
  if (result.status !== 200 || typeof result.data.token !== 'string' || !account) return { ok: false, message: message(result, 'Code incorrect ou expiré.') };
  session = { token: result.data.token, admin: account.admin === true, syncedAt: 0 };
  storeSession();
  return { ok: true, message: 'Vous êtes connecté.', data: account.data, dataAt: account.dataAt };
}

export async function signOut(): Promise<void> {
  if (session) await call('POST', '/auth/quitter', undefined, true);
  session = null;
  storeSession();
}

/** Envoie au service ce qui doit suivre le joueur d'un PC à l'autre. */
export async function pushData(data: Record<string, unknown>): Promise<void> {
  if (!session) return;
  const result = await call('PUT', '/compte/donnees', { data }, true);
  if (result.status === 401) {
    session = null; // session expirée : il faudra se reconnecter
    storeSession();
  } else if (result.status === 200 && typeof result.data.dataAt === 'number') {
    session.syncedAt = result.data.dataAt;
    storeSession();
  }
}

// ───── Steam : relié par sa page officielle, ouverte dans le navigateur du joueur ─────

export interface SteamFriend { name: string; online: boolean; game: string; appId: string; lastSeen: number; since: number }
export interface SteamProfile { linked: boolean; name: string; friends: SteamFriend[] }

export async function startSteamLink(): Promise<{ ok: boolean; message: string }> {
  if (!session) return { ok: false, message: 'Connectez-vous à votre compte Warmup avant de relier Steam.' };
  const result = await call('POST', '/steam/demarrer', undefined, true);
  const url = typeof result.data.url === 'string' ? result.data.url : '';
  // Seule la page officielle de connexion de Steam peut être ouverte ici.
  if (result.status !== 200 || !url.startsWith('https://steamcommunity.com/openid/login?')) return { ok: false, message: message(result, 'La connexion à Steam n\'a pas pu démarrer.') };
  await shell.openExternal(url);
  return { ok: true, message: 'La page officielle de Steam s\'est ouverte dans votre navigateur. Connectez-vous-y, puis revenez ici.' };
}

export async function unlinkSteam(): Promise<void> {
  await call('POST', '/steam/retirer', undefined, true);
  steamCache = null;
}

let steamCache: { at: number; profile: SteamProfile; achieved: Map<string, { name: string; at: number }[]> } | null = null;

/** Pseudo, amis et succès obtenus, gardés dix minutes. `appIds` : jeux Steam dont on veut les succès (20 au plus). */
export async function steamData(appIds: string[], force = false): Promise<{ profile: SteamProfile; achieved: Map<string, { name: string; at: number }[]> }> {
  const empty = { profile: { linked: false, name: '', friends: [] }, achieved: new Map<string, { name: string; at: number }[]>() };
  if (!session) return empty;
  if (steamCache && !force && Date.now() - steamCache.at < 600_000) return steamCache;
  const result = await call('GET', '/steam', undefined, true);
  if (result.status !== 200 || result.data.linked !== true) return empty;
  const profile: SteamProfile = { linked: true, name: typeof result.data.name === 'string' ? result.data.name : '', friends: Array.isArray(result.data.friends) ? (result.data.friends as SteamFriend[]).slice(0, 100) : [] };
  const achieved = new Map<string, { name: string; at: number }[]>();
  for (const appId of appIds.slice(0, 20)) {
    const answer = await call('GET', `/steam/succes?appid=${encodeURIComponent(appId)}`, undefined, true);
    if (answer.status === 200 && Array.isArray(answer.data.achieved)) achieved.set(appId, answer.data.achieved as { name: string; at: number }[]);
  }
  steamCache = { at: Date.now(), profile, achieved };
  return steamCache;
}
