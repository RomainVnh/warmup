// Numéro Steam de chaque jeu du catalogue (voir SOURCES.md).
// La version vierge charge les visuels officiels directement chez Steam, à partir de ces numéros :
// le dépôt et l'application publiés ne contiennent plus aucun visuel de jeu.
export const CATALOGUE_STEAM_IDS: Record<string, string> = {
  'cyberpunk-2077': '1091500',
  'call-of-duty-mw4': '4435490',
  'phantom-blade-zero': '4115450',
  'expedition-33': '1903340',
  'baldurs-gate-3': '1086940',
  'red-dead-redemption-2': '1174180',
  'resident-evil-4': '2050650',
  'diablo-4': '2344520',
  'the-last-of-us-1': '1888930',
  'the-last-of-us-2': '2531310',
  'elden-ring': '1245620',
  'the-witcher-3': '292030',
  'hades-2': '1145350',
  'counter-strike-2': '730',
  'monster-hunter-wilds': '2246340',
  'kingdom-come-deliverance-2': '1771300',
  'black-myth-wukong': '2358720',
  'ghost-of-tsushima': '2215430',
  'god-of-war-ragnarok': '2322010',
  'hollow-knight-silksong': '1030300',
  'fable': '2769570',
  'forza-horizon-6': '2483190',
  'dragon-ball-sparking-zero': '1790600',
  'sekiro': '814380',
  'stardew-valley': '413150',
  'lies-of-p': '1627720',
  'spider-man-2': '2651280',
  'final-fantasy-vii-rebirth': '2909400',
  'split-fiction': '2001120',
  'doom-the-dark-ages': '3017860',
  'gta-5': '3240220',
  'resident-evil-requiem': '3764200',
  'silent-hill-townfall': '1636440',
};

/** Les succès de certains jeux sont rangés sous un autre numéro Steam que le jeu lui-même. */
export const ACHIEVEMENT_STEAM_IDS: Record<string, string> = {
  'call-of-duty-mw4': '1938090' // Call of Duty HQ
};

const STORE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
const COMMUNITY = 'https://shared.fastly.steamstatic.com/community_assets/images/apps';

/** Bannière, jaquette et logo officiels d'un jeu, chez Steam. */
export const steamArt = (appId: string) => ({
  art: `${STORE}/${appId}/library_hero.jpg`,
  cover: `${STORE}/${appId}/library_600x900_2x.jpg`,
  logo: `${STORE}/${appId}/logo.png`
});

/** Icône d'un succès chez Steam : même nom de fichier que celui relevé dans le catalogue. */
export function steamAchievementIcon(gameId: string, localIcon: string): string {
  const appId = ACHIEVEMENT_STEAM_IDS[gameId] ?? CATALOGUE_STEAM_IDS[gameId];
  const file = localIcon.split('/').pop() ?? '';
  return appId && /^[\w.-]+$/.test(file) ? `${COMMUNITY}/${appId}/${file}` : '';
}
