import type { DetectSource } from '../../shared/types';

/**
 * Manière de lancer un jeu, construite par la détection à partir de valeurs vérifiées.
 * Elle reste dans la partie système : l'interface ne la voit jamais et ne peut pas la choisir.
 * - url : adresse officielle de la plateforme (steam://, com.epicgames.launcher://) ;
 * - exe : programme de la plateforme ou du jeu, avec des arguments fixes.
 */
export type LaunchPlan =
  | { kind: 'url'; url: string }
  | { kind: 'exe'; file: string; args: string[]; cwd: string };

/** Un jeu trouvé sur le disque, avant rapprochement avec la bibliothèque. */
export interface FoundGame {
  source: DetectSource;
  storeId: string;
  title: string;
  folder: string;
  sizeGb: number | null;
  complete: boolean;
  /** null : Warmup sait que le jeu est là, mais pas encore comment le lancer. */
  launch: LaunchPlan | null;
  /** Désinstallation par le programme officiel de la plateforme ; null si Warmup ne sait pas la lancer. */
  uninstall?: LaunchPlan | null;
  /** Vérification des fichiers par la plateforme (Steam seulement). */
  verify?: LaunchPlan | null;
  /** Temps de jeu et dernière partie d'après la plateforme, quand elle les enregistre sur le PC (Steam). */
  minutes?: number;
  lastPlayed?: number;
}

export interface StoreResult { source: DetectSource; found: boolean; games: FoundGame[] }
