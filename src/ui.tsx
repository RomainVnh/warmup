import { useState, type ReactNode } from 'react';
import type { Game, Status, Tile } from '../shared/types';
import { useApp } from './context';

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  library: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  chat: 'M4 5h16v11H9l-5 4z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  check: 'M5 12l5 5 9-10',
  offline: 'M2 8.8a15 15 0 0 1 20 0M5.3 12.4a10 10 0 0 1 13.4 0M8.7 15.9a5 5 0 0 1 6.6 0M12 19.5h.01M3 3l18 18',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  warn: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  up: 'M12 19V6M6 12l6-6 6 6',
  play: 'M7 4l13 8-13 8z',
  back: 'M15 5l-7 7 7 7',
  star: 'M12 4l2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8z',
  list: 'M4 6h16M4 12h16M4 18h16',
  dot: 'M12 11.5v1',
  thumbUp: 'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  send: 'M5 12h14M13 6l6 6-6 6',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  pause: 'M8 5v14M16 5v14',
  close: 'M6 6l12 12M18 6L6 18',
  folder: 'M3 6h6l2 2h10v11H3z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.2a3.5 3.5 0 0 1 0 6.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  history: 'M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4M12 8v4l3 2',
  thumbDown: 'M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 7 5h10'
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, stroke = 1.8, filled = false }: { name: IconName; size?: number; stroke?: number; filled?: boolean }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function StatusText({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span className={`status status-${status}`}>
      <Icon name={status === 'ok' ? 'check' : 'warn'} size={12} stroke={2.6} />
      {children}
    </span>
  );
}

export function Pill({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span className={`pill pill-${status}`}>
      <Icon name={status === 'ok' ? 'check' : 'warn'} size={13} stroke={2.4} />
      {children}
    </span>
  );
}

export function TileBox({ tile }: { tile: Tile }) {
  return (
    <div className="tile">
      <div className="tile-big">{tile.big}</div>
      <div className="tile-label">{tile.label}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(next: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange(next: T): void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const hoursLabel = (hours: number) => (hours === 0 ? 'Jamais joué' : `${hours} h de jeu`);

// Logo de l'application : trois traits arrondis et penchés, dessinés dans la couleur du texte.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={Math.round((size * 120) / 106)} height={size} viewBox="0 0 120 106" fill="currentColor">
      <rect x="14" y="5" width="20" height="90" rx="10" transform="rotate(14 24 50)" />
      <rect x="50" y="11" width="20" height="90" rx="10" transform="rotate(14 60 56)" />
      <rect x="86" y="5" width="20" height="90" rx="10" transform="rotate(14 96 50)" />
    </svg>
  );
}

// État vide ou erreur : une icône, ce qui se passe en une phrase, et ce que l'on peut faire.
export function EmptyState({ icon, title, children, actions, tone = 'plain' }: { icon: IconName; title: string; children: ReactNode; actions?: ReactNode; tone?: 'plain' | 'warn' }) {
  return (
    <div className={`empty${tone === 'warn' ? ' warn' : ''}`}>
      <span className="empty-icon" aria-hidden="true"><Icon name={icon} size={24} stroke={1.7} /></span>
      <h2 className="empty-title">{title}</h2>
      <p className="empty-text">{children}</p>
      {actions && <div className="row empty-actions">{actions}</div>}
    </div>
  );
}

// Emblème de Coach, l'assistant de Warmup : un anneau ouvert (l'échauffement en cours) autour d'un point.
export const ASSISTANT_NAME = 'Coach';
export function CoachMark({ size = 18, live = false }: { size?: number; live?: boolean }) {
  return (
    <svg className={`coach-mark${live ? ' live' : ''}`} aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path className="coach-ring" d="M16 3.5a12.5 12.5 0 1 1-10.8 6.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.5" fill="currentColor" />
    </svg>
  );
}

// Halo flou tiré d'un visuel, posé derrière le haut de la page.
export function Ambient({ src }: { src?: string }) {
  return <div className="ambient" aria-hidden="true" style={src ? { backgroundImage: `url(${src})` } : { background: 'radial-gradient(closest-side, rgba(150, 170, 255, 0.5), transparent)' }} />;
}

// Jauge circulaire : value entre 0 et 1, le contenu s'affiche au centre.
export function Ring({ value, size = 132, tone = 'plain', label, children }: { value: number; size?: number; tone?: 'plain' | 'ok' | 'warn'; label: string; children: ReactNode }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ${tone}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="value" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Stat({ value, unit, label }: { value: ReactNode; unit?: string; label: string }) {
  return (
    <div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      <div className="eyebrow stat-label">{label}</div>
    </div>
  );
}

// Icône du joueur : son image importée, sinon l'initiale de son pseudo.
export function UserAvatar({ name, image, className = '' }: { name: string; image: string; className?: string }) {
  if (image) return <img className={`avatar ${className}`} src={image} alt="" />;
  return <span className={`avatar ${className}`} aria-hidden="true">{(name[0] ?? 'J').toUpperCase()}</span>;
}

// Réduit une image choisie par le joueur à un carré de 256 px, recadré au centre, pour en faire une icône légère.
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('format'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = 256;
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!context || !side) return reject(new Error('lecture'));
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('lecture'));
    };
    image.src = url;
  });
}

// Visuel d'un jeu. Sans image utilisable, un fond sobre porte le titre.
export function GameArt({ game, kind, className = '', lazy = false }: { game: Game; kind: 'art' | 'cover' | 'featured'; className?: string; lazy?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = kind === 'featured' ? game.featuredArt || game.art : game[kind];
  if (!src || failed) return <div className={`art-fallback ${className}`}>{game.title}</div>;
  return <img className={className} src={src} alt="" loading={lazy ? 'lazy' : undefined} onError={() => setFailed(true)} />;
}

// Logo du jeu sur son visuel, ou son titre écrit quand il n'y a pas de logo.
export function GameLogo({ game, as: Tag = 'div' }: { game: Game; as?: 'h1' | 'div' }) {
  const [failed, setFailed] = useState(false);
  if (!game.logo || failed) return <Tag className="game-logo-text">{game.title}</Tag>;
  return (
    <Tag style={{ margin: 0 }}>
      <img className="game-logo" src={game.logo} alt={game.title} onError={() => setFailed(true)} />
    </Tag>
  );
}

// Bouton principal d'un jeu. Sa couleur dit l'état : vert « Jouer », orange « Corriger et jouer ».
// Un jeu absent du disque propose « Installer », puis l'avancement de son téléchargement.
export function PlayButton({ game, onPlay, small = false }: { game: Game; onPlay(game: Game): void; small?: boolean }) {
  const { installed, notify } = useApp();
  const size = small ? ' sm' : '';
  // Jeu possédé mais absent du disque : Warmup n'installe pas les jeux, c'est le rôle de leur plateforme.
  if (!installed.has(game.id)) {
    return (
      <button type="button" className={`play neutral${size}`} onClick={() => notify(`${game.title} n'est pas installé. Installez-le depuis ${sourceLabel(game.source)} : Warmup le retrouvera à la prochaine analyse.`)}>
        <Icon name="download" size={small ? 14 : 16} stroke={2.2} />
        Non installé
      </button>
    );
  }
  const warn = game.status === 'warn';
  return (
    <button type="button" className={`play${warn ? ' warn' : ''}${size}`} onClick={() => onPlay(game)}>
      <Icon name={warn ? 'warn' : 'play'} size={small ? 14 : 18} filled={!warn} stroke={2.4} />
      {warn ? 'Corriger et jouer' : 'Jouer'}
    </button>
  );
}

export const sourceLabel = (source: Game['source']) => (source === 'Manuel' ? 'Ajouté à la main' : source);

export function GameCard({ game }: { game: Game }) {
  const { installed } = useApp();
  const absent = !installed.has(game.id);
  return (
    <a className={`cover-card${absent ? ' absent' : ''}`} href={`#/game/${game.id}`}>
      <div className="cover">
        <GameArt game={game} kind="cover" lazy />
        {absent && <span className="cover-flag"><Icon name="download" size={13} stroke={2.2} />Non installé</span>}
      </div>
      <div>
        <div className="cover-tag">{game.multiplayer ? 'Multijoueur' : 'Solo'}</div>
        <div className="cover-name">{game.title}</div>
        <div className="cover-meta">
          {absent ? <span>{game.sizeGb} Go à télécharger</span> : game.status === 'warn' ? <StatusText status="warn">{game.statusLabel}</StatusText> : <span>{hoursLabel(game.hours)}</span>}
        </div>
      </div>
    </a>
  );
}
