import { useEffect, useState } from 'react';
import type { PcIssue, PcPart } from '../../shared/types';
import { api } from '../api';
import { useApp } from '../context';
import { Ambient, Icon, Ring, Stat, StatusText } from '../ui';
import { Effect } from './Journal';

export function Diagnostic() {
  const { data, notify, journal, undoFix, reload } = useApp();
  const { servers } = data.pc;
  const [parts, setParts] = useState<PcPart[]>(data.pc.parts);
  const [checkedAt, setCheckedAt] = useState('Contrôlé à l\'ouverture de Warmup');
  const [checking, setChecking] = useState(false);

  // Relit le matériel. Dans le navigateur, la réponse reste l'exemple et le dit.
  const recheck = async () => {
    setChecking(true);
    try {
      const report = await api.getPcReport();
      setParts(report.parts);
      setIssues(report.issues);
      if (!report.example) void reload();
      setCheckedAt(report.checkedAt);
      notify(report.example ? 'Exemple de diagnostic : la vraie lecture du PC se fait dans l\'application installée.' : 'Diagnostic relancé : le matériel a été relu.');
    } catch {
      notify('Le diagnostic n\'a pas pu relire le PC. Réessayez dans un instant.');
    } finally {
      setChecking(false);
    }
  };
  const [issues, setIssues] = useState(data.pc.issues);
  const [busy, setBusy] = useState<string | null>(null);
  // Version vierge : après une correction ou une partie, le diagnostic suit la dernière lecture du PC.
  useEffect(() => {
    if (data.demo) return;
    setParts(data.pc.parts);
    setIssues(data.pc.issues);
  }, [data.demo, data.pc]);

  // Une correction prédéfinie, ou une page officielle quand la correction se fait à la main.
  const act = async (issue: PcIssue) => {
    if (!issue.fix && !issue.open) return notify(`${issue.action} : disponible avec la version Windows.`);
    setBusy(issue.title);
    try {
      const result = issue.fix ? await api.applyFix(issue.fix) : await api.openOfficial(issue.open!);
      notify(result.message, result.ok && issue.fix ? { label: 'Voir le journal', href: '#/journal' } : undefined);
      if (issue.fix && !data.demo) await reload();
    } catch {
      notify('La correction n\'a pas pu être appliquée. Rien n\'a été modifié.');
    } finally {
      setBusy(null);
    }
  };
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
            <span className="eyebrow">{checkedAt}</span>
            <h1 className="title">Diagnostic du PC</h1>
            <p className="sub">{allGood ? 'Tout est en ordre.' : `${parts.length - good} points peuvent être améliorés. Rien n'empêche de jouer.`}</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={recheck} disabled={checking}>{checking ? 'Lecture du PC…' : 'Relancer le diagnostic'}</button>
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
              {!data.demo && !issue.guideId && !issue.fix && !issue.open
                ? null
                : issue.guideId
                ? <a className="btn btn-primary" href={`#/guide/${issue.guideId}`}>{issue.action}</a>
                : <button type="button" className="btn btn-primary" onClick={() => void act(issue)} disabled={busy !== null}>{busy === issue.title ? 'En cours…' : issue.action}</button>}
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

      <div className={servers.length > 0 ? 'split even section' : 'section'}>
        {servers.length > 0 && <section>
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
        </section>}
        <section>
          <h2 className="h2">Journal des corrections</h2>
          <p className="small muted" style={{ margin: '6px 0 22px' }}>Tout ce que Warmup a modifié sur ce PC. Chaque correction peut être annulée.</p>
          {journal.length === 0 && <p className="muted">Warmup n'a encore rien modifié sur ce PC.</p>}
          <ol className="tl">
            {journal.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 16 }}>
                  <div className="grow">
                    <div className="strong">{entry.title}</div>
                    <div className="small muted">{entry.detail}</div>
                    {!entry.undone && data.effects?.[entry.id] && <Effect effect={data.effects[entry.id]} />}
                  </div>
                  {entry.undone
                    ? <span className="chip">Annulée</span>
                    : entry.undoable && (
                      <button type="button" className="btn" aria-label={`Annuler : ${entry.title}`} onClick={() => { undoFix(entry.id); notify('Correction annulée, valeur d\'origine rétablie.'); }}>
                        <Icon name="back" size={14} stroke={2} />
                        Annuler
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ol>
          <a className="link" href="#/journal" style={{ display: 'inline-block', marginTop: 16 }}>Tout le journal</a>
        </section>
      </div>

      <section className="section">
        <div className="stats">
          <Stat value={data.week.cleanLaunches} label="Lancements sans incident cette semaine" />
          <Stat value={data.week.fixes} label="Problèmes corrigés avant de jouer" />
          <Stat value={journal.filter((entry) => entry.undoable && !entry.undone).length} label="Corrections en place" />
        </div>
      </section>
    </div>
  );
}
