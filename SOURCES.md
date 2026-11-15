# Sources des données et des visuels

Ce document recense d'où viennent les jeux d'exemple de Warmup : visuels, succès, actualités et fiches. Il sert à retrouver l'origine d'un fichier, à le mettre à jour, et à savoir quoi retirer avant de rendre le dépôt public.

> **Droits.** Les noms, logos, jaquettes, captures, icônes de succès et images d'actualités appartiennent aux éditeurs des jeux. Ils servent ici de données d'exemple pour concevoir l'interface. Ils ne doivent pas être publiés ni distribués tels quels.

## Ce qui est réel, ce qui est inventé

| Réel (relevé à la source) | Inventé (données d'exemple) |
| --- | --- |
| Titre, studio, année, genre, résumé | Heures de jeu, dernière partie, rang dans « Jeux récents » |
| Bannière, jaquette, logo, captures | Succès « obtenus » (seule la liste des succès est réelle) |
| Liste complète des succès, avec leur icône et leur rareté | Amis, avis des joueurs, notes et nombre d'avis |
| Actualités : titre, date, image de l'article | Bilans de partie, incidents, mods, téléchargements, notifications |
| | Analyse du PC dans le navigateur (l'application, elle, lit le vrai matériel) |

Les titres et résumés des actualités sont traduits en français à partir des annonces officielles, souvent en anglais.

## Sources

### Steam (la plupart des jeux)

Tout passe par le script [`outils/ajouter-jeu-steam.py`](outils/ajouter-jeu-steam.py), qui utilise `curl`, sans clé ni compte.

| Donnée | Adresse | Fichiers produits |
| --- | --- | --- |
| Trouver le numéro Steam d'un jeu | `store.steampowered.com/api/storesearch/?term=<titre>` | — |
| Chemins des visuels de bibliothèque | `api.steampowered.com/IStoreBrowseService/GetItems/v1/` | — |
| Bannière, jaquette, logo | `shared.akamai.steamstatic.com/store_item_assets/steam/apps/<numéro>/…` | `public/art/<jeu>/hero.jpg`, `cover.jpg`, `logo.png` |
| Captures, studio, date, résumé | `store.steampowered.com/api/appdetails?appids=<numéro>&l=french` | `public/art/<jeu>/shot1.jpg` à `shot4.jpg` |
| Liste des succès (nom, description, succès cachés) | `steamcommunity.com/stats/<numéro>/achievements/?l=french` | `shared/achievements-data.ts` |
| Rareté des succès | `api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=<numéro>` | `shared/achievements-data.ts` |
| Icônes des succès | `shared.fastly.steamstatic.com/community_assets/images/apps/<numéro>/…` | `public/art/<jeu>/ach/` |
| Actualités | `store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid=<numéro>&count_before=0&count_after=10&l=french` | `shared/news-data.ts` |
| Image de chaque actualité | `clan.akamai.steamstatic.com/images/<clan>/<fichier>` | `public/art/<jeu>/news/1.jpg`, `2.jpg`, `3.jpg` |

Les images d'actualités sont converties en JPEG et réduites à 1280 pixels de large avec `sips` (outil fourni avec macOS).

### Rockstar Games (Grand Theft Auto VI)

GTA VI n'est pas sur Steam.

- **Visuels et actualités** : site officiel `rockstargames.com` et son fil d'actualités Rockstar Newswire (images hébergées sur `rockstargames-com.akamaized.net`).
- **Retouches** : la bannière, la bannière de l'accueil (`featured.jpg`) et les captures de `public/art/gta-6/` ont été retouchées ou remplacées par le propriétaire du projet. Ne pas les écraser.
- **Succès** : aucun, le jeu n'a pas de liste publique.

### Riot Games (Valorant)

Valorant n'est pas sur Steam.

- **Visuels et actualités** : site officiel `playvalorant.com/fr-fr/`, lu à partir des données intégrées à la page.
- **Jaquette** : recadrée à partir de la bannière, faute de jaquette officielle au format vertical.
- **Succès** : aucun, le jeu n'en a pas.

### Logo de Warmup

Fourni par le propriétaire du projet (dossier `warmup-logo`) : version vectorielle dans `src/ui.tsx` et `docs/logo.svg`, icônes de l'application dans `build/`, icône d'onglet dans `public/`.

### Polices

Space Grotesk et JetBrains Mono, installées par les paquets `@fontsource` (licence SIL Open Font License). Elles sont incluses dans l'application, aucun appel à un service extérieur.

## Jeu par jeu

| Jeu | Dossier | Source | Numéro Steam | Remarques |
| --- | --- | --- | --- | --- |
| Grand Theft Auto VI | `gta-6` | Rockstar Games | — | Visuels retouchés par le propriétaire, pas de succès |
| Cyberpunk 2077 | `cyberpunk-2077` | Steam | 1091500 | |
| Call of Duty: Modern Warfare 4 | `call-of-duty-mw4` | Steam | 4435490 | Succès de Call of Duty HQ (1938090) |
| Phantom Blade Zero | `phantom-blade-zero` | Steam | 4115450 | Pas de logo, titre écrit |
| Clair Obscur: Expedition 33 | `expedition-33` | Steam | 1903340 | |
| Baldur's Gate 3 | `baldurs-gate-3` | Steam | 1086940 | |
| Red Dead Redemption 2 | `red-dead-redemption-2` | Steam | 1174180 | |
| Resident Evil 4 | `resident-evil-4` | Steam | 2050650 | |
| Diablo IV | `diablo-4` | Steam | 2344520 | |
| The Last of Us Part I | `the-last-of-us-1` | Steam | 1888930 | |
| The Last of Us Part II Remastered | `the-last-of-us-2` | Steam | 2531310 | |
| Elden Ring | `elden-ring` | Steam | 1245620 | |
| The Witcher 3: Wild Hunt | `the-witcher-3` | Steam | 292030 | |
| Hades II | `hades-2` | Steam | 1145350 | |
| Counter-Strike 2 | `counter-strike-2` | Steam | 730 | Un seul succès |
| Valorant | `valorant` | Riot Games | — | Jaquette recadrée, pas de succès |
| Monster Hunter Wilds | `monster-hunter-wilds` | Steam | 2246340 | |
| Kingdom Come: Deliverance II | `kingdom-come-deliverance-2` | Steam | 1771300 | |
| Black Myth: Wukong | `black-myth-wukong` | Steam | 2358720 | |
| Ghost of Tsushima Director's Cut | `ghost-of-tsushima` | Steam | 2215430 | |
| God of War Ragnarök | `god-of-war-ragnarok` | Steam | 2322010 | |
| Hollow Knight: Silksong | `hollow-knight-silksong` | Steam | 1030300 | |
| Fable | `fable` | Steam | 2769570 | Pas encore sorti, pas de succès |
| Forza Horizon 6 | `forza-horizon-6` | Steam | 2483190 | |
| Dragon Ball: Sparking! Zero | `dragon-ball-sparking-zero` | Steam | 1790600 | |
| Sekiro: Shadows Die Twice | `sekiro` | Steam | 814380 | |
| Stardew Valley | `stardew-valley` | Steam | 413150 | |
| Lies of P | `lies-of-p` | Steam | 1627720 | |
| Marvel's Spider-Man 2 | `spider-man-2` | Steam | 2651280 | |
| Final Fantasy VII Rebirth | `final-fantasy-vii-rebirth` | Steam | 2909400 | |
| Split Fiction | `split-fiction` | Steam | 2001120 | |
| DOOM: The Dark Ages | `doom-the-dark-ages` | Steam | 3017860 | |
| Grand Theft Auto V | `gta-5` | Steam | 3240220 | Version améliorée |
| Resident Evil Requiem | `resident-evil-requiem` | Steam | 3764200 | Pas de logo, titre écrit |
| Silent Hill: Townfall | `silent-hill-townfall` | Steam | 1636440 | Pas de logo, titre écrit |

Le « Source » indique d'où viennent les données, pas la plateforme affichée dans la fiche du jeu.

## Mettre à jour ou ajouter un jeu

Voir [`AJOUTER-UN-JEU.txt`](AJOUTER-UN-JEU.txt). Pour un jeu Steam :

```bash
python3 outils/ajouter-jeu-steam.py <dossier> <numéro-Steam>
```

Le script remplace les visuels et les succès du jeu. Les actualités et la fiche (`shared/mock-data.ts`) se complètent à la main. Ajoutez ensuite une ligne au tableau ci-dessus.

## Avant de rendre le dépôt public

Retirer de l'historique ou remplacer par des visuels libres de droits :

- `public/art/` : tous les visuels de jeux, icônes de succès et images d'actualités ;
- `docs/captures/` : les captures de l'application, qui montrent ces visuels ;
- `shared/achievements-data.ts` et `shared/news-data.ts` : les textes recopiés des éditeurs.
