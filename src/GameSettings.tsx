import { useEffect, useRef, useState } from 'react';
import { defaultGameOptions, LAUNCH_ARGS, type Game, type GameFiles, type LaunchWindowChoice } from '../shared/types';
import { api } from './api';
import { useApp } from './context';
import { GameArt, Icon, Segmented, Toggle } from './ui';

// Paramètres d'un jeu, ouverts depuis le bouton « Paramètres » de sa fiche :
// options de lancement, fichiers du jeu, désinstallation.
// Rien ne touche au jeu lui-même : Warmup passe par la plateforme ou par le système.

export function GameSettings({ game, onClose }: { game: Game; onClose(): void }) {
  const { gameOptions, updateGameOptions, settings, installed, uninstall, notify, reload } = useApp();
  const [title, setTitle] = useState(game.title);
  const options = gameOptions[game.id] ?? defaultGameOptions;
  const isInstalled = installed.has(game.id);
  const [args, setArgs] = useState(options.args);
  const [files, setFiles] = useState<GameFiles | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const argsValid = LAUNCH_ARGS.test(args.trim());

  useEffect(() => {
    let alive = true;
    void api.getGameFiles(game.id).then((result) => alive && setFiles(result)).catch(() => alive && setFiles(null));
    return () => { alive = false; };
  }, [game.id]);

  // Échap ferme ; le focus entre dans la fenêtre à l'ouverture et revient au bouton à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const saveArgs = () => {
    if (argsValid && args.trim() !== options.args) {
      updateGameOptions(game.id, { args: args.trim() });
      notify(args.trim() ? `Arguments enregistrés pour ${game.title}.` : `Arguments retirés pour ${game.title}.`);
    }
  };

  const run = async (action: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      notify((await action()).message);
    } catch {
      notify('L\'action n\'a pas pu aboutir. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  const doUninstall = async () => {
    setBusy(true);
    const message = await uninstall(game);
    setBusy(false);
    setConfirming(false);
    notify(message);
  };

  // Jeu ajouté à la main : on peut le renommer ou le retirer de la bibliothèque. Ses fichiers ne sont jamais touchés.
  const rename = async () => {
    const result = await api.renameGame(game.id, title);
    notify(result.message);
    if (result.ok) await reload();
  };
  const remove = async () => {
    const result = await api.removeGame(game.id);
    notify(result.message);
    if (!result.ok) return;
    onClose();
    window.location.hash = '#/library';
    await reload();
  };

  const platform = files?.source ?? game.source;
  const argsUnsupported = (platform as string) === 'Epic';
  const windowLabel = settings.launchWindow ? 'affichée' : 'masquée';

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="gs" role="dialog" aria-modal="true" aria-labelledby="gs-title" tabIndex={-1} ref={dialogRef}>
        <header className="gs-head">
          <span className="gs-thumb"><GameArt game={game} kind="cover" /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <span className="eyebrow">Paramètres du jeu</span>
            <h2 id="gs-title" className="gs-title">{game.title}</h2>
          </div>
          <button type="button" className="btn btn-icon" aria-label="Fermer les paramètres" onClick={onClose}><Icon name="close" size={16} stroke={2.2} /></button>
        </header>

        <div className="gs-body">
          <section className="gs-section" aria-labelledby="gs-launch">
            <h3 id="gs-launch" className="h2">Lancement</h3>

            <div className="gs-row">
              <div className="grow">
                <div className="strong">Fenêtre de lancement</div>
                <div className="small muted">La fenêtre « Optimised by Warmup » qui montre les contrôles avant le jeu.</div>
              </div>
              <Segmented<LaunchWindowChoice>
                label="Fenêtre de lancement pour ce jeu"
                value={options.launchWindow}
                onChange={(launchWindow) => updateGameOptions(game.id, { launchWindow })}
                options={[
                  { value: 'default', label: `Réglages · ${windowLabel}` },
                  { value: 'always', label: 'Toujours' },
                  { value: 'never', label: 'Jamais' }
                ]}
              />
            </div>

            <div className="gs-row">
              <div className="grow">
                <div className="strong">Contrôles avant lancement</div>
                <div className="small muted">
                  {options.checks
                    ? `Warmup vérifie le PC et corrige ce qui peut l'être avant d'ouvrir le jeu (${game.launch.steps.length} points).`
                    : 'Désactivés : le jeu s\'ouvre directement, sans vérification. En cas de problème, Warmup ne pourra pas l\'expliquer.'}
                </div>
              </div>
              <Toggle checked={options.checks} onChange={(checks) => updateGameOptions(game.id, { checks })} label="Contrôles avant lancement" />
            </div>

            <div className="gs-row gs-column">
              <label className="strong" htmlFor="gs-args">Arguments de lancement</label>
              <div className="small muted">Transmis au jeu à chaque lancement, par exemple <code>-dx12</code> ou <code>-skipintro</code>. Ils dépendent du jeu : en cas de doute, laissez vide.</div>
              <div className="row" style={{ gap: 10, flexWrap: 'nowrap', marginTop: 8 }}>
                <span className="field grow">
                  <input
                    id="gs-args"
                    type="text"
                    value={args}
                    maxLength={200}
                    spellCheck={false}
                    placeholder="Aucun argument"
                    aria-invalid={argsValid ? undefined : true}
                    aria-describedby="gs-args-help"
                    disabled={argsUnsupported}
                    onChange={(event) => setArgs(event.target.value)}
                    onBlur={saveArgs}
                    onKeyDown={(event) => event.key === 'Enter' && saveArgs()}
                  />
                </span>
                <button type="button" className="btn" onClick={saveArgs} disabled={!argsValid || args.trim() === options.args || argsUnsupported}>Enregistrer</button>
              </div>
              <p id="gs-args-help" className={argsValid ? 'small muted' : 'status status-warn'} role={argsValid ? undefined : 'alert'}>
                {argsUnsupported
                  ? 'Epic Games ne permet pas de transmettre des arguments depuis Warmup.'
                  : argsValid
                    ? 'Lettres, chiffres, espaces et les signes - _ = . : + , / uniquement.'
                    : <><Icon name="warn" size={12} stroke={2.6} />Seuls les lettres, chiffres, espaces et les signes - _ = . : + , / sont acceptés.</>}
              </p>
            </div>
          </section>

          {game.manual && (
            <section className="gs-section" aria-labelledby="gs-manual">
              <h3 id="gs-manual" className="h2">Jeu ajouté à la main</h3>
              <div className="gs-row gs-column">
                <label className="strong" htmlFor="gs-title-input">Nom du jeu</label>
                <div className="row" style={{ gap: 10, flexWrap: 'nowrap', marginTop: 8 }}>
                  <span className="field grow"><input id="gs-title-input" type="text" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void rename()} /></span>
                  <button type="button" className="btn" disabled={!title.trim() || title.trim() === game.title} onClick={() => void rename()}>Renommer</button>
                </div>
              </div>
              <div className="gs-row">
                <div className="grow">
                  <div className="strong">Retirer de la bibliothèque</div>
                  <div className="small muted">Le jeu disparaît de Warmup. Ses fichiers restent sur le PC, et vous pourrez l'ajouter de nouveau.</div>
                </div>
                <button type="button" className="btn" onClick={() => void remove()}>Retirer</button>
              </div>
            </section>
          )}

          <section className="gs-section" aria-labelledby="gs-files">
            <h3 id="gs-files" className="h2">Fichiers du jeu</h3>
            {!isInstalled ? (
              <div className="gs-row">
                <div className="grow">
                  <div className="strong">Ce jeu n'est pas installé</div>
                  <div className="small muted">Installez-le depuis {game.source} : Warmup le retrouvera à la prochaine analyse.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="gs-row">
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong">Emplacement</div>
                    <div className="small muted gs-path" title={files?.folder}>{files === null ? 'Recherche…' : files.found ? files.folder || 'Inconnu' : 'Warmup n\'a pas trouvé ce jeu sur ce PC.'}</div>
                  </div>
                  <button type="button" className="btn" disabled={busy || !files?.found} onClick={() => run(() => api.openGameFolder(game.id))}><Icon name="folder" size={14} />Ouvrir le dossier</button>
                </div>
                {!game.manual && <div className="gs-row">
                  <div className="grow">
                    <div className="strong">Vérifier les fichiers</div>
                    <div className="small muted">{files?.canVerify ? `${platform} compare les fichiers du jeu à l'original et retélécharge ceux qui manquent ou sont abîmés.` : `La vérification se fait depuis ${platform}.`}</div>
                  </div>
                  <button type="button" className="btn" disabled={busy || !files?.canVerify} onClick={() => run(() => api.verifyGameFiles(game.id))}><Icon name="refresh" size={14} />Vérifier</button>
                </div>}
                <div className="gs-row">
                  <div className="grow">
                    <div className="strong">Place sur le disque</div>
                    <div className="small muted">{(files?.sizeGb ?? game.sizeGb) ? `${files?.sizeGb ?? game.sizeGb} Go${game.modCount ? `, dont ${game.modCount} mods installés` : ''}.` : 'Taille inconnue.'}</div>
                  </div>
                </div>
              </>
            )}
          </section>

          {isInstalled && !game.manual && (
            <section className="gs-section" aria-labelledby="gs-uninstall">
              <h3 id="gs-uninstall" className="h2">Désinstaller</h3>
              {!confirming ? (
                <div className="gs-row">
                  <div className="grow">
                    <div className="strong">Retirer {game.title} de ce PC</div>
                    <div className="small muted">Warmup ouvre le programme de désinstallation officiel de {platform}. Le jeu reste dans votre bibliothèque.</div>
                  </div>
                  <button type="button" className="btn" disabled={busy || (files !== null && !files.example && !files.canUninstall)} onClick={() => setConfirming(true)}>Désinstaller…</button>
                </div>
              ) : (
                <div className="gs-confirm" role="alertdialog" aria-labelledby="gs-confirm-title" aria-describedby="gs-confirm-text">
                  <p id="gs-confirm-title" className="strong"><Icon name="warn" size={14} stroke={2.4} />Désinstaller {game.title} ?</p>
                  <ul id="gs-confirm-text" className="gs-list">
                    <li>Environ {files?.sizeGb ?? game.sizeGb} Go seront libérés.</li>
                    <li>Les sauvegardes enregistrées dans le cloud de {platform} sont conservées. Les sauvegardes locales{game.modCount ? ` et les ${game.modCount} mods` : ''} peuvent être supprimés.</li>
                    <li>{platform} peut vous demander une dernière confirmation.</li>
                    <li>Le jeu reste dans votre bibliothèque : vous pourrez le réinstaller à tout moment.</li>
                  </ul>
                  <div className="row" style={{ gap: 10, marginTop: 14 }}>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={doUninstall}>{busy ? 'Ouverture…' : 'Désinstaller'}</button>
                    <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(false)}>Annuler</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {files?.example && <p className="small muted gs-note">Exemple : dans le navigateur, rien n'est lu ni modifié sur le PC. Les options de lancement, elles, sont bien enregistrées.</p>}
        </div>
      </div>
    </div>
  );
}
