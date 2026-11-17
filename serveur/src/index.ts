import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { sendCode } from './email.js';
import { achievements, finishLink, profile, startLink, steamAvailable } from './steam.js';
import { db, save, sweep, type Account } from './store.js';

// Service en ligne de Warmup.
//   POST /auth/code      { email }            envoie un code à 6 chiffres par e-mail
//   POST /auth/verifier  { email, code }      échange le code contre un jeton de session
//   POST /auth/quitter                         ferme la session
//   GET  /compte                               adresse, date de création, droits, données synchronisées
//   PUT  /compte/donnees { data }              enregistre les données synchronisées
//   POST /steam/demarrer                       adresse de la page officielle de connexion à Steam
//   GET  /steam/retour                         retour de Steam (ouvert par le navigateur du joueur)
//   GET  /steam                                pseudo et amis Steam
//   GET  /steam/succes?appid=                  succès obtenus sur un jeu
//   POST /steam/retirer                        oublie le compte Steam relié
// Aucun mot de passe : l'adresse e-mail est prouvée par le code reçu.

const PORT = Number(process.env.PORT ?? 8787);
const CODE_MINUTES = 15;
const SESSION_DAYS = 90;
const MAX_BODY = 400_000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,80}\.[^\s@]{2,24}$/;
const admins = new Set((process.env.ADMINS ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean));

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const today = () => new Date().toISOString().slice(0, 10);

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Envoi trop volumineux.'));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const parsed: unknown = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new HttpError(400, 'Demande illisible.'));
      }
    });
    request.on('error', () => reject(new HttpError(400, 'Demande interrompue.')));
  });
}

function emailOf(body: Record<string, unknown>): string {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 120 || !EMAIL.test(email)) throw new HttpError(400, 'Adresse e-mail incomplète.');
  return email;
}

/** Compte de la session présentée dans l'en-tête Authorization, ou erreur 401. */
function signedIn(request: http.IncomingMessage): { account: Account; key: string } {
  const token = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.authorization ?? '')?.[1];
  const key = token ? sha(token) : '';
  const session = key ? db().sessions[key] : undefined;
  const account = session && session.expires > Date.now() ? db().accounts[session.email] : undefined;
  if (!account) throw new HttpError(401, 'Session expirée. Reconnectez-vous.');
  return { account, key };
}

const view = (account: Account) => ({ email: account.email, createdAt: account.createdAt, admin: admins.has(account.email), data: account.data, dataAt: account.dataAt, steam: Boolean(account.steamId) });

/** Page affichée dans le navigateur au retour de Steam. */
class Page {
  constructor(public html: string) {}
}
const page = (title: string, text: string) => new Page(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Warmup</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070708;color:#f3f3f4;font:16px system-ui"><main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-weight:500">${title}</h1><p style="color:#c2c2c7;line-height:1.6">${text}</p></main></body></html>`);

async function route(request: http.IncomingMessage): Promise<unknown> {
  const path = (request.url ?? '').split('?')[0];
  const key = `${request.method} ${path}`;

  if (key === 'GET /') return { service: 'Warmup', ok: true };

  if (key === 'POST /auth/code') {
    const email = emailOf(await readBody(request));
    const now = Date.now();
    const previous = db().codes[email];
    const sentToday = previous?.day === today() ? previous.sentToday : 0;
    // Un code par minute et dix par jour au plus, pour qu'on ne puisse pas inonder une boîte mail.
    if (previous && now - previous.sentAt < 60_000) throw new HttpError(429, 'Un code vient d\'être envoyé. Patientez une minute.');
    if (sentToday >= 10) throw new HttpError(429, 'Trop de codes demandés aujourd\'hui. Réessayez demain.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    db().codes[email] = { hash: sha(`${email}:${code}`), expires: now + CODE_MINUTES * 60_000, tries: 0, sentAt: now, sentToday: sentToday + 1, day: today() };
    save();
    if (!(await sendCode(email, code))) throw new HttpError(502, 'L\'e-mail n\'a pas pu être envoyé. Réessayez dans un instant.');
    return { ok: true, minutes: CODE_MINUTES };
  }

  if (key === 'POST /auth/verifier') {
    const body = await readBody(request);
    const email = emailOf(body);
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
    const pending = db().codes[email];
    const wrong = new HttpError(401, 'Code incorrect ou expiré.');
    if (!pending || pending.expires < Date.now() || pending.tries >= 5 || !/^\d{6}$/.test(code)) throw wrong;
    pending.tries += 1; // cinq essais au plus par code
    if (!same(pending.hash, sha(`${email}:${code}`))) {
      save();
      throw wrong;
    }
    pending.expires = 0; // un code ne sert qu'une fois
    const account = (db().accounts[email] ??= { email, createdAt: Date.now(), data: {}, dataAt: 0 });
    const token = randomBytes(32).toString('base64url');
    db().sessions[sha(token)] = { email, expires: Date.now() + SESSION_DAYS * 86_400_000 };
    save();
    return { token, account: view(account) };
  }

  if (key === 'POST /auth/quitter') {
    delete db().sessions[signedIn(request).key];
    save();
    return { ok: true };
  }

  if (key === 'GET /compte') return view(signedIn(request).account);

  if (key === 'PUT /compte/donnees') {
    const { account } = signedIn(request);
    const { data } = await readBody(request);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Données illisibles.');
    account.data = data as Record<string, unknown>;
    account.dataAt = Date.now();
    save();
    return { ok: true, dataAt: account.dataAt };
  }

  if (key === 'POST /steam/demarrer') {
    if (!steamAvailable()) throw new HttpError(503, 'La connexion à Steam n\'est pas encore configurée sur le service.');
    return { url: startLink(signedIn(request).account) };
  }
  if (key === 'GET /steam/retour') {
    const ok = await finishLink(new URL(request.url ?? '', 'http://x').searchParams);
    return ok ? page('Steam est relié', 'Vous pouvez fermer cette page et revenir à Warmup.') : page('La connexion à Steam n\'a pas abouti', 'Revenez à Warmup et relancez la connexion.');
  }
  if (key === 'GET /steam') return profile(signedIn(request).account);
  if (key === 'GET /steam/succes') return { achieved: await achievements(signedIn(request).account, new URL(request.url ?? '', 'http://x').searchParams.get('appid') ?? '') };
  if (key === 'POST /steam/retirer') {
    delete signedIn(request).account.steamId;
    save();
    return { ok: true };
  }

  throw new HttpError(404, 'Adresse inconnue.');
}

http
  .createServer((request, response) => {
    route(request)
      .then((result) => ({ status: 200, result }))
      .catch((error: unknown) => {
        if (error instanceof HttpError) return { status: error.status, result: { error: error.message } };
        console.error(error);
        return { status: 500, result: { error: 'Erreur du serveur.' } };
      })
      .then(({ status, result }) => {
        const html = result instanceof Page;
        response.writeHead(status, { 'Content-Type': html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(html ? result.html : JSON.stringify(result));
      });
  })
  .listen(PORT, () => console.log(`Service Warmup à l'écoute sur le port ${PORT}`));

setInterval(sweep, 3_600_000).unref();
