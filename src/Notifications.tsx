import { useEffect, useRef, useState } from 'react';
import type { Notice, NoticeKind, Snapshot } from '../shared/types';
import { findGame, useApp } from './context';
import { GameArt, Icon, type IconName } from './ui';

const KIND: Record<NoticeKind, { icon: IconName; label: string }> = {
  update: { icon: 'download', label: 'Mises à jour' },
  friend: { icon: 'users', label: 'Amis' },
  achievement: { icon: 'trophy', label: 'Succès' },
  fix: { icon: 'check', label: 'Corrections' }
};
const FILTERS: ('all' | NoticeKind)[] = ['all', 'update', 'friend', 'achievement', 'fix'];

// Illustration d'une notification : l'icône réelle du succès, l'avatar de l'ami ou la jaquette du jeu.
// Une petite pastille rappelle la catégorie. Sans jeu ni ami, il reste le pictogramme seul.
function NoticeArt({ notice, data }: { notice: Notice; data: Snapshot }) {
  const game = notice.gameId ? findGame(data, notice.gameId) : undefined;
  const achievement = notice.kind === 'achievement' && game
    ? game.achievements.list.find((a) => a.name === notice.achievement) ?? game.achievements.list.find((a) => a.when && a.icon)
    : undefined;
  const badge = <span className="notice-badge"><Icon name={KIND[notice.kind].icon} size={10} stroke={2.4} /></span>;

  if (achievement?.icon) return <span className="notice-art"><img src={achievement.icon} alt="" loading="lazy" />{badge}</span>;
  if (notice.friend) {
    return (
      <span className="notice-art round">
        <span className="avatar on" aria-hidden="true">{notice.friend[0]}</span>
        {game && <span className="notice-mini"><GameArt game={game} kind="cover" lazy /></span>}
      </span>
    );
  }
  if (game) return <span className="notice-art"><GameArt game={game} kind="cover" lazy />{badge}</span>;
  return <span className="notice-icon"><Icon name={KIND[notice.kind].icon} size={15} stroke={2} /></span>;
}

// Cloche de la barre du haut : mises à jour terminées, amis en ligne, succès obtenus, corrections appliquées.
export function NotificationBell() {
  const { data, notices, markNoticesRead } = useApp();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | NoticeKind>('all');
  const boxRef = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => n.unread).length;
  const shown = notices.filter((n) => filter === 'all' || n.kind === filter);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onHash = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open]);

  return (
    <div className="bell" ref={boxRef}>
      <button type="button" className={`top-icon${open ? ' active' : ''}`} title="Notifications" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} non lues` : 'Notifications'} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" size={16} />
        {unread > 0 && <span className="top-count">{unread}</span>}
      </button>
      {open && (
        <section className="bell-panel" aria-label="Notifications">
          <div className="bell-head">
            <h2 className="h2">Notifications</h2>
            {unread > 0 && <button type="button" className="link" onClick={markNoticesRead}>Tout marquer comme lu</button>}
          </div>
          <div className="seg" role="group" aria-label="Filtrer les notifications">
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'Tout' : KIND[f].label}</button>
            ))}
          </div>
          <div className="bell-list">
            {shown.length === 0 && <p className="muted" style={{ padding: '18px 0' }}>Rien dans cette catégorie.</p>}
            {shown.map((n) => (
              <a key={n.id} className={`notice${n.unread ? ' unread' : ''}`} href={n.href}>
                <NoticeArt notice={n} data={data} />
                <span className="notice-body">
                  <span className="strong">{n.title}</span>
                  <span className="small muted">{n.text}</span>
                  <span className="eyebrow" style={{ marginTop: 4 }}>{n.when}{n.unread ? ' · non lu' : ''}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
