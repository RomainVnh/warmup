import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Game, Source } from '../../shared/types';
import { useApp } from '../context';
import { GameArt, GameCard, Icon, Segmented, StatusText, hoursLabel, sourceLabel } from '../ui';

type SourceFilter = 'all' | Source;
type StateFilter = 'all' | 'ok' | 'warn' | 'favorites' | 'absent';
type Sort = 'recent' | 'name' | 'hours' | 'size';
type View = 'grid' | 'list';

const SOURCES: Source[] = ['Steam', 'Epic', 'GOG', 'Battle.net', 'Rockstar', 'Riot', 'Manuel'];

const sorters: Record<Sort, (a: Game, b: Game) => number> = {
  recent: (a, b) => a.recentRank - b.recentRank,
  name: (a, b) => a.title.localeCompare(b.title, 'fr'),
  hours: (a, b) => b.hours - a.hours,
  size: (a, b) => b.sizeGb - a.sizeGb
};

export function Library({ initialQuery }: { initialQuery: string }) {
  const { data, favorites, notify, installed, collections, saveCollections } = useApp();
  const [collectionId, setCollectionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const collection = collections.find((c) => c.id === collectionId);
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<SourceFilter>('all');
  const [state, setState] = useState<StateFilter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<View>('grid');

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.games
      .filter((g) => !q || g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q))
      .filter((g) => source === 'all' || g.source === source)
      .filter((g) => !collection || collection.gameIds.includes(g.id))
      .filter((g) => state === 'all' || (state === 'favorites' ? favorites.has(g.id) : state === 'absent' ? !installed.has(g.id) : installed.has(g.id) && g.status === state))
      .sort(sorters[sort]);
  }, [data.games, query, source, state, sort, favorites, installed, collection]);

  const totalGb = data.games.reduce((sum, g) => sum + g.sizeGb, 0);
  const warnCount = data.games.filter((g) => g.status === 'warn').length;
  const absentCount = data.games.filter((g) => !installed.has(g.id)).length;

  // Nombre de filtres qui ne sont pas sur leur valeur par défaut, affiché sur le bouton.
  const activeFilters = Number(Boolean(collectionId)) + Number(source !== 'all') + Number(state !== 'all') + Number(sort !== 'recent');
  const resetFilters = () => {
    setCollectionId('');
    setSource('all');
    setState('all');
    setSort('recent');
  };
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  const createCollection = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    // L'identifiant est tiré du nom : minuscules, sans accent, tirets.
    const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection';
    let id = base;
    for (let n = 2; collections.some((c) => c.id === id); n += 1) id = `${base}-${n}`;
    saveCollections([...collections, { id, name, gameIds: [] }]);
    setCollectionId(id);
    setNewName('');
    setCreating(false);
  };
  const deleteCollection = () => {
    if (!collection) return;
    saveCollections(collections.filter((c) => c.id !== collection.id));
    setCollectionId('');
    notify(`Collection « ${collection.name} » supprimée. Les jeux restent dans la bibliothèque.`);
  };

  const sources = SOURCES.filter((s) => data.games.some((g) => g.source === s));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Bibliothèque</h1>
          <p className="sub">
            {data.games.length} jeux, dont {data.games.length - absentCount} installés ({totalGb} Go au total). {warnCount === 0 ? 'Tous sont prêts.' : `${warnCount} demande${warnCount > 1 ? 'nt' : ''} votre attention.`}
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={collections.length >= 12} onClick={() => setCreating(true)}><Icon name="folder" size={14} />Nouvelle collection</button>
          <button type="button" className="btn" onClick={() => notify('Analyse des dossiers terminée : aucun nouveau jeu trouvé.')}>Relancer l'analyse</button>
          <button type="button" className="btn btn-primary" onClick={() => notify('L\'ajout d\'un jeu à la main arrivera avec la version Windows.')}>Ajouter un jeu</button>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 24 }}>
        <label className="field">
          <Icon name="search" size={14} />
          <input type="search" aria-label="Filtrer la bibliothèque" placeholder="Nom ou genre" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="menu" ref={filtersRef}>
          <button type="button" className="btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
            <Icon name="sliders" size={15} />
            Filtres avancés{activeFilters ? ` · ${activeFilters}` : ''}
          </button>
          {filtersOpen && (
            <div className="menu-panel filters-panel" role="group" aria-label="Filtres avancés">
              <label>
                <span className="eyebrow">Collection</span>
                <select className="select" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                  <option value="">Toutes les collections</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.gameIds.length}</option>)}
                </select>
              </label>
              <label>
                <span className="eyebrow">Plateforme</span>
                <select className="select" value={source} onChange={(e) => setSource(e.target.value as SourceFilter)}>
                  <option value="all">Toutes les plateformes</option>
                  {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)} · {data.games.filter((g) => g.source === s).length}</option>)}
                </select>
              </label>
              <label>
                <span className="eyebrow">État</span>
                <select className="select" value={state} onChange={(e) => setState(e.target.value as StateFilter)}>
                  <option value="all">Tous les états</option>
                  <option value="ok">Prêts</option>
                  <option value="warn">À corriger</option>
                  <option value="favorites">Favoris</option>
                  <option value="absent">Non installés</option>
                </select>
              </label>
              <label>
                <span className="eyebrow">Trier par</span>
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recent">Joué récemment</option>
                  <option value="name">Nom</option>
                  <option value="hours">Temps de jeu</option>
                  <option value="size">Place sur le disque</option>
                </select>
              </label>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn" disabled={!activeFilters} onClick={resetFilters}>Réinitialiser</button>
                <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Voir {games.length} jeu{games.length > 1 ? 'x' : ''}</button>
              </div>
            </div>
          )}
        </div>
        <span className="push">
          <Segmented<View> label="Affichage" value={view} onChange={setView} options={[{ value: 'grid', label: 'Jaquettes' }, { value: 'list', label: 'Liste' }]} />
        </span>
      </div>

      {(creating || collection) && (
        <div className="toolbar" style={{ marginBottom: 24 }}>
          {creating ? (
            <form className="row" onSubmit={createCollection}>
              <span className="field" style={{ width: 240 }}><input type="text" autoFocus maxLength={28} aria-label="Nom de la nouvelle collection" placeholder="Nom de la collection" value={newName} onChange={(e) => setNewName(e.target.value)} /></span>
              <button type="submit" className="btn btn-primary">Créer</button>
              <button type="button" className="btn" onClick={() => setCreating(false)}>Annuler</button>
            </form>
          ) : collection && (
            <>
              <span className="muted">Collection « {collection.name} » · {games.length} jeu{games.length > 1 ? 'x' : ''}</span>
              <button type="button" className="btn push" onClick={deleteCollection}>Supprimer cette collection</button>
            </>
          )}
        </div>
      )}

      {games.length === 0 ? (
        <div className="card">
          <p className="strong">{collection && collection.gameIds.length === 0 ? `La collection « ${collection.name} » est vide.` : 'Aucun jeu ne correspond à ces filtres.'}</p>
          <p className="muted">{collection && collection.gameIds.length === 0 ? 'Ouvrez la fiche d\'un jeu et utilisez le bouton « Collections » pour l\'y ranger.' : 'Essayez un autre nom, ou remettez la plateforme et l\'état sur « Tous ».'}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="cover-grid">
          {games.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      ) : (
        <div>
          {games.map((g) => (
            <a key={g.id} className="game-row" href={`#/game/${g.id}`}>
              <span className="thumb"><GameArt game={g} kind="cover" lazy /></span>
              <span className="grow">
                <span className="strong">{g.title}</span>
                <span className="small muted" style={{ display: 'block' }}>{g.genre}</span>
              </span>
              <span className="small muted" style={{ width: 100 }}>{sourceLabel(g.source)}</span>
              <span className="small muted" style={{ width: 110 }}>{hoursLabel(g.hours)}</span>
              <span className="small muted" style={{ width: 60 }}>{g.sizeGb} Go</span>
              <span style={{ width: 170 }}>{installed.has(g.id) ? <StatusText status={g.status}>{g.statusLabel}</StatusText> : <span className="small muted">Non installé</span>}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
