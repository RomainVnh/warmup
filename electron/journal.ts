import type { FixLog, JournalEntry } from '../shared/types';
import { readJson, writeJson } from './store';

// Journal : tout ce que Warmup a modifié sur ce PC, du plus récent au plus ancien.
// Une correction est toujours une action prédéfinie : pour être annulable, elle doit avoir ici sa fonction d'annulation.

const FILE = 'journal.json';
const MAX_ENTRIES = 500;

/** Annulations possibles, par nature d'action. Vide pour l'instant : aucune correction réelle n'existe encore. */
const UNDO: Record<string, (entry: JournalEntry) => Promise<boolean>> = {};

const isEntry = (value: unknown): value is JournalEntry => {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.at === 'number' && typeof e.title === 'string' && typeof e.detail === 'string' && typeof e.undoable === 'boolean' && typeof e.undone === 'boolean';
};

export function cleanJournal(input: unknown): JournalEntry[] {
  return Array.isArray(input) ? input.filter(isEntry).slice(0, MAX_ENTRIES) : [];
}

let entries: JournalEntry[] = [];
let persistent = true;

/** Version vierge : le journal est lu sur le disque. */
export function loadJournal(): void {
  persistent = true;
  entries = cleanJournal(readJson(FILE));
}

/** Version de test : le journal d'exemple, gardé en mémoire. « Annuler » y marque seulement la ligne. */
export function loadDemoJournal(log: FixLog[], now = Date.now()): void {
  persistent = false;
  entries = log.map((entry, index) => ({ id: `exemple-${index}`, at: now - (index + 1) * 5_400_000, title: entry.what, detail: entry.detail, undoable: true, undone: false }));
}

export const journal = (): JournalEntry[] => entries;

export function logAction(action: { kind: string; title: string; detail: string; gameId?: string }): void {
  const undoable = action.kind in UNDO;
  entries = [{ id: `${action.kind}-${Date.now()}`, at: Date.now(), title: action.title, detail: action.detail, gameId: action.gameId, undoable, undone: false }, ...entries].slice(0, MAX_ENTRIES);
  if (persistent) writeJson(FILE, entries);
}

export async function undo(id: unknown): Promise<JournalEntry[]> {
  const entry = typeof id === 'string' ? entries.find((e) => e.id === id) : undefined;
  if (!entry || !entry.undoable || entry.undone) return entries;
  const handler = UNDO[entry.id.replace(/-\d+$/, '')];
  // Dans la version de test, rien n'a réellement été modifié : il n'y a rien à défaire sur le PC.
  const done = persistent ? Boolean(handler) && (await handler(entry)) : true;
  if (done) {
    entries = entries.map((e) => (e.id === entry.id ? { ...e, undone: true } : e));
    if (persistent) writeJson(FILE, entries);
  }
  return entries;
}
