import fs from 'node:fs';
import path from 'node:path';

// Données du serveur, dans un seul fichier JSON. Suffisant pour démarrer ; à remplacer par une base de données
// quand le nombre de comptes le demandera.

export interface Account {
  email: string;
  createdAt: number;
  /** Ce que l'application synchronise : carte de joueur, collections, favoris, réglages. */
  data: Record<string, unknown>;
  dataAt: number;
  /** Identifiant public du compte Steam relié, s'il y en a un. */
  steamId?: string;
}
export interface PendingCode { hash: string; expires: number; tries: number; sentAt: number; sentToday: number; day: string }
export interface Session { email: string; expires: number }

interface Data { accounts: Record<string, Account>; codes: Record<string, PendingCode>; sessions: Record<string, Session> }

const dir = process.env.DONNEES ?? './donnees';
const file = path.join(dir, 'warmup.json');

let data: Data = { accounts: {}, codes: {}, sessions: {} };
try {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Data>;
  data = { accounts: raw.accounts ?? {}, codes: raw.codes ?? {}, sessions: raw.sessions ?? {} };
} catch {
  // Premier démarrage : pas encore de fichier.
}

let timer: NodeJS.Timeout | null = null;
/** Enregistre sur le disque, au plus une fois par seconde, en remplaçant le fichier d'un seul coup. */
export function save(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data), 'utf8');
      fs.renameSync(`${file}.tmp`, file);
    } catch (error) {
      console.error('Enregistrement impossible :', error);
    }
  }, 1000);
}

export const db = (): Data => data;

/** Retire les codes et les sessions expirés. */
export function sweep(now = Date.now()): void {
  for (const [key, code] of Object.entries(data.codes)) if (code.expires < now - 86_400_000) delete data.codes[key];
  for (const [key, session] of Object.entries(data.sessions)) if (session.expires < now) delete data.sessions[key];
  save();
}
