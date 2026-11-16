import { steamAchievements } from './achievements-data';
import { gameNews } from './news-data';
import { buildReports, downloads, friends, graphicsFor, guides, modSets, notices } from './mock-extra';
import type { Achievement, Check, Game, LaunchStep, Review, Session, Snapshot } from './types';

// Données d'exemple : les jeux existent, mais les chiffres, noms de joueurs et incidents sont inventés.
// Sous Windows, ces valeurs viendront du PC et des plateformes.

const okChecks: Check[] = [
  { name: 'Écran', value: '2560 × 1440 à 144 Hz, sur la carte graphique', status: 'ok' },
  { name: 'Pilote graphique', value: 'À jour, installé il y a 2 jours', status: 'ok' },
  { name: 'Températures', value: 'Processeur 46 °C, carte graphique 41 °C au repos', status: 'ok' },
  { name: 'Arrière-plan', value: 'Aucun téléchargement ni programme gourmand', status: 'ok' },
  { name: 'Espace disque', value: '212 Go libres', status: 'ok' }
];

const okSteps: LaunchStep[] = [
  { name: 'Écran', value: '144 Hz actifs', fixed: false },
  { name: 'Pilote graphique', value: 'À jour', fixed: false },
  { name: 'Températures', value: '46 °C au repos', fixed: false },
  { name: 'Arrière-plan', value: 'Rien à signaler', fixed: false },
  { name: 'Fichiers du jeu', value: 'Complets', fixed: false }
];

const sessions = (rows: [string, string, string, boolean][]): Session[] =>
  rows.map(([date, length, result, ok]) => ({ date, length, result, ok }));

const WHEN = ['Hier', 'Il y a 3 jours', 'Il y a 1 semaine', 'Il y a 2 semaines', 'Il y a 3 semaines', 'Le mois dernier', 'Il y a 2 mois', 'Il y a 3 mois'];

// Succès réels du jeu. Ceux marqués « obtenus » sont inventés : on prend les plus courants, comme pour un joueur en cours de partie.
const achievements = (id: string, done: number): Game['achievements'] => {
  const all = [...(steamAchievements[id] ?? [])].sort((a, b) => b.rarity - a.rarity);
  const count = Math.min(done, all.length);
  const list = all.map((a, i): Achievement => ({ ...a, when: i < count ? WHEN[Math.min(WHEN.length - 1, Math.floor(((count - 1 - i) / count) * WHEN.length))] : null }));
  return { done: count, total: list.length, list };
};

const reviews = (percent: number, count: number, list: [string, boolean, number, string][]): Game['reviews'] => ({
  percent,
  count,
  label: percent >= 90 ? 'Extrêmement positives' : percent >= 80 ? 'Très positives' : percent >= 70 ? 'Plutôt positives' : 'Mitigées',
  list: list.map(([author, positive, hours, text]): Review => ({ author, positive, hours, text }))
});

type Seed = Pick<Game, 'id' | 'title' | 'source' | 'hours' | 'sizeGb' | 'lastPlayed' | 'recentRank' | 'genre' | 'summary'> & Partial<Game>;

const game = (seed: Seed): Game => ({
  installed: true,
  favorite: false,
  art: `art/${seed.id}/hero.jpg`,
  cover: `art/${seed.id}/cover.jpg`,
  logo: `art/${seed.id}/logo.png`,
  screenshots: [1, 2, 3, 4].map((n) => `art/${seed.id}/shot${n}.jpg`),
  status: 'ok',
  statusLabel: 'Prêt',
  developer: 'Studio indépendant',
  year: 2024,
  multiplayer: false,
  version: '1.0',
  location: `D:\\Jeux\\${seed.title}`,
  region: null,
  modCount: 0,
  achievements: achievements(seed.id, Math.round(Math.min(0.9, seed.hours / 220) * (steamAchievements[seed.id]?.length ?? 0))),
  friends: [],
  news: gameNews[seed.id] ?? [],
  reviews: reviews(84, 5200, [
    ['Maëlle', true, 32, 'Une ambiance superbe et une histoire qui tient jusqu\'au bout.'],
    ['Okan', false, 6, 'Beau, mais quelques longueurs en milieu de partie.']
  ]),
  checks: okChecks,
  changes: [],
  sessions: sessions([[seed.lastPlayed, '1 h 10', 'Sans incident', true], ['La fois précédente', '0 h 45', 'Sans incident', true]]),
  graphics: graphicsFor(seed.id),
  launch: { steps: okSteps, resultTitle: '5 points vérifiés', resultText: 'Tout est en ordre. Bon jeu.' },
  ...seed
});

// Les jeux sont réels, mais les heures, succès, amis, avis et incidents affichés sont inventés.
const games: Game[] = [
  game({
    id: 'call-of-duty-mw4', title: 'Call of Duty: Modern Warfare 4', source: 'Steam', hours: 212, sizeGb: 148, lastPlayed: 'Il y a 3 jours', recentRank: 3,
    logo: null, favorite: true, genre: 'Tir à la première personne', developer: 'Infinity Ward', year: 2026, multiplayer: true, version: '1.08', region: 'Europe de l\'Ouest',
    summary: 'La péninsule coréenne bascule dans la guerre. Une campagne solo, un multijoueur compétitif à six contre six et un mode coopératif, avec des parties classées sur des serveurs dédiés.',
    achievements: achievements('call-of-duty-mw4', 41),
    friends: [
      { name: 'Lina', platform: 'Steam', state: 'En partie classée', online: true },
      { name: 'Tomás', platform: 'Steam', state: 'En ligne', online: true },
      { name: 'Ayoub', platform: 'PlayStation', state: 'A joué hier', online: false },
      { name: 'Sacha', platform: 'Xbox', state: 'A joué il y a 3 jours', online: false }
    ],
    reviews: reviews(78, 96000, [
      ['Inès', true, 640, 'Le meilleur multijoueur de la série depuis longtemps, surtout en équipe.'],
      ['Baptiste', true, 120, 'Serveurs stables, mises à jour régulières. La campagne est courte mais intense.'],
      ['Yuki', false, 45, 'Très bon jeu, mais il prend énormément de place sur le disque.']
    ]),
    checks: [...okChecks, { name: 'Serveurs du jeu', value: '18 ms, Europe de l\'Ouest, service normal', status: 'ok' }],
    changes: [{ level: 2, title: 'Pilote graphique mis à jour', text: 'Aucun problème connu avec ce jeu pour cette version du pilote.', when: 'Il y a 2 jours' }],
    sessions: sessions([['Hier', '1 h 12', '2 saccades, réseau', false], ['Avant-hier', '1 h 52', 'Sans incident', true], ['Il y a 4 jours', '2 h 05', 'Sans incident', true], ['Il y a 5 jours', '0 h 40', 'Sans incident', true]]),
    launch: {
      steps: [
        { name: 'Écran', value: '144 Hz actifs', fixed: false },
        { name: 'Pilote graphique', value: 'À jour', fixed: false },
        { name: 'Températures', value: '46 °C au repos', fixed: false },
        { name: 'Arrière-plan', value: 'Téléchargement Steam mis en pause', fixed: true },
        { name: 'Serveurs du jeu', value: '18 ms, Europe de l\'Ouest', fixed: false }
      ],
      resultTitle: '5 points vérifiés, 1 corrigé',
      resultText: 'Le téléchargement Steam reprendra tout seul à la fin de la partie.'
    }
  }),
  game({
    id: 'cyberpunk-2077', title: 'Cyberpunk 2077', source: 'GOG', hours: 96, sizeGb: 84, lastPlayed: 'Hier', recentRank: 2,
    favorite: true, status: 'warn', statusLabel: '2 points à corriger', genre: 'Jeu de rôle en monde ouvert', developer: 'CD Projekt Red', year: 2020, version: '2.5', modCount: 42,
    summary: 'Night City, mégalopole obsédée par le pouvoir et les implants. Vous incarnez V, mercenaire à la recherche d\'un implant unique qui donnerait l\'immortalité. Sa communauté de mods est l\'une des plus actives.',
    achievements: achievements('cyberpunk-2077', 27),
    reviews: reviews(85, 780000, [
      ['Clément', true, 210, 'Après ses mises à jour, le jeu tient enfin ses promesses. La ville est incroyable.'],
      ['Rania', true, 88, 'Avec quelques mods, c\'est l\'un des meilleurs mondes ouverts.'],
      ['Lukas', false, 12, 'Chaque mise à jour casse mes mods, c\'est pénible.']
    ]),
    checks: [
      { name: 'Mods', value: '40 compatibles, 2 incompatibles avec la version 2.5', status: 'warn' },
      { name: 'Outil de scripts', value: 'Version installée plus ancienne que celle demandée par le jeu', status: 'warn' },
      ...okChecks
    ],
    changes: [
      { level: 0, title: 'Le jeu est passé de la version 2.4 à la 2.5', text: 'Mise à jour automatique. Elle casse les mods qui dépendent de l\'ancien moteur de scripts.', when: 'Hier, 18 h 04' },
      { level: 0, title: '2 mods non mis à jour pour la version 2.5', text: 'Vivid Streets et Night City Traffic. Signalés par 312 joueurs dans le catalogue.', when: 'Depuis hier' },
      { level: 1, title: 'Pilote graphique mis à jour', text: 'Aucun problème connu avec ce jeu pour cette version du pilote.', when: 'Il y a 2 jours' },
      { level: 2, title: '1 nouveau programme au démarrage de Windows', text: 'Logiciel d\'éclairage du clavier. Utilise peu de ressources.', when: 'Il y a 2 jours' }
    ],
    sessions: sessions([['Hier', '0 h 03', 'Plantage au chargement', false], ['Avant-hier', '2 h 10', 'Sans incident', true], ['Il y a 4 jours', '1 h 25', 'Sans incident', true], ['Il y a 6 jours', '3 h 02', '1 saccade, disque', false]]),
    launch: {
      steps: [
        { name: 'Mods', value: '2 mods incompatibles désactivés', fixed: true },
        { name: 'Outil de scripts', value: 'Mis à jour en version 1.32', fixed: true },
        { name: 'Écran', value: '144 Hz actifs', fixed: false },
        { name: 'Pilote graphique', value: 'À jour', fixed: false },
        { name: 'Arrière-plan', value: 'Rien à signaler', fixed: false }
      ],
      resultTitle: '5 points vérifiés, 2 corrigés',
      resultText: 'Chaque correction est notée dans le journal et peut être annulée.'
    }
  }),
  game({ id: 'gta-6', title: 'Grand Theft Auto VI', source: 'Rockstar', hours: 41, sizeGb: 162, lastPlayed: 'Hier', recentRank: 1, logo: null, favorite: true, featuredArt: 'art/gta-6/featured.jpg',
    genre: 'Action et aventure en monde ouvert', developer: 'Rockstar North', year: 2026, version: '1.02',
    summary: 'Jason et Lucia, deux complices pris dans un coup qui tourne mal, traversent l\'État de Leonida et les néons de Vice City pour s\'en sortir ensemble.',
    reviews: reviews(96, 310000, [['Maëlle', true, 58, 'Un monde ouvert d\'une densité jamais vue.'], ['Okan', true, 22, 'L\'histoire prend son temps, mais quelle mise en scène.']]) }),
  game({ id: 'expedition-33', title: 'Clair Obscur: Expedition 33', source: 'Steam', hours: 38, sizeGb: 43, lastPlayed: 'Il y a 5 jours', recentRank: 5, favorite: true,
    genre: 'Jeu de rôle au tour par tour', developer: 'Sandfall Interactive', year: 2025, version: '1.4',
    summary: 'Chaque année, la Peintresse inscrit un nombre sur son monolithe, et tous ceux qui ont cet âge disparaissent. L\'Expédition 33 part pour l\'arrêter. Des combats au tour par tour où l\'esquive et la parade se jouent en temps réel.',
    reviews: reviews(94, 142000, [['Inès', true, 61, 'Une direction artistique et une musique inoubliables.'], ['Lukas', true, 35, 'Le meilleur système de combat du genre depuis des années.']]) }),
  game({ id: 'baldurs-gate-3', title: 'Baldur\'s Gate 3', source: 'Steam', hours: 187, sizeGb: 146, lastPlayed: 'La semaine dernière', recentRank: 6, modCount: 6,
    genre: 'Jeu de rôle', developer: 'Larian Studios', year: 2023, multiplayer: true, version: 'Patch 8', region: null,
    summary: 'Réunissez votre groupe et retournez aux Royaumes Oubliés. Une aventure où chaque choix compte, seul ou en coopération jusqu\'à quatre, dans l\'univers de Donjons et Dragons.',
    friends: [{ name: 'Lina', platform: 'Steam', state: 'A joué il y a 2 jours', online: false }, { name: 'Noor', platform: 'Steam', state: 'En ligne', online: true }],
    reviews: reviews(96, 720000, [['Clément', true, 310, 'Trois parties terminées, trois histoires différentes.'], ['Rania', true, 140, 'Chaque compagnon mérite son propre jeu.']]) }),
  game({ id: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', source: 'Steam', hours: 124, sizeGb: 120, lastPlayed: 'Il y a 2 semaines', recentRank: 7,
    genre: 'Action et aventure en monde ouvert', developer: 'Rockstar Games', year: 2019, version: '1.31',
    summary: 'Amérique, 1899. Arthur Morgan et la bande de Dutch van der Linde fuient à travers un pays qui n\'a plus de place pour les hors-la-loi.',
    reviews: reviews(92, 690000, [['Baptiste', true, 204, 'Le monde ouvert le plus vivant jamais fait.'], ['Yuki', false, 9, 'Magnifique, mais le rythme est très lent au début.']]) }),
  game({ id: 'resident-evil-4', installed: false, title: 'Resident Evil 4', source: 'Steam', hours: 23, sizeGb: 58, lastPlayed: 'Il y a 3 semaines', recentRank: 8,
    genre: 'Horreur et action', developer: 'Capcom', year: 2023, version: '1.1',
    summary: 'Six ans après Raccoon City, Leon S. Kennedy est envoyé dans un village reculé d\'Europe pour retrouver la fille du président. Le classique de 2005, entièrement refait.',
    reviews: reviews(97, 110000, [['Maëlle', true, 41, 'Un remake exemplaire, tendu du début à la fin.'], ['Okan', true, 18, 'Le maniement des armes est un régal.']]) }),
  game({ id: 'diablo-4', title: 'Diablo IV', source: 'Battle.net', hours: 76, sizeGb: 90, lastPlayed: 'Le mois dernier', recentRank: 9,
    genre: 'Action et jeu de rôle', developer: 'Blizzard Entertainment', year: 2023, multiplayer: true, version: '2.4', region: 'Europe',
    summary: 'Lilith est de retour à Sanctuaire. Choisissez une classe, parcourez un monde ouvert partagé avec d\'autres joueurs et affrontez des donjons qui changent à chaque saison.',
    friends: [{ name: 'Tomás', platform: 'Steam', state: 'A joué hier', online: false }],
    reviews: reviews(74, 58000, [['Inès', true, 230, 'Les saisons récentes ont vraiment relancé le jeu.'], ['Lukas', false, 60, 'Très bon jusqu\'au niveau maximum, répétitif ensuite.']]) }),
  game({ id: 'the-last-of-us-2', title: 'The Last of Us Part II Remastered', source: 'Epic', hours: 29, sizeGb: 110, lastPlayed: 'Le mois dernier', recentRank: 10,
    genre: 'Action et aventure', developer: 'Naughty Dog', year: 2025, version: '1.2',
    summary: 'Cinq ans après leur traversée des États-Unis, Ellie et Joel vivent à Jackson. Un événement brutal lance Ellie dans un voyage de vengeance jusqu\'à Seattle.',
    reviews: reviews(89, 21000, [['Rania', true, 33, 'Une mise en scène et un jeu d\'acteurs hors normes.'], ['Clément', true, 27, 'Le mode Sans retour prolonge bien l\'aventure.']]) }),
  game({ id: 'elden-ring', title: 'Elden Ring', source: 'Steam', hours: 142, sizeGb: 62, lastPlayed: 'Il y a 2 mois', recentRank: 11,
    genre: 'Action et jeu de rôle', developer: 'FromSoftware', year: 2022, multiplayer: true, version: '1.16', region: null,
    summary: 'Levez-vous, Sans-éclat. Parcourez l\'Entre-terre, un monde ouvert imaginé par Hidetaka Miyazaki et George R. R. Martin, et devenez Seigneur d\'Elden.',
    reviews: reviews(93, 810000, [['Baptiste', true, 260, 'Une liberté d\'exploration totale.'], ['Yuki', true, 95, 'Difficile, mais toujours juste.']]) }),
  game({ id: 'the-witcher-3', title: 'The Witcher 3: Wild Hunt', source: 'GOG', hours: 163, sizeGb: 57, lastPlayed: 'Il y a 3 mois', recentRank: 12, modCount: 4,
    genre: 'Jeu de rôle en monde ouvert', developer: 'CD Projekt Red', year: 2015, version: '4.04',
    summary: 'Geralt de Riv, chasseur de monstres, cherche Ciri, l\'enfant de la prophétie, dans un monde ravagé par la guerre et traqué par la Chasse sauvage.',
    reviews: reviews(96, 760000, [['Maëlle', true, 180, 'Les quêtes secondaires valent celles des autres jeux.'], ['Okan', true, 120, 'Toujours aussi beau dix ans après.']]) }),
  game({ id: 'hades-2', installed: false, title: 'Hades II', source: 'Epic', hours: 34, sizeGb: 10, lastPlayed: 'Il y a 3 mois', recentRank: 13,
    genre: 'Action et roguelike', developer: 'Supergiant Games', year: 2025, version: '1.0',
    summary: 'Mélinoé, princesse des Enfers, affronte le Titan du temps avec l\'aide de l\'Olympe. Chaque tentative est différente, chaque échec rend plus fort.',
    reviews: reviews(95, 98000, [['Inès', true, 70, 'Encore plus riche que le premier.'], ['Lukas', true, 44, 'On relance une partie sans s\'en rendre compte.']]) }),
  game({ id: 'counter-strike-2', title: 'Counter-Strike 2', source: 'Steam', hours: 640, sizeGb: 60, lastPlayed: 'Il y a 4 jours', recentRank: 14, favorite: true,
    genre: 'Tir tactique en équipe', developer: 'Valve', year: 2023, multiplayer: true, version: '1.41', region: 'Europe de l\'Ouest',
    summary: 'L\'expérience compétitive par excellence depuis plus de vingt ans. Deux équipes de cinq, une bombe à poser ou à désamorcer, et des manches qui se jouent à un détail près.',
    friends: [{ name: 'Tomás', platform: 'Steam', state: 'En partie', online: true }, { name: 'Sacha', platform: 'Steam', state: 'A joué hier', online: false }],
    reviews: reviews(86, 8900000, [['Baptiste', true, 2100, 'Le jeu de tir compétitif de référence.'], ['Yuki', false, 300, 'Excellent, mais les tricheurs gâchent parfois les parties classées.']]) }),
  game({ id: 'valorant', title: 'Valorant', source: 'Riot', hours: 410, sizeGb: 45, lastPlayed: 'La semaine dernière', recentRank: 15, favorite: true,
    genre: 'Tir tactique en équipe', developer: 'Riot Games', year: 2020, multiplayer: true, version: '13.10', region: 'Europe de l\'Ouest',
    summary: 'Un jeu de tir tactique à cinq contre cinq où chaque agent a ses propres compétences. Une équipe pose le spike, l\'autre le désamorce, et la précision compte autant que la coordination.',
    friends: [{ name: 'Tomás', platform: 'Riot', state: 'En partie classée', online: true }, { name: 'Noor', platform: 'Riot', state: 'A joué hier', online: false }],
    reviews: { percent: 0, count: 0, label: 'Aucun avis disponible', list: [] } }),
  game({ id: 'monster-hunter-wilds', title: 'Monster Hunter Wilds', source: 'Steam', hours: 88, sizeGb: 75, lastPlayed: 'Il y a 2 semaines', recentRank: 16,
    genre: 'Action et chasse en coopération', developer: 'Capcom', year: 2025, multiplayer: true, version: '1.042', region: 'Europe',
    summary: 'Des environnements qui se transforment d\'un moment à l\'autre sous l\'effet d\'une nature déchaînée, et une histoire de monstres et d\'humains qui cherchent à vivre en harmonie.',
    friends: [{ name: 'Noor', platform: 'Steam', state: 'A joué hier', online: false }],
    reviews: reviews(68, 210000, [['Clément', true, 160, 'Les combats sont les meilleurs de la série.'], ['Rania', false, 40, 'Très exigeant pour le PC, même avec une bonne carte graphique.']]) }),
  game({ id: 'kingdom-come-deliverance-2', title: 'Kingdom Come: Deliverance II', source: 'Epic', hours: 71, sizeGb: 100, lastPlayed: 'Il y a 3 semaines', recentRank: 17,
    genre: 'Jeu de rôle en monde ouvert', developer: 'Warhorse Studios', year: 2025, version: '1.5',
    summary: 'L\'Europe du XVe siècle, sans magie ni dragons. Vous incarnez le jeune Henry dans un périple médiéval où chaque combat, chaque repas et chaque nuit de sommeil compte.',
    reviews: reviews(93, 140000, [['Maëlle', true, 110, 'Un monde médiéval d\'un réalisme rare.'], ['Okan', true, 64, 'Lent au départ, passionnant ensuite.']]) }),
  game({ id: 'black-myth-wukong', title: 'Black Myth: Wukong', source: 'Steam', hours: 37, sizeGb: 130, lastPlayed: 'Le mois dernier', recentRank: 18,
    genre: 'Action et jeu de rôle', developer: 'Game Science', year: 2024, version: '1.0.21',
    summary: 'Un jeu d\'action inspiré de la mythologie chinoise. Vous incarnez le Prédestiné et affrontez maints périls pour découvrir la vérité cachée derrière une légende glorieuse.',
    reviews: reviews(96, 1100000, [['Baptiste', true, 58, 'Des combats de boss mémorables du début à la fin.'], ['Inès', true, 41, 'Visuellement, c\'est une claque.']]) }),
  game({ id: 'ghost-of-tsushima', title: 'Ghost of Tsushima Director\'s Cut', source: 'Steam', hours: 61, sizeGb: 75, lastPlayed: 'Il y a 2 mois', recentRank: 19,
    genre: 'Action et aventure en monde ouvert', developer: 'Sucker Punch Productions', year: 2024, multiplayer: true, version: 'Patch 8',
    summary: 'Une tempête approche. Sur l\'île de Tsushima envahie, le samouraï Jin Sakai doit abandonner ses traditions pour devenir le Fantôme. L\'édition complète inclut le mode coopératif Legends.',
    reviews: reviews(95, 150000, [['Rania', true, 70, 'Chaque paysage mérite une capture d\'écran.'], ['Clément', true, 55, 'Un portage PC exemplaire.']]) }),
  game({ id: 'god-of-war-ragnarok', installed: false, title: 'God of War Ragnarök', source: 'Steam', hours: 44, sizeGb: 175, lastPlayed: 'Il y a 2 mois', recentRank: 20,
    genre: 'Action et aventure', developer: 'Santa Monica Studio', year: 2024, version: 'Patch 9.1',
    summary: 'Kratos et Atreus partent en quête de réponses à travers les neuf royaumes, avant l\'arrivée du Ragnarök.',
    reviews: reviews(83, 48000, [['Yuki', true, 52, 'Une suite à la hauteur, avec un duo père-fils toujours aussi fort.'], ['Lukas', true, 38, 'Les combats ont gagné en variété.']]) }),
  game({ id: 'hollow-knight-silksong', title: 'Hollow Knight: Silksong', source: 'GOG', hours: 46, sizeGb: 8, lastPlayed: 'Il y a 3 mois', recentRank: 21,
    genre: 'Action et exploration', developer: 'Team Cherry', year: 2025, version: '1.0.30000',
    summary: 'Explorez, combattez et survivez en grimpant jusqu\'au sommet d\'un vaste royaume maudit par la soie et les mélodies.',
    reviews: reviews(91, 320000, [['Maëlle', true, 80, 'L\'attente valait la peine.'], ['Okan', false, 15, 'Superbe, mais nettement plus dur que le premier.']]) }),
  game({ id: 'fable', title: 'Fable', source: 'Steam', hours: 0, sizeGb: 92, lastPlayed: 'Jamais lancé', recentRank: 22,
    genre: 'Action et jeu de rôle en monde ouvert', developer: 'Playground Games', year: 2027, version: 'Préchargé',
    summary: 'Devenez le héros ou l\'héroïne que vous voulez à Albion, dans un monde ouvert où chaque décision façonne votre aventure, où la réputation fait loi et où les fins de contes de fées ne sont jamais garanties. Sortie le 23 février 2027.',
    sessions: [], reviews: { percent: 0, count: 0, label: 'Aucun avis avant la sortie', list: [] } }),
  game({ id: 'forza-horizon-6', installed: false, title: 'Forza Horizon 6', source: 'Steam', hours: 58, sizeGb: 155, lastPlayed: 'Il y a 5 mois', recentRank: 23, logo: null,
    genre: 'Course en monde ouvert', developer: 'Playground Games', year: 2026, multiplayer: true, version: '1.479', region: 'Europe',
    summary: 'Le festival Horizon s\'installe au Japon. Plus de 550 voitures réelles, des routes de montagne aux rues de Tokyo, et des courses à partager en ligne.',
    reviews: reviews(87, 96000, [['Rania', true, 120, 'Le Japon était la destination que tout le monde attendait.'], ['Clément', true, 35, 'On y revient chaque semaine pour la nouvelle voiture.']]) }),
  game({ id: 'dragon-ball-sparking-zero', title: 'Dragon Ball: Sparking! Zero', source: 'Steam', hours: 47, sizeGb: 29, lastPlayed: 'Il y a 6 jours', recentRank: 24,
    genre: 'Combat en arène', developer: 'Spike Chunsoft', year: 2024, multiplayer: true, version: '2.0', region: 'Europe',
    summary: 'L\'héritier de la série Budokai Tenkaichi. Incarnez les plus puissants guerriers de l\'univers Dragon Ball dans des combats en arène effrénés, seul contre l\'ordinateur ou en ligne.',
    friends: [{ name: 'Sacha', platform: 'Steam', state: 'En ligne', online: true }],
    reviews: reviews(87, 120000, [['Yuki', true, 90, 'Le jeu Dragon Ball que j\'attendais depuis quinze ans.'], ['Lukas', true, 30, 'Un nombre de personnages délirant.']]) }),
  game({ id: 'sekiro', title: 'Sekiro: Shadows Die Twice', source: 'Steam', hours: 64, sizeGb: 25, lastPlayed: 'Il y a 6 mois', recentRank: 25,
    genre: 'Action et aventure', developer: 'FromSoftware', year: 2019, version: '1.06',
    summary: 'Japon, fin du XVIe siècle. Le shinobi Loup, laissé pour mort, se relève pour protéger son jeune seigneur. Des duels au sabre où la parade et le rythme comptent plus que la force.',
    reviews: reviews(95, 260000, [['Baptiste', true, 88, 'Le plus exigeant des FromSoftware, et le plus gratifiant.'], ['Inès', true, 120, 'Chaque duel finit par devenir une danse.']]) }),
  game({ id: 'stardew-valley', title: 'Stardew Valley', source: 'Steam', hours: 214, sizeGb: 1, lastPlayed: 'Il y a 1 an', recentRank: 34, favorite: true,
    genre: 'Simulation de ferme et jeu de rôle', developer: 'ConcernedApe', year: 2016, multiplayer: true, version: '1.6.15',
    summary: 'Vous héritez de la vieille ferme de votre grand-père à Pélican Ville. Cultivez, pêchez, explorez les mines et liez-vous avec les habitants, seul ou jusqu\'à huit en coopération.',
    friends: [{ name: 'Noor', platform: 'Steam', state: 'A joué hier', online: false }, { name: 'Maëlle', platform: 'Epic', state: 'En ligne', online: true }],
    reviews: reviews(98, 820000, [['Maëlle', true, 320, 'Le jeu parfait pour décompresser le soir.'], ['Clément', true, 140, 'Dix ans après, toujours aussi attachant.']]) }),
  game({ id: 'lies-of-p', title: 'Lies of P', source: 'Steam', hours: 52, sizeGb: 80, lastPlayed: 'Il y a 6 mois', recentRank: 26,
    genre: 'Action et jeu de rôle', developer: 'NEOWIZ', year: 2023, version: '1.14.0.0',
    summary: 'Krat, une ville de la Belle Époque ravagée par ses propres pantins. Vous incarnez P, une marionnette qui découvre que chaque mensonge le rend plus humain.',
    reviews: reviews(91, 64000, [['Okan', true, 70, 'Un des meilleurs jeux du genre hors FromSoftware.'], ['Yuki', true, 45, 'L\'ambiance de Krat est inoubliable.']]) }),
  game({ id: 'spider-man-2', installed: false, title: 'Marvel\'s Spider-Man 2', source: 'Steam', hours: 12, sizeGb: 140, lastPlayed: 'Il y a 7 mois', recentRank: 27,
    genre: 'Action et aventure en monde ouvert', developer: 'Insomniac Games', year: 2025, version: '2.810.0.0',
    summary: 'Peter Parker et Miles Morales unissent leurs forces dans un New York agrandi, face à Kraven le chasseur et au symbiote Venom.',
    reviews: reviews(79, 18000, [['Rania', true, 30, 'Se balancer entre les gratte-ciel reste un pur plaisir.'], ['Lukas', false, 8, 'Le portage PC a demandé plusieurs correctifs.']]) }),
  game({ id: 'final-fantasy-vii-rebirth', installed: false, title: 'Final Fantasy VII Rebirth', source: 'Steam', hours: 31, sizeGb: 155, lastPlayed: 'Il y a 7 mois', recentRank: 28,
    genre: 'Jeu de rôle et action', developer: 'Square Enix', year: 2025, version: '1.005',
    summary: 'Cloud et ses compagnons quittent Midgar et parcourent un monde immense sur les traces de Sephiroth. Le deuxième volet de la trilogie qui réinvente Final Fantasy VII.',
    reviews: reviews(92, 22000, [['Inès', true, 95, 'Le monde ouvert est rempli de choses à faire.'], ['Okan', true, 60, 'Les combats mêlent action et stratégie à merveille.']]) }),
  game({ id: 'split-fiction', title: 'Split Fiction', source: 'Steam', hours: 19, sizeGb: 85, lastPlayed: 'Il y a 8 mois', recentRank: 30, multiplayer: true, region: 'Europe',
    genre: 'Aventure en coopération', developer: 'Hazelight Studios', year: 2025, version: '1.0.4',
    summary: 'Mio et Zoé, deux autrices que tout oppose, se retrouvent piégées dans leurs propres histoires, entre science-fiction et fantasy. Une aventure qui se joue uniquement à deux.',
    friends: [{ name: 'Sacha', platform: 'Steam', state: 'A joué avec vous', online: true }],
    reviews: reviews(97, 90000, [['Sacha', true, 19, 'Chaque chapitre invente une nouvelle façon de jouer.'], ['Rania', true, 16, 'Le meilleur jeu à deux depuis It Takes Two.']]) }),
  game({ id: 'doom-the-dark-ages', installed: false, title: 'DOOM: The Dark Ages', source: 'Steam', hours: 22, sizeGb: 80, lastPlayed: 'Il y a 10 mois', recentRank: 32,
    genre: 'Tir à la première personne', developer: 'id Software', year: 2025, version: 'Mise à jour 4',
    summary: 'Le préquel de DOOM (2016). Le Doom Slayer affronte les légions de l\'Enfer dans un monde médiéval et sombre, bouclier-scie à la main.',
    reviews: reviews(84, 33000, [['Baptiste', true, 25, 'Plus lourd et plus brutal que DOOM Eternal.'], ['Okan', true, 14, 'Le bouclier change toute la façon de jouer.']]) }),
  game({ id: 'gta-5', title: 'Grand Theft Auto V', source: 'Steam', hours: 356, sizeGb: 110, lastPlayed: 'Il y a 8 mois', recentRank: 29, multiplayer: true, region: 'Europe',
    genre: 'Action et aventure en monde ouvert', developer: 'Rockstar North', year: 2025, version: 'Version améliorée 1.0.889',
    summary: 'Trois criminels que tout oppose, Michael, Franklin et Trevor, enchaînent les braquages à Los Santos. La version améliorée inclut GTA Online, avec ses événements renouvelés chaque semaine.',
    friends: [{ name: 'Ayoub', platform: 'PlayStation', state: 'A joué hier', online: false }, { name: 'Baptiste', platform: 'Xbox', state: 'A joué la semaine dernière', online: false }],
    reviews: reviews(86, 1700000, [['Ayoub', true, 900, 'Dix ans plus tard, GTA Online me fait toujours revenir.'], ['Maëlle', true, 120, 'L\'histoire à trois personnages reste géniale.']]) }),
  game({ id: 'resident-evil-requiem', title: 'Resident Evil Requiem', source: 'Steam', hours: 26, sizeGb: 70, lastPlayed: 'Il y a 9 mois', recentRank: 31, logo: null,
    genre: 'Horreur et survie', developer: 'Capcom', year: 2026, version: '1.300',
    summary: 'Un requiem pour les morts, l\'enfer pour les vivants. Grace Ashcroft, analyste du FBI, enquête sur une série de morts mystérieuses, pendant que Leon S. Kennedy reprend du service.',
    reviews: reviews(95, 120000, [['Okan', true, 30, 'Le meilleur Resident Evil depuis des années.'], ['Inès', true, 24, 'Les passages avec Grace sont terrifiants.']]) }),
  game({ id: 'silent-hill-townfall', title: 'Silent Hill: Townfall', source: 'Steam', hours: 9, sizeGb: 45, lastPlayed: 'Il y a 10 mois', recentRank: 33, logo: null,
    genre: 'Horreur psychologique', developer: 'Screen Burn', year: 2026, version: '1.6.0',
    summary: 'De retour sur l\'île de St. Amelia pour « tout arranger », Simon Ordell plonge dans un monde d\'esquives tendues, d\'affrontements et d\'énigmes qui révèlent peu à peu la vérité.',
    reviews: reviews(78, 9000, [['Maëlle', true, 11, 'Une ambiance radio grésillante qui donne des frissons.'], ['Lukas', false, 6, 'Des saccades au lancement, corrigées depuis.']]) }),
  game({ id: 'phantom-blade-zero', title: 'Phantom Blade Zero', source: 'Steam', hours: 18, sizeGb: 120, lastPlayed: 'Il y a 4 jours', recentRank: 4, logo: null,
    genre: 'Action et jeu de rôle', developer: 'S-GAME', year: 2026, version: '1.0302256',
    summary: 'Un monde wuxia sombre, entre arts martiaux et fantastique. Vous incarnez Soul, un assassin qui n\'a plus que 66 jours à vivre : repoussez les tueurs lancés à vos trousses, déjouez les complots et défendez vos valeurs jusqu\'au bout.',
    reviews: reviews(90, 45000, [['Sacha', true, 22, 'Des combats d\'une vitesse et d\'une élégance rares.'], ['Okan', true, 15, 'L\'univers wuxia change des jeux d\'action habituels.']]) }),
  game({ id: 'the-last-of-us-1', installed: false, title: 'The Last of Us Part I', source: 'Steam', hours: 21, sizeGb: 100, lastPlayed: 'Il y a 1 an', recentRank: 35,
    genre: 'Action et aventure', developer: 'Naughty Dog', year: 2023, version: '1.1.5',
    summary: 'Le jeu qui a inspiré la série. Vingt ans après une pandémie qui a ravagé la civilisation, Joel, un survivant endurci, est chargé de faire sortir Ellie, quatorze ans, d\'une zone de quarantaine militaire.',
    reviews: reviews(78, 64000, [['Rania', true, 24, 'Une histoire qui reste bouleversante, même en la connaissant.'], ['Lukas', false, 10, 'Le portage a longtemps été lourd, c\'est bien mieux depuis les correctifs.']]) })
];

export const snapshot: Snapshot = {
  demo: true,
  games,
  week: { hours: [3.4, 0.8, 2, 1.2, 2.2, 3, 4.4], total: '19 h', cleanLaunches: '14 sur 15', fixes: '3' },
  pc: {
    parts: [
      { name: 'Écran', big: '144 Hz actifs', text: 'Branché sur la carte graphique, 2560 × 1440.', status: 'ok' },
      { name: 'Carte graphique', big: '41 °C', text: 'Pilote à jour, installé il y a 2 jours.', status: 'ok' },
      { name: 'Processeur', big: '46 °C', text: '6 cœurs, 4 % d\'utilisation au repos.', status: 'ok' },
      { name: 'Mémoire vive', big: '16 Go à 2133 MHz', text: 'Deux barrettes. Profil rapide désactivé.', status: 'warn' },
      { name: 'Stockage', big: '212 Go libres', text: 'Jeux installés sur un SSD.', status: 'ok' },
      { name: 'Réseau', big: 'Câble · 0 % de perte', text: 'Stable sur les 10 dernières minutes.', status: 'ok' },
      { name: 'Arrière-plan', big: '1 programme gourmand', text: 'Logiciel d\'éclairage, 6 % du processeur.', status: 'warn' },
      { name: 'Windows', big: 'Mode Jeu activé', text: 'Alimentation en performances élevées.', status: 'ok' }
    ],
    issues: [
      { title: 'La mémoire vive tourne moins vite qu\'elle ne le peut', why: 'Vos barrettes peuvent fonctionner à 3600 MHz mais sont réglées sur 2133 MHz. Dans les jeux compétitifs, cela peut coûter des images par seconde et causer des saccades.', change: 'rien automatiquement. Ce réglage se fait dans le BIOS, Warmup vous guide pas à pas.', action: 'Voir le guide', guideId: 'memoire' },
      { title: 'Un logiciel d\'éclairage consomme du processeur en permanence', why: 'Il utilise 6 % du processeur même quand vous jouez, ce qui peut provoquer de petites saccades.', change: 'le programme est mis en pause pendant vos parties, puis relancé à la fin.', action: 'Mettre en pause en jeu' }
    ],
    servers: [
      { game: 'Call of Duty: Modern Warfare 4', region: 'Europe de l\'Ouest', ping: '18 ms', state: 'Service normal', status: 'ok' },
      { game: 'Diablo IV', region: 'Europe', ping: '21 ms', state: 'Service normal', status: 'ok' },
      { game: 'Baldur\'s Gate 3', region: 'Europe', ping: '34 ms', state: 'Panne chez l\'éditeur', status: 'warn' },
      { game: 'Elden Ring', region: 'Europe', ping: '29 ms', state: 'Service normal', status: 'ok' }
    ],
    log: [
      { what: 'Écran passé de 60 Hz à 144 Hz', detail: 'Il y a 6 jours · valeur d\'origine : 60 Hz' },
      { what: 'Téléchargement Steam mis en pause pendant la partie', detail: 'Hier, 21 h 02 · repris automatiquement à 22 h 14' },
      { what: 'Enregistrement en arrière-plan de Windows désactivé', detail: 'Il y a 6 jours · valeur d\'origine : activé' },
      { what: 'Jeu assigné à la carte graphique dédiée', detail: 'Il y a 9 jours · Elden Ring' }
    ]
  },
  mods: modSets,
  reports: buildReports(games),
  friends,
  downloads,
  notices,
  guides,
  profile: {
    name: 'Joueur',
    since: 'Membre depuis novembre 2026',
    accounts: [
      { platform: 'Steam', linked: true, detail: 'Bibliothèque, amis, succès, avis et actualités' },
      { platform: 'Epic Games', linked: true, detail: 'Bibliothèque seulement' },
      { platform: 'Battle.net', linked: true, detail: 'Bibliothèque seulement' },
      { platform: 'Rockstar Games', linked: true, detail: 'Bibliothèque seulement' },
      { platform: 'GOG', linked: true, detail: 'Bibliothèque seulement' },
      { platform: 'Nexus Mods', linked: true, detail: '3 mises à jour de mods disponibles' },
      { platform: 'PlayStation', linked: false, detail: 'Expérimental : pas d\'accès officiel proposé par Sony' }
    ],
    pc: [
      { label: 'Processeur', value: 'Ryzen 5, 6 cœurs' },
      { label: 'Carte graphique', value: 'RTX 4060, 8 Go' },
      { label: 'Mémoire vive', value: '16 Go, deux barrettes' },
      { label: 'Écran', value: '2560 × 1440, 144 Hz' },
      { label: 'Système', value: 'Windows 11' }
    ],
    stats: [
      { big: '96 %', label: 'Lancements sans incident' },
      { big: '17', label: 'Problèmes corrigés' }
    ]
  }
};
