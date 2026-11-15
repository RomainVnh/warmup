import { execFile } from 'node:child_process';
import path from 'node:path';

// Lecture seule du registre Windows, avec l'outil « reg » fourni par Windows.
// Seules les clés listées ici peuvent être lues : aucune commande libre.

export const REGISTRY_KEYS = {
  steamUser: 'HKCU\\Software\\Valve\\Steam',
  steamMachine: 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
  gogGames: 'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
  // Liste des programmes installés : Battle.net et Rockstar y inscrivent leurs jeux.
  uninstall32: 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  uninstall64: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
} as const;

export type RegistryKey = (typeof REGISTRY_KEYS)[keyof typeof REGISTRY_KEYS];
export type RegistryValues = Map<string, Record<string, string>>;

/** Renvoie le texte affiché par « reg query <clé> /s », ou un texte vide si la clé n'existe pas. */
export function queryRegistry(key: RegistryKey): Promise<string> {
  if (process.platform !== 'win32' || !Object.values(REGISTRY_KEYS).includes(key)) return Promise.resolve('');
  const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe');
  return new Promise((resolve) => {
    execFile(reg, ['query', key, '/s'], { timeout: 5000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? '' : stdout);
    });
  });
}

/**
 * Transforme la sortie de « reg query » en table : clé du registre → { nom en minuscules : valeur }.
 *
 *   HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\GOG.com\Games\1207664663
 *       gameName    REG_SZ    The Witcher 3: Wild Hunt
 */
export function parseRegOutput(text: string): RegistryValues {
  const result: RegistryValues = new Map();
  let current: Record<string, string> | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^HKEY_/.test(line)) {
      current = {};
      result.set(line.trim(), current);
      continue;
    }
    const match = /^\s{4}(.+?)\s{4}REG_[A-Z_]+(?:\s{4}(.*))?$/.exec(line);
    if (match && current) current[match[1].trim().toLowerCase()] = (match[2] ?? '').trim();
  }
  return result;
}
