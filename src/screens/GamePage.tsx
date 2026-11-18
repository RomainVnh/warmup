import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Game } from '../../shared/types';
import { api } from '../api';
import { findGame, useApp } from '../context';
import { GameSettings } from '../GameSettings';
import { GameArt, GameLogo, Icon, PlayButton, Ring, Segmented, Stat, StatusText, sourceLabel } from '../ui';

const shot = (game: Game, index: number) => (game.screenshots.length ? game.screenshots[index % game.screenshots.length] : game.art);

/** Image d'une actualité ; si elle ne répond pas, une capture du jeu, puis sa bannière, puis rien. */
function NewsImage({ game, src, index }: { game: Game; src: string; index: number }) {
  const choices = [src, shot(game, index), game.art].filter((url, i, list) => url && list.indexOf(url) === i);
  const [current, setCurrent] = useState(0);
  if (current >= choices.length) return <div className="art-fallback">{game.title}</div>;
  return <img src={choices[current]} alt="" loading="lazy" onError={() => setCurrent((n) => n + 1)} />;
}

const TABS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'sante', label: 'Santé' },
  { id: 'reglages', label: 'Réglages conseillés' },
  { id: 'succes', label: 'Succès' },
  { id: 'amis', label: 'Amis' },
  { id: 'actus', label: 'Actualités' },
  { id: 'avis', label: 'Avis' }
] as const;
type TabId = (typeof TABS)[number]['id'];

const CHANGE_TAGS = ['Cause probable', 'À surveiller', 'Sans risque'];

export function GamePage({ id, initialTab }: { id: string; initialTab: string }) {
  const { data, play, favorites, toggleFavorite, installed } = useApp();
  const game = findGame(data, id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'apercu');

  if (!game) {
    return (
      <div className="page">
        <h1 className="title">Jeu introuvable</h1>
        <p className="sub">Ce jeu n'est plus dans votre bibliothèque.</p>
        <a className="btn" style={{ marginTop: 20 }} href="#/library">Retour à la bibliothèque</a>
      </div>
    );
  }

  const favorite = favorites.has(game.id);
  const warn = game.status === 'warn';

  // Version vierge : rien d'inventé. Les succès obtenus, les amis, les avis et les réglages conseillés
  // viendront avec les connexions aux plateformes ; leurs onglets ne s'affichent pas d'ici là.
  const proven = data.demo || game.achievements.done > 0; // succès obtenus connus : exemple, ou confirmés par Steam
  const tabs = data.demo ? TABS : TABS.filter((t) => t.id === 'apercu' || t.id === 'sante' || (t.id === 'succes' && proven) || (t.id === 'actus' && game.news.length > 0));
  const { done } = game.achievements;
  const total = proven ? game.achievements.total : 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const warnChecks = game.checks.filter((c) => c.status === 'warn').length;

  return (
    <>
      <section className="hero compact">
        <GameArt game={game} kind="art" className="hero-img" />
        <div className="hero-shade" />
        <div className="hero-top">
          <a className="back" href="#/library"><Icon name="back" size={14} stroke={2} />Bibliothèque</a>
        </div>
        <div className="hero-body">
          <GameLogo game={game} as="h1" />
        </div>
      </section>

      <div className="playbar">
        <PlayButton game={game} onPlay={play} />
        <dl className="facts">
          <div>
            <dt>État</dt>
            <dd>{installed.has(game.id) ? <StatusText status={game.status}>{warn ? game.statusLabel : `Prêt · ${game.checks.length} points vérifiés`}</StatusText> : `Non installé · ${game.sizeGb} Go à télécharger`}</dd>
          </div>
          <div><dt>Dernière partie</dt><dd>{game.lastPlayed}</dd></div>
          <div><dt>Temps de jeu</dt><dd>{game.hours ? `${game.hours} h` : 'Jamais joué'}</dd></div>
          {total > 0 && (
            <div>
              <dt>Succès</dt>
              <dd>
                {done} sur {total}
                <div className="meter" role="img" aria-label={`${percent} % des succès obtenus`}><i style={{ width: `${percent}%` }} /></div>
              </dd>
            </div>
          )}
        </dl>
        <div className="row push">
          <CollectionMenu game={game} />
          <button type="button" className="btn btn-icon" aria-pressed={favorite} aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => toggleFavorite(game.id)}>
            <Icon name="star" filled={favorite} />
          </button>
          <button type="button" className="btn btn-icon" aria-label={`Paramètres de ${game.title} : lancement, fichiers, désinstallation`} title="Paramètres du jeu" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
            <Icon name="gear" />
          </button>
        </div>
      </div>
      {settingsOpen && <GameSettings game={game} onClose={() => setSettingsOpen(false)} />}

      <div className="tabs" role="tablist" aria-label="Sections de la fiche">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'sante' && warnChecks > 0 && <span className="count">{warnChecks}</span>}
          </button>
        ))}
      </div>

      <div className="page" style={{ paddingTop: 40 }} role="tabpanel">
        {tab === 'apercu' && <Overview game={game} onTab={setTab} />}
        {tab === 'sante' && <Health game={game} />}
        {tab === 'reglages' && <Graphics game={game} />}
        {tab === 'succes' && <Achievements game={game} />}
        {tab === 'amis' && <Friends game={game} />}
        {tab === 'actus' && <News game={game} />}
        {tab === 'avis' && <Reviews game={game} />}
      </div>
    </>
  );
}

// Menu « Collections » : ranger le jeu dans une ou plusieurs collections, ou en créer une.
function CollectionMenu({ game }: { game: Game }) {
  const { collections, saveCollections } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const count = collections.filter((c) => c.gameIds.includes(game.id)).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (id: string) =>
    saveCollections(collections.map((c) => (c.id !== id ? c : { ...c, gameIds: c.gameIds.includes(game.id) ? c.gameIds.filter((g) => g !== game.id) : [...c.gameIds, game.id] })));
  const create = (event: FormEvent) => {
    event.preventDefault();
    const label = name.trim();
    if (!label || collections.length >= 12) return;
    const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection';
    let id = base;
    for (let n = 2; collections.some((c) => c.id === id); n += 1) id = `${base}-${n}`;
    saveCollections([...collections, { id, name: label, gameIds: [game.id] }]);
    setName('');
  };

  return (
    <div className="menu" ref={boxRef}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="folder" size={15} />
        Collections{count ? ` · ${count}` : ''}
      </button>
      {open && (
        <div className="menu-panel" role="group" aria-label={`Collections de ${game.title}`}>
          {collections.length === 0 && <p className="small muted" style={{ padding: '6px 4px 10px' }}>Aucune collection pour l'instant.</p>}
          {collections.map((c) => {
            const inside = c.gameIds.includes(game.id);
            return (
              <button key={c.id} type="button" role="menuitemcheckbox" aria-checked={inside} className="menu-item" onClick={() => toggle(c.id)}>
                <span className={`check${inside ? ' on' : ''}`}>{inside && <Icon name="check" size={12} stroke={3} />}</span>
                <span className="grow">{c.name}</span>
                <span className="small muted">{c.gameIds.length}</span>
              </button>
            );
          })}
          <form className="menu-form" onSubmit={create}>
            <span className="field"><input type="text" maxLength={28} aria-label="Nom d'une nouvelle collection" placeholder="Nouvelle collection" value={name} onChange={(e) => setName(e.target.value)} /></span>
            <button type="submit" className="btn btn-icon" aria-label="Créer la collection et y ranger ce jeu" disabled={!name.trim()}><Icon name="plus" size={14} /></button>
          </form>
        </div>
      )}
    </div>
  );
}

// Réglages graphiques conseillés pour ce PC, avec le nombre d'images par seconde attendu.
function Graphics({ game }: { game: Game }) {
  const { data, notify } = useApp();
  const g = game.graphics;
  const target = 144;
  const pc = data.profile.pc;
  return (
    <div className="game-layout">
      <div className="flow">
        <section className="ach-head" style={{ marginBottom: 0 }}>
          <Ring value={Math.min(1, g.fps / target)} tone="plain" label={`${g.fps} images par seconde attendues`}>
            <strong>{g.fps}</strong>
            <span>images/s</span>
          </Ring>
          <div className="stats">
            <Stat value={g.preset} label="Niveau conseillé" />
            <Stat value={g.low} unit="images/s" label="Dans les passages les plus lourds" />
            <Stat value={g.fps >= target ? 'Atteints' : `${Math.round((g.fps / target) * 100)} %`} label="Des 144 Hz de votre écran" />
          </div>
        </section>
        <p className="lead">{g.note}</p>
        <section>
          <div className="block-head" style={{ alignItems: 'center' }}>
            <h2 className="h2">Réglage par réglage</h2>
            <button type="button" className="btn btn-primary" onClick={() => notify('L\'application des réglages arrivera avec la version Windows. Les valeurs d\'origine seront gardées pour pouvoir revenir en arrière.')}>Appliquer ces réglages</button>
          </div>
          {g.rows.map((row) => (
            <div key={row.name} className="list-row" style={{ gap: 24, alignItems: 'flex-start' }}>
              <span className="muted" style={{ width: 170 }}>{row.name}</span>
              <span className="strong" style={{ width: 220 }}>{row.value}</span>
              <span className="grow muted">{row.why}</span>
            </div>
          ))}
        </section>
      </div>
      <aside className="aside">
        <section>
          <h2 className="h2">Calculé pour ce PC</h2>
          <dl className="dl">
            {pc.map((p) => (
              <div key={p.label} style={{ display: 'contents' }}><dt>{p.label}</dt><dd>{p.value}</dd></div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="h2">Affichage</h2>
          <dl className="dl">
            <dt>Résolution</dt><dd>{g.resolution}</dd>
            <dt>Mise à l'échelle</dt><dd>{g.upscaling}</dd>
          </dl>
        </section>
        <section>
          <h2 className="h2">D'où viennent ces chiffres</h2>
          <p className="muted">Ils sont estimés à partir de PC proches du vôtre. Le bilan de vos parties indique ensuite le nombre d'images réellement obtenu.</p>
          <a className="btn" style={{ marginTop: 14 }} href={`#/reports?game=${game.id}`}>Voir les bilans</a>
        </section>
      </aside>
    </div>
  );
}

function Gallery({ game }: { game: Game }) {
  const [current, setCurrent] = useState(0);
  if (!game.screenshots.length) return null;
  return (
    <section aria-label="Images du jeu">
      <img className="gallery-main" src={game.screenshots[current]} alt={`${game.title}, image ${current + 1}`} />
      {game.screenshots.length > 1 && (
        <div className="gallery-thumbs">
          {game.screenshots.map((src, i) => (
            <button key={src} type="button" aria-pressed={i === current} aria-label={`Afficher l'image ${i + 1}`} onClick={() => setCurrent(i)}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const percentLabel = (rarity: number) => `${rarity.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

function Ach({ a }: { a: Game['achievements']['list'][number] }) {
  const secret = a.hidden && !a.when;
  return (
    <div className={`ach${a.when ? '' : ' locked'}`}>
      {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : <span className="ach-blank" />}
      <div className="ach-body">
        <div className="ach-name">{a.name}</div>
        <div className="small muted">{secret ? 'Succès caché : la description apparaît une fois obtenu.' : a.text || 'Sans description.'}</div>
        <div className="small" style={{ marginTop: 2, color: a.when ? 'var(--text-2)' : 'var(--muted)' }}>{a.when ? `Obtenu ${a.when.toLowerCase()}` : 'Pas encore obtenu'}</div>
      </div>
      <div className="ach-rarity">
        <div className="small strong">{percentLabel(a.rarity)}</div>
        <div className="meter" role="img" aria-label={`Obtenu par ${percentLabel(a.rarity)} des joueurs`}><i style={{ width: `${Math.max(2, a.rarity)}%` }} /></div>
      </div>
    </div>
  );
}

function Overview({ game, onTab }: { game: Game; onTab(tab: TabId): void }) {
  const { notify, data } = useApp();
  const online = game.friends.filter((f) => f.online).length;
  const { done, list } = game.achievements;
  const total = data.demo || done > 0 ? game.achievements.total : 0;
  const meta = [game.genre, game.developer, game.year || '', data.demo || game.developer ? (game.multiplayer ? 'Multijoueur' : 'Solo') : ''].filter(Boolean).join(' · ');
  const openFolder = () => void api.openGameFolder(game.id).then((result) => notify(result.message)).catch(() => notify('Le dossier n\'a pas pu être ouvert.'));
  return (
    <div className="game-layout">
      <div className="flow">
        <section>
          {game.summary
            ? <p className="lead">{game.summary}</p>
            : <p className="lead muted">{game.manual ? 'Jeu ajouté à la main. Warmup le lance, suit vos parties et vérifie le PC avant chaque lancement.' : 'Warmup a trouvé ce jeu sur votre PC. Il le lance, suit vos parties et vérifie le PC avant chaque lancement.'}</p>}
          {game.summary && <p className="meta-line">{meta}</p>}
        </section>

        <Gallery game={game} />

        {game.news.length > 0 && (
          <section>
            <div className="block-head">
              <h2 className="h2">Actualités</h2>
              <button type="button" className="link" onClick={() => onTab('actus')}>Toutes les actualités</button>
            </div>
            {game.news.slice(0, 2).map((n, i) => (
              <article key={n.title} className="media">
                <NewsImage game={game} src={n.image} index={i + 1} />
                <div>
                  <div className="small muted">{n.tag} · {n.date}</div>
                  <h3>{n.title}</h3>
                  <p className="muted">{n.text}</p>
                </div>
              </article>
            ))}
          </section>
        )}

        {total > 0 && (
          <section>
            <div className="block-head">
              <h2 className="h2">Succès · {done} sur {total}</h2>
              <button type="button" className="link" onClick={() => onTab('succes')}>Tous les succès</button>
            </div>
            <div>
              {[...list.filter((a) => a.when).slice(-3).reverse(), ...list.filter((a) => !a.when).slice(0, 1)].map((a) => <Ach key={a.name} a={a} />)}
            </div>
          </section>
        )}

        <section>
          <div className="block-head">
            <h2 className="h2">Dernières parties</h2>
            <a className="link" href={`#/reports?game=${game.id}`}>Tous les bilans de ce jeu</a>
          </div>
          {game.sessions.length === 0 && <p className="muted">Aucune partie pour l'instant.</p>}
          {game.sessions.map((s, i) => (
            <a key={s.date + i} className="list-row" href={`#/report/${game.id}-${i + 1}`}>
              <span className="muted" style={{ width: 150 }}>{s.date}</span>
              <span className="strong" style={{ width: 70 }}>{s.length}</span>
              <span className="grow"><StatusText status={s.ok ? 'ok' : 'warn'}>{s.result}</StatusText></span>
              <span className="link">Lire le bilan</span>
            </a>
          ))}
        </section>
      </div>

      <aside className="aside">
        <section>
          <h2 className="h2">Informations</h2>
          <dl className="dl">
            <dt>Plateforme</dt><dd>{game.source === 'Manuel' ? 'Aucune, jeu ajouté à la main' : `${sourceLabel(game.source)}, ouvert en arrière-plan par Warmup`}</dd>
            {game.version && (<><dt>Version</dt><dd>{game.version}</dd></>)}
            <dt>Place sur le disque</dt><dd>{game.sizeGb ? `${game.sizeGb} Go` : 'Inconnue'}</dd>
            <dt>Emplacement</dt><dd style={{ overflowWrap: 'anywhere' }}>{game.location}</dd>
            {data.demo && (<><dt>Sauvegardes</dt><dd>{game.source === 'Manuel' ? 'Copie locale seulement' : `Synchronisées avec ${sourceLabel(game.source)}`}</dd></>)}
            {game.region && (<><dt>Serveurs</dt><dd>{game.region}</dd></>)}
          </dl>
          <div className="row" style={{ marginTop: 18 }}>
            <button type="button" className="btn" onClick={openFolder}>Ouvrir le dossier</button>
          </div>
        </section>
        {data.demo && game.multiplayer && (
          <section>
            <h2 className="h2">Amis</h2>
            {game.friends.length === 0 && <p className="muted">Aucun ami trouvé sur ce jeu pour l'instant.</p>}
            {game.friends.length > 0 && <p className="small muted" style={{ marginBottom: 6 }}>{online} en ligne sur {game.friends.length}</p>}
            {game.friends.slice(0, 4).map((f) => (
              <div key={f.name + f.platform} className="person">
                <span className={`avatar${f.online ? ' on' : ''}`} aria-hidden="true">{f.name[0]}</span>
                <div>
                  <div className="strong">{f.name}</div>
                  <div className="small muted">{f.state}</div>
                </div>
              </div>
            ))}
            {game.friends.length > 0 && <button type="button" className="link" onClick={() => onTab('amis')}>Tous les amis</button>}
          </section>
        )}
        {game.modCount > 0 && (
          <section>
            <h2 className="h2">Mods</h2>
            <p className="muted">{game.modCount} mods actifs. Leur état est enregistré à chaque partie et peut être restauré.</p>
            <a className="btn" style={{ marginTop: 14 }} href={`#/mods/${game.id}`}>Gérer les mods</a>
          </section>
        )}
        {data.demo && <section>
          <h2 className="h2">Un souci ?</h2>
          <p className="muted">Coach, l'assistant de Warmup, connaît l'état de ce jeu et de votre PC.</p>
          <a className="btn" style={{ marginTop: 14 }} href="#/assistant">Demander à Coach</a>
        </section>}
      </aside>
    </div>
  );
}

function Health({ game }: { game: Game }) {
  const { play, data } = useApp();
  return (
    <div className="flow narrow">
      <section>
        <h2 className="h2">Ce qui a changé depuis la dernière partie réussie</h2>
        <p className="muted" style={{ margin: '6px 0 14px' }}>Du plus suspect au moins suspect. C'est ici que se trouve presque toujours la cause d'un problème.</p>
        {game.changes.length === 0 && (data.demo || data.reports.some((r) => r.gameId === game.id && r.ok)
          ? <p className="strong">Rien n'a changé : le jeu est dans l'état exact où il tournait bien.</p>
          : <p className="strong">Warmup prendra une photo du PC à votre première partie réussie : pilote, Windows, écran, version du jeu. Elle servira de référence si un jour le jeu se met à mal tourner.</p>)}
        {game.changes.map((c) => (
          <div key={c.title} className="list-row">
            <span className={`small strong ${c.level === 0 ? 'status-warn' : 'muted'}`} style={{ width: 120 }}>{CHANGE_TAGS[c.level]}</span>
            <div className="grow">
              <div className="strong">{c.title}</div>
              <div className="small muted">{c.text}</div>
            </div>
            <span className="small muted">{c.when}</span>
          </div>
        ))}
      </section>
      <section>
        <div className="block-head">
          <h2 className="h2">Contrôle avant lancement</h2>
          <button type="button" className="btn" onClick={() => play(game)}>Refaire le contrôle et jouer</button>
        </div>
        {game.checks.map((c) => (
          <div key={c.name} className="list-row">
            <span className={`icon-box sm${c.status === 'ok' ? ' ok' : ''}`}><Icon name={c.status === 'ok' ? 'check' : 'warn'} size={14} stroke={2.6} /></span>
            <span className="strong" style={{ width: 190 }}>{c.name}</span>
            <span className="grow muted">{c.value}</span>
            <StatusText status={c.status}>{c.status === 'ok' ? 'Bon' : data.demo ? 'À corriger' : 'À surveiller'}</StatusText>
          </div>
        ))}
      </section>
    </div>
  );
}

type AchFilter = 'all' | 'done' | 'todo';

function Achievements({ game }: { game: Game }) {
  const { done, total, list } = game.achievements;
  const [filter, setFilter] = useState<AchFilter>('all');
  if (!total) return <p className="muted">Aucun succès n'est disponible pour ce jeu : il ne passe pas par Steam.</p>;
  const percent = Math.round((done / total) * 100);
  const obtained = list.filter((a) => a.when);
  const rarest = obtained[obtained.length - 1];
  const next = list.find((a) => !a.when);
  const shown = filter === 'all' ? list : filter === 'done' ? obtained : list.filter((a) => !a.when);
  return (
    <section>
      <div className="ach-head">
        <Ring value={done / total} tone="plain" label={`${percent} % des succès obtenus`}>
          <strong>{percent} %</strong>
          <span>obtenus</span>
        </Ring>
        <div className="stats">
          <Stat value={done} unit={`sur ${total}`} label="Succès obtenus" />
          <Stat value={total - done} label="Restent à obtenir" />
          {rarest && <Stat value={percentLabel(rarest.rarity)} label={`Votre plus rare : ${rarest.name}`} />}
          {next && <Stat value={percentLabel(next.rarity)} label={`Le plus accessible : ${next.name}`} />}
        </div>
      </div>
      <div className="block-head">
        <Segmented<AchFilter>
          label="Filtrer les succès"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Tous · ${total}` },
            { value: 'done', label: `Obtenus · ${done}` },
            { value: 'todo', label: `À obtenir · ${total - done}` }
          ]}
        />
        <span className="small muted">Classés du plus courant au plus rare. Le pourcentage indique la part des joueurs qui l'ont obtenu.</span>
      </div>
      <div className="ach-grid">
        {shown.map((a) => <Ach key={a.name + a.icon} a={a} />)}
      </div>
    </section>
  );
}

function Friends({ game }: { game: Game }) {
  if (!game.multiplayer) return <p className="muted">Ce jeu se joue en solo : il n'y a pas d'amis à afficher.</p>;
  if (!game.friends.length) return <p className="muted">Aucun de vos amis ne joue à ce jeu pour l'instant.</p>;
  return (
    <section className="flow narrow" style={{ gap: 0 }}>
      <h2 className="h2">Avec qui vous jouez</h2>
      <p className="muted" style={{ margin: '6px 0 12px' }}>Vos amis sur ce jeu, toutes plateformes confondues.</p>
      {game.friends.map((f) => (
        <div key={f.name + f.platform} className="list-row">
          <span className={`avatar${f.online ? ' on' : ''}`} aria-hidden="true">{f.name[0]}</span>
          <div className="grow">
            <div className="strong">{f.name}</div>
            <div className="small muted">{f.state}</div>
          </div>
          <span className="small muted">{f.platform}</span>
        </div>
      ))}
    </section>
  );
}

function News({ game }: { game: Game }) {
  if (!game.news.length) return <p className="muted">Aucune actualité pour ce jeu.</p>;
  return (
    <div>
      {game.news.map((n, i) => (
        <article key={n.title} className={`media${i === 0 ? ' big' : ''}`}>
          <NewsImage game={game} src={n.image} index={i + 1} />
          <div>
            <div className="small muted">{n.tag} · {n.date}</div>
            <h3>{n.title}</h3>
            <p style={{ color: 'var(--text-2)' }}>{n.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function Reviews({ game }: { game: Game }) {
  const { percent, count, label, list } = game.reviews;
  if (!count) return <p className="muted">Aucun avis disponible : ce jeu n'est relié à aucune plateforme qui en publie.</p>;
  return (
    <div className="game-layout">
      <section>
        <h2 className="h2" style={{ marginBottom: 20 }}>Avis récents</h2>
        {list.map((r) => (
          <div key={r.author} className="review">
            <div className="row">
              <span className="avatar sm" aria-hidden="true">{r.author[0]}</span>
              <span className="strong">{r.author}</span>
              <span className="small muted">{r.hours} h de jeu</span>
              <span className="small strong row" style={{ gap: 6, marginLeft: 'auto', color: r.positive ? 'var(--text)' : 'var(--muted)' }}>
                <Icon name={r.positive ? 'thumbUp' : 'thumbDown'} size={13} stroke={2} />
                {r.positive ? 'Recommande' : 'Ne recommande pas'}
              </span>
            </div>
            <p className="lead" style={{ fontSize: 14, marginTop: 10 }}>{r.text}</p>
          </div>
        ))}
      </section>
      <aside className="aside">
        <section>
          <div className="score">{percent} %</div>
          <div className="strong" style={{ marginTop: 8 }}>{label}</div>
          <p className="muted">{count.toLocaleString('fr-FR')} avis de joueurs.</p>
          <div className="meter" style={{ marginTop: 16 }} role="img" aria-label={`${percent} % d'avis positifs`}><i style={{ width: `${percent}%` }} /></div>
        </section>
      </aside>
    </div>
  );
}
