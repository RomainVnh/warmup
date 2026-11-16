import { app } from 'electron';

// Deux façons de voir Warmup :
// - version vierge (la règle) : uniquement ce qui est lu sur ce PC. C'est ce que voit toute personne qui installe l'application ;
// - version de test : jeux, amis et chiffres d'exemple, pour travailler l'interface. Elle s'ouvre pour le compte admin
//   (electron/admin.ts), ou en développement avec WARMUP_TEST=1.
export const forcedTest = (): boolean => !app.isPackaged && process.env.WARMUP_TEST === '1';
