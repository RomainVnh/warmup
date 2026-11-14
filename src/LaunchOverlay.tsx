import type { Game } from '../shared/types';
import { GameArt, GameLogo, Icon } from './ui';

export interface LaunchState {
  game: Game;
  step: number;
  phase: 'run' | 'done' | 'game';
  silent: boolean;
}

interface Props {
  launch: LaunchState;
  onSkip(): void;
  onDisable(): void;
  onQuit(): void;
}

// Fenêtre de contrôle avant lancement, puis faux écran de jeu.
// Elle s'affiche avant le jeu, jamais à l'intérieur.
export function LaunchOverlay({ launch, onSkip, onDisable, onQuit }: Props) {
  const { game, step, phase, silent } = launch;
  const steps = game.launch.steps;

  if (phase === 'game') {
    return (
      <div className="game-screen" role="dialog" aria-modal="true" aria-label={`${game.title}, simulation du jeu`}>
        <GameArt game={game} kind="art" />
        <span className="launch-kicker">Simulation · le jeu s'ouvre ici</span>
        <GameLogo game={game} />
        <p className="muted" style={{ maxWidth: 480 }}>
          Warmup reste en dehors du jeu et prépare le bilan de la partie.
        </p>
        <button type="button" className="btn btn-primary" onClick={onQuit} autoFocus>
          Quitter le jeu
        </button>
      </div>
    );
  }

  if (silent) {
    return (
      <div className="silent-chip" role="status">
        <span className="spinner" />
        Contrôle de {game.title} en cours
      </div>
    );
  }

  const percent = Math.round((Math.min(step, steps.length) / steps.length) * 100);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Contrôle avant lancement de ${game.title}`}>
      <div className="launch-win">
        <div className="launch-banner">
          <GameArt game={game} kind="art" />
          <div>
            <div className="launch-kicker">Contrôle avant lancement</div>
            <div className="launch-title">{game.title}</div>
          </div>
        </div>
        <div className="progress" role="progressbar" aria-label="Avancement du contrôle" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="launch-list">
          {steps.map((s, i) => {
            const done = i < step;
            const current = i === step && phase === 'run';
            return (
              <div key={s.name} className={`launch-row${done ? ' done' : ''}`}>
                {current ? <span className="spinner" /> : <Icon name={done ? 'check' : 'dot'} size={14} stroke={2.8} />}
                <span className="name">{s.name}</span>
                <span className="value">{done ? s.value : current ? 'Vérification en cours' : 'En attente'}</span>
                {done && <span className={`tag${s.fixed ? ' fixed' : ''}`}>{s.fixed ? 'Corrigé' : 'Bon'}</span>}
              </div>
            );
          })}
        </div>
        {phase === 'done' && (
          <div className="launch-result" role="status">
            <strong><Icon name="check" size={13} stroke={2.6} />{game.launch.resultTitle}</strong>
            <span>{game.launch.resultText}</span>
          </div>
        )}
        <div className="launch-foot">
          <span className="launch-brand">
            Optimised by <strong>Warmup</strong>
          </span>
          <div className="row">
            <button type="button" className="btn btn-text small" onClick={onDisable}>
              Ne plus afficher
            </button>
            <button type="button" className="btn small" onClick={onSkip}>
              Passer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
