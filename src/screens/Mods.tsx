import { useState } from 'react';
import type { Mod } from '../../shared/types';
import { findGame, useApp } from '../context';
import { GameArt, Icon, Segmented, Stat, StatusText, Toggle } from '../ui';

type Filter = 'all' | 'warn' | 'update';

export function Mods({ gameId }: { gameId: string }) {
  const { data, play, notify } = useApp();
  // Sans jeu précisé, on ouvre celui qui a un problème, sinon le premier.
  const sets = data.mods;
  const set = sets.find((m) => m.gameId === gameId) ?? sets.find((m) => m.list.some((x) => x.level === 'warn')) ?? sets[0];
  const game = findGame(data, set.gameId)!;
  const [mods, setMods] = useState<Mod[]>(set.list);
  const [filter, setFilter] = useState<Filter>('all');

  const count = (level: Mod['level']) => mods.filter((m) => m.level === level).length;
  const shown = mods.filter((m) => filter === 'all' || m.level === filter);
  const faulty = mods.filter((m) => m.state.startsWith('Incompatible') && m.enabled);
  const setEnabled = (name: string, enabled: boolean) => setMods((list) => list.map((m) => (m.name === name ? { ...m, enabled } : m)));
  const disableFaulty = () => {
    setMods((list) => list.map((m) => (m.state.startsWith('Incompatible') ? { ...m, enabled: false } : m)));
    play(game);
  };

  return (
    <div className="page">
      <nav className="game-tabs" aria-label="Choisir un jeu">
        {sets.map((m) => {
          const g = findGame(data, m.gameId);
          if (!g) return null;
          const alerts = m.list.filter((x) => x.level === 'warn').length;
          return (
            <a key={m.gameId} href={`#/mods/${m.gameId}`} className={`game-tab${m.gameId === set.gameId ? ' on' : ''}`} aria-current={m.gameId === set.gameId ? 'page' : undefined}>
              <span className="thumb-sq"><GameArt game={g} kind="cover" className="fill" /></span>
              <span>
                <span className="strong">{g.title}</span>
                <span className="small muted" style={{ display: 'block' }}>{g.modCount} mods{alerts ? ` · ${alerts} à voir` : ''}</span>
              </span>
              {alerts > 0 && <span className="status status-warn"><Icon name="warn" size={14} stroke={2.4} /></span>}
            </a>
          );
        })}
      </nav>
      <header className="banner">
        <GameArt game={game} kind="art" />
        <div>
          <span className="eyebrow">Mods · {game.title} · version {game.version}</span>
          <h1 className="title">{faulty.length ? `${faulty.length} ${set.headline}` : 'Aucun mod en cause'}</h1>
          <p className="sub">
            {faulty.length ? set.text : 'Tous les mods actifs prennent en charge la version actuelle du jeu. L\'état des mods est enregistré à chaque partie.'}
          </p>
        </div>
        <div className="row">
          {faulty.length > 0 && <button type="button" className="btn btn-primary btn-lg" onClick={disableFaulty}>Désactiver les {faulty.length} et tester le jeu</button>}
          <button type="button" className="btn btn-lg btn-glass" onClick={() => notify(`Recherche par moitiés : ${Math.max(1, Math.ceil(Math.log2(game.modCount)))} essais au plus pour ${game.modCount} mods. Disponible avec la version Windows.`)}>Trouver le mod fautif</button>
        </div>
      </header>

      <div className="stats" style={{ marginBottom: 56 }}>
        <Stat value={game.modCount} label="Mods installés" />
        <Stat value={mods.filter((m) => m.enabled).length} unit={`sur ${mods.length} affichés`} label="Actifs" />
        <Stat value={count('warn')} label="En cause ou en conflit" />
        <Stat value={count('update')} label="Mises à jour disponibles" />
      </div>

      <div className="split">
        <section>
          <div className="block-head" style={{ alignItems: 'center' }}>
            <h2 className="h2">Ordre de chargement</h2>
            <div className="row">
              <Segmented<Filter>
                label="Filtrer les mods"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `Tous · ${mods.length}` },
                  { value: 'warn', label: `En cause · ${count('warn')}` },
                  { value: 'update', label: `Mises à jour · ${count('update')}` }
                ]}
              />
              <button type="button" className="btn" onClick={() => notify('L\'ajout de mods arrivera avec la connexion à Nexus Mods.')}><Icon name="plus" size={14} />Ajouter</button>
            </div>
          </div>
          {shown.map((m) => (
            <div key={m.name} className={`mod${m.enabled ? '' : ' off'}`}>
              <span className="index">{String(m.order).padStart(2, '0')}</span>
              <div className="grow">
                <div className="strong">{m.name} <span className="small muted" style={{ fontWeight: 400, marginLeft: 6 }}>{m.version}</span></div>
                <div className="small muted">{m.note}</div>
              </div>
              <span className="mod-state">
                {m.level === 'update'
                  ? <span className="status status-update"><Icon name="up" size={14} stroke={2.6} />{m.state}</span>
                  : <StatusText status={m.level}>{m.state}</StatusText>}
              </span>
              <Toggle checked={m.enabled} onChange={(next) => setEnabled(m.name, next)} label={`${m.enabled ? 'Désactiver' : 'Activer'} ${m.name}`} />
            </div>
          ))}
          <p className="small muted" style={{ marginTop: 18 }}>{shown.length} mods affichés sur {game.modCount}.</p>
        </section>

        <aside className="aside">
          <section>
            <h2 className="h2">États sauvegardés</h2>
            <p className="small muted" style={{ marginBottom: 22 }}>La liste des mods est enregistrée à chaque partie. Vous pouvez revenir à n'importe quel état.</p>
            <ol className="tl">
              {set.snapshots.map((s) => (
                <li key={s.when} className={s.ok ? 'ok' : 'warn'}>
                  <div className="strong">{s.when}</div>
                  <StatusText status={s.ok ? 'ok' : 'warn'}>{s.result}</StatusText>
                  <div><button type="button" className="link" onClick={() => notify(`État du ${s.when.toLowerCase()} restauré.`)}>Restaurer cet état</button></div>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="h2">Compte Nexus Mods</h2>
            <p className="small muted" style={{ marginBottom: 12 }}>Lié par la connexion officielle. Aucun mot de passe n'est conservé.</p>
            <StatusText status="ok">Lié · {count('update')} mises à jour disponibles</StatusText>
          </section>
        </aside>
      </div>
    </div>
  );
}
