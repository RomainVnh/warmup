import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// Petits fichiers JSON rangés dans le dossier de données de l'application.

export const dataFile = (name: string) => path.join(app.getPath('userData'), name);

export function readJson(name: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(dataFile(name), 'utf8'));
  } catch {
    return undefined;
  }
}

export function writeJson(name: string, value: unknown): void {
  try {
    fs.writeFileSync(dataFile(name), JSON.stringify(value, null, 2), 'utf8');
  } catch {
    // Un échec d'écriture ne doit rien bloquer : la valeur vaut au moins pour cette session.
  }
}
