import { findGame, useApp } from '../context';
import { Timeline } from '../Timeline';
import { GameArt, Icon, PlayButton, Stat, StatusText } from '../ui';

export function Report({ id }: { id: string }) {
  const { data, play, notify } = useApp();
  const report = data.reports.find((r) => r.id === id) ?? data.reports[0];
  const game = report ? findGame(data, report.gameId) : undefined;

  if (!report || !game) {
    return (
      <div className="page">
        <h1 className="title">Aucun bilan pour l'instant</h1>
        <p className="sub">Le premier bilan apparaîtra à la fin de votre prochaine partie.</p>
        <a className="btn" style={{ marginTop: 20 }} href="#/home">Retour à l'accueil</a>
      </div>
    );
  }

  const { chart } = report;
  const max = Math.max(...chart.values, chart.limit);
  const n = chart.values.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / (max * 1.15)) * 100;
  const line = chart.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  // Points à signaler : au-delà du seuil, et plus marqués que leurs voisins.
  const out = (v: number) => (chart.above ? v > chart.limit : v < chart.limit);
  const marks = chart.values
    .map((v, i) => ({ v, i }))
    .filter(({ v, i }) => {
      const before = chart.values[i - 1] ?? v;
      const after = chart.values[i + 1] ?? v;
      return out(v) && (chart.above ? v >= before && v >= after : v <= before && v <= after);
    });
  const others = data.reports.filter((r) => r.gameId === game.id && r.id !== report.id).slice(0, 4);

  return (
    <div className="page">
      <a className="back" href={`#/reports?game=${game.id}`}><Icon name="back" size={14} stroke={2} />Tous les bilans de {game.title}</a>
      <header className="banner" style={{ marginTop: 8 }}>
        <GameArt game={game} kind="art" />
        <div style={{ maxWidth: 720 }}>
          <span className="eyebrow">Bilan de partie · {game.title} · {report.when}</span>
          <h1 className="title">{report.headline}</h1>
          <p className="sub" style={{ color: 'var(--text-2)' }}>{report.text}</p>
        </div>
        <div className="row">
          <PlayButton game={game} onPlay={play} />
          <button type="button" className="btn btn-lg btn-glass" onClick={() => notify('L\'export du bilan arrivera avec la version Windows.')}>Exporter</button>
        </div>
      </header>

      <div className="stats">
        {report.tiles.map((t) => <Stat key={t.label} value={t.big} label={t.label} />)}
      </div>

      {report.timeline && <Timeline timeline={report.timeline} />}

      <section className="section">
        <div className="block-head">
          <h2 className="h2">{chart.title}</h2>
          <span className="small muted">{chart.summary}</span>
        </div>
        <div className="curve-wrap">
          <svg className="curve" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${chart.title}. ${chart.summary}`}>
            <defs>
              <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
                <stop offset="1" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((g) => <line key={g} className="grid" x1="0" x2="100" y1={g} y2={g} />)}
            <path className="area" d={`${line} L100 100 L0 100 Z`} />
            <path className="line" d={line} />
          </svg>
          {marks.map(({ v, i }) => (
            <span key={i} className="curve-peak" style={{ left: `${x(i)}%`, top: `${y(v)}%` }}>{v} {chart.unit}</span>
          ))}
        </div>
        <div className="axis">{chart.axis.map((label, i) => <span key={i}>{label}</span>)}</div>
      </section>

      {report.changes && (
        <section className="section" aria-label="Ce qui a changé">
          <div className="block-head">
            <h2 className="h2">Ce qui a changé depuis la dernière partie réussie</h2>
            <span className="small muted">{report.changes.length ? 'Du plus suspect au moins suspect' : 'Rien n\'a changé'}</span>
          </div>
          {report.changes.length === 0
            ? <p className="muted">Le PC et le jeu étaient dans le même état que lors de la dernière partie réussie : la cause est ailleurs (réseau, serveurs du jeu, chaleur…).</p>
            : report.changes.map((c) => (
              <div key={c.title} className="list-row">
                <span className={`small strong ${c.level === 0 ? 'status-warn' : 'muted'}`} style={{ width: 120 }}>{['Cause probable', 'À surveiller', 'Sans risque'][c.level]}</span>
                <div className="grow">
                  <div className="strong">{c.title}</div>
                  <div className="small muted">{c.text}</div>
                </div>
                <span className="small muted">{c.when}</span>
              </div>
            ))}
        </section>
      )}

      <div className="split section">
        <section>
          <h2 className="h2" style={{ marginBottom: 24 }}>Ce qui s'est passé</h2>
          <ol className="tl">
            {report.events.map((e) => (
              <li key={e.time + e.title} className={e.ok ? 'ok' : 'warn'}>
                <span className="eyebrow">{e.time}</span>
                <div className="strong" style={{ fontSize: 16, margin: '4px 0 2px' }}>{e.title}</div>
                <div className="muted">{e.text}</div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="aside">
          {report.advice && (
            <section>
              <h2 className="h2">{report.advice.title}</h2>
              <p className="muted">{report.advice.text}</p>
              <a className="btn" style={{ marginTop: 14 }} href={report.advice.href}>{report.advice.action}</a>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="h2">Autres parties de ce jeu</h2>
              {others.map((r) => (
                <a key={r.id} className="list-row" href={`#/report/${r.id}`} style={{ padding: '12px 0' }}>
                  <div className="grow" style={{ flexBasis: 120 }}>
                    <div className="strong">{r.date}</div>
                    <div className="small muted">{r.length}</div>
                  </div>
                  <StatusText status={r.ok ? 'ok' : 'warn'}>{r.cause}</StatusText>
                </a>
              ))}
              <a className="link" href={`#/reports?game=${game.id}`}>Tout l'historique</a>
            </section>
          )}
          <section>
            <h2 className="h2">Ce bilan est-il juste ?</h2>
            <p className="small muted">Votre réponse améliore le diagnostic pour tous les joueurs. Rien de personnel n'est partagé.</p>
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => notify('Merci, votre réponse est enregistrée.')}>Oui</button>
              <button type="button" className="btn" onClick={() => notify('Merci. Coach peut regarder cette partie de plus près.', { label: 'Demander à Coach', href: '#/assistant' })}>Non, c'était autre chose</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
