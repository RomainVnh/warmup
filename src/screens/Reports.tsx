import { useMemo, useState } from 'react';
import type { ReportCause } from '../../shared/types';
import { findGame, useApp } from '../context';
import { GameArt, Icon, Stat, StatusText, Toggle } from '../ui';

export function Reports({ initialGame }: { initialGame: string }) {
  const { data } = useApp();
  const [gameId, setGameId] = useState(data.games.some((g) => g.id === initialGame) ? initialGame : '');
  const [onlyIssues, setOnlyIssues] = useState(false);

  const scoped = useMemo(() => data.reports.filter((r) => !gameId || r.gameId === gameId), [data.reports, gameId]);
  const shown = scoped.filter((r) => !onlyIssues || !r.ok);
  const issues = scoped.filter((r) => !r.ok);
  const games = data.games.filter((g) => data.reports.some((r) => r.gameId === g.id)).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const game = gameId ? findGame(data, gameId) : undefined;

  // Cause la plus fréquente, et jeu où un même problème est revenu.
  const counts = new Map<ReportCause, number>();
  for (const r of issues) counts.set(r.cause, (counts.get(r.cause) ?? 0) + 1);
  const topCause = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const byGame = new Map<string, number>();
  for (const r of data.reports.filter((x) => !x.ok)) byGame.set(r.gameId, (byGame.get(r.gameId) ?? 0) + 1);
  const repeat = [...byGame.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0];
  const repeatGame = repeat ? findGame(data, repeat[0]) : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{game ? game.title : 'Tous les jeux'}</span>
          <h1 className="title">Bilans de parties</h1>
          <p className="sub">Chaque partie laisse un bilan. Les relire ensemble montre si un problème revient, et d'où il vient.</p>
        </div>
      </div>

      <div className="stats">
        <Stat value={scoped.length} label="Parties enregistrées" />
        <Stat value={`${scoped.length ? Math.round(((scoped.length - issues.length) / scoped.length) * 100) : 0} %`} label="Sans incident" />
        <Stat value={issues.length} label="Parties avec un incident" />
        {topCause && <Stat value={topCause[0]} label={`Cause la plus fréquente · ${topCause[1]} fois`} />}
      </div>

      {repeatGame && !gameId && (
        <section className="card card-warn alert section" style={{ marginTop: 40 }}>
          <span className="icon-box"><Icon name="warn" size={20} stroke={2} /></span>
          <div className="grow">
            <div className="strong" style={{ fontSize: 16 }}>Un problème revient sur {repeatGame.title}</div>
            <div className="muted">{repeat![1]} parties avec un incident parmi les dernières. Les bilans de ce jeu montrent ce qu'elles ont en commun.</div>
          </div>
          <button type="button" className="btn" onClick={() => { setGameId(repeatGame.id); setOnlyIssues(true); }}>Voir ces parties</button>
        </section>
      )}

      <section className="section">
        <div className="block-head" style={{ alignItems: 'center' }}>
          <h2 className="h2">{shown.length} bilan{shown.length > 1 ? 's' : ''}</h2>
          <div className="row" style={{ gap: 18 }}>
            <label className="label-inline">
              Jeu
              <select className="select" value={gameId} onChange={(e) => setGameId(e.target.value)}>
                <option value="">Tous les jeux</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </label>
            <span className="label-inline">
              Seulement les incidents
              <Toggle checked={onlyIssues} onChange={setOnlyIssues} label="Afficher seulement les parties avec un incident" />
            </span>
          </div>
        </div>
        {shown.length === 0 && <p className="muted">Aucune partie ne correspond à ces filtres.</p>}
        {shown.map((r) => {
          const g = findGame(data, r.gameId);
          if (!g) return null;
          return (
            <a key={r.id} className="list-row" href={`#/report/${r.id}`} style={{ gap: 16 }}>
              <span className="thumb-sq"><GameArt game={g} kind="cover" lazy className="fill" /></span>
              <div className="grow">
                <div className="strong">{r.headline}</div>
                <div className="small muted">{g.title}</div>
              </div>
              <span className="muted" style={{ width: 150 }}>{r.date}</span>
              <span className="muted" style={{ width: 70 }}>{r.length}</span>
              <span style={{ width: 150 }}><StatusText status={r.ok ? 'ok' : 'warn'}>{r.cause}</StatusText></span>
            </a>
          );
        })}
      </section>
    </div>
  );
}
