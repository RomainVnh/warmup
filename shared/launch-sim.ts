import type { LaunchEvent } from './types';

// Simulation du contrôle avant lancement.
// Sous Windows, ce fichier sera remplacé par les vrais contrôles ;
// les événements envoyés à l'interface resteront les mêmes.
export function simulateLaunch(
  stepCount: number,
  emit: (event: LaunchEvent) => void,
  stepMs = 420,
  holdMs = 1300
): () => void {
  let index = 0;
  let hold: ReturnType<typeof setTimeout> | undefined;
  const timer = setInterval(() => {
    index += 1;
    emit({ type: 'step', index });
    if (index >= stepCount) {
      clearInterval(timer);
      emit({ type: 'done' });
      hold = setTimeout(() => emit({ type: 'started', real: false }), holdMs);
    }
  }, stepMs);
  return () => {
    clearInterval(timer);
    if (hold) clearTimeout(hold);
  };
}
