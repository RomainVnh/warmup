import type { JournalEntry } from '../../shared/types';
import { findGame, useApp } from '../context';
import { EmptyState, Icon, Stat } from '../ui';

const when = (at: number) => new Date(at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

// Journal : tout ce que Warmup a modifié sur ce PC, du plus récent au plus ancien.
// Chaque correction y est notée et peut être annulée ; ce qui ne peut pas l'être le dit clairement.
export function Journal() {
  const { data, journal, undoFix, notify } = useApp();
  const active = journal.filter((entry) => entry.undoable && !entry.undone).length;
  const undone = journal.filter((entry) => entry.undone).length;

  const undo = (entry: JournalEntry) => {
    undoFix(entry.id);
    notify(data.demo ? 'Correction annulée (exemple : rien n\'a été modifié sur ce PC).' : 'Correction annulée : la valeur d\'origine est rétablie.');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{data.demo ? 'Exemple de journal' : 'Sur ce PC'}</span>
          <h1 className="title">Journal</h1>
          <p className="sub">Tout ce que Warmup a modifié sur ce PC, du plus récent au plus ancien. Une correction est toujours expliquée avant, notée ici, et annulable.</p>
        </div>
        <a className="btn" href="#/diagnostic"><Icon name="pulse" size={14} />Diagnostic du PC</a>
      </div>

      {journal.length === 0 ? (
        <EmptyState icon="history" title="Warmup n'a encore rien modifié sur ce PC">
          Dès qu'une correction sera appliquée avant un lancement, ou qu'un jeu sera désinstallé depuis Warmup, la ligne apparaîtra ici avec son bouton « Annuler ».
        </EmptyState>
      ) : (
        <>
          <div className="stats">
            <Stat value={journal.length} label="Actions notées" />
            <Stat value={active} label="Corrections en place" />
            <Stat value={undone} label="Corrections annulées" />
          </div>

          <section className="section">
            <ol className="tl journal">
              {journal.map((entry) => {
                const game = entry.gameId ? findGame(data, entry.gameId) : undefined;
                return (
                  <li key={entry.id} className={entry.undone ? 'undone' : entry.undoable ? 'ok' : ''}>
                    <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 20 }}>
                      <div className="grow">
                        <div className="strong">{entry.title}</div>
                        <div className="muted" style={{ marginTop: 4, maxWidth: '70ch' }}>{entry.detail}</div>
                        <div className="eyebrow" style={{ marginTop: 10 }}>
                          {when(entry.at)}{game ? <> · <a href={`#/game/${game.id}`}>{game.title}</a></> : null}
                        </div>
                      </div>
                      {entry.undone ? (
                        <span className="chip">Annulée</span>
                      ) : entry.undoable ? (
                        <button type="button" className="btn" aria-label={`Annuler : ${entry.title}`} onClick={() => undo(entry)}>
                          <Icon name="back" size={14} stroke={2} />Annuler
                        </button>
                      ) : (
                        <span className="chip" title="Cette action ne peut pas être défaite par Warmup">Non annulable</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
