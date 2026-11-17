import { randomBytes } from 'node:crypto';
import { db, save, type Account } from './store.js';

// Connexion à Steam, par sa page officielle (OpenID) : Warmup ne voit jamais le mot de passe.
// Steam renvoie seulement l'identifiant public du compte ; la clé de l'API Steam, elle, reste sur ce serveur.
//   STEAM_API_KEY     clé gratuite, à demander sur https://steamcommunity.com/dev/apikey
//   ADRESSE_PUBLIQUE  adresse de ce serveur vue d'internet, par exemple https://api.warmup.example

const OPENID = 'https://steamcommunity.com/openid/login';
const API = 'https://api.steampowered.com';
const key = () => process.env.STEAM_API_KEY ?? '';
const publicUrl = () => (process.env.ADRESSE_PUBLIQUE ?? '').replace(/\/+$/, '');

export const steamAvailable = (): boolean => key() !== '' && /^https:\/\//.test(publicUrl());

// Demandes de connexion en cours : un jeton à usage unique relie le retour de Steam au bon compte Warmup.
const pending = new Map<string, { email: string; expires: number }>();

export function startLink(account: Account): string {
  const state = randomBytes(24).toString('base64url');
  pending.set(state, { email: account.email, expires: Date.now() + 10 * 60_000 });
  const back = `${publicUrl()}/steam/retour?etat=${state}`;
  const query = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': back,
    'openid.realm': publicUrl(),
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  return `${OPENID}?${query}`;
}

/** Retour de Steam : on lui redemande de confirmer la réponse, puis on retient l'identifiant du compte. */
export async function finishLink(query: URLSearchParams): Promise<boolean> {
  const state = query.get('etat') ?? '';
  const request = pending.get(state);
  pending.delete(state);
  if (!request || request.expires < Date.now()) return false;
  const steamId = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(query.get('openid.claimed_id') ?? '')?.[1];
  if (!steamId || !(query.get('openid.return_to') ?? '').startsWith(`${publicUrl()}/steam/retour`)) return false;
  const check = new URLSearchParams();
  for (const [name, value] of query) if (name.startsWith('openid.')) check.set(name, value);
  check.set('openid.mode', 'check_authentication');
  try {
    const response = await fetch(OPENID, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: check.toString() });
    if (!/is_valid\s*:\s*true/.test(await response.text())) return false;
  } catch {
    return false;
  }
  const account = db().accounts[request.email];
  if (!account) return false;
  account.steamId = steamId;
  save();
  return true;
}

async function steam<T>(path: string, params: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}?${new URLSearchParams({ key: key(), ...params })}`, { signal: AbortSignal.timeout(10_000) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

interface Player { steamid: string; personaname?: string; personastate?: number; gameid?: string; gameextrainfo?: string; lastlogoff?: number }

/** Pseudo Steam et amis (en ligne, en jeu). Les amis ne sont visibles que si le profil Steam les rend publics. */
export async function profile(account: Account): Promise<{ linked: boolean; name: string; friends: { name: string; online: boolean; game: string; appId: string; lastSeen: number; since: number }[] }> {
  if (!account.steamId) return { linked: false, name: '', friends: [] };
  const me = await steam<{ response: { players: Player[] } }>('/ISteamUser/GetPlayerSummaries/v2/', { steamids: account.steamId });
  const list = await steam<{ friendslist?: { friends: { steamid: string; friend_since: number }[] } }>('/ISteamUser/GetFriendList/v1/', { steamid: account.steamId, relationship: 'friend' });
  const ids = (list?.friendslist?.friends ?? []).slice(0, 100);
  const players = ids.length ? await steam<{ response: { players: Player[] } }>('/ISteamUser/GetPlayerSummaries/v2/', { steamids: ids.map((f) => f.steamid).join(',') }) : null;
  const friends = (players?.response.players ?? []).map((p) => ({
    name: (p.personaname ?? 'Ami Steam').slice(0, 40),
    online: (p.personastate ?? 0) > 0,
    game: (p.gameextrainfo ?? '').slice(0, 80),
    appId: /^\d{1,10}$/.test(p.gameid ?? '') ? p.gameid! : '',
    lastSeen: (p.lastlogoff ?? 0) * 1000,
    since: (ids.find((f) => f.steamid === p.steamid)?.friend_since ?? 0) * 1000
  }));
  return { linked: true, name: (me?.response.players[0]?.personaname ?? '').slice(0, 40), friends };
}

/** Succès obtenus sur un jeu : nom affiché et date. Vide si le profil Steam garde ses détails de jeu privés. */
export async function achievements(account: Account, appId: string): Promise<{ name: string; at: number }[]> {
  if (!account.steamId || !/^\d{1,10}$/.test(appId)) return [];
  const data = await steam<{ playerstats?: { achievements?: { achieved: number; unlocktime: number; name?: string }[] } }>('/ISteamUserStats/GetPlayerAchievements/v1/', { steamid: account.steamId, appid: appId, l: 'french' });
  return (data?.playerstats?.achievements ?? []).filter((a) => a.achieved === 1 && a.name).map((a) => ({ name: a.name!.slice(0, 120), at: a.unlocktime * 1000 }));
}
