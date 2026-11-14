import fs from 'node:fs/promises';
import path from 'node:path';

// Lecture prudente des fichiers des plateformes : tout ce qu'ils contiennent est une donnée, jamais une instruction.

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Lit un fichier texte de 2 Mo au plus. Renvoie null s'il est absent, trop gros ou illisible. */
export async function readText(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** Noms des fichiers d'un dossier (liste vide si le dossier n'existe pas), limités à `max`. */
export async function listFiles(dir: string, max = 3000): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).slice(0, max);
  } catch {
    return [];
  }
}

export async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** Texte venu d'un fichier tiers : sans caractères de contrôle, raccourci. */
export function cleanText(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Taille en octets (nombre ou texte) convertie en Go, un chiffre après la virgule. null si inconnue. */
export function bytesToGb(value: unknown): number | null {
  const bytes = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,16}$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

/** Deux chemins désignent-ils le même dossier ? (Windows ne distingue pas les majuscules.) */
export const pathKey = (dir: string): string => path.normalize(dir).replace(/[\\/]+$/, '').toLowerCase();
