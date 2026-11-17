import { execFile } from 'node:child_process';
import path from 'node:path';

// Corrections avant lancement. Chacune est une action prédéfinie, que le joueur a activée lui-même dans les réglages
// après en avoir lu l'explication ; elle est notée dans le journal et peut être annulée.
//
// Première correction : le mode d'alimentation de Windows. Pendant une partie, Warmup passe en « Performances élevées »,
// puis rétablit le mode d'origine à la fin. Il utilise l'outil « powercfg » fourni avec Windows, sans droits d'administrateur.

export const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function powercfg(args: string[]): Promise<string> {
  if (process.platform !== 'win32') return Promise.resolve('');
  const tool = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'powercfg.exe');
  return new Promise((resolve) => {
    execFile(tool, args, { timeout: 8000, windowsHide: true }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

/** Lit une ligne de powercfg : identifiant du mode et son nom entre parenthèses. */
export function parseScheme(line: string): { guid: string; name: string } | null {
  const guid = GUID.exec(line)?.[0].toLowerCase();
  return guid ? { guid, name: /\(([^)]+)\)/.exec(line)?.[1]?.trim() ?? 'Mode inconnu' } : null;
}

/** Vrai si le mode « Performances élevées » existe sur ce PC (certains portables ne le proposent pas). */
export const hasHighPerformance = (list: string): boolean => list.toLowerCase().includes(HIGH_PERFORMANCE);

export interface PowerChange { previous: string; previousName: string }

/** Passe en « Performances élevées ». Renvoie le mode d'origine, ou null s'il n'y avait rien à changer ou si ce n'est pas possible. */
export async function boostPower(): Promise<PowerChange | null> {
  const active = parseScheme(await powercfg(['/getactivescheme']));
  if (!active || active.guid === HIGH_PERFORMANCE) return null;
  if (!hasHighPerformance(await powercfg(['/list']))) return null;
  await powercfg(['/setactive', HIGH_PERFORMANCE]);
  const now = parseScheme(await powercfg(['/getactivescheme']));
  return now?.guid === HIGH_PERFORMANCE ? { previous: active.guid, previousName: active.name } : null;
}

/** Rétablit un mode d'alimentation. `guid` vient du journal : il est vérifié avant d'être utilisé. */
export async function restorePower(guid: string): Promise<boolean> {
  if (!new RegExp(`^${GUID.source}$`, 'i').test(guid)) return false;
  await powercfg(['/setactive', guid]);
  return parseScheme(await powercfg(['/getactivescheme']))?.guid === guid.toLowerCase();
}
