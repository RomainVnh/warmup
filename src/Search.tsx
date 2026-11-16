import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Game } from '../shared/types';
import { useApp } from './context';
import { GameArt, Icon, type IconName } from './ui';
import { SETTING_GROUPS } from './screens/Settings';

const PAGES: { label: string; href: string; icon: IconName }[] = [
  { label: 'Accueil', href: '#/home', icon: 'home' },
  { label: 'Bibliothèque', href: '#/library', icon: 'grid' },
  { label: 'Téléchargements', href: '#/downloads', icon: 'download' },
  { label: 'Amis', href: '#/friends', icon: 'users' },
  { label: 'Mods', href: '#/mods', icon: 'layers' },
  { label: 'Bilans de parties', href: '#/reports', icon: 'history' },
  { label: 'Diagnostic du PC', href: '#/diagnostic', icon: 'pulse' },
  { label: 'Journal des corrections', href: '#/journal', icon: 'history' },
  { label: 'Coach, l\'assistant', href: '#/assistant', icon: 'chat' },
  { label: 'Réglages', href: '#/settings', icon: 'gear' },
  { label: 'Profil', href: '#/profile', icon: 'user' }
];

interface Result {
  key: string;
  group: string;
  label: string;
  detail: string;
  href: string;
  icon?: IconName;
  image?: string;
  game?: Game;
}

// Comparaison sans accents ni majuscules.
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recherche de la barre du haut : jeux, succès, réglages, pages et guides, proposés pendant la frappe.
export function GlobalSearch() {
  const { data, play, installed, install } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = fold(query.trim());
    if (!q) return [];
    const has = (text: string) => fold(text).includes(q);
    const games = data.games
      .filter((g) => has(g.title) || has(g.genre) || has(g.developer))
      .sort((a, b) => Number(fold(b.title).startsWith(q)) - Number(fold(a.title).startsWith(q)) || a.recentRank - b.recentRank)
      .slice(0, 5)
      .map((g): Result => ({ key: `game-${g.id}`, group: 'Jeux', label: g.title, detail: installed.has(g.id) ? g.genre : `${g.genre} · non installé`, href: `#/game/${g.id}`, game: g }));
    const achievements = q.length < 3 || !data.demo ? [] : data.games
      .flatMap((g) => g.achievements.list.filter((a) => !(a.hidden && !a.when) && has(a.name)).map((a): Result => ({ key: `ach-${g.id}-${a.name}`, group: 'Succès', label: a.name, detail: `${g.title} · ${a.when ? 'obtenu' : 'pas encore obtenu'}`, href: `#/game/${g.id}?tab=succes`, image: a.icon })))
      .slice(0, 4);
    const settings = SETTING_GROUPS.flatMap((group) => group.rows.filter((row) => has(row.label) || has(row.text)).map((row): Result => ({ key: `set-${row.key}`, group: 'Réglages', label: row.label, detail: group.title, href: '#/settings', icon: 'gear' }))).slice(0, 3);
    const pages = PAGES.filter((p) => (data.demo || !['#/downloads', '#/friends', '#/mods'].includes(p.href)) && has(p.label)).map((p): Result => ({ key: `page-${p.href}`, group: 'Pages', label: p.label, detail: 'Ouvrir la page', href: p.href, icon: p.icon })).slice(0, 3);
    const guides = data.guides.filter((g) => has(g.title)).map((g): Result => ({ key: `guide-${g.id}`, group: 'Guides', label: g.title, detail: `${g.duration} · ${g.level}`, href: `#/guide/${g.id}`, icon: 'check' }));
    return [...games, ...achievements, ...settings, ...pages, ...guides];
  }, [query, data, installed]);

  useEffect(() => setIndex(0), [query]);

  // Ctrl + K (ou Cmd + K) place le curseur dans la recherche.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onHash = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    window.location.hash = href;
  };
  const start = (game: Game) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    if (installed.has(game.id)) play(game);
    else install(game);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (results.length) setIndex((i) => (i + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const current = results[index];
      if (!current) return go(`#/library?q=${encodeURIComponent(query.trim())}`);
      if (current.game && (event.ctrlKey || event.metaKey)) return start(current.game);
      go(current.href);
    }
  };

  const shown = open && query.trim().length > 0;
  let lastGroup = '';

  return (
    <div className="search" ref={boxRef}>
      <div className="field top-search">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={shown}
          aria-controls="search-results"
          aria-activedescendant={shown && results[index] ? `search-${index}` : undefined}
          aria-label="Rechercher un jeu, un succès, un réglage"
          placeholder="Rechercher un jeu, un succès, un réglage"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="kbd">Ctrl K</kbd>
        <Icon name="search" size={15} />
      </div>
      {shown && (
        <div className="search-panel" id="search-results" role="listbox" aria-label="Résultats">
          {results.length === 0 && <p className="muted search-empty">Aucun résultat pour « {query.trim()} ». Entrée pour chercher dans la bibliothèque.</p>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {head && <div className="eyebrow search-group">{head}</div>}
                <div id={`search-${i}`} role="option" aria-selected={i === index} className={`search-row${i === index ? ' on' : ''}`} onMouseEnter={() => setIndex(i)}>
                  <a href={r.href} className="search-main" tabIndex={-1} onClick={(e) => { e.preventDefault(); go(r.href); }}>
                    <span className="search-thumb">
                      {r.game ? <GameArt game={r.game} kind="cover" className="fill" /> : r.image ? <img className="fill" src={r.image} alt="" /> : <Icon name={r.icon ?? 'search'} size={16} />}
                    </span>
                    <span className="search-text">
                      <span className="strong">{r.label}</span>
                      <span className="small muted">{r.detail}</span>
                    </span>
                  </a>
                  {r.game && (
                    <button type="button" className="btn search-play" tabIndex={-1} onClick={() => start(r.game!)}>
                      <Icon name={installed.has(r.game.id) ? 'play' : 'download'} size={13} filled={installed.has(r.game.id)} stroke={2.2} />
                      {installed.has(r.game.id) ? 'Jouer' : 'Installer'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="search-foot small muted">
            <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> choisir</span>
            <span><kbd className="kbd">Entrée</kbd> ouvrir</span>
            <span><kbd className="kbd">Ctrl</kbd> <kbd className="kbd">Entrée</kbd> lancer le jeu</span>
            <span><kbd className="kbd">Échap</kbd> fermer</span>
          </div>
        </div>
      )}
    </div>
  );
}
