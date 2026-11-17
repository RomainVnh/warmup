import { useApp } from '../context';
import type { Game } from '../../shared/types';
import { Icon, Logo, type IconName } from '../ui';

// Premiers pas dans une application vierge : ce que Warmup a déjà trouvé, ce qu'il reste à faire,
// et ce qu'il mesurera pendant les parties. Chaque étape se coche d'elle-même, d'après ce qui est réellement lu sur le PC.

interface Step {
  done: boolean;
  title: string;
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

function useSteps(): Step[] {
  const { data, installed, addGame, play } = useApp();
  const games = data.games.filter((g) => installed.has(g.id));
  const issues = data.pc.issues.length + data.pc.parts.filter((p) => p.status === 'warn').length;
  const first: Game | undefined = games[0];
  return [
    {
      done: games.length > 0,
      title: 'Trouver vos jeux',
      text: games.length
        ? `${games.length} jeu${games.length > 1 ? 'x' : ''} trouvé${games.length > 1 ? 's' : ''} sur ce PC. Un jeu manque ? Ajoutez-le à la main.`
        : 'Warmup lit la liste de Steam, GOG, Battle.net et Rockstar, sans rien modifier.',
      action: games.length ? { label: 'Ajouter un jeu', onClick: () => void addGame() } : { label: 'Rechercher les jeux', href: '#/settings/jeux' }
    },
    {
      done: data.pc.parts.length > 0 && issues === 0,
      title: 'Vérifier votre PC',
      text: !data.pc.parts.length
        ? 'Écran, carte graphique, mémoire et disque, lus sans rien modifier.'
        : issues
          ? `${issues} point${issues > 1 ? 's' : ''} à corriger avant de jouer. Chaque correction est expliquée, et annulable.`
          : 'Rien à corriger pour l\'instant. Warmup revérifie avant chaque partie.',
      action: { label: issues ? 'Voir et corriger' : 'Voir le diagnostic', href: '#/diagnostic' }
    },
    {
      done: data.steam.linked,
      title: 'Relier Steam',
      text: data.steam.linked
        ? `Compte ${data.steam.name || 'Steam'} relié : heures, succès et amis viennent de Steam.`
        : 'Pour retrouver vos succès et vos amis. La connexion se fait sur la page officielle de Steam.',
      action: data.steam.linked ? undefined : { label: 'Relier Steam', href: '#/settings/steam' }
    },
    {
      done: data.reports.length > 0,
      title: 'Jouer une première partie',
      text: data.reports.length
        ? 'Votre premier bilan est prêt.'
        : 'Lancez un jeu depuis Warmup : il le vérifie, l\'ouvre, puis prépare le bilan de la partie.',
      action: data.reports.length ? { label: 'Lire le bilan', href: `#/report/${data.reports[0].id}` } : first ? { label: `Jouer à ${first.title}`, onClick: () => play(first) } : undefined
    }
  ];
}

/** Liste « Pour bien démarrer ». Elle disparaît d'elle-même quand tout est fait. */
export function StartSteps({ compact = false }: { compact?: boolean }) {
  const steps = useSteps();
  const done = steps.filter((s) => s.done).length;
  if (compact && done === steps.length) return null;
  return (
    <section className={compact ? '' : 'section'} aria-label="Pour bien démarrer">
      <div className="section-head">
        <h2 className="h2">Pour bien démarrer</h2>
        <span className="start-count" aria-label={`${done} étapes sur ${steps.length} terminées`}>{done} / {steps.length}</span>
      </div>
      <ol className="start-steps">
        {steps.map((step, index) => (
          <li key={step.title} className={`start-step${step.done ? ' done' : ''}`}>
            <span className="start-mark" aria-hidden="true">{step.done ? <Icon name="check" size={15} stroke={2.6} /> : index + 1}</span>
            <div className="start-body">
              <div className="strong">{step.title}<span className="sr-only">{step.done ? ' : fait' : ' : à faire'}</span></div>
              <p className="small muted">{step.text}</p>
            </div>
            {step.action && (step.action.href
              ? <a className={`btn${!step.done && index === steps.findIndex((s) => !s.done) ? ' btn-primary' : ''}`} href={step.action.href}>{step.action.label}</a>
              : <button type="button" className={`btn${!step.done && index === steps.findIndex((s) => !s.done) ? ' btn-primary' : ''}`} onClick={step.action.onClick}>{step.action.label}</button>)}
          </li>
        ))}
      </ol>
    </section>
  );
}

const MEASURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'pulse', title: 'Images par seconde', text: 'La fluidité réelle, et les chutes brusques qui font saccader.' },
  { icon: 'signal', title: 'Ping et pertes réseau', text: 'Pour savoir si un retard vient du réseau ou du PC.' },
  { icon: 'temp', title: 'Température', text: 'Une carte graphique trop chaude ralentit pour se protéger.' },
  { icon: 'chip', title: 'Mémoire et processeur', text: 'Ce que le jeu demande au PC, du début à la fin.' }
];

/** Ce que Warmup relève pendant une partie, avant qu'il y ait des bilans à montrer. */
export function MeasuresExplainer() {
  return (
    <section className="section" aria-label="Ce que Warmup mesure">
      <div className="section-head"><h2 className="h2">Pendant vos parties</h2></div>
      <div className="measures">
        {MEASURES.map((m) => (
          <div key={m.title} className="measure">
            <span className="measure-icon" aria-hidden="true"><Icon name={m.icon} size={18} /></span>
            <div className="strong">{m.title}</div>
            <p className="small muted">{m.text}</p>
          </div>
        ))}
      </div>
      <p className="small muted measures-note">
        <Icon name="lock" size={13} /> Tout est relevé de l'extérieur du jeu : Warmup ne s'y introduit jamais, sans risque avec les anti-triche.
      </p>
    </section>
  );
}

/** Accueil d'une application vierge, quand aucun jeu n'est encore installé. */
export function StartPage() {
  const { data, addGame } = useApp();
  const owned = data.games.filter((g) => !g.installed).length;
  return (
    <div className="page start-page">
      <header className="start-head">
        <Logo size={44} />
        <span className="eyebrow">Bienvenue</span>
        <h1 className="start-title">Chaque partie démarre dans de bonnes conditions.</h1>
        <p className="start-lead">
          Warmup vérifie votre PC avant de jouer, mesure ce qui se passe pendant la partie et vous explique simplement ce qui ne va pas.
          {owned > 0 && ` Vous possédez ${owned} jeu${owned > 1 ? 'x' : ''} qui ne ${owned > 1 ? 'sont' : 'est'} pas encore installé${owned > 1 ? 's' : ''} sur ce PC.`}
        </p>
        <div className="row start-actions">
          <a className="btn btn-primary btn-lg" href="#/settings/jeux"><Icon name="search" size={15} />Rechercher les jeux installés</a>
          <button type="button" className="btn btn-lg" onClick={() => void addGame()}><Icon name="plus" size={15} />Ajouter un jeu</button>
        </div>
      </header>
      <StartSteps />
      <MeasuresExplainer />
      {data.pc.parts.length > 0 && (
        <section className="section" aria-label="Votre PC">
          <div className="section-head"><h2 className="h2">Votre PC</h2><a className="link" href="#/diagnostic">Diagnostic complet</a></div>
          <ul className="start-pc">
            {data.pc.parts.map((part) => (
              <li key={part.name}>
                <span className="eyebrow">{part.name}</span>
                <span className="strong">{part.big}</span>
                <span className={`small pill pill-${part.status}`}><Icon name={part.status === 'ok' ? 'check' : 'warn'} size={12} stroke={2.4} />{part.status === 'ok' ? 'Bon' : 'À corriger'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
