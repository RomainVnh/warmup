import type { ReportSeries, ReportTimeline } from '../shared/types';
import { Icon } from './ui';

// Graphique du bilan : une courbe par mesure (images par seconde, ping, température), alignées sur le même temps,
// avec les moments où la partie a décroché marqués d'un trait et d'un numéro.

function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)} `;
    open = true;
  });
  return d.trim();
}

function Series({ series, length, marks }: { series: ReportSeries; length: number; marks: ReportTimeline['marks'] }) {
  const found = series.values.filter((v): v is number => v !== null);
  const top = Math.max(series.limit, ...found) * 1.15 || 1;
  const x = (i: number) => (length > 1 ? (i / (length - 1)) * 100 : 50);
  const y = (v: number) => 100 - (v / top) * 100;
  const avg = Math.round(found.reduce((a, b) => a + b, 0) / Math.max(1, found.length));
  const worst = series.above ? Math.max(...found) : Math.min(...found);
  const mine = marks.filter((m) => m.kind === series.key);
  const lost = series.key === 'ping' ? series.values.filter((v) => v === null).length : 0;
  const summary = `En moyenne ${avg} ${series.unit}, ${series.above ? 'au plus haut' : 'au plus bas'} ${worst} ${series.unit}${lost ? `, ${lost} moment${lost > 1 ? 's' : ''} sans réponse` : ''}.`;
  return (
    <div className="tline-series">
      <div className="tline-head">
        <span className="eyebrow">{series.label}</span>
        <span className="small muted">{summary}</span>
      </div>
      <div className="tline-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${series.label}. ${summary}`}>
          <line className="tline-limit" x1="0" x2="100" y1={y(series.limit)} y2={y(series.limit)} />
          <path className="tline-line" d={path(series.values, x, y)} />
        </svg>
        {mine.map((m) => {
          const v = series.values[m.index];
          return v === null
            ? <span key={m.index} className="tline-dot lost" style={{ left: `${x(m.index)}%`, top: '50%' }} />
            : <span key={m.index} className="tline-dot" style={{ left: `${x(m.index)}%`, top: `${y(v)}%` }} />;
        })}
        <span className="tline-limit-label small">{series.above ? 'Seuil' : 'Chute sous'} {series.limit} {series.unit}</span>
      </div>
    </div>
  );
}

export function Timeline({ timeline }: { timeline: ReportTimeline }) {
  const { length, marks } = timeline;
  const x = (i: number) => (length > 1 ? (i / (length - 1)) * 100 : 50);
  return (
    <section className="section" aria-label="Déroulé de la partie">
      <div className="block-head">
        <h2 className="h2">Déroulé de la partie</h2>
        <span className="small muted">{marks.length ? `${marks.length} moment${marks.length > 1 ? 's' : ''} à signaler` : 'Aucune chute repérée'}</span>
      </div>
      <div className="tline">
        <div className="tline-marks" aria-hidden="true">
          {marks.map((m, n) => {
            // Deux moments très proches : le second numéro descend d'un cran pour rester lisible.
            const close = n > 0 && x(m.index) - x(marks[n - 1].index) < 3;
            return <span key={`${m.kind}-${m.index}`} className={`tline-mark${close ? ' low' : ''}`} style={{ left: `${x(m.index)}%` }}><b>{n + 1}</b></span>;
          })}
        </div>
        {timeline.series.map((s) => <Series key={s.key} series={s} length={length} marks={marks} />)}
        <div className="axis">{timeline.axis.map((label, i) => <span key={i}>{label}</span>)}</div>
      </div>
      {marks.length > 0 && (
        <ol className="tline-list">
          {marks.map((m, n) => (
            <li key={`${m.kind}-${m.index}`}>
              <b className="tline-num">{n + 1}</b>
              <span className="eyebrow">{m.time}</span>
              <span><Icon name="warn" size={13} stroke={2.2} /> {m.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
