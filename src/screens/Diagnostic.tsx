import { useState } from 'react';
import { useApp } from '../context';
import { Ambient, Icon, Ring, Stat, StatusText } from '../ui';

export function Diagnostic() {
  const { data, notify } = useApp();
  const { parts, servers } = data.pc;
  const [issues, setIssues] = useState(data.pc.issues);
  const [log, setLog] = useState(data.pc.log);
  const good = parts.filter((p) => p.status === 'ok').length;
  const allGood = good === parts.length;

  return (
    <div className="page">
      <Ambient />
      <div className="page-head">
        <div className="row" style={{ gap: 36 }}>
          <Ring value={good / parts.length} tone={allGood ? 'ok' : 'warn'} label={`${good} points bons sur ${parts.length}`}>
            <strong>{good}/{parts.length}</strong>
            <span>au vert</span>
          </Ring>
          <div>
            <span className="eyebrow">Contrôlé il y a 2 minutes</span>
            <h1 className="title">Diagnostic du PC</h1>
            <p className="sub">{allGood ? 'Tout est en ordre.' : `${parts.length - good} points peuvent être améliorés. Rien n'empêche de jouer.`}</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => notify('Diagnostic relancé : aucun changement depuis le dernier contrôle.')}>Relancer le diagnostic</button>
      </div>

      <section>
        <span className="eyebrow" style={{ marginBottom: 6 }}>À améliorer · {issues.length}</span>
        {issues.length === 0 && <p className="strong" style={{ paddingTop: 16 }}>Plus rien à améliorer pour l'instant.</p>}
        {issues.map((issue, i) => (
          <article key={issue.title} className="list-row" style={{ alignItems: 'flex-start', gap: 20, padding: '26px 0' }}>
            <span className="index">{String(i + 1).padStart(2, '0')}</span>
            <div className="grow" style={{ flexBasis: 420 }}>
              <h2 style={{ fontSize: 20, fontWeight: 500 }}>{issue.title}</h2>
              <p className="muted" style={{ marginTop: 8, maxWidth: '68ch' }}>{issue.why}</p>
              <p className="small" style={{ marginTop: 12, color: 'var(--text-2)' }}><span className="muted">Ce qui sera modifié : </span>{issue.change}</p>
            </div>
            <div className="row">
              {issue.guideId
                ? <a className="btn btn-primary" href={`#/guide/${issue.guideId}`}>{issue.action}</a>
                : <button type="button" className="btn btn-primary" onClick={() => notify(`${issue.action} : disponible avec la version Windows.`)}>{issue.action}</button>}
              <button type="button" className="btn" onClick={() => setIssues((list) => list.filter((x) => x.title !== issue.title))}>Ignorer</button>
            </div>
          </article>
        ))}
      </section>

      <section className="section">
        <span className="eyebrow" style={{ marginBottom: 6 }}>État du PC</span>
        {parts.map((p) => (
          <div key={p.name} className="list-row" style={{ gap: 24 }}>
            <span className="muted" style={{ width: 150 }}>{p.name}</span>
            <span style={{ width: 240, fontSize: 18, fontWeight: 500 }}>{p.big}</span>
            <span className="grow muted">{p.text}</span>
            <StatusText status={p.status}>{p.status === 'ok' ? 'Bon' : 'À améliorer'}</StatusText>
          </div>
        ))}
      </section>

      <div className="split even section">
        <section>
          <h2 className="h2">Serveurs de vos jeux</h2>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>Ping mesuré vers les vrais serveurs de chaque jeu, et état du service chez l'éditeur.</p>
          {servers.map((s) => (
            <div key={s.game} className="list-row">
              <div className="grow" style={{ flexBasis: 160 }}>
                <div className="strong">{s.game}</div>
                <div className="small muted">{s.region}</div>
              </div>
              <span style={{ width: 70, fontSize: 18, fontWeight: 300 }}>{s.ping}</span>
              <span style={{ width: 170 }}><StatusText status={s.status}>{s.state}</StatusText></span>
            </div>
          ))}
        </section>
        <section>
          <h2 className="h2">Journal des corrections</h2>
          <p className="small muted" style={{ margin: '6px 0 22px' }}>Tout ce que Warmup a modifié sur ce PC, avec la valeur d'origine. Chaque ligne peut être annulée.</p>
          {log.length === 0 && <p className="muted">Aucune correction en place.</p>}
          <ol className="tl">
            {log.map((entry) => (
              <li key={entry.what}>
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 16 }}>
                  <div className="grow">
                    <div className="strong">{entry.what}</div>
                    <div className="small muted">{entry.detail}</div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLog((list) => list.filter((l) => l.what !== entry.what));
                      notify('Correction annulée, valeur d\'origine rétablie.');
                    }}
                  >
                    <Icon name="back" size={14} stroke={2} />
                    Annuler
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="section">
        <div className="stats">
          <Stat value={data.week.cleanLaunches} label="Lancements sans incident cette semaine" />
          <Stat value={data.week.fixes} label="Problèmes corrigés avant de jouer" />
          <Stat value={log.length} label="Corrections en place" />
        </div>
      </section>
    </div>
  );
}
