import { parseRegOutput } from './registry';

// Liste des programmes installés, telle que Windows la tient dans le registre
// (« Applications installées » dans les paramètres). Battle.net et Rockstar y inscrivent chacun de leurs jeux.

export interface InstalledProgram {
  key: string;
  name: string;
  folder: string;
  publisher: string;
  uninstall: string;
  /** Taille en Ko, telle que l'indique le programme. 0 si inconnue. */
  sizeKb: number;
}

/** `outputs` : sorties de « reg query » sur les deux listes (programmes 32 et 64 bits). */
export function installedPrograms(...outputs: string[]): InstalledProgram[] {
  const list: InstalledProgram[] = [];
  for (const output of outputs) {
    for (const [key, values] of parseRegOutput(output)) {
      const name = values.displayname ?? '';
      if (!name) continue;
      const size = /^0x([0-9a-f]{1,8})$/i.exec(values.estimatedsize ?? '');
      list.push({
        key,
        name,
        folder: (values.installlocation ?? '').replace(/^"|"$/g, '').slice(0, 400),
        publisher: values.publisher ?? '',
        uninstall: (values.uninstallstring ?? '').slice(0, 600),
        sizeKb: size ? parseInt(size[1], 16) : 0
      });
    }
  }
  return list;
}
