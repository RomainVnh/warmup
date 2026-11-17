import type { FriendStatus, Game, GraphicsAdvice, Guide, ModSet, Notice, Report } from './types';

// Suite des données d'exemple : réglages conseillés, bilans, mods, amis, téléchargements, notifications, guides.
// Tout ce qui est chiffré ici est inventé pour travailler l'interface.

// Nombre stable tiré d'un texte, pour varier les exemples sans hasard.
const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Suite de valeurs pseudo-aléatoires reproductible.
function series(seed: string, count: number, base: number, spread: number): number[] {
  let state = hash(seed) || 1;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return Math.round(base + ((state / 0xffffffff) * 2 - 1) * spread);
  });
}

/* ───── Réglages graphiques conseillés (PC d'exemple : RTX 4060 8 Go, Ryzen 5, écran 2560 × 1440 à 144 Hz) ───── */

const VERY_HEAVY = ['cyberpunk-2077', 'gta-6', 'black-myth-wukong', 'monster-hunter-wilds', 'fable', 'kingdom-come-deliverance-2'];
const LIGHT = ['counter-strike-2', 'valorant', 'hades-2', 'hollow-knight-silksong', 'dragon-ball-sparking-zero', 'stardew-valley'];
const FAST_SHOOTERS: Record<string, number> = { 'counter-strike-2': 310, valorant: 280 };

export function graphicsFor(id: string): GraphicsAdvice {
  const wobble = hash(id) % 9;
  if (LIGHT.includes(id)) {
    const fps = FAST_SHOOTERS[id] ?? 144;
    return {
      preset: 'Maximum',
      resolution: '2560 × 1440, native',
      upscaling: 'Inutile',
      fps,
      low: Math.round(fps * 0.82),
      rows: [
        { name: 'Qualité générale', value: 'Maximum', why: 'Ce jeu est léger : votre carte graphique a de la marge.' },
        { name: 'Mise à l\'échelle', value: 'Désactivée', why: 'L\'image native est plus nette et le jeu reste fluide.' },
        { name: 'Limite d\'images', value: fps > 144 ? 'Aucune' : '141 images par seconde', why: fps > 144 ? 'En jeu compétitif, plus d\'images réduit le délai entre votre geste et l\'écran.' : 'Juste sous les 144 Hz de l\'écran, pour une image sans déchirure.' },
        { name: 'Synchronisation verticale', value: 'Désactivée, G-Sync activé', why: 'G-Sync évite les déchirures sans ajouter de délai.' }
      ],
      note: fps > 144 ? 'Le jeu dépasse largement les 144 Hz de votre écran. Activer le profil rapide de la mémoire vive ferait encore gagner des images.' : 'Rien à sacrifier : le jeu tient les 144 images par seconde au maximum.'
    };
  }
  const heavy = VERY_HEAVY.includes(id);
  const fps = id === 'elden-ring' ? 60 : (heavy ? 68 : 96) + wobble;
  return {
    preset: heavy ? 'Élevé' : 'Très élevé',
    resolution: '2560 × 1440',
    upscaling: heavy ? 'DLSS Qualité + génération d\'images' : 'DLSS Qualité',
    fps,
    low: id === 'elden-ring' ? 54 : Math.round(fps * 0.76),
    rows: [
      { name: 'Qualité générale', value: heavy ? 'Élevé' : 'Très élevé', why: heavy ? 'Le niveau Ultra coûte environ 25 % d\'images pour une différence peu visible.' : 'Votre carte tient ce niveau sans descendre sous 70 images par seconde.' },
      { name: 'Textures', value: 'Élevées', why: 'Votre carte a 8 Go de mémoire : les textures Ultra la saturent et causent des saccades.' },
      { name: 'Ombres', value: heavy ? 'Moyennes' : 'Élevées', why: 'C\'est le réglage qui pèse le plus sur le processeur.' },
      { name: 'Ray tracing', value: heavy ? 'Désactivé' : 'Reflets seulement', why: heavy ? 'Avec le ray tracing complet, le jeu tomberait sous 40 images par seconde.' : 'Les reflets apportent le plus pour un coût limité.' },
      { name: 'Mise à l\'échelle', value: 'DLSS Qualité', why: 'Environ 35 % d\'images en plus, pour une image presque identique en 1440p.' },
      { name: 'Limite d\'images', value: id === 'elden-ring' ? '60 (imposée par le jeu)' : '141 images par seconde', why: id === 'elden-ring' ? 'Ce jeu ne dépasse pas 60 images par seconde, quel que soit le PC.' : 'Juste sous les 144 Hz de l\'écran, pour une image sans déchirure.' }
    ],
    note: id === 'elden-ring'
      ? 'Le jeu est limité à 60 images par seconde par son éditeur. Votre PC tient cette limite sans effort.'
      : heavy
        ? 'Ce jeu est exigeant. Ces réglages visent une image fluide plutôt que le niveau Ultra, que votre carte ne tient pas en 1440p.'
        : 'Ces réglages gardent le jeu au-dessus de 70 images par seconde, même dans les passages chargés.'
  };
}

/* ───── Bilans de partie ───── */

const DETAILED_PINGS = [19, 20, 18, 21, 19, 22, 20, 19, 18, 20, 21, 19, 23, 20, 19, 18, 21, 20, 19, 22, 20, 19, 21, 20, 96, 184, 120, 24, 20, 19, 160, 88, 21, 19, 20, 22, 19, 18, 20, 21, 19, 20, 22, 19, 21, 20, 19, 20];

function reportFor(game: Game, index: number): Report {
  const session = game.sessions[index];
  const id = `${game.id}-${index + 1}`;
  const online = Boolean(game.region);
  const { fps } = game.graphics;
  const temp = 62 + (hash(id) % 12);
  const base = { id, gameId: game.id, date: session.date, when: session.date, length: session.length, ok: session.ok };
  const pingBase = 18 + (hash(game.id) % 16);
  const calmChart = online
    ? { title: 'Ping pendant la partie', unit: 'ms', summary: `Stable autour de ${pingBase} ms.`, values: series(id, 48, pingBase, 3), limit: 60, above: true, axis: ['Début', '', '', '', 'Fin'] }
    : { title: 'Images par seconde pendant la partie', unit: 'images/s', summary: `Stable autour de ${fps} images par seconde.`, values: series(id, 48, fps, Math.max(3, Math.round(fps * 0.06))), limit: Math.round(fps * 0.6), above: false, axis: ['Début', '', '', '', 'Fin'] };
  const tiles = [
    { big: session.length, label: 'Durée de la partie' },
    { big: String(fps), label: 'Images par seconde en moyenne' },
    ...(online ? [{ big: `${pingBase} ms`, label: 'Ping moyen' }] : []),
    { big: `${temp} °C`, label: 'Température maximale, carte graphique' }
  ];

  if (game.id === 'call-of-duty-mw4' && index === 0) {
    return {
      ...base,
      when: 'Hier, de 21 h 02 à 22 h 14',
      cause: 'Réseau',
      headline: 'Vos 2 saccades venaient du réseau, pas de votre PC',
      text: 'À 21 h 40 et 21 h 47, le ping est monté à 184 ms pendant quelques secondes. Au même moment, le processeur et la carte graphique tournaient normalement. Un autre appareil de la maison utilisait toute la connexion.',
      tiles: [
        { big: '1 h 12', label: 'Durée de la partie' },
        { big: '212', label: 'Images par seconde en moyenne' },
        { big: '21 ms', label: 'Ping moyen' },
        { big: '184 ms', label: 'Ping le plus haut' },
        { big: '71 °C', label: 'Température maximale, carte graphique' }
      ],
      chart: { title: 'Ping pendant la partie', unit: 'ms', summary: 'Stable autour de 20 ms, sauf deux pics ressentis en jeu.', values: DETAILED_PINGS, limit: 40, above: true, axis: ['21 h 02', '21 h 20', '21 h 40', '22 h 00', '22 h 14'] },
      events: [
        { time: '21 h 02', title: 'Lancement sans incident', text: 'Contrôle passé en 2 secondes. Un téléchargement Steam a été mis en pause.', ok: true },
        { time: '21 h 40', title: 'Saccade de 8 secondes', text: 'Ping à 184 ms, 3 % de paquets perdus. Processeur à 38 %, carte graphique à 64 % : le PC n\'était pas en cause.', ok: false },
        { time: '21 h 47', title: 'Saccade de 5 secondes', text: 'Même signature que la précédente : pic réseau seul.', ok: false },
        { time: '22 h 14', title: 'Fin de partie', text: 'Téléchargement Steam repris. Aucun plantage, aucune surchauffe.', ok: true }
      ],
      advice: { title: 'Pour la prochaine fois', text: 'Votre box peut donner la priorité au PC de jeu. Warmup ne peut pas la régler à votre place, mais vous guide pas à pas.', action: 'Voir le guide pour ma box', href: '#/guide/box' }
    };
  }

  if (session.result.includes('Plantage')) {
    return {
      ...base,
      cause: 'Mods',
      headline: 'Le jeu a planté au chargement : 2 mods ne suivent pas la nouvelle version',
      text: `${game.title} est passé en version ${game.version} juste avant cette partie. Deux mods dépendent de l'ancien moteur de scripts : le jeu s'est arrêté au chargement de la sauvegarde, au bout de 3 minutes.`,
      tiles: [{ big: session.length, label: 'Durée avant le plantage' }, { big: '2', label: 'Mods incompatibles' }, { big: `${temp} °C`, label: 'Température maximale, carte graphique' }],
      chart: { title: 'Images par seconde avant le plantage', unit: 'images/s', summary: 'Le jeu tournait normalement jusqu\'à l\'arrêt.', values: [...series(id, 30, fps, 4), 12, 0], limit: Math.round(fps * 0.6), above: false, axis: ['Lancement', '', '', '', 'Plantage'] },
      events: [
        { time: 'Lancement', title: 'Contrôle passé, avec une alerte', text: 'La nouvelle version du jeu et les 2 mods non mis à jour étaient déjà signalés.', ok: false },
        { time: '3 min', title: 'Plantage au chargement de la sauvegarde', text: 'Le rapport de plantage désigne le moteur de scripts. Ni la température ni la mémoire n\'étaient en cause.', ok: false }
      ],
      advice: { title: 'Ce qui règle le problème', text: 'Désactiver les 2 mods incompatibles en attendant leur mise à jour. L\'état précédent reste enregistré et peut être restauré.', action: 'Voir les mods en cause', href: `#/mods/${game.id}` }
    };
  }

  if (session.result.includes('disque')) {
    const values = series(id, 48, fps, 4);
    values[30] = Math.round(fps * 0.35);
    values[31] = Math.round(fps * 0.5);
    return {
      ...base,
      cause: 'Disque',
      headline: 'Une saccade venait du disque, pas de la carte graphique',
      text: 'Pendant un trajet rapide, le jeu a dû charger beaucoup de décors d\'un coup. Le disque a saturé pendant 4 secondes alors que la carte graphique avait encore de la marge.',
      tiles,
      chart: { title: 'Images par seconde pendant la partie', unit: 'images/s', summary: 'Fluide, sauf une chute au chargement d\'une nouvelle zone.', values, limit: Math.round(fps * 0.6), above: false, axis: ['Début', '', '', '', 'Fin'] },
      events: [
        { time: 'Début', title: 'Lancement sans incident', text: 'Contrôle passé, rien à corriger.', ok: true },
        { time: '1 h 52', title: 'Saccade de 4 secondes', text: 'Disque utilisé à 100 %, carte graphique à 58 %. Un mod de textures de 11 Go était en cours de lecture.', ok: false },
        { time: 'Fin', title: 'Fin de partie', text: 'Aucun plantage, aucune surchauffe.', ok: true }
      ],
      advice: { title: 'Pour la prochaine fois', text: 'Le mod « Textures haute définition » pèse 11 Go et sollicite beaucoup le disque. Le désactiver, ou passer à sa version allégée, évite ces chutes.', action: 'Voir les mods', href: `#/mods/${game.id}` }
    };
  }

  return {
    ...base,
    cause: 'Aucun incident',
    headline: 'Partie sans incident',
    text: 'Aucune saccade, aucun plantage, aucune surchauffe. Le jeu a tourné dans les conditions prévues du début à la fin.',
    tiles,
    chart: calmChart,
    events: [
      { time: 'Début', title: 'Lancement sans incident', text: 'Contrôle passé, rien à corriger.', ok: true },
      { time: 'Fin', title: 'Fin de partie', text: `Température maximale de ${temp} °C. Rien à signaler.`, ok: true }
    ],
    advice: null
  };
}

// Tous les bilans, du plus récent au plus ancien (ordre des dernières parties, puis des sessions de chaque jeu).
export function buildReports(games: Game[]): Report[] {
  return games
    .flatMap((game) => game.sessions.map((_, index) => ({ game, index })))
    .sort((a, b) => a.index - b.index || a.game.recentRank - b.game.recentRank)
    .map(({ game, index }) => reportFor(game, index));
}

/* ───── Mods ───── */

const SNAPSHOTS_OK = [
  { when: 'Dernière partie', result: 'Sans incident', ok: true },
  { when: 'La fois précédente', result: 'Sans incident', ok: true }
];

export const modSets: ModSet[] = [
  {
    gameId: 'cyberpunk-2077',
    headline: 'mods en cause dans le plantage d\'hier',
    text: 'Le jeu marchait avant-hier avec ces mêmes mods. Seule sa version a changé, et ces mods ne la prennent pas encore en charge.',
    list: [
      { order: 1, name: 'Moteur de scripts', note: 'Requis par 17 autres mods', version: '1.31', state: 'Mise à jour en 1.32', level: 'update', enabled: true },
      { order: 2, name: 'Extension du moteur', note: 'Requis par 9 autres mods', version: '2.5.0', state: 'À jour', level: 'ok', enabled: true },
      { order: 7, name: 'Vivid Streets', note: 'Dépend du moteur de scripts 1.32', version: '4.0.2', state: 'Incompatible avec la 2.5', level: 'warn', enabled: true },
      { order: 8, name: 'Night City Traffic', note: 'Auteur inactif depuis 4 mois', version: '1.8', state: 'Incompatible avec la 2.5', level: 'warn', enabled: true },
      { order: 12, name: 'Interface épurée', note: 'Modifie les mêmes fichiers que le mod 19', version: '3.1', state: 'Conflit avec Carte détaillée', level: 'warn', enabled: true },
      { order: 19, name: 'Carte détaillée', note: 'Chargé après Interface épurée, il l\'emporte', version: '2.0', state: 'À jour', level: 'ok', enabled: true },
      { order: 23, name: 'Textures haute définition', note: '11 Go', version: '6.2', state: 'Mise à jour en 6.3', level: 'update', enabled: true },
      { order: 31, name: 'Météo réaliste', note: 'Aucune dépendance', version: '1.4', state: 'À jour', level: 'ok', enabled: true },
      { order: 40, name: 'Garde-robe étendue', note: 'Désactivé par vous il y a 3 semaines', version: '2.2', state: 'À jour', level: 'ok', enabled: false }
    ],
    snapshots: [
      { when: 'Hier, 21 h 12', result: 'Plantage au chargement', ok: false },
      { when: 'Avant-hier, 20 h 05', result: 'Sans incident · 2 h 10', ok: true },
      { when: 'Il y a 4 jours', result: 'Sans incident · 1 h 25', ok: true }
    ]
  },
  {
    gameId: 'baldurs-gate-3',
    headline: 'mods en cause',
    text: 'Tous vos mods prennent en charge la version actuelle du jeu.',
    list: [
      { order: 1, name: 'Mod Fixer', note: 'Requis par 3 autres mods', version: '1.0', state: 'À jour', level: 'ok', enabled: true },
      { order: 2, name: 'Interface améliorée', note: 'Requis par 2 autres mods', version: '4.2', state: 'Mise à jour en 4.3', level: 'update', enabled: true },
      { order: 3, name: 'Sorts de la 5e édition', note: 'Ajoute 120 sorts', version: '2.1', state: 'À jour', level: 'ok', enabled: true },
      { order: 4, name: 'Groupe élargi', note: 'Jusqu\'à 8 compagnons', version: '1.6', state: 'À jour', level: 'ok', enabled: true },
      { order: 5, name: 'Salon de coiffure de Tav', note: 'Dépend de Interface améliorée', version: '3.0', state: 'À jour', level: 'ok', enabled: true },
      { order: 6, name: 'Panier d\'équipement', note: 'Aucune dépendance', version: '1.9', state: 'À jour', level: 'ok', enabled: true }
    ],
    snapshots: SNAPSHOTS_OK
  },
  {
    gameId: 'the-witcher-3',
    headline: 'mods en cause',
    text: 'Tous vos mods prennent en charge la version actuelle du jeu.',
    list: [
      { order: 1, name: 'Textures retravaillées HD', note: '9 Go', version: '12.0', state: 'À jour', level: 'ok', enabled: true },
      { order: 2, name: 'Interface discrète', note: 'Aucune dépendance', version: '15.3', state: 'À jour', level: 'ok', enabled: true },
      { order: 3, name: 'Voyage rapide partout', note: 'Aucune dépendance', version: '3.3', state: 'À jour', level: 'ok', enabled: true },
      { order: 4, name: 'Poids illimité', note: 'Désactivé par vous le mois dernier', version: '1.31', state: 'À jour', level: 'ok', enabled: false }
    ],
    snapshots: SNAPSHOTS_OK
  }
];

/* ───── Amis ───── */

export const friends: FriendStatus[] = [
  {
    name: 'Lina', platform: 'Steam', state: 'En partie classée', online: true, gameId: 'call-of-duty-mw4', joinable: true, since: 'Depuis 25 min',
    tagline: 'Classée tous les soirs, micro toujours ouvert.', friendSince: 'Amie depuis mars 2021',
    games: [{ gameId: 'call-of-duty-mw4', hours: 312 }, { gameId: 'counter-strike-2', hours: 1240 }, { gameId: 'elden-ring', hours: 96 }, { gameId: 'gta-6', hours: 58 }],
    activity: [
      { when: 'Il y a 25 min', text: 'A lancé une partie classée', gameId: 'call-of-duty-mw4' },
      { when: 'Hier', text: 'A joué 3 h 20 avec vous', gameId: 'call-of-duty-mw4' },
      { when: 'Il y a 4 jours', text: 'A terminé l\'histoire principale', gameId: 'gta-6' }
    ]
  },
  {
    name: 'Tomás', platform: 'Riot', state: 'En partie classée, manche 9', online: true, gameId: 'valorant', joinable: false, since: 'Depuis 40 min',
    tagline: 'Jeux de tir uniquement. Ne répond pas pendant une manche.', friendSince: 'Ami depuis septembre 2022',
    games: [{ gameId: 'valorant', hours: 1870 }, { gameId: 'counter-strike-2', hours: 640 }, { gameId: 'call-of-duty-mw4', hours: 84 }],
    activity: [
      { when: 'Il y a 40 min', text: 'A lancé une partie classée', gameId: 'valorant' },
      { when: 'Avant-hier', text: 'A joué 2 h 05', gameId: 'counter-strike-2' },
      { when: 'La semaine dernière', text: 'A installé le jeu', gameId: 'call-of-duty-mw4' }
    ]
  },
  {
    name: 'Noor', platform: 'Steam', state: 'Au campement, groupe ouvert', online: true, gameId: 'baldurs-gate-3', joinable: true, since: 'Depuis 1 h 10',
    tagline: 'Jeux de rôle au long cours, toujours partante pour une campagne à plusieurs.', friendSince: 'Amie depuis juin 2019',
    games: [{ gameId: 'baldurs-gate-3', hours: 428 }, { gameId: 'the-witcher-3', hours: 205 }, { gameId: 'expedition-33', hours: 71 }, { gameId: 'cyberpunk-2077', hours: 132 }],
    activity: [
      { when: 'Il y a 1 h 10', text: 'A ouvert son groupe', gameId: 'baldurs-gate-3' },
      { when: 'Hier', text: 'A obtenu un succès rare', gameId: 'expedition-33' },
      { when: 'Il y a 6 jours', text: 'A commencé une nouvelle partie', gameId: 'the-witcher-3' }
    ]
  },
  {
    name: 'Sacha', platform: 'Steam', state: 'Dans le menu, cherche un adversaire', online: true, gameId: 'dragon-ball-sparking-zero', joinable: true, since: 'Depuis 5 min',
    tagline: 'Combat et jeux d\'action. Revanche acceptée à toute heure.', friendSince: 'Ami depuis janvier 2024',
    games: [{ gameId: 'dragon-ball-sparking-zero', hours: 164 }, { gameId: 'monster-hunter-wilds', hours: 233 }, { gameId: 'black-myth-wukong', hours: 47 }],
    activity: [
      { when: 'Il y a 5 min', text: 'Cherche un adversaire', gameId: 'dragon-ball-sparking-zero' },
      { when: 'Hier', text: 'A joué 1 h 40 avec vous', gameId: 'dragon-ball-sparking-zero' },
      { when: 'Il y a 3 jours', text: 'A battu le dernier chef', gameId: 'black-myth-wukong' }
    ]
  },
  {
    name: 'Maëlle', platform: 'Epic', state: 'En ligne, ne joue pas', online: true, gameId: null, joinable: false, since: 'Depuis 2 h',
    tagline: 'Aventures solo, une histoire à la fois.', friendSince: 'Amie depuis novembre 2020',
    games: [{ gameId: 'the-last-of-us-2', hours: 62 }, { gameId: 'ghost-of-tsushima', hours: 88 }, { gameId: 'red-dead-redemption-2', hours: 141 }],
    activity: [
      { when: 'Hier', text: 'A joué 2 h 30', gameId: 'ghost-of-tsushima' },
      { when: 'Il y a 5 jours', text: 'A terminé le jeu', gameId: 'the-last-of-us-2' },
      { when: 'Il y a 2 semaines', text: 'A ajouté le jeu à sa liste d\'envies', gameId: 'fable' }
    ]
  },
  {
    name: 'Ayoub', platform: 'PlayStation', state: 'A joué à Modern Warfare 4', online: false, gameId: 'call-of-duty-mw4', joinable: false, since: 'Hier',
    tagline: 'Joue sur console, rejoint les parties du week-end.', friendSince: 'Ami depuis août 2023',
    games: [{ gameId: 'call-of-duty-mw4', hours: 190 }, { gameId: 'god-of-war-ragnarok', hours: 54 }, { gameId: 'gta-6', hours: 77 }],
    activity: [
      { when: 'Hier', text: 'A joué 1 h 50', gameId: 'call-of-duty-mw4' },
      { when: 'Samedi', text: 'A joué 4 h avec vous', gameId: 'call-of-duty-mw4' },
      { when: 'Il y a 2 semaines', text: 'A terminé le jeu', gameId: 'god-of-war-ragnarok' }
    ]
  },
  {
    name: 'Inès', platform: 'Steam', state: 'A joué à Elden Ring', online: false, gameId: 'elden-ring', joinable: false, since: 'Il y a 3 jours',
    tagline: 'Jeux difficiles, sans carte ni guide.', friendSince: 'Amie depuis février 2022',
    games: [{ gameId: 'elden-ring', hours: 356 }, { gameId: 'hollow-knight-silksong', hours: 68 }, { gameId: 'hades-2', hours: 112 }, { gameId: 'black-myth-wukong', hours: 39 }],
    activity: [
      { when: 'Il y a 3 jours', text: 'A joué 2 h 15', gameId: 'elden-ring' },
      { when: 'La semaine dernière', text: 'A obtenu un succès rare', gameId: 'hollow-knight-silksong' },
      { when: 'Il y a 3 semaines', text: 'A terminé une partie sans mourir', gameId: 'hades-2' }
    ]
  },
  {
    name: 'Baptiste', platform: 'Xbox', state: 'A joué à Forza Horizon 6', online: false, gameId: 'forza-horizon-6', joinable: false, since: 'La semaine dernière',
    tagline: 'Courses et mondes ouverts, volant branché.', friendSince: 'Ami depuis mai 2018',
    games: [{ gameId: 'forza-horizon-6', hours: 143 }, { gameId: 'red-dead-redemption-2', hours: 97 }, { gameId: 'gta-6', hours: 64 }],
    activity: [
      { when: 'La semaine dernière', text: 'A joué 3 h', gameId: 'forza-horizon-6' },
      { when: 'Il y a 2 semaines', text: 'A terminé le premier festival', gameId: 'forza-horizon-6' },
      { when: 'Il y a 1 mois', text: 'A repris sa partie', gameId: 'red-dead-redemption-2' }
    ]
  }
];

/* ───── Notifications ───── */

export const notices: Notice[] = [
  { id: 'n1', kind: 'friend', title: 'Lina joue à Modern Warfare 4', text: 'En partie classée depuis 25 minutes. Vous pouvez la rejoindre.', when: 'Il y a 25 min', href: '#/friends/Lina', unread: true, friend: 'Lina', gameId: 'call-of-duty-mw4' },
  { id: 'n2', kind: 'fix', title: '2 mods incompatibles sur Cyberpunk 2077', text: 'Ils seront désactivés au prochain lancement, avec votre accord.', when: 'Il y a 1 h', href: '#/mods/cyberpunk-2077', unread: true, gameId: 'cyberpunk-2077' },
  { id: 'n4', kind: 'achievement', title: 'Succès obtenu : Membre de l\'expédition', text: 'Clair Obscur : Expedition 33. Atteindre le niveau 33.', when: 'Hier, 23 h 10', href: '#/game/expedition-33?tab=succes', unread: false, gameId: 'expedition-33', achievement: 'Membre de l\'expédition' },
  { id: 'n9', kind: 'achievement', title: 'Succès obtenu : En bonne compagnie', text: 'Red Dead Redemption 2. Terminez une activité avec un camarade dans chaque camp.', when: 'Hier, 22 h 40', href: '#/game/red-dead-redemption-2?tab=succes', unread: false, gameId: 'red-dead-redemption-2', achievement: 'En bonne compagnie' },
  { id: 'n5', kind: 'fix', title: 'Bilan prêt : vos 2 saccades venaient du réseau', text: 'Modern Warfare 4, hier soir. Le PC n\'était pas en cause.', when: 'Hier, 22 h 14', href: '#/report/call-of-duty-mw4-1', unread: false, gameId: 'call-of-duty-mw4' },
  { id: 'n10', kind: 'friend', title: 'Noor a ouvert son groupe', text: 'Baldur\'s Gate 3, au campement. Une place est libre.', when: 'Hier, 20 h 55', href: '#/friends/Noor', unread: false, friend: 'Noor', gameId: 'baldurs-gate-3' },
  { id: 'n7', kind: 'update', title: 'Modern Warfare 4 : Saison 1 installée', text: 'Mise à jour de 18,2 Go terminée.', when: 'Hier, 20 h 41', href: '#/game/call-of-duty-mw4?tab=actus', unread: false, gameId: 'call-of-duty-mw4' },
  { id: 'n8', kind: 'update', title: 'Cyberpunk 2077 est passé en version 2.5', text: 'Mise à jour automatique. Deux mods ne la prennent pas encore en charge.', when: 'Hier, 18 h 04', href: '#/game/cyberpunk-2077?tab=sante', unread: false, gameId: 'cyberpunk-2077' }
];

/* ───── Guides pas à pas ───── */

export const guides: Guide[] = [
  {
    id: 'memoire',
    title: 'Activer le profil rapide de la mémoire vive',
    intro: 'Vos barrettes sont vendues pour 3600 MHz mais tournent à 2133 MHz : c\'est le réglage d\'usine de presque tous les PC. Le profil rapide (appelé XMP, EXPO ou DOCP selon la marque) s\'active en une minute dans le BIOS.',
    duration: '5 minutes',
    level: 'Facile, sans outil',
    warmupDoes: 'Warmup ne peut pas modifier le BIOS à votre place. Il vous guide, puis vérifie le résultat au redémarrage.',
    back: { label: 'Retour au diagnostic', href: '#/diagnostic' },
    steps: [
      { title: 'Redémarrez le PC et entrez dans le BIOS', text: 'Enregistrez votre travail, redémarrez, puis appuyez plusieurs fois sur la touche Suppr dès que l\'écran s\'allume. Sur certains PC, la touche est F2.', tip: 'Si Windows démarre, vous avez appuyé trop tard : redémarrez et recommencez.', visual: { screen: 'Démarrage du PC', lines: ['Carte mère détectée', 'Mémoire : 16 Go à 2133 MHz', 'Appuyez sur Suppr pour entrer dans le BIOS'], highlight: 2, key: 'Suppr' } },
      { title: 'Ouvrez la page de la mémoire', text: 'Sur l\'écran d\'accueil du BIOS, cherchez la ligne qui parle de la mémoire. Elle s\'appelle XMP, EXPO, DOCP ou « Profil mémoire » selon la marque de votre carte mère.', visual: { screen: 'BIOS · Accueil', lines: ['Processeur : Ryzen 5, 46 °C', 'Mémoire : 16 Go, 2133 MHz', 'Profil mémoire (XMP / EXPO) : Désactivé', 'Ordre de démarrage'], highlight: 2 } },
      { title: 'Choisissez le profil 1', text: 'Passez la ligne de « Désactivé » à « Profil 1 ». La fréquence affichée doit passer à 3600 MHz. Ne touchez à aucun autre réglage.', tip: 'S\'il existe un profil 2, gardez le 1 : c\'est celui que le fabricant garantit.', visual: { screen: 'BIOS · Profil mémoire', lines: ['Désactivé · 2133 MHz', 'Profil 1 · 3600 MHz', 'Profil 2 · 3466 MHz'], highlight: 1, key: 'Entrée' } },
      { title: 'Enregistrez et quittez', text: 'Appuyez sur F10, puis confirmez. Le PC redémarre tout seul, parfois deux fois de suite : c\'est normal.', visual: { screen: 'BIOS · Enregistrer', lines: ['Profil mémoire : Désactivé → Profil 1', 'Enregistrer les changements et redémarrer ?', 'Oui'], highlight: 2, key: 'F10' } },
      { title: 'Vérifiez dans Warmup', text: 'De retour dans Windows, relancez le diagnostic. La ligne « Mémoire vive » doit afficher 3600 MHz et passer au vert.', tip: 'Si le PC ne démarre plus, il revient seul aux réglages d\'usine après trois essais. Rien n\'est perdu.', visual: { screen: 'Warmup · Diagnostic', lines: ['Écran : 144 Hz actifs', 'Mémoire vive : 16 Go à 3600 MHz', 'Stockage : 212 Go libres'], highlight: 1 } }
    ]
  },
  {
    id: 'box',
    title: 'Donner la priorité au PC de jeu sur votre box',
    intro: 'Quand un autre appareil de la maison regarde une vidéo ou télécharge, votre jeu peut saccader. La plupart des box savent faire passer le PC de jeu en premier.',
    duration: '10 minutes',
    level: 'Facile, depuis un navigateur',
    warmupDoes: 'Warmup ne se connecte pas à votre box et ne voit pas son mot de passe. Il vous montre où trouver l\'option.',
    back: { label: 'Retour au bilan', href: '#/report' },
    steps: [
      { title: 'Ouvrez l\'interface de la box', text: 'Dans votre navigateur, tapez 192.168.1.1 dans la barre d\'adresse. Chez certains opérateurs, l\'adresse est 192.168.0.1 ou 192.168.1.254.', visual: { screen: 'Navigateur', lines: ['http://192.168.1.1', 'Bienvenue sur votre box'], highlight: 0, key: 'Entrée' } },
      { title: 'Connectez-vous', text: 'Le mot de passe d\'administration est écrit sur l\'étiquette collée sous la box, à moins que vous ne l\'ayez changé.', tip: 'Ce mot de passe reste entre vous et la box : Warmup ne le demande jamais.', visual: { screen: 'Box · Connexion', lines: ['Identifiant : admin', 'Mot de passe : voir l\'étiquette de la box', 'Se connecter'], highlight: 1 } },
      { title: 'Trouvez votre PC dans la liste des appareils', text: 'Ouvrez la page « Appareils connectés » ou « Mon réseau ». Votre PC de jeu y apparaît sous son nom, branché en câble.', visual: { screen: 'Box · Appareils connectés', lines: ['Téléviseur du salon · Wi-Fi', 'PC-DE-JEU · câble', 'Téléphone · Wi-Fi', 'Tablette · Wi-Fi'], highlight: 1 } },
      { title: 'Activez la priorité', text: 'Selon l\'opérateur, l\'option s\'appelle « Priorité », « Mode jeu » ou « Qualité de service ». Activez-la pour le PC de jeu, puis enregistrez.', tip: 'Si l\'option n\'existe pas sur votre box, limiter le débit du téléviseur donne un résultat proche.', visual: { screen: 'Box · PC-DE-JEU', lines: ['Adresse : 192.168.1.24', 'Priorité de trafic : Élevée', 'Enregistrer'], highlight: 1 } },
      { title: 'Vérifiez à la prochaine partie', text: 'Jouez comme d\'habitude. Le prochain bilan dira si les pics de ping ont disparu, même quand la maison utilise la connexion.', visual: { screen: 'Warmup · Bilan', lines: ['Ping moyen : 20 ms', 'Ping le plus haut : 31 ms', 'Aucune saccade'], highlight: 1 } }
    ]
  }
];
