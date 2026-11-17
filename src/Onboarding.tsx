import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isEmail, LINKABLE, type DetectionReport, type Linkable } from '../shared/types';
import { api } from './api';
import { findGame, useApp } from './context';
import { fileToAvatar, GameArt, Icon, Logo, Toggle, UserAvatar } from './ui';

// Parcours de premier lancement : compte, analyse du PC, jeux installés, comptes à relier, préférences.
// Chaque étape peut être remise à plus tard ; tout se retrouve ensuite dans les réglages.

const STEPS = ['Bienvenue', 'Compte', 'Votre PC', 'Vos jeux', 'Plateformes', 'Préférences', 'Terminé'] as const;

export const PLATFORM_TEXT: Record<Linkable, string> = {
  Steam: 'Bibliothèque, heures de jeu, succès et amis.',
  Epic: 'Bibliothèque et amis Epic Games.',
  GOG: 'Bibliothèque et succès GOG Galaxy.',
  'Battle.net': 'Jeux Blizzard et Call of Duty, amis Battle.net.',
  Rockstar: 'Jeux du Rockstar Games Launcher.',
  Riot: 'Valorant et les jeux Riot, amis Riot.',
  PlayStation: 'Amis et parties en cours sur console.',
  Xbox: 'Amis Xbox et jeux du Game Pass PC.'
};

type AccountMode = 'create' | 'signin';

// Après une déconnexion, le parcours se rouvre directement sur l'étape Compte, seule.
let accountOnlyNext = false;
export const openAccountStep = (): void => { accountOnlyNext = true; };

export function Onboarding() {
  const { data, account, updateAccount, settings, updateSettings } = useApp();
  // Compte seul : après une déconnexion, ou si la configuration est déjà faite mais que personne n'est connecté.
  const [accountOnly] = useState(accountOnlyNext || (account.onboarded && !account.signedIn));
  const [step, setStep] = useState(accountOnly ? 1 : 0);
  // La demande d'ouverture sur l'étape Compte ne vaut qu'une fois.
  useEffect(() => {
    accountOnlyNext = false;
  }, []);
  const [pcDone, setPcDone] = useState(false);
  const [detection, setDetection] = useState<DetectionReport | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // À chaque étape, le titre reçoit le focus : les lecteurs d'écran annoncent où l'on est.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Version vierge : relier une plateforme n'existe pas encore pour de vrai, l'étape n'est pas proposée.
  const visible = STEPS.map((name, index) => ({ name, index })).filter((item) => data.demo || item.name !== 'Plateformes');
  const position = Math.max(0, visible.findIndex((item) => item.index === step));
  const next = () => setStep(visible[Math.min(visible.length - 1, position + 1)].index);
  const back = () => setStep(visible[Math.max(0, position - 1)].index);
  const finish = () => {
    accountOnlyNext = false;
    updateAccount({ onboarded: true });
  };

  const warnParts = data.pc.parts.filter((p) => p.status === 'warn').length;
  const title = (text: string) => <h1 className="ob-title" ref={headingRef} tabIndex={-1}>{text}</h1>;

  let body: ReactNode;
  let primary: { label: string; action(): void; disabled?: boolean } | null = { label: 'Continuer', action: next };
  let later: string | null = null;

  switch (step) {
    case 0:
      primary = { label: 'Commencer', action: next };
      body = (
        <>
          <span className="ob-logo"><Logo size={44} /></span>
          {title('Bienvenue dans Warmup')}
          <p className="ob-lead">Chaque jeu démarre dans de bonnes conditions. En cas de problème, Warmup sait pourquoi, l'explique simplement et le répare.</p>
          <ul className="ob-points">
            <li><Icon name="check" size={14} stroke={2.4} /><span><strong>Votre PC.</strong> Warmup regarde votre matériel et ses réglages, sans rien modifier.</span></li>
            <li><Icon name="check" size={14} stroke={2.4} /><span><strong>Vos jeux.</strong> Il retrouve ceux qui sont déjà installés.</span></li>
            <li><Icon name="check" size={14} stroke={2.4} /><span><strong>Vos comptes.</strong> Vous reliez vos plateformes maintenant ou plus tard.</span></li>
          </ul>
          <p className="small muted">Environ deux minutes. Après la création du compte, chaque étape peut être remise à plus tard.</p>
        </>
      );
      break;

    case 1:
      primary = account.signedIn ? { label: accountOnly ? 'Ouvrir Warmup' : 'Continuer', action: accountOnly ? finish : next } : null;
      body = (
        <>
          {title('Votre compte Warmup')}
          <p className="ob-lead">Warmup s'utilise avec un compte : il garde votre carte de joueur, vos réglages et vos collections d'un PC à l'autre.</p>
          <AccountStep />
        </>
      );
      break;

    case 2:
      primary = { label: 'Continuer', action: next, disabled: !pcDone };
      body = (
        <>
          {title('Votre PC')}
          <p className="ob-lead">Warmup lit la configuration de ce PC pour savoir ce qu'il peut faire tourner et ce qui peut gêner un jeu. Rien n'est modifié.</p>
          <PcStep done={pcDone} onDone={() => setPcDone(true)} />
        </>
      );
      break;

    case 3:
      primary = { label: 'Continuer', action: next, disabled: !detection };
      body = (
        <>
          {title('Vos jeux installés')}
          <p className="ob-lead">Warmup lit la liste tenue par Steam, GOG, Battle.net et Rockstar. Aucun jeu n'est ouvert et aucun compte n'est consulté.</p>
          <GamesStep report={detection} onReport={setDetection} />
        </>
      );
      break;

    case 4:
      later = account.linked.length === 0 ? 'Plus tard' : null;
      primary = account.linked.length === 0 ? null : { label: 'Continuer', action: next };
      body = (
        <>
          {title('Relier vos plateformes')}
          <p className="ob-lead">Relier un compte ajoute vos jeux possédés, vos heures, vos succès et vos amis. La page officielle de la plateforme s'ouvre : Warmup ne voit jamais votre mot de passe.</p>
          <LinkStep linked={account.linked} onChange={(linked) => updateAccount({ linked })} />
          <p className="small muted">Vous pourrez relier ou retirer un compte à tout moment dans Réglages. Version de démonstration : aucune page de connexion ne s'ouvre encore.</p>
        </>
      );
      break;

    case 5:
      body = (
        <>
          {title('Vos préférences')}
          <p className="ob-lead">Quelques choix pour commencer. Ils se changent ensuite dans Réglages.</p>
          <div className="ob-list">
            <PrefRow label="Afficher la fenêtre de lancement" text="Deux à trois secondes avant chaque jeu, pour voir ce qui a été vérifié." checked={settings.launchWindow} onChange={(v) => updateSettings({ launchWindow: v })} />
            {data.demo && <PrefRow label="Demander mon accord avant chaque correction" text="Warmup montre ce qui va changer et attend votre réponse. Tout reste annulable." checked={settings.askBeforeFix} onChange={(v) => updateSettings({ askBeforeFix: v })} />}
            <PrefRow label="Ouvrir Warmup au démarrage de Windows" text="L'application reste discrète dans la zone de notification." checked={settings.startWithWindows} onChange={(v) => updateSettings({ startWithWindows: v })} />
          </div>
        </>
      );
      break;

    default:
      primary = { label: 'Ouvrir Warmup', action: finish };
      body = (
        <>
          {title('Tout est prêt')}
          <p className="ob-lead">Voici ce que Warmup a retenu. Vous pouvez revenir sur chaque point dans Réglages.</p>
          <dl className="ob-summary">
            <div><dt>Compte</dt><dd>{account.email}</dd></div>
            <div><dt>PC</dt><dd>{pcDone ? `${data.pc.parts.length} éléments vérifiés, ${warnParts} à améliorer` : 'Analyse remise à plus tard'}</dd></div>
            <div><dt>Jeux</dt><dd>{detection ? `${detection.games.length} jeux trouvés sur ce PC` : 'Recherche remise à plus tard'}</dd></div>
            {data.demo && <div><dt>Plateformes</dt><dd>{account.linked.length ? account.linked.join(', ') : 'Aucune reliée pour l\'instant'}</dd></div>}
          </dl>
        </>
      );
  }

  return (
    <div className="ob">
      <aside className="ob-side" aria-label="Étapes de la configuration">
        <span className="ob-brand"><Logo size={22} /><span>Warmup</span></span>
        {!accountOnly && <ol className="ob-steps">
          {visible.map(({ name, index }, order) => (
            <li key={name} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
              <span className="ob-step-mark">{index < step ? <Icon name="check" size={11} stroke={3} /> : order + 1}</span>
              {name}
            </li>
          ))}
        </ol>}
        {accountOnly && <p className="muted">Vous êtes déconnecté. Connectez-vous ou créez un compte pour rouvrir Warmup : vos jeux et vos réglages sont restés sur ce PC.</p>}
        {!accountOnly && account.signedIn && step < STEPS.length - 1 && <button type="button" className="link ob-skip" onClick={finish}>Passer la configuration</button>}
      </aside>

      <main className="ob-main">
        <div className="ob-body" key={step}>
          <span className="eyebrow">{accountOnly ? 'Connexion' : `Étape ${position + 1} sur ${visible.length}`}</span>
          {body}
        </div>
        <div className="ob-foot">
          {step > 0 && !accountOnly ? <button type="button" className="btn" onClick={back}>Retour</button> : <span />}
          <div className="row" style={{ gap: 12 }}>
            {later && <button type="button" className="btn" onClick={accountOnly ? finish : next}>{later}</button>}
            {primary && <button type="button" className="btn btn-primary" onClick={primary.action} disabled={primary.disabled}>{primary.label}</button>}
          </div>
        </div>
      </main>
    </div>
  );
}

// Étape Compte : à gauche le formulaire, à droite la carte de joueur qui se met à jour pendant la saisie.
// Connexion sans mot de passe : un lien est envoyé à l'adresse indiquée.
// Le compte est obligatoire : sans lui, on ne peut pas aller plus loin.
function AccountStep() {
  const { data, account, updateAccount, profileCard, updateProfileCard, online } = useApp();
  const [mode, setMode] = useState<AccountMode>(account.onboarded ? 'signin' : 'create');
  const [mail, setMail] = useState(account.email);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  // Service en ligne : quand il est configuré, l'adresse est prouvée par un code à 6 chiffres reçu par e-mail.
  const [service, setService] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.getAccountService().then((info) => setService(info.online)).catch(() => undefined);
  }, []);

  const sendCode = async (value: string) => {
    setBusy(true);
    const result = await api.requestLoginCode(value).catch(() => ({ ok: false, message: 'Le code n\'a pas pu être envoyé.' }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setError('');
    setCode('');
    setSent(true);
  };
  const checkCode = async () => {
    setBusy(true);
    const result = await api.verifyLoginCode(mail, code).catch(() => ({ ok: false, message: 'La vérification n\'a pas abouti.' }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setError('');
    updateAccount({ email: mail }); // la partie système a déjà ouvert la session : on relit le compte et la bibliothèque
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const mostPlayed = [...data.games].sort((a, b) => b.hours - a.hours);
  const banners = mostPlayed.slice(0, 6);
  const banner = findGame(data, profileCard.bannerGameId) ?? mostPlayed[0];
  const shownName = profileCard.name || 'Votre pseudo';
  const validMail = isEmail(mail.trim().toLowerCase());

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    fileToAvatar(file).then(
      (avatar) => {
        setAvatarError('');
        updateProfileCard({ avatar });
      },
      () => setAvatarError('Cette image ne peut pas être utilisée. Choisissez un fichier JPEG, PNG ou WebP.')
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = mail.trim().toLowerCase();
    if (mode === 'create' && !profileCard.name.trim()) {
      setError('Choisissez un pseudo pour créer votre compte.');
      return;
    }
    if (!isEmail(value)) {
      setError('Cette adresse ne semble pas complète. Exemple : prenom@exemple.fr');
      return;
    }
    if (!online) {
      setError('Pas de connexion internet : le lien de connexion ne peut pas être envoyé pour l\'instant. Vérifiez le Wi-Fi ou le câble, puis réessayez.');
      return;
    }
    setError('');
    setMail(value);
    if (service) {
      void sendCode(value);
      return;
    }
    // Sans service en ligne, version vierge : le compte est créé sur ce PC tout de suite. L'envoi d'un lien par e-mail viendra avec le service en ligne.
    if (!data.demo) {
      updateAccount({ email: value, signedIn: true });
      return;
    }
    setSent(true);
  };

  const card = (
    <aside className="ob-player" aria-label="Aperçu de votre carte de joueur">
      <span className="eyebrow">Votre carte de joueur</span>
      <div className="ob-player-card">
        <div className="ob-player-banner">{banner && <GameArt game={banner} kind="art" />}</div>
        <div className="ob-player-id">
          <UserAvatar name={profileCard.name || 'J'} image={profileCard.avatar} className="lg" />
          <div style={{ minWidth: 0 }}>
            <div className={`ob-player-name${profileCard.name ? '' : ' empty'}`}>{shownName}</div>
            <div className="small muted ob-player-line">{profileCard.tagline || 'Votre phrase de profil'}</div>
          </div>
        </div>
        <div className="ob-player-meta">
          <span className="chip">{account.signedIn ? 'Compte Warmup' : mode === 'create' ? 'Nouveau joueur' : 'De retour'}</span>
          {(account.signedIn || validMail) && <span className="chip ob-player-mail">{account.signedIn ? account.email : mail.trim().toLowerCase()}</span>}
        </div>
      </div>
      <p className="small muted">C'est ce que verront vos amis. Vous pourrez tout changer depuis votre profil.</p>
    </aside>
  );

  let main: ReactNode;
  if (account.signedIn) {
    main = (
      <div className="ob-card">
        <span className="status status-ok"><Icon name="check" size={12} stroke={2.6} />Connecté</span>
        <p className="strong" style={{ fontSize: 20, margin: '10px 0 6px' }}>{profileCard.name ? `Bienvenue, ${profileCard.name}` : 'Bienvenue'}</p>
        <p className="muted" style={{ marginBottom: 14 }}>{account.email}</p>
        <button type="button" className="link" onClick={() => { setSent(false); updateAccount({ email: '', signedIn: false }); }}>Utiliser un autre compte</button>
      </div>
    );
  } else if (sent && service) {
    main = (
      <div className="ob-card" aria-live="polite">
        <span className="eyebrow">Code envoyé</span>
        <p className="strong" style={{ fontSize: 18, margin: '10px 0 6px' }}>Saisissez le code reçu à {mail}</p>
        <p className="muted">Un code à 6 chiffres, valable 15 minutes. Pensez à regarder dans les courriers indésirables.</p>
        <label className="ob-field" style={{ marginTop: 16, maxWidth: 220 }}>
          <span>Code de connexion</span>
          <span className="field"><input type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={code} placeholder="000000" aria-invalid={error ? true : undefined} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.replace(/\s/g, '').length === 6 && void checkCode()} /></span>
        </label>
        {error && <p className="status status-warn" role="alert" style={{ marginTop: 10 }}><Icon name="warn" size={12} stroke={2.6} />{error}</p>}
        <div className="row" style={{ marginTop: 18, gap: 12 }}>
          <button type="button" className="btn btn-primary" disabled={busy || code.replace(/\s/g, '').length !== 6} onClick={() => void checkCode()}>{busy ? 'Vérification…' : 'Se connecter'}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void sendCode(mail)}>Renvoyer un code</button>
          <button type="button" className="btn" disabled={busy} onClick={() => { setSent(false); setError(''); }}>Changer d'adresse</button>
        </div>
      </div>
    );
  } else if (sent) {
    main = (
      <div className="ob-card" aria-live="polite">
        <span className="eyebrow">Lien envoyé</span>
        <p className="strong" style={{ fontSize: 18, margin: '10px 0 6px' }}>Ouvrez le lien reçu à {mail}</p>
        <p className="muted">Il est valable 15 minutes et vous connecte sans mot de passe.</p>
        <p className="small muted" style={{ marginTop: 10 }}>Version de démonstration : aucun e-mail n'est réellement envoyé.</p>
        <div className="row" style={{ marginTop: 18, gap: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => updateAccount({ email: mail, signedIn: true })}>J'ai ouvert le lien</button>
          <button type="button" className="btn" onClick={() => setSent(false)}>Changer d'adresse</button>
        </div>
      </div>
    );
  } else {
    main = (
      <form className="ob-form" onSubmit={submit} noValidate>
        <div className="ob-choice" role="group" aria-label="Se connecter ou créer un compte">
          <button type="button" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setError(''); }}>
            <Icon name="users" size={18} />
            <span><strong>Se connecter</strong><small>J'ai déjà un compte</small></span>
          </button>
          <button type="button" aria-pressed={mode === 'create'} onClick={() => { setMode('create'); setError(''); }}>
            <Icon name="plus" size={18} />
            <span><strong>Créer un compte</strong><small>Première fois ici</small></span>
          </button>
        </div>

        {mode === 'signin' && <p className="muted" style={{ margin: 0 }}>Content de vous revoir. Indiquez votre adresse : vos réglages, vos collections et votre profil reviennent sur ce PC.</p>}

        {mode === 'create' && (
          <>
            <div className="ob-avatar-row">
              <UserAvatar name={profileCard.name || 'J'} image={profileCard.avatar} className="lg" />
              <div className="row" style={{ gap: 10 }}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>{profileCard.avatar ? 'Changer d\'icône' : 'Importer une icône'}</button>
                {profileCard.avatar && <button type="button" className="btn" onClick={() => updateProfileCard({ avatar: '' })}>Retirer</button>}
              </div>
            </div>
            {avatarError && <p className="status status-warn" role="alert"><Icon name="warn" size={12} stroke={2.6} />{avatarError}</p>}

            <label className="ob-field">
              <span>Pseudo</span>
              <span className="field"><input type="text" value={profileCard.name} maxLength={24} autoComplete="nickname" placeholder="Le nom que verront vos amis" onChange={(e) => updateProfileCard({ name: e.target.value })} /></span>
            </label>
            <label className="ob-field">
              <span>Phrase de profil <em className="muted">(facultatif)</em></span>
              <span className="field"><input type="text" value={profileCard.tagline} maxLength={90} placeholder="Par exemple : jeux de rôle et parties entre amis" onChange={(e) => updateProfileCard({ tagline: e.target.value })} /></span>
            </label>
            <div className="ob-field">
              <span id="ob-banner-label">Bannière</span>
              <div className="ob-banners" role="group" aria-labelledby="ob-banner-label">
                {banners.map((game) => (
                  <button key={game.id} type="button" className="pick" aria-pressed={banner?.id === game.id} aria-label={game.title} title={game.title} onClick={() => updateProfileCard({ bannerGameId: game.id })}>
                    <GameArt game={game} kind="art" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <label className="ob-field">
          <span>Adresse e-mail</span>
          <span className="field"><input type="email" value={mail} maxLength={120} autoComplete="email" placeholder="prenom@exemple.fr" aria-invalid={error ? true : undefined} aria-describedby={error ? 'ob-mail-error' : undefined} onChange={(e) => setMail(e.target.value)} /></span>
        </label>
        {error && <p id="ob-mail-error" className="status status-warn" role="alert"><Icon name="warn" size={12} stroke={2.6} />{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg ob-submit">
          <Icon name={mode === 'create' ? 'plus' : 'check'} size={15} stroke={2.4} />
          {mode === 'create' ? 'Créer mon compte' : 'Se connecter'}
        </button>
        <p className="small muted">{service
          ? 'Pas de mot de passe à retenir : Warmup vous envoie un code de connexion par e-mail.'
          : data.demo
          ? 'Pas de mot de passe à retenir : Warmup vous envoie un lien de connexion par e-mail.'
          : 'Pas de mot de passe. Pour l\'instant, votre compte est enregistré sur ce PC uniquement ; la vérification par e-mail et la synchronisation entre PC arriveront avec le service en ligne de Warmup.'}</p>
        <p className="ob-switch">
          {mode === 'create' ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?'}
          <button type="button" className="btn" onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(''); }}>{mode === 'create' ? 'Se connecter' : 'Créer un compte'}</button>
        </p>
      </form>
    );
  }

  return <div className="ob-account">{main}{card}</div>;
}

function PcStep({ done, onDone }: { done: boolean; onDone(): void }) {
  const { data } = useApp();
  const parts = data.pc.parts;
  const [shown, setShown] = useState(done ? parts.length : 0);

  useEffect(() => {
    if (shown >= parts.length) {
      if (!done) onDone();
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), 380);
    return () => clearTimeout(timer);
  }, [shown, parts.length, done, onDone]);

  const warn = parts.filter((p) => p.status === 'warn').length;
  return (
    <>
      <p className="eyebrow" role="status">{shown < parts.length ? `Analyse en cours · ${shown} sur ${parts.length}` : `Analyse terminée · ${parts.length} éléments`}</p>
      <div className="ob-grid">
        {parts.map((part, index) => (
          <div key={part.name} className={`ob-part${index < shown ? ' on' : ''}`}>
            <span className="eyebrow">{part.name}</span>
            <span className="strong">{index < shown ? part.big : '…'}</span>
            {index < shown && (
              <span className={`status status-${part.status}`}>
                <Icon name={part.status === 'ok' ? 'check' : 'warn'} size={11} stroke={2.6} />{part.status === 'ok' ? 'Bon' : 'À améliorer'}
              </span>
            )}
          </div>
        ))}
      </div>
      {shown >= parts.length && (
        <p className="muted" aria-live="polite">
          {warn === 0 ? 'Tout est bien réglé.' : `${warn} points peuvent être améliorés. Warmup vous les expliquera dans Diagnostic, rien ne presse.`} {data.demo && <span className="small">Exemple de résultat : dans la version vierge, c'est votre vrai matériel qui est lu.</span>}
        </p>
      )}
    </>
  );
}

function GamesStep({ report, onReport }: { report: DetectionReport | null; onReport(report: DetectionReport): void }) {
  const { data } = useApp();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (report) return;
    let alive = true;
    // Un court délai laisse voir que la recherche a lieu, même quand elle est instantanée.
    const started = Date.now();
    api.detectGames()
      .then((result) => setTimeout(() => alive && onReport(result), Math.max(0, 900 - (Date.now() - started))))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [report, onReport]);

  if (failed) return <p className="status status-warn" role="alert"><Icon name="warn" size={12} stroke={2.6} />La recherche n'a pas abouti. Vous pourrez la relancer dans Réglages.</p>;
  if (!report) return <p className="eyebrow" role="status">Recherche des jeux en cours…</p>;

  return (
    <div aria-live="polite">
      <ul className="detect-stores">
        {report.stores.map((store) => (
          <li key={store.source}>
            <span className="eyebrow">{store.source}</span>
            <span className={store.found ? 'strong' : 'muted'}>{store.note}</span>
          </li>
        ))}
      </ul>
      {report.games.length === 0 ? (
        <p className="muted">Aucun jeu trouvé pour l'instant. Vous pourrez relancer la recherche dans Réglages, ou ajouter un jeu à la main.</p>
      ) : (
        <div className="ob-games">
          {report.games.map((found) => {
            const game = found.libraryId ? findGame(data, found.libraryId) : undefined;
            return (
              <div key={`${found.source}-${found.storeId}`} className="ob-game">
                <span className="ob-game-cover">{game ? <GameArt game={game} kind="cover" lazy /> : <span className="art-fallback">{found.title}</span>}</span>
                <span className="strong">{found.title}</span>
                <span className="small muted">{found.source}{found.complete ? '' : ' · installation inachevée'}</span>
              </div>
            );
          })}
        </div>
      )}
      {report.example && <p className="small muted" style={{ marginTop: 16 }}>Exemple de résultat : la vraie recherche se fait dans l'application installée, pas dans le navigateur.</p>}
    </div>
  );
}

export function LinkStep({ linked, onChange }: { linked: Linkable[]; onChange(next: Linkable[]): void }) {
  return (
    <div className="ob-list">
      {LINKABLE.map((name) => {
        const on = linked.includes(name);
        return (
          <div key={name} className="list-row" style={{ flexWrap: 'nowrap', gap: 20 }}>
            <span className="ob-platform" aria-hidden="true">{name[0]}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong">{name}</div>
              <div className="small muted">{PLATFORM_TEXT[name]}</div>
            </div>
            {on && <span className="status status-ok"><Icon name="check" size={12} stroke={2.6} />Relié</span>}
            <button type="button" className="btn" aria-label={on ? `Retirer ${name}` : `Relier ${name}`} onClick={() => onChange(on ? linked.filter((n) => n !== name) : [...linked, name])}>
              {on ? 'Retirer' : 'Relier'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PrefRow({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange(next: boolean): void }) {
  return (
    <div className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
      <div className="grow">
        <div className="strong">{label}</div>
        <div className="small muted" style={{ marginTop: 2 }}>{text}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
