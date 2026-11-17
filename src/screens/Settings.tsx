import { Fragment, useEffect, useRef, useState } from 'react';
import type { DetectionReport, Settings } from '../../shared/types';
import { api } from '../api';
import { useApp } from '../context';
import { LinkStep, openAccountStep } from '../Onboarding';
import { Ambient, Icon, Toggle } from '../ui';

export const SETTING_GROUPS: { title: string; rows: { key: keyof Settings; label: string; text: string }[] }[] = [
  {
    title: 'Lancement',
    rows: [
      { key: 'launchWindow', label: 'Afficher la fenêtre de lancement', text: 'La petite fenêtre « Optimised by Warmup » qui montre les contrôles avant chaque jeu. Désactivée, les contrôles continuent en silence.' }
    ]
  },
  {
    title: 'Corrections',
    rows: [{ key: 'powerBoost', label: 'Passer Windows en « Performances élevées » pendant le jeu', text: 'Au lancement d\'un jeu, Warmup change le mode d\'alimentation de Windows, puis rétablit le vôtre à la fin de la partie. Chaque changement est noté dans le journal et peut être annulé. Sur un portable, la batterie se vide plus vite.' }, { key: 'askBeforeFix', label: 'Demander mon accord avant chaque correction', text: 'Warmup montre ce qui va changer et attend votre réponse. Toute correction reste annulable depuis le journal.' }]
  },
  {
    title: 'Données',
    rows: [{ key: 'shareCatalog', label: 'Partager les pannes résolues avec le catalogue commun', text: 'Sans votre nom ni vos fichiers : seulement le jeu, le symptôme et la solution qui a marché.' }]
  },
  {
    title: 'Général',
    rows: [{ key: 'startWithWindows', label: 'Ouvrir Warmup au démarrage de Windows', text: 'L\'application reste discrète dans la zone de notification.' }]
  }
];

/** Réglages qui agissent déjà pour de vrai sur ce PC. */
const REAL_SETTINGS: (keyof Settings)[] = ['launchWindow', 'startWithWindows', 'powerBoost'];

export function SettingsPage() {
  const { settings, updateSettings, account, updateAccount, data } = useApp();
  // Version vierge : seuls les réglages qui ont déjà un effet réel sont proposés.
  const groups = data.demo ? SETTING_GROUPS : SETTING_GROUPS.map((group) => ({ ...group, rows: group.rows.filter((row) => REAL_SETTINGS.includes(row.key)) })).filter((group) => group.rows.length > 0);
  return (
    <div className="page">
      <Ambient />
      <div className="page-head">
        <div>
          <span className="eyebrow">Enregistrés tout de suite</span>
          <h1 className="title">Réglages</h1>
        </div>
      </div>
      <div className="settings">
        {groups.map((group) => (
          <Fragment key={group.title}>
            <h2 className="h2">{group.title}</h2>
            <div className="group">
              {group.rows.map((row) => (
                <div key={row.key} className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
                  <div className="grow">
                    <div className="strong">{row.label}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>{row.text}</div>
                  </div>
                  <Toggle checked={settings[row.key]} onChange={(next) => updateSettings({ [row.key]: next })} label={row.label} />
                </div>
              ))}
            </div>
          </Fragment>
        ))}
        <h2 className="h2">Compte</h2>
        <div className="group">
          <div className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
            <div className="grow">
              <div className="strong">{account.email}</div>
              <div className="small muted" style={{ marginTop: 2 }}>{account.signedIn ? (data.demo ? 'Connecté par lien e-mail, sans mot de passe.' : 'Compte enregistré sur ce PC, sans mot de passe.') : 'Un compte garde vos réglages et vos collections d\'un PC à l\'autre.'}</div>
            </div>
            <button type="button" className="btn" onClick={() => { openAccountStep(); updateAccount({ email: '', signedIn: false }); }}>Se déconnecter</button>
          </div>
          <div className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
            <div className="grow">
              <div className="strong">Revoir la configuration de départ</div>
              <div className="small muted" style={{ marginTop: 2 }}>Compte, analyse du PC, jeux installés et plateformes, étape par étape.</div>
            </div>
            <button type="button" className="btn" onClick={() => updateAccount({ onboarded: false })}>Relancer</button>
          </div>
        </div>
        {!data.demo && <h2 className="h2">Plateformes</h2>}
        {!data.demo && <div className="group" id="reglage-steam"><SteamLink /></div>}
        {data.demo && <h2 className="h2">Plateformes</h2>}
        {data.demo && <div className="group">
          <LinkStep linked={account.linked} onChange={(linked) => updateAccount({ linked })} />
          <p className="small muted" style={{ paddingTop: 12 }}>La connexion se fait sur la page officielle de chaque plateforme : Warmup ne voit jamais votre mot de passe. Version de démonstration, aucune page ne s'ouvre encore.</p>
        </div>}
        <h2 className="h2">Jeux installés</h2>
        <div className="group"><Detection /></div>
        <h2 className="h2">À propos</h2>
        <div className="group">
          <p className="muted" style={{ paddingTop: 16 }}>{data.demo
            ? 'Warmup 0.4.0, version de test. Les jeux sont réels ; les mesures, heures et incidents affichés sont des données d\'exemple.'
            : 'Warmup 0.4.0. Tout ce qui est affiché est lu sur ce PC : jeux installés, matériel, heures de jeu et parties mesurées par Warmup.'}</p>
        </div>
      </div>
    </div>
  );
}

// Recherche des jeux installés : Warmup lit les fichiers tenus par Steam, GOG, Battle.net et Rockstar, sans rien modifier.
function Detection() {
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const { reload } = useApp();
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Arrivée depuis « Rechercher les jeux installés » (#/settings/jeux) : on montre la section et on lance la recherche.
  useEffect(() => {
    if (!window.location.hash.startsWith('#/settings/jeux')) return;
    boxRef.current?.scrollIntoView({ block: 'center' });
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setReport(await api.detectGames());
      void reload(); // version vierge : la bibliothèque suit ce qui vient d'être trouvé
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detect" ref={boxRef}>
      <div className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
        <div className="grow">
          <div className="strong">Rechercher les jeux installés sur ce PC</div>
          <div className="small muted" style={{ marginTop: 2 }}>Warmup lit la liste tenue par Steam, GOG, Battle.net et Rockstar. Rien n'est modifié et aucun jeu n'est ouvert.</div>
        </div>
        <button type="button" className="btn" onClick={search} disabled={busy}>
          <Icon name="search" size={14} />{busy ? 'Recherche…' : report ? 'Relancer' : 'Rechercher'}
        </button>
      </div>

      {failed && <p className="status status-warn" role="alert"><Icon name="warn" size={12} stroke={2.6} />La recherche n'a pas abouti. Réessayez dans un instant.</p>}

      {report && (
        <div aria-live="polite">
          {report.example && <p className="small muted detect-note">Exemple de résultat : la vraie recherche se fait dans l'application installée, pas dans le navigateur.</p>}
          <ul className="detect-stores">
            {report.stores.map((store) => (
              <li key={store.source}>
                <span className="eyebrow">{store.source}</span>
                <span className={store.found ? 'strong' : 'muted'}>{store.note}</span>
              </li>
            ))}
          </ul>
          {report.games.length === 0 ? (
            <p className="muted">Aucun jeu trouvé pour l'instant.</p>
          ) : (
            report.games.map((game) => (
              <div key={`${game.source}-${game.storeId}`} className="list-row detect-game">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong">{game.title}</div>
                  <div className="small muted detect-folder" title={game.folder}>{game.folder}</div>
                </div>
                <span className="small muted detect-size">{game.sizeGb === null ? 'Taille inconnue' : `${game.sizeGb.toLocaleString('fr-FR')} Go`}</span>
                <span className="chip">{game.source}</span>
                {!game.complete && <span className="chip warn"><Icon name="warn" size={11} stroke={2.6} />Installation inachevée</span>}
                {game.complete && !game.canLaunch && <span className="chip">Lancement depuis Warmup pas encore pris en charge</span>}
                {game.libraryId
                  ? <a className="link" href={`#/game/${game.libraryId}`}>Voir la fiche</a>
                  : <span className="small muted">Pas encore dans la bibliothèque</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Steam se relie par sa page officielle, ouverte dans le navigateur : Warmup ne voit jamais le mot de passe.
// Les autres plateformes demandent un accord de leur éditeur : elles viendront plus tard.
function SteamLink() {
  const { data, reload, notify } = useApp();
  const [service, setService] = useState(false);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    void api.getAccountService().then((info) => setService(info.online)).catch(() => undefined);
    // Arrivée depuis « Relier Steam » (#/settings/steam) : on montre la section.
    if (window.location.hash.startsWith('#/settings/steam')) document.getElementById('reglage-steam')?.scrollIntoView({ block: 'center' });
  }, []);

  const link = async () => {
    const result = await api.linkSteam().catch(() => ({ ok: false, message: 'La connexion à Steam n\'a pas pu démarrer.' }));
    notify(result.message);
    if (result.ok) setWaiting(true);
  };
  const finish = async () => {
    await reload(true);
    setWaiting(false);
  };
  const unlink = async () => {
    const result = await api.unlinkSteam().catch(() => ({ ok: false, message: 'Steam n\'a pas pu être retiré.' }));
    notify(result.message);
    await reload(true);
  };

  return (
    <>
      <div className="list-row" style={{ flexWrap: 'nowrap', gap: 24 }}>
        <div className="grow">
          <div className="strong">Steam{data.steam.linked && data.steam.name ? ` · ${data.steam.name}` : ''}</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {data.steam.linked
              ? 'Relié : vos amis Steam et vos succès obtenus sont affichés. Ils ne sont visibles que si votre profil Steam les rend publics.'
              : service
                ? 'Affiche vos amis Steam et vos succès obtenus. La connexion se fait sur la page officielle de Steam.'
                : 'La connexion à Steam passe par le service en ligne de Warmup, qui n\'est pas encore en service.'}
          </div>
        </div>
        {data.steam.linked
          ? <button type="button" className="btn" onClick={() => void unlink()}>Retirer</button>
          : waiting
            ? <button type="button" className="btn btn-primary" onClick={() => void finish()}>J'ai terminé sur Steam</button>
            : <button type="button" className="btn" disabled={!service} onClick={() => void link()}>Relier</button>}
      </div>
      <p className="small muted" style={{ paddingTop: 12 }}>GOG, Battle.net et Rockstar demandent chacun un accord de leur éditeur avant de pouvoir être reliés. Leurs jeux installés sont déjà détectés.</p>
    </>
  );
}
