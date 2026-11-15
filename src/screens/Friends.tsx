import { useState } from 'react';
import type { FriendStatus, Game } from '../../shared/types';
import { findGame, useApp } from '../context';
import { GameArt, Icon, Segmented, Stat } from '../ui';

type Filter = 'all' | 'playing' | 'joinable';

const friendHref = (name: string) => `#/friends/${encodeURIComponent(name)}`;

export function Friends({ selected }: { selected: string }) {
  const { data, play, installed, install, notify, online: connected } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const online = data.friends.filter((f) => f.online);
  const offline = data.friends.filter((f) => !f.online);
  const playing = online.filter((f) => f.gameId);
  const joinable = online.filter((f) => f.joinable);
  const shown = filter === 'all' ? online : filter === 'playing' ? playing : joinable;
  const friend = data.friends.find((f) => f.name === selected) ?? online[0] ?? data.friends[0];

  const join = (target: FriendStatus) => {
    const game = target.gameId ? findGame(data, target.gameId) : undefined;
    if (!game) return;
    if (!installed.has(game.id)) {
      install(game);
      return;
    }
    notify(`Vous rejoindrez ${target.name} dès que ${game.title} sera lancé.`);
    play(game);
  };

  const row = (item: FriendStatus) => {
    const game = item.gameId ? findGame(data, item.gameId) : undefined;
    const current = friend?.name === item.name;
    return (
      <li key={item.name}>
        <a className={`fr-row${current ? ' active' : ''}`} href={friendHref(item.name)} aria-current={current ? 'true' : undefined}>
          <span className={`avatar${item.online ? ' on' : ' off'}`} aria-hidden="true">{item.name[0]}</span>
          <span className="fr-row-text">
            <span className="strong">{item.name}</span>
            <span className="small muted">{item.online ? (game ? `Joue à ${game.title}` : 'En ligne') : `${item.state} · ${item.since.toLowerCase()}`}</span>
          </span>
          {item.joinable && <span className="fr-dot" title="Partie à rejoindre" aria-label="Partie à rejoindre" />}
        </a>
      </li>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Toutes plateformes confondues</span>
          <h1 className="title">Amis</h1>
          <p className="sub">Vos amis de Steam, Epic, Riot et des consoles réunis au même endroit. Choisissez un ami pour voir son profil.</p>
        </div>
        <button type="button" className="btn" onClick={() => notify('L\'ajout d\'amis arrivera avec les connexions aux plateformes.')}><Icon name="plus" size={14} />Ajouter un ami</button>
      </div>

      {!connected && <p className="status status-warn fr-offline" role="status"><Icon name="offline" size={13} stroke={2.2} />Hors connexion : la liste date de votre dernière connexion. Rejoindre et écrire reprendront au retour du réseau.</p>}

      <div className="fr-layout">
        <nav className="fr-list" aria-label="Liste des amis">
          <Segmented<Filter>
            label="Filtrer les amis en ligne"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `Tous · ${online.length}` },
              { value: 'playing', label: `En jeu · ${playing.length}` },
              { value: 'joinable', label: `À rejoindre · ${joinable.length}` }
            ]}
          />
          <span className="eyebrow fr-list-label">En ligne · {shown.length}</span>
          {shown.length === 0 ? <p className="muted small">Personne dans cette liste pour l'instant.</p> : <ul>{shown.map(row)}</ul>}
          {filter === 'all' && (
            <>
              <span className="eyebrow fr-list-label">Hors ligne · {offline.length}</span>
              <ul>{offline.map(row)}</ul>
            </>
          )}
        </nav>

        {friend && <FriendProfile key={friend.name} friend={friend} onJoin={join} />}
      </div>
    </div>
  );
}

function FriendProfile({ friend, onJoin }: { friend: FriendStatus; onJoin(friend: FriendStatus): void }) {
  const { data, installed, notify, online: connected } = useApp();
  const current = friend.gameId ? findGame(data, friend.gameId) : undefined;
  const games = friend.games
    .map((g) => ({ game: findGame(data, g.gameId), hours: g.hours }))
    .filter((g): g is { game: Game; hours: number } => Boolean(g.game));
  const banner = (friend.online && current) || games[0]?.game || current;
  const totalHours = games.reduce((sum, g) => sum + g.hours, 0);
  const shared = games.filter((g) => g.game.hours > 0);
  const maxHours = Math.max(1, ...games.flatMap((g) => [g.hours, g.game.hours]));
  // Succès réels des jeux de l'ami ; seul le fait qu'il les ait obtenus est inventé.
  const medals = games.slice(0, 3).flatMap(({ game }, index) => {
    const list = game.achievements.list.filter((a) => !a.hidden && a.icon);
    const pick = list[(friend.name.length * 3 + index * 5) % Math.max(1, list.length)];
    return pick ? [{ game, ach: pick }] : [];
  });

  return (
    <article className="fr-profile" aria-label={`Profil de ${friend.name}`}>
      <div className="fr-banner">
        {banner && <GameArt game={banner} kind="art" />}
      </div>

      <div className="fr-id">
        <span className={`avatar lg${friend.online ? ' on' : ''}`} aria-hidden="true">{friend.name[0]}</span>
        <div className="fr-id-text">
          <h2 className="fr-name">{friend.name}</h2>
          <p className="fr-tagline">{friend.tagline}</p>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip">{friend.platform}</span>
            <span className="chip">{friend.friendSince}</span>
          </div>
        </div>
      </div>

      <div className="fr-now">
        <div>
          <span className="eyebrow">{friend.online ? 'En ce moment' : 'Dernière activité'}</span>
          <div className="fr-now-state">
            {friend.online
              ? <span className="status status-ok"><Icon name="check" size={12} stroke={2.6} />En ligne</span>
              : <span className="muted">Hors ligne</span>}
            <span className="strong">{friend.state}</span>
            <span className="muted">{friend.since}</span>
          </div>
        </div>
        <div className="row">
          {friend.online && current && friend.joinable && (
            <button type="button" className="btn btn-primary" onClick={() => onJoin(friend)} disabled={!connected} title={connected ? undefined : 'Disponible au retour de la connexion'}>
              <Icon name="play" size={13} filled />
              {installed.has(current.id) ? 'Rejoindre' : 'Installer pour rejoindre'}
            </button>
          )}
          {friend.online && current && !friend.joinable && <span className="chip">Partie en cours, impossible de rejoindre</span>}
          <button type="button" className="btn" onClick={() => notify(`Les messages passeront par ${friend.platform} dans la version Windows.`)}>Message</button>
          {current && <a className="btn" href={`#/game/${current.id}`}>Fiche du jeu</a>}
        </div>
      </div>

      <div className="stats fr-stats">
        <Stat value={totalHours.toLocaleString('fr-FR')} unit="h" label="Sur ses jeux favoris" />
        <Stat value={shared.length} unit={`sur ${games.length}`} label="Jeux en commun" />
        <Stat value={games[0]?.game.title ?? '—'} label="Jeu le plus joué" />
      </div>

      <section className="fr-block">
        <h3 className="h2">Ses jeux</h3>
        <div className="fr-games">
          {games.map(({ game, hours }) => (
            <a key={game.id} className="fr-game" href={`#/game/${game.id}`}>
              <span className="fr-game-cover"><GameArt game={game} kind="cover" lazy /></span>
              <span className="fr-game-body">
                <span className="strong">{game.title}</span>
                <span className="fr-bar">
                  <span className="small">{friend.name}</span>
                  <span className="meter"><i style={{ width: `${(hours / maxHours) * 100}%` }} /></span>
                  <span className="small fr-hours">{hours.toLocaleString('fr-FR')} h</span>
                </span>
                <span className="fr-bar you">
                  <span className="small">Vous</span>
                  <span className="meter"><i style={{ width: `${(game.hours / maxHours) * 100}%` }} /></span>
                  <span className="small fr-hours">{game.hours > 0 ? `${game.hours.toLocaleString('fr-FR')} h` : 'Jamais joué'}</span>
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="fr-cols">
        <section className="fr-block">
          <h3 className="h2">Derniers succès</h3>
          {medals.length === 0 && <p className="muted">Aucun succès à afficher pour ses jeux.</p>}
          {medals.map(({ game, ach }) => (
            <div key={`${game.id}-${ach.name}`} className="ach">
              <img src={ach.icon} alt="" loading="lazy" />
              <div className="ach-body">
                <div className="ach-name">{ach.name}</div>
                <div className="small muted">{game.title} · obtenu par {ach.rarity.toLocaleString('fr-FR')} % des joueurs</div>
              </div>
            </div>
          ))}
        </section>

        <section className="fr-block">
          <h3 className="h2">Activité récente</h3>
          <ol className="tl">
            {friend.activity.map((event) => {
              const game = event.gameId ? findGame(data, event.gameId) : undefined;
              return (
                <li key={`${event.when}-${event.text}`}>
                  <div className="strong">{event.text}</div>
                  <div className="small muted">
                    {game ? <a className="link" href={`#/game/${game.id}`}>{game.title}</a> : null}
                    {game ? ' · ' : ''}{event.when}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </article>
  );
}
