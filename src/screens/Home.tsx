import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context';
import { GameArt, GameCard, GameLogo, Pill, PlayButton, Segmented, sourceLabel } from '../ui';

type Shelf = 'recent' | 'favorites' | 'check';
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function Home() {
  const { data, play, favorites, installed: onDisk } = useApp();
  const [shelf, setShelf] = useState<Shelf>('recent');

  const installed = useMemo(() => data.games.filter((g) => onDisk.has(g.id)).sort((a, b) => a.recentRank - b.recentRank), [data.games, onDisk]);
  const featured = installed[0];
  const toCheck = installed.filter((g) => g.status === 'warn');
  const favs = installed.filter((g) => favorites.has(g.id));
  const shown = shelf === 'recent' ? installed.slice(1) : shelf === 'favorites' ? favs : toCheck;
  // L'accueil montre deux rangées au plus : le nombre de colonnes dépend de la largeur disponible.
  const shelfRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);
  useEffect(() => {
    const node = shelfRef.current;
    if (!node) return;
    const measure = () => setColumns(Math.max(1, Math.floor((node.clientWidth + 16) / (168 + 16))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown.length > 0]);
  const visible = shown.slice(0, columns * 2);
  const hidden = shown.length - visible.length;
  const maxHours = Math.max(...data.week.hours);
  const lastReport = data.reports[0];
  const reportGame = data.games.find((g) => g.id === lastReport?.gameId);

  return (
    <>
      <section className="hero home-hero" aria-label="Jeu à reprendre">
        <GameArt game={featured} kind="featured" className="hero-img" />
        <div className="hero-shade" />
        <div className="hero-body">
          <div className="hero-text">
            <span className="kicker">Reprendre votre partie · joué {featured.lastPlayed.toLowerCase()}</span>
            <GameLogo game={featured} as="h1" />
            <Pill status={featured.status}>
              {featured.status === 'ok' ? `Prêt à lancer · ${featured.checks.length} points vérifiés` : featured.statusLabel}
            </Pill>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
              {featured.changes[0]
                ? `Un seul changement depuis votre dernière partie réussie : ${featured.changes[0].title.toLowerCase()}. ${featured.changes[0].text}`
                : 'Rien n\'a changé depuis votre dernière partie réussie.'}
            </p>
            <div className="row" style={{ gap: 12 }}>
              <PlayButton game={featured} onPlay={play} />
              <a className="btn btn-lg btn-glass" href={`#/game/${featured.id}`}>Fiche du jeu</a>
            </div>
          </div>
          <dl className="facts">
            <div>
              <dt>{featured.region ? 'Ping' : 'Sur le disque'}</dt>
              <dd>{featured.region ? '18 ms' : `${featured.sizeGb} Go`}</dd>
            </div>
            <div><dt>Écran</dt><dd>144 Hz actifs</dd></div>
            <div><dt>Dernière partie</dt><dd>{featured.sessions[0]?.length ?? 'Aucune'}</dd></div>
            <div><dt>Plateforme</dt><dd>{sourceLabel(featured.source)}</dd></div>
          </dl>
        </div>
      </section>

      <div className="page home-page">
        <section aria-label="Vos jeux">
          <div className="section-head">
            <h2 className="h2">Vos jeux</h2>
            <div className="row">
              <Segmented<Shelf>
                label="Filtrer les jeux"
                value={shelf}
                onChange={setShelf}
                options={[
                  { value: 'recent', label: 'Récents' },
                  { value: 'favorites', label: `Favoris · ${favs.length}` },
                  { value: 'check', label: `À corriger · ${toCheck.length}` }
                ]}
              />
              <a className="btn" href="#/library">Toute la bibliothèque</a>
            </div>
          </div>
          {shown.length ? (
            <>
              <div className="shelf" ref={shelfRef}>
                {visible.map((g) => <GameCard key={g.id} game={g} />)}
              </div>
              {hidden > 0 && (
                <div className="shelf-more">
                  <a className="btn" href="#/library">Voir les {hidden} autres jeux dans la bibliothèque</a>
                </div>
              )}
            </>
          ) : (
            <p className="card muted">Aucun jeu dans cette liste pour l'instant.</p>
          )}
        </section>

        <section className="section" aria-label="Votre semaine">
          <div className="section-head"><h2 className="h2">Votre semaine</h2><a className="link" href="#/reports">Tous les bilans</a></div>
          <div className="strip">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
              <div>
                <div className="tile-big">{data.week.total}</div>
                <div className="tile-label">Heures jouées</div>
              </div>
              <div className="bars" role="img" aria-label="Heures jouées par jour, du lundi au dimanche">
                {data.week.hours.map((h, i) => (
                  <div key={i}>
                    <i style={{ height: Math.max(4, Math.round((h / maxHours) * 46)) }} />
                    {DAYS[i]}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="tile-big">{data.week.cleanLaunches}</div>
              <div className="tile-label">Lancements sans incident</div>
            </div>
            <div>
              <div className="tile-big">{data.week.fixes}</div>
              <div className="tile-label">Problèmes corrigés avant de jouer</div>
            </div>
            {lastReport && (
              <a href={`#/report/${lastReport.id}`}>
                <div className="small muted">Dernier bilan · {reportGame?.title}</div>
                <div className="strong" style={{ marginTop: 4 }}>{lastReport.headline}.</div>
                <div className="small" style={{ marginTop: 8, textDecoration: 'underline' }}>Lire le bilan</div>
              </a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
