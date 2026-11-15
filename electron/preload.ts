import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Account, Collection, GameOptions, LaunchEvent, WarmupApi, ProfileCard, Settings } from '../shared/types';

// Le pont entre l'interface et la partie système.
// Seules les actions listées ici existent du côté de l'interface.
const api: WarmupApi = {
  getSnapshot: () => ipcRenderer.invoke('data:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch),
  getProfileCard: () => ipcRenderer.invoke('profile:get'),
  setProfileCard: (patch: Partial<ProfileCard>) => ipcRenderer.invoke('profile:set', patch),
  getCollections: () => ipcRenderer.invoke('collections:get'),
  setCollections: (list: Collection[]) => ipcRenderer.invoke('collections:set', list),
  getAccount: () => ipcRenderer.invoke('account:get'),
  setAccount: (patch: Partial<Account>) => ipcRenderer.invoke('account:set', patch),
  getGameOptions: () => ipcRenderer.invoke('game-options:get'),
  setGameOptions: (gameId: string, patch: Partial<GameOptions>) => ipcRenderer.invoke('game-options:set', gameId, patch),
  getGameFiles: (gameId: string) => ipcRenderer.invoke('game:files', gameId),
  openGameFolder: (gameId: string) => ipcRenderer.invoke('game:open-folder', gameId),
  verifyGameFiles: (gameId: string) => ipcRenderer.invoke('game:verify', gameId),
  uninstallGame: (gameId: string) => ipcRenderer.invoke('game:uninstall', gameId),
  getPcReport: () => ipcRenderer.invoke('pc:report'),
  detectGames: () => ipcRenderer.invoke('games:detect'),
  startLaunch(gameId, onEvent) {
    const listener = (_event: IpcRendererEvent, launchEvent: LaunchEvent) => onEvent(launchEvent);
    ipcRenderer.on('launch:event', listener);
    ipcRenderer.send('launch:start', gameId);
    return () => {
      ipcRenderer.removeListener('launch:event', listener);
      ipcRenderer.send('launch:cancel');
    };
  }
};

contextBridge.exposeInMainWorld('warmup', api);
