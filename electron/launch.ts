import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { shell } from 'electron';
import type { LaunchPlan } from './detect/types';

// Ouverture réelle d'un jeu. Seules deux formes existent, toutes deux construites par la détection :
// une adresse officielle de plateforme, ou un programme lancé avec des arguments fixes.
// Warmup ouvre le jeu puis reste à l'extérieur : il ne s'y introduit jamais.

const ALLOWED_URL = /^(steam:\/\/(rungameid|uninstall|validate)\/\d{1,10}|steam:\/\/run\/\d{1,10}\/\/[\w%.:+,\-/=]{0,600}\/|com\.epicgames\.launcher:\/\/apps\/[\w.-]{1,80}\?action=launch&silent=true)$/;

/** Ajoute les arguments choisis par le joueur (déjà vérifiés par splitArgs) à la manière de lancer. */
export function withArgs(plan: LaunchPlan, args: string[]): LaunchPlan {
  if (!args.length) return plan;
  if (plan.kind === 'exe') return { ...plan, args: [...plan.args, ...args] };
  // Steam accepte des arguments par l'adresse « steam://run/<numéro>//<arguments>/ » (à vérifier sur un vrai PC).
  const steam = /^steam:\/\/rungameid\/(\d{1,10})$/.exec(plan.url);
  return steam ? { kind: 'url', url: `steam://run/${steam[1]}//${encodeURIComponent(args.join(' '))}/` } : plan;
}

/** Ouvre le dossier d'un jeu dans l'explorateur de fichiers. */
export async function openFolder(folder: string): Promise<LaunchResult> {
  if (!fs.existsSync(folder)) return { ok: false, reason: 'Le dossier du jeu est introuvable. Il a peut-être été déplacé.' };
  const error = await shell.openPath(folder);
  return error ? { ok: false, reason: 'Le dossier n\'a pas pu être ouvert.' } : { ok: true };
}

export type LaunchResult = { ok: true } | { ok: false; reason: string };

export async function openGame(plan: LaunchPlan): Promise<LaunchResult> {
  if (plan.kind === 'url') {
    if (!ALLOWED_URL.test(plan.url)) return { ok: false, reason: 'L\'adresse de lancement n\'est pas reconnue.' };
    try {
      await shell.openExternal(plan.url, { activate: true });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'La plateforme du jeu ne s\'est pas ouverte. Vérifiez qu\'elle est bien installée.' };
    }
  }

  if (!fs.existsSync(plan.file)) return { ok: false, reason: 'Le programme du jeu est introuvable. Il a peut-être été déplacé ou désinstallé.' };
  return new Promise<LaunchResult>((resolve) => {
    try {
      const child = spawn(plan.file, plan.args, { cwd: plan.cwd, detached: true, stdio: 'ignore', windowsHide: false, shell: false });
      child.once('error', () => resolve({ ok: false, reason: 'Windows a refusé d\'ouvrir le jeu.' }));
      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch {
      resolve({ ok: false, reason: 'Windows a refusé d\'ouvrir le jeu.' });
    }
  });
}
