import { createContext, useContext } from 'react';
import type { Account, Collection, Download, Game, Notice, ProfileCard, Settings, Snapshot } from '../shared/types';

export interface AppState {
  data: Snapshot;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  /** Lance le contrôle avant lancement, puis le jeu. */
  play(game: Game): void;
  /** Ce que le joueur a personnalisé sur son profil. */
  profileCard: ProfileCard;
  updateProfileCard(patch: Partial<ProfileCard>): void;
  /** Pseudo à afficher : celui choisi, sinon le nom par défaut. */
  displayName: string;
  /** Jeux présents sur le disque. Un jeu possédé mais absent doit d'abord être installé. */
  installed: Set<string>;
  downloads: Download[];
  /** Ajoute l'installation d'un jeu à la file des téléchargements. */
  install(game: Game): void;
  setDownloadPaused(id: string, paused: boolean): void;
  removeDownload(id: string): void;
  collections: Collection[];
  saveCollections(next: Collection[]): void;
  notices: Notice[];
  markNoticesRead(): void;
  /** Compte Warmup, plateformes reliées et état du premier lancement. */
  account: Account;
  updateAccount(patch: Partial<Account>): void;
  favorites: Set<string>;
  toggleFavorite(id: string): void;
  notify(text: string, link?: { label: string; href: string }): void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp doit être utilisé dans <App>.');
  return state;
}

export function findGame(data: Snapshot, id: string): Game | undefined {
  return data.games.find((g) => g.id === id);
}
