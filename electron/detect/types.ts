import type { DetectSource } from '../../shared/types';

/** Un jeu trouvé sur le disque, avant rapprochement avec la bibliothèque. */
export interface FoundGame {
  source: DetectSource;
  storeId: string;
  title: string;
  folder: string;
  sizeGb: number | null;
  complete: boolean;
}

export interface StoreResult { source: DetectSource; found: boolean; games: FoundGame[] }
