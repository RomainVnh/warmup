import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Game } from '../../shared/types';
import { useApp } from '../context';
import { openAccountStep } from '../Onboarding';
import { GameArt, Icon, Stat, StatusText, UserAvatar, fileToAvatar, hoursLabel, sourceLabel } from '../ui';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const SHOWCASE_MAX = 4;

// Total d'heures par valeur d'un champ (plateforme, genre), du plus joué au moins joué.
function hoursBy(games: Game[], key: (g: Game) => string): [string, number][] {
  const totals = new Map<string, number>();
  for (const g of games) totals.set(key(g), (totals.get(key(g)) ?? 0) + g.hours);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export function ProfilePage() {
  const { data, notify, favorites, profileCard, updateProfileCard, displayName, account, updateAccount } = useApp();
  // Se déconnecter ramène à l'étape Compte : il faut s'y reconnecter ou créer un compte pour rouvrir Warmup.
  const signOut = () => {
    openAccountStep();
    updateAccount({ email: '', signedIn: false });
  };
  const { profile, games } = data;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profileCard.name);
  const [tagline, setTagline] = useState(profileCard.tagline);

  const byHours = useMemo(() => [...games].sort((a, b) => b.hours - a.hours), [games]);
  const banner = games.find((g) => g.id === profileCard.bannerGameId) ?? byHours[0];
  const chosen = profileCard.showcase.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => Boolean(g));
  const showcase = chosen.length ? chosen : byHours.filter((g) => favorites.has(g.id)).slice(0, SHOWCASE_MAX);
  const hours = games.reduce((sum, g) => sum + g.hours, 0);
  const achievements = games.reduce((sum, g) => sum + g.achievements.done, 0);
  const platforms = hoursBy(games, (g) => sourceLabel(g.source));
  const genres = hoursBy(games, (g) => g.genre);
  const rarest = games
    .flatMap((g) => g.achievements.list.filter((a) => a.when && a.rarity > 0).map((a) => ({ ...a, game: g })))
    .sort((a, b) => a.rarity - b.rarity)
    .slice(0, 5);
  const recent = [...games].filter((g) => g.hours > 0).sort((a, b) => a.recentRank - b.recentRank).slice(0, 3);
  const maxWeek = Math.max(...data.week.hours);
  const top = byHours.slice(0, 5);

  const save = (event: FormEvent) => {
    event.preventDefault();
    updateProfileCard({ name, tagline });
    setEditing(false);
    notify('Profil mis à jour.');
  };
  const importAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    fileToAvatar(file).then(
      (avatar) => {
        updateProfileCard({ avatar });
        notify('Icône mise à jour.');
      },
      (error: Error) => notify(error.message === 'format' ? 'Choisissez une image au format JPEG, PNG ou WebP.' : 'Cette image n\'a pas pu être lue. Essayez-en une autre.')
    );
  };
  const toggleShowcase = (id: string) => {
    const current = chosen.map((g) => g.id);
    if (current.includes(id)) updateProfileCard({ showcase: current.filter((x) => x !== id) });
    else if (current.length < SHOWCASE_MAX) updateProfileCard({ showcase: [...current, id] });
    else notify(`La vitrine contient ${SHOWCASE_MAX} jeux au plus. Retirez-en un pour en ajouter un autre.`);
  };

  return (
    <div className="page">
      <header className="banner profile-banner">
        <GameArt game={banner} kind="art" />
        <div className="row" style={{ gap: 24, alignItems: 'flex-end' }}>
          <UserAvatar name={displayName} image={profileCard.avatar} className="xl" />
          <div>
            <span className="eyebrow">{profile.since}</span>
            <h1 className="title">{displayName}</h1>
            <p className="sub" style={{ color: 'var(--text-2)' }}>{profileCard.tagline || 'Ajoutez une phrase pour vous présenter.'}</p>
            <div className="row" style={{ marginTop: 14 }}>
              {platforms[0] && <span className="chip">Joue surtout sur {platforms[0][0]}</span>}
              {genres[0] && <span className="chip">{genres[0][0]}</span>}
              <span className="chip">Bannière : {banner.title}</span>
            </div>
          </div>
        </div>
        <div className="row profile-actions">
          <button type="button" className={`btn btn-lg ${editing ? 'btn-primary' : 'btn-glass'}`} aria-expanded={editing} onClick={() => setEditing((open) => !open)}>
            <Icon name={editing ? 'check' : 'sliders'} size={15} stroke={editing ? 2.6 : 1.8} />
            {editing ? 'Valider' : 'Personnaliser'}
          </button>
          <button type="button" className="btn btn-lg btn-glass" onClick={signOut} title={`Connecté : ${account.email}`}>Se déconnecter</button>
        </div>
      </header>

      {editing && (
        <section className="card editor" aria-label="Personnaliser le profil">
          <form className="editor-fields" onSubmit={save}>
            <label>
              <span className="eyebrow">Pseudo</span>
              <span className="field"><input type="text" maxLength={24} value={name} placeholder={profile.name} onChange={(e) => setName(e.target.value)} /></span>
            </label>
            <label style={{ flex: '2 1 320px' }}>
              <span className="eyebrow">Phrase de présentation</span>
              <span className="field"><input type="text" maxLength={90} value={tagline} placeholder="Par exemple : jeux de rôle et parties classées le week-end" onChange={(e) => setTagline(e.target.value)} /></span>
            </label>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </form>

          <div>
            <span className="eyebrow" style={{ marginBottom: 12 }}>Icône</span>
            <div className="row" style={{ gap: 16 }}>
              <UserAvatar name={displayName} image={profileCard.avatar} className="lg" />
              <label className="btn file-btn">
                <Icon name="up" size={14} stroke={2.2} />
                Importer une image
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={importAvatar} />
              </label>
              {profileCard.avatar && <button type="button" className="btn" onClick={() => updateProfileCard({ avatar: '' })}>Retirer l'icône</button>}
              <span className="small muted">JPEG, PNG ou WebP. L'image est recadrée en carré et réduite ; elle reste sur ce PC.</span>
            </div>
          </div>

          <div>
            <span className="eyebrow" style={{ marginBottom: 12 }}>Bannière · choisissez un jeu</span>
            <div className="picks">
              {games.map((g) => (
                <button key={g.id} type="button" className="pick" aria-pressed={banner.id === g.id} aria-label={`Bannière : ${g.title}`} title={g.title} onClick={() => updateProfileCard({ bannerGameId: g.id })}>
                  <GameArt game={g} kind="art" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="eyebrow" style={{ marginBottom: 12 }}>Vitrine · {chosen.length} jeu{chosen.length > 1 ? 'x' : ''} sur {SHOWCASE_MAX}{chosen.length === 0 ? ' (vos favoris sont affichés par défaut)' : ''}</span>
            <div className="row">
              {byHours.map((g) => (
                <button key={g.id} type="button" className="chip chip-btn" aria-pressed={chosen.some((c) => c.id === g.id)} onClick={() => toggleShowcase(g.id)}>{g.title}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="stats">
        <Stat value={hours.toLocaleString('fr-FR')} unit="h" label="Temps de jeu total" />
        <Stat value={games.length} label="Jeux dans la bibliothèque" />
        <Stat value={achievements} label="Succès obtenus" />
        {profile.stats.map((s) => <Stat key={s.label} value={s.big} label={s.label} />)}
      </div>

      {showcase.length > 0 && (
        <section className="section">
          <div className="block-head">
            <h2 className="h2">Ma vitrine</h2>
            {!editing && <button type="button" className="link" onClick={() => setEditing(true)}>Choisir les jeux</button>}
          </div>
          <div className="showcase">
            {showcase.map((g) => {
              const { done, total } = g.achievements;
              return (
                <a key={g.id} className="showcase-item" href={`#/game/${g.id}`}>
                  <GameArt game={g} kind="art" lazy />
                  <div>
                    <div className="strong" style={{ fontSize: 17 }}>{g.title}</div>
                    <div className="small" style={{ color: 'var(--text-2)' }}>{hoursLabel(g.hours)}{total ? ` · ${done} succès sur ${total}` : ''}</div>
                    {total > 0 && <div className="meter" style={{ marginTop: 10 }}><i style={{ width: `${(done / total) * 100}%` }} /></div>}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <div className="split even section">
        <section>
          <h2 className="h2" style={{ marginBottom: 8 }}>Mes succès les plus rares</h2>
          {rarest.length === 0 && <p className="muted">Aucun succès obtenu pour l'instant.</p>}
          {rarest.map((a) => (
            <a key={a.game.id + a.name} className="ach" href={`#/game/${a.game.id}?tab=succes`}>
              {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : <span className="ach-blank" />}
              <div className="ach-body">
                <div className="ach-name">{a.name}</div>
                <div className="small muted">{a.game.title}</div>
              </div>
              <div className="ach-rarity">
                <div className="small strong">{a.rarity.toLocaleString('fr-FR')} %</div>
                <div className="small muted">des joueurs</div>
              </div>
            </a>
          ))}
        </section>
        <section>
          <h2 className="h2" style={{ marginBottom: 20 }}>Mes habitudes</h2>
          <span className="eyebrow" style={{ marginBottom: 12 }}>Temps de jeu par plateforme</span>
          {platforms.map(([label, value]) => (
            <div key={label} className="bar-row">
              <span>{label}</span>
              <div className="meter"><i style={{ width: `${(value / platforms[0][1]) * 100}%` }} /></div>
              <span className="muted">{value.toLocaleString('fr-FR')} h</span>
            </div>
          ))}
          <span className="eyebrow" style={{ margin: '32px 0 12px' }}>Cette semaine · {data.week.total}</span>
          <div className="bars" style={{ height: 96, gap: 14 }} role="img" aria-label="Heures jouées par jour cette semaine, du lundi au dimanche">
            {data.week.hours.map((h, i) => (
              <div key={i}>
                <i style={{ height: Math.max(4, Math.round((h / maxWeek) * 70)), width: 22 }} />
                {DAYS[i]}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="split even section">
        <section>
          <h2 className="h2" style={{ marginBottom: 8 }}>En ce moment</h2>
          {recent.map((g) => (
            <a key={g.id} className="list-row" href={`#/game/${g.id}`} style={{ gap: 16 }}>
              <span className="thumb-sq"><GameArt game={g} kind="cover" lazy className="fill" /></span>
              <div className="grow">
                <div className="strong">{g.title}</div>
                <div className="small muted">Joué {g.lastPlayed.toLowerCase()} · dernière partie de {g.sessions[0]?.length ?? '0 h'}</div>
              </div>
              <StatusText status={g.status}>{g.statusLabel}</StatusText>
            </a>
          ))}
        </section>
        <section>
          <h2 className="h2" style={{ marginBottom: 8 }}>Mes jeux les plus joués</h2>
          {top.map((g, i) => (
            <a key={g.id} className="list-row" href={`#/game/${g.id}`} style={{ gap: 16 }}>
              <span className="index">{String(i + 1).padStart(2, '0')}</span>
              <span className="thumb-sq"><GameArt game={g} kind="cover" lazy className="fill" /></span>
              <div className="grow">
                <div className="strong">{g.title}</div>
                <div className="meter" style={{ marginTop: 10 }}><i style={{ width: `${(g.hours / (top[0].hours || 1)) * 100}%` }} /></div>
              </div>
              <span className="muted" style={{ width: 100, textAlign: 'right' }}>{hoursLabel(g.hours)}</span>
            </a>
          ))}
        </section>
      </div>

      <div className="split section">
        <section>
          <h2 className="h2">Comptes liés</h2>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>Chaque compte passe par la connexion officielle de sa plateforme. Warmup ne voit et ne conserve aucun mot de passe.</p>
          {profile.accounts.map((a) => (
            <div key={a.platform} className="list-row">
              <span className="avatar" aria-hidden="true" style={{ borderRadius: 10 }}>{a.platform[0]}</span>
              <div className="grow">
                <div className="strong">{a.platform}</div>
                <div className="small muted">{a.detail}</div>
              </div>
              {a.linked ? <StatusText status="ok">Lié</StatusText> : <span className="small muted">Non lié</span>}
              <button type="button" className="btn" onClick={() => notify(`${a.linked ? 'Déconnexion' : 'Connexion'} de ${a.platform} : disponible avec la version Windows.`)}>
                {a.linked ? 'Délier' : 'Lier'}
              </button>
            </div>
          ))}
        </section>
        <aside className="aside">
          <section>
            <h2 className="h2">Mon PC</h2>
            <dl className="dl">
              {profile.pc.map((p) => (
                <div key={p.label} style={{ display: 'contents' }}><dt>{p.label}</dt><dd>{p.value}</dd></div>
              ))}
            </dl>
            <a className="btn" style={{ marginTop: 18 }} href="#/diagnostic">Voir le diagnostic</a>
          </section>
          <section>
            <h2 className="h2">Mes données</h2>
            <p className="muted">Vous pouvez récupérer ou effacer tout ce que Warmup a enregistré.</p>
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => notify('L\'export des données arrivera avec les comptes Warmup.')}>Exporter</button>
              <button type="button" className="btn" onClick={() => notify('La suppression des données arrivera avec les comptes Warmup.')}>Tout effacer</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
