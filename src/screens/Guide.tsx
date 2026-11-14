import { useState } from 'react';
import type { GuideVisual } from '../../shared/types';
import { useApp } from '../context';
import { Icon } from '../ui';

// Illustration d'une étape : un écran schématique, la ligne à repérer en clair, la touche à presser en dessous.
function Visual({ visual }: { visual: GuideVisual }) {
  const top = 74;
  const gap = 44;
  const height = top + visual.lines.length * gap + (visual.key ? 86 : 26);
  return (
    <svg className="guide-visual" viewBox={`0 0 520 ${height}`} role="img" aria-label={`Schéma de l'écran « ${visual.screen} ». À repérer : ${visual.lines[visual.highlight]}${visual.key ? `. Touche : ${visual.key}` : ''}`}>
      <rect x="1" y="1" width="518" height={height - 2} rx="14" className="gv-frame" />
      <circle cx="26" cy="26" r="5" className="gv-dot" />
      <circle cx="44" cy="26" r="5" className="gv-dot" />
      <circle cx="62" cy="26" r="5" className="gv-dot" />
      <text x="88" y="31" className="gv-title">{visual.screen}</text>
      <line x1="1" x2="519" y1="50" y2="50" className="gv-line" />
      {visual.lines.map((line, i) => (
        <g key={line}>
          {i === visual.highlight && <rect x="18" y={top + i * gap - 26} width="484" height="38" rx="8" className="gv-on" />}
          <text x="34" y={top + i * gap} className={i === visual.highlight ? 'gv-text on' : 'gv-text'}>{line}</text>
          {i === visual.highlight && <path d={`M476 ${top + i * gap - 12} l8 6 -8 6`} className="gv-arrow" />}
        </g>
      ))}
      {visual.key && (
        <g>
          <rect x={260 - (visual.key.length * 11 + 44) / 2} y={height - 66} width={visual.key.length * 11 + 44} height="42" rx="9" className="gv-key" />
          <text x="260" y={height - 39} textAnchor="middle" className="gv-keytext">{visual.key}</text>
        </g>
      )}
    </svg>
  );
}

export function GuidePage({ id }: { id: string }) {
  const { data, notify } = useApp();
  const guide = data.guides.find((g) => g.id === id);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());

  if (!guide) {
    return (
      <div className="page">
        <h1 className="title">Guide introuvable</h1>
        <p className="sub">Ce guide n'existe pas ou a été retiré.</p>
        <a className="btn" style={{ marginTop: 20 }} href="#/diagnostic">Retour au diagnostic</a>
      </div>
    );
  }

  const current = guide.steps[step];
  const last = step === guide.steps.length - 1;
  const next = () => {
    setDone((set) => new Set(set).add(step));
    if (last) notify('Guide terminé. Relancez le diagnostic pour vérifier le résultat.', { label: 'Diagnostic', href: '#/diagnostic' });
    else setStep(step + 1);
  };

  return (
    <div className="page">
      <a className="back" href={guide.back.href}><Icon name="back" size={14} stroke={2} />{guide.back.label}</a>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <span className="eyebrow">Guide pas à pas · {guide.duration} · {guide.level}</span>
          <h1 className="title">{guide.title}</h1>
          <p className="sub">{guide.intro}</p>
        </div>
      </div>
      <p className="chip" style={{ whiteSpace: 'normal', padding: '10px 14px', marginBottom: 48 }}><Icon name="check" size={13} stroke={2.4} />{guide.warmupDoes}</p>

      <div className="guide">
        <ol className="guide-steps" aria-label="Étapes du guide">
          {guide.steps.map((s, i) => (
            <li key={s.title}>
              <button type="button" className={`guide-step${i === step ? ' on' : ''}${done.has(i) ? ' done' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                <span className="guide-num">{done.has(i) ? <Icon name="check" size={13} stroke={2.6} /> : i + 1}</span>
                <span>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <section className="guide-main" aria-live="polite">
          <span className="eyebrow">Étape {step + 1} sur {guide.steps.length}</span>
          <h2 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: '10px 0 14px' }}>{current.title}</h2>
          <p className="lead">{current.text}</p>
          {current.tip && <p className="guide-tip"><span className="strong">Bon à savoir. </span>{current.tip}</p>}
          <Visual visual={current.visual} />
          <div className="row" style={{ marginTop: 28 }}>
            <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}><Icon name="back" size={14} stroke={2} />Étape précédente</button>
            <button type="button" className="btn btn-primary" onClick={next}>{last ? 'J\'ai terminé' : 'C\'est fait, étape suivante'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
