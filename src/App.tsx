import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cleanAccount, cleanCollections, cleanProfileCard, defaultProfileCard, defaultSettings, type Account, type Collection, type Download, type Game, type Notice, type ProfileCard, type Settings, type Snapshot } from '../shared/types';
import { api } from './api';
import { AppContext, type AppState } from './context';
import { LaunchOverlay, type LaunchState } from './LaunchOverlay';
import { GameArt, Icon, Logo, UserAvatar, type IconName } from './ui';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { GamePage } from './screens/GamePage';
import { Mods } from './screens/Mods';
import { Diagnostic } from './screens/Diagnostic';
import { Report } from './screens/Report';
import { Assistant } from './screens/Assistant';
import { SettingsPage } from './screens/Settings';
import { ProfilePage } from './screens/Profile';
import { Downloads } from './screens/Downloads';
import { Friends } from './screens/Friends';
import { Reports } from './screens/Reports';
import { GuidePage } from './screens/Guide';
import { GlobalSearch } from './Search';
import { NotificationBell } from './Notifications';
import { Onboarding } from './Onboarding';

interface Route {
  name: string;
  param: string;
  query: URLSearchParams;
}

function readRoute(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const [name = '', param = ''] = path.split('/');
  return { name: name || 'home', param: decodeURIComponent(param), query: new URLSearchParams(query) };
}

// Mods, Assistant, Diagnostic et Réglages sont dans la barre du haut : ils n'apparaissent pas ici.
const NAV: { route: string; label: string; icon: IconName }[] = [
  { route: 'home', label: 'Accueil', icon: 'home' },
  { route: 'library', label: 'Bibliothèque', icon: 'grid' }
];

interface Toast {
  text: string;
  link?: { label: string; href: string };
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [data, setData] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [profileCard, setProfileCard] = useState<ProfileCard>(defaultProfileCard);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [launch, setLaunch] = useState<LaunchState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const cancelLaunch = useRef<(() => void) | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    void api.getSnapshot().then((snap) => {
      setData(snap);
      setFavorites(new Set(snap.games.filter((g) => g.favorite).map((g) => g.id)));
      setInstalled(new Set(snap.games.filter((g) => g.installed).map((g) => g.id)));
      setDownloads(snap.downloads.items);
      setNotices(snap.notices);
    });
    void api.getSettings().then(setSettings);
    void api.getProfileCard().then(setProfileCard);
    void api.getCollections().then(setCollections);
    void api.getAccount().then(setAccount);
    return () => cancelLaunch.current?.();
  }, []);

  // Chaque changement d'écran repart du haut de la page.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [route.name, route.param]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback<AppState['notify']>((text, link) => setToast({ text, link }), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    void api.setSettings(patch).then(setSettings);
  }, []);

  const updateProfileCard = useCallback((patch: Partial<ProfileCard>) => {
    setProfileCard((current) => cleanProfileCard(patch, current));
    void api.setProfileCard(patch).then(setProfileCard);
  }, []);

  const updateAccount = useCallback((patch: Partial<Account>) => {
    setAccount((current) => (current ? cleanAccount(patch, current) : current));
    void api.setAccount(patch).then(setAccount);
  }, []);

  const saveCollections = useCallback((next: Collection[]) => {
    setCollections(cleanCollections(next));
    void api.setCollections(next).then(setCollections);
  }, []);

  const markNoticesRead = useCallback(() => setNotices((list) => list.map((n) => ({ ...n, unread: false }))), []);

  // Téléchargements simulés : un seul avance à la fois, à la vitesse d'exemple ; le suivant de la file prend le relais.
  const speed = data?.downloads.speedMbPerSec ?? 0;
  const busy = downloads.some((d) => d.state === 'active' || d.state === 'queued');
  useEffect(() => {
    if (!busy || !speed) return;
    const timer = setInterval(() => {
      setDownloads((list) => {
        const index = list.findIndex((d) => d.state === 'active');
        if (index < 0) {
          const next = list.findIndex((d) => d.state === 'queued');
          return next < 0 ? list : list.map((d, i) => (i === next ? { ...d, state: 'active' } : d));
        }
        const current = list[index];
        const doneGb = Math.min(current.sizeGb, current.doneGb + speed / 1000);
        const finished = doneGb >= current.sizeGb;
        return list.map((d, i) => (i === index ? { ...d, doneGb, state: finished ? 'done' : 'active', when: finished ? 'À l\'instant' : d.when } : d));
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [busy, speed]);

  // Une installation terminée rend le jeu jouable.
  useEffect(() => {
    const ready = downloads.filter((d) => d.kind === 'install' && d.state === 'done' && !installed.has(d.gameId));
    if (!ready.length) return;
    setInstalled((current) => new Set([...current, ...ready.map((d) => d.gameId)]));
    const game = data?.games.find((g) => g.id === ready[0].gameId);
    if (game) {
      setToast({ text: `${game.title} est installé et prêt à jouer.`, link: { label: 'Ouvrir la fiche', href: `#/game/${game.id}` } });
      setNotices((list) => [{ id: `installe-${game.id}`, kind: 'update', title: `${game.title} est installé`, text: `${game.sizeGb} Go téléchargés. Le jeu est prêt.`, when: 'À l\'instant', href: `#/game/${game.id}`, unread: true, gameId: game.id }, ...list]);
    }
  }, [downloads, installed, data]);

  const install = useCallback((game: Game) => {
    setDownloads((list) => {
      if (list.some((d) => d.gameId === game.id && d.kind === 'install' && d.state !== 'done')) return list;
      const waiting = list.some((d) => d.state === 'active');
      return [...list, { id: `installation-${game.id}`, gameId: game.id, kind: 'install', label: 'Installation', sizeGb: game.sizeGb, doneGb: 0, state: waiting ? 'queued' : 'active', when: '' }];
    });
    setToast({ text: `${game.title} est ajouté aux téléchargements.`, link: { label: 'Voir la file', href: '#/downloads' } });
  }, []);

  const setDownloadPaused = useCallback((id: string, paused: boolean) => {
    setDownloads((list) => list.map((d) => (d.id === id && d.state !== 'done' ? { ...d, state: paused ? 'paused' : 'queued' } : d)));
  }, []);

  const removeDownload = useCallback((id: string) => setDownloads((list) => list.filter((d) => d.id !== id)), []);

  const play = useCallback(
    (game: Game) => {
      cancelLaunch.current?.();
      setToast(null);
      setLaunch({ game, step: 0, phase: 'run', silent: !settings.launchWindow });
      cancelLaunch.current = api.startLaunch(game.id, (event) => {
        setLaunch((current) => {
          if (!current || current.game.id !== game.id || current.phase === 'game') return current;
          if (event.type === 'step') return { ...current, step: event.index };
          if (event.type === 'done') return { ...current, phase: 'done' };
          return { ...current, phase: 'game' };
        });
      });
    },
    [settings.launchWindow]
  );

  const skipLaunch = useCallback(() => {
    cancelLaunch.current?.();
    setLaunch((current) => (current ? { ...current, phase: 'game', step: current.game.launch.steps.length } : current));
  }, []);

  const quitGame = useCallback(() => {
    cancelLaunch.current?.();
    setLaunch(null);
    notify('Partie terminée. Le bilan est prêt.', { label: 'Voir le bilan', href: '#/report' });
  }, [notify]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const displayName = profileCard.name || data?.profile.name || 'Joueur';
  const state = useMemo<AppState | null>(
    () => (data && account ? { data, account, updateAccount, settings, updateSettings, play, profileCard, updateProfileCard, displayName, installed, downloads, install, setDownloadPaused, removeDownload, collections, saveCollections, notices, markNoticesRead, favorites, toggleFavorite, notify } : null),
    [data, account, updateAccount, settings, updateSettings, play, profileCard, updateProfileCard, displayName, installed, downloads, install, setDownloadPaused, removeDownload, collections, saveCollections, notices, markNoticesRead, favorites, toggleFavorite, notify]
  );

  if (!state) return <div className="overlay" role="status">Chargement de la bibliothèque</div>;

  // Premier lancement : le parcours de configuration remplace l'application tant qu'il n'est pas terminé.
  if (!state.account.onboarded || !state.account.signedIn) {
    return (
      <AppContext.Provider value={state}>
        <Onboarding />
      </AppContext.Provider>
    );
  }

  const active = route.name === 'game' ? 'library' : route.name;
  const pcIssues = state.data.pc.parts.filter((p) => p.status === 'warn').length;
  const recent = state.data.games.filter((g) => installed.has(g.id)).sort((x, y) => x.recentRank - y.recentRank).slice(0, 6);
  const friends = [...state.data.friends].sort((x, y) => Number(y.online) - Number(x.online));
  const running = downloads.filter((d) => d.state !== 'done').length;

  let screen;
  switch (route.name) {
    case 'library': screen = <Library key={route.query.toString()} initialQuery={route.query.get('q') ?? ''} />; break;
    case 'game': screen = <GamePage key={route.param} id={route.param} initialTab={route.query.get('tab') ?? ''} />; break;
    case 'mods': screen = <Mods key={route.param} gameId={route.param} />; break;
    case 'downloads': screen = <Downloads />; break;
    case 'friends': screen = <Friends selected={route.param} />; break;
    case 'reports': screen = <Reports key={route.query.toString()} initialGame={route.query.get('game') ?? ''} />; break;
    case 'guide': screen = <GuidePage key={route.param} id={route.param} />; break;
    case 'diagnostic': screen = <Diagnostic />; break;
    case 'report': screen = <Report key={route.param} id={route.param} />; break;
    case 'assistant': screen = <Assistant />; break;
    case 'settings': screen = <SettingsPage />; break;
    case 'profile': screen = <ProfilePage />; break;
    default: screen = <Home />;
  }

  return (
    <AppContext.Provider value={state}>
      <div className="app">
        <aside className="side">
          <a href="#/home" className="brand" aria-label="Warmup, accueil">
            <Logo />
            <span className="brand-name">Warmup</span>
          </a>
          <div className="side-label">Menu</div>
          <nav className="side-nav" aria-label="Navigation principale">
            {NAV.map((n) => (
              <a key={n.route} href={`#/${n.route}`} title={n.label} className={`side-link${active === n.route ? ' active' : ''}`} aria-current={active === n.route ? 'page' : undefined}>
                <Icon name={n.icon} size={16} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="side-label">Jeux récents</div>
          <nav className="side-games" aria-label="Jeux récents">
            {recent.map((g) => {
              const current = route.name === 'game' && route.param === g.id;
              return (
                <a key={g.id} href={`#/game/${g.id}`} title={g.title} className={`side-game${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined}>
                  <span className="thumb"><GameArt game={g} kind="cover" lazy /></span>
                  <span className="name">{g.title}</span>
                  {g.status === 'warn' && (
                    <span className="flag" title={g.statusLabel}>
                      <Icon name="warn" size={13} stroke={2.2} />
                      <span className="sr-only">{g.statusLabel}</span>
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
          <a href="#/profile" title={`Profil de ${displayName}`} className={`side-profile${active === 'profile' ? ' active' : ''}`} aria-current={active === 'profile' ? 'page' : undefined}>
            <UserAvatar name={displayName} image={profileCard.avatar} className="on" />
            <span>{displayName}</span>
          </a>
        </aside>
        <div className="content">
          <header className="top">
            <GlobalSearch />
            <a className={`top-friends${active === 'friends' ? ' active' : ''}`} href="#/friends" title="Voir les amis" aria-label={`Amis : ${friends.filter((f) => f.online).length} en ligne. Ouvrir la page Amis`}>
              <span className="small muted top-friends-count">{friends.filter((f) => f.online).length} amis en ligne</span>
              <span className="stack-avatars" aria-hidden="true">
                {friends.slice(0, 6).map((f) => (
                  <span key={f.name} className={`avatar${f.online ? ' on' : ' off'}`}>{f.name[0]}</span>
                ))}
              </span>
            </a>
            <span className="top-sep" aria-hidden="true" />
            <a href="#/downloads" title="Téléchargements" className={`top-icon${active === 'downloads' ? ' active' : ''}`} aria-label={running ? `Téléchargements, ${running} en cours ou en attente` : 'Téléchargements'} aria-current={active === 'downloads' ? 'page' : undefined}>
              <Icon name="download" size={16} />
              {running > 0 && <span className="top-count">{running}</span>}
            </a>
            <NotificationBell />
            <a href="#/mods" title="Mods" className={`top-icon${active === 'mods' ? ' active' : ''}`} aria-label="Mods" aria-current={active === 'mods' ? 'page' : undefined}><Icon name="layers" size={16} /></a>
            <a href="#/assistant" title="Coach, l'assistant" className={`top-icon${active === 'assistant' ? ' active' : ''}`} aria-label="Coach, l'assistant" aria-current={active === 'assistant' ? 'page' : undefined}><Icon name="chat" size={16} /></a>
            <a href="#/diagnostic" title="Diagnostic du PC" className={`top-icon${active === 'diagnostic' ? ' active' : ''}`} aria-label={pcIssues > 0 ? `Diagnostic du PC, ${pcIssues} points à améliorer` : 'Diagnostic du PC'} aria-current={active === 'diagnostic' ? 'page' : undefined}>
              <Icon name="pulse" size={16} />
              {pcIssues > 0 && <span className="top-flag"><Icon name="warn" size={12} stroke={2.4} /></span>}
            </a>
            <a href="#/settings" title="Réglages" className={`top-icon${active === 'settings' ? ' active' : ''}`} aria-label="Réglages" aria-current={active === 'settings' ? 'page' : undefined}><Icon name="gear" size={16} /></a>
          </header>
          <div className="body">
            <main className="main" ref={mainRef}>{screen}</main>
          </div>
        </div>
      </div>
      {launch && (
        <LaunchOverlay
          launch={launch}
          onSkip={skipLaunch}
          onQuit={quitGame}
          onDisable={() => {
            updateSettings({ launchWindow: false });
            setLaunch((current) => (current ? { ...current, silent: true } : current));
            notify('Fenêtre de lancement désactivée. Les contrôles continuent en silence.', { label: 'Réglages', href: '#/settings' });
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.link && <a href={toast.link.href} onClick={() => setToast(null)}>{toast.link.label}</a>}
        </div>
      )}
    </AppContext.Provider>
  );
}
