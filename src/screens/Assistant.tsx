import { useApp } from '../context';
import { Ambient, ASSISTANT_NAME, CoachMark, Icon } from '../ui';

const CONTEXT = ['Changements depuis la dernière partie réussie', 'Rapport du dernier plantage', 'Mods et leurs versions', 'État du réseau et du PC', 'Corrections déjà tentées'];
const IDEAS = ['Pourquoi mon jeu saccade le soir ?', 'Quel mod a cassé ma sauvegarde ?', 'Mon écran est-il bien réglé ?'];

// Écran de démonstration : la conversation est écrite d'avance.
// L'assistant réel passera par un serveur, jamais par une clé rangée dans l'appli.
export function Assistant() {
  const { notify } = useApp();
  const later = () => notify(`${ASSISTANT_NAME} sera branché dans une prochaine étape.`);
  return (
    <div className="page">
      <Ambient />
      <div className="chat">
        <header style={{ textAlign: 'center', padding: '24px 0 12px' }}>
          <span className="coach-badge"><CoachMark size={26} live /></span>
          <span className="eyebrow">{ASSISTANT_NAME} · l'assistant de Warmup</span>
          <h1 className="title" style={{ marginTop: 10 }}>Dites-moi ce qui ne va pas</h1>
          <p className="sub" style={{ margin: '10px auto 0' }}>Je regarde d'abord ce qui a changé sur votre PC, puis je vous réponds en clair. Ci-dessous, un exemple de conversation.</p>
        </header>

        <div className="msg me"><p>Cyberpunk 2077 plante encore au chargement de ma sauvegarde.</p></div>

        <div className="msg">
          <span className="row coach-line">
            <CoachMark size={16} />
            <strong>{ASSISTANT_NAME}</strong>
            <span className="small muted">a vérifié 5 éléments en 2 secondes</span>
          </span>
          <p className="msg-body">
            J'ai trouvé. Le plantage date de la mise à jour 2.5 du jeu, installée hier à 18 h 04. Deux de vos mods, <strong>Vivid Streets</strong> et <strong>Night City Traffic</strong>, dépendent de l'ancien moteur de scripts et n'ont pas encore été mis à jour par leurs auteurs. Votre sauvegarde, elle, est intacte.
          </p>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="chip">Version 2.4 → 2.5</span>
            <span className="chip warn"><Icon name="warn" size={12} stroke={2.4} />2 mods incompatibles</span>
            <span className="chip">Signalé par 312 joueurs</span>
          </div>
        </div>

        <div className="proposal">
          <span className="eyebrow">Ce que je propose</span>
          <p style={{ fontSize: 18, fontWeight: 500, margin: '10px 0 6px' }}>Désactiver ces 2 mods, puis relancer le jeu pour vérifier</p>
          <p className="muted">Je ne touche à rien d'autre. L'action est notée dans le journal et vous pouvez l'annuler à tout moment.</p>
          <div className="row" style={{ marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={() => notify('Action appliquée dans la démonstration. Rien n\'a été modifié sur ce PC.')}>Appliquer</button>
            <a className="btn" href="#/mods">Voir les mods concernés</a>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            {IDEAS.map((idea) => <button key={idea} type="button" className="chip" style={{ minHeight: 44, background: 'transparent', cursor: 'pointer' }} onClick={later}>{idea}</button>)}
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); later(); }}>
            <input type="text" aria-label={`Votre message à ${ASSISTANT_NAME}`} placeholder={`Écrivez à ${ASSISTANT_NAME} : décrivez le problème`} />
            <button type="submit" aria-label="Envoyer"><Icon name="send" size={18} stroke={2} /></button>
          </form>
        </div>

        <footer style={{ paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <span className="eyebrow" style={{ marginBottom: 12 }}>Ce que {ASSISTANT_NAME} voit</span>
          <div className="row">
            {CONTEXT.map((c) => <span key={c} className="chip"><Icon name="check" size={12} stroke={2.6} />{c}</span>)}
          </div>
          <p className="small muted" style={{ marginTop: 16, maxWidth: '70ch' }}>
            Je lis tout, mais je n'agis qu'à travers les corrections annulables de Warmup, et seulement avec votre accord. Quand je ne sais pas, je le dis. Les journaux envoyés sont nettoyés de vos informations personnelles. <a href="#/settings" style={{ textDecoration: 'underline' }}>Gérer mes données</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
