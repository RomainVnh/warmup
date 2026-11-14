import type { Download } from '../../shared/types';
import { findGame, useApp } from '../context';
import { GameArt, Icon, Ring, Stat } from '../ui';

const gb = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;

function remaining(job: Download, speed: number): string {
  const seconds = Math.round(((job.sizeGb - job.doneGb) * 1000) / speed);
  if (seconds < 60) return `${seconds} s restantes`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min restantes`;
  return `${Math.floor(seconds / 3600)} h ${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')} restantes`;
}

export function Downloads() {
  const { data, downloads, installed, install, setDownloadPaused, removeDownload } = useApp();
  const { speedMbPerSec, diskFreeGb, diskTotalGb } = data.downloads;
  const active = downloads.find((d) => d.state === 'active');
  const waiting = downloads.filter((d) => d.state === 'queued' || d.state === 'paused');
  const done = downloads.filter((d) => d.state === 'done');
  const pendingGb = downloads.filter((d) => d.state !== 'done').reduce((sum, d) => sum + (d.sizeGb - d.doneGb), 0);
  const freeAfter = diskFreeGb - pendingGb;
  const absent = data.games.filter((g) => !installed.has(g.id) && !downloads.some((d) => d.gameId === g.id && d.kind === 'install' && d.state !== 'done'));
  const used = diskTotalGb - diskFreeGb;

  const row = (job: Download, state: string) => {
    const game = findGame(data, job.gameId);
    if (!game) return null;
    const percent = Math.floor((job.doneGb / job.sizeGb) * 100);
    return (
      <div key={job.id} className="list-row" style={{ gap: 16 }}>
        <span className="thumb-sq"><GameArt game={game} kind="cover" lazy className="fill" /></span>
        <div className="grow">
          <a className="strong" href={`#/game/${game.id}`}>{game.title}</a>
          <div className="small muted">{job.label} · {state}</div>
          {job.state !== 'done' && <div className="meter" style={{ marginTop: 10, maxWidth: 460 }} role="img" aria-label={`${percent} % téléchargés`}><i style={{ width: `${percent}%` }} /></div>}
        </div>
        <span className="muted" style={{ width: 150, textAlign: 'right' }}>{job.state === 'done' ? gb(job.sizeGb) : `${gb(job.doneGb)} sur ${gb(job.sizeGb)}`}</span>
        {job.state !== 'done' && (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button type="button" className="btn btn-icon" title={job.state === 'paused' ? 'Reprendre' : 'Mettre en pause'} aria-label={`${job.state === 'paused' ? 'Reprendre' : 'Mettre en pause'} : ${game.title}`} onClick={() => setDownloadPaused(job.id, job.state !== 'paused')}>
              <Icon name={job.state === 'paused' ? 'play' : 'pause'} size={14} filled={job.state === 'paused'} stroke={2.2} />
            </button>
            <button type="button" className="btn btn-icon" title="Retirer de la file" aria-label={`Retirer de la file : ${game.title}`} onClick={() => removeDownload(job.id)}>
              <Icon name="close" size={14} stroke={2.2} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 36 }}>
          <Ring value={used / diskTotalGb} tone={freeAfter < 50 ? 'warn' : 'plain'} label={`${Math.round((used / diskTotalGb) * 100)} % du disque utilisé`}>
            <strong>{Math.round(diskFreeGb)}</strong>
            <span>Go libres</span>
          </Ring>
          <div>
            <span className="eyebrow">{active ? 'Téléchargement en cours' : waiting.length ? 'File en attente' : 'Rien en cours'}</span>
            <h1 className="title">Téléchargements</h1>
            <p className="sub">Les téléchargements se mettent en pause tout seuls quand vous lancez un jeu, puis reprennent à la fin de la partie.</p>
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat value={active ? speedMbPerSec : 0} unit="Mo/s" label="Vitesse actuelle" />
        <Stat value={gb(pendingGb)} label="Reste à télécharger" />
        <Stat value={gb(Math.max(0, freeAfter))} label="Place libre une fois terminé" />
        <Stat value={gb(diskTotalGb)} label="Taille du disque de jeux" />
      </div>

      <section className="section">
        <h2 className="h2" style={{ marginBottom: 8 }}>En cours</h2>
        {active ? row(active, `${speedMbPerSec} Mo/s · ${remaining(active, speedMbPerSec)}`) : <p className="muted" style={{ paddingTop: 12 }}>Aucun téléchargement en cours.</p>}
      </section>

      {waiting.length > 0 && (
        <section className="section">
          <h2 className="h2" style={{ marginBottom: 8 }}>File d'attente · {waiting.length}</h2>
          {waiting.map((job) => row(job, job.state === 'paused' ? 'en pause' : 'en attente'))}
        </section>
      )}

      {absent.length > 0 && (
        <section className="section">
          <h2 className="h2" style={{ marginBottom: 8 }}>Jeux possédés, pas encore installés · {absent.length}</h2>
          {absent.map((game) => (
            <div key={game.id} className="list-row" style={{ gap: 16 }}>
              <span className="thumb-sq"><GameArt game={game} kind="cover" lazy className="fill" /></span>
              <div className="grow">
                <a className="strong" href={`#/game/${game.id}`}>{game.title}</a>
                <div className="small muted">{game.genre}</div>
              </div>
              <span className={game.sizeGb > freeAfter ? 'status status-warn' : 'muted'} style={{ width: 230, textAlign: 'right', justifyContent: 'flex-end' }}>
                {game.sizeGb > freeAfter ? <><Icon name="warn" size={13} stroke={2.4} />{gb(game.sizeGb)} : place insuffisante</> : gb(game.sizeGb)}
              </span>
              <button type="button" className="btn" disabled={game.sizeGb > freeAfter} onClick={() => install(game)}><Icon name="download" size={14} stroke={2.2} />Installer</button>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <h2 className="h2" style={{ marginBottom: 8 }}>Terminés</h2>
        {done.length === 0 && <p className="muted" style={{ paddingTop: 12 }}>Aucun téléchargement terminé récemment.</p>}
        {done.map((job) => row(job, `terminé ${job.when.toLowerCase()}`))}
      </section>
    </div>
  );
}
