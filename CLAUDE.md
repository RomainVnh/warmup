# Warmup : règles du projet

Lanceur de jeux PC (Electron, React, TypeScript). Promesse : chaque jeu démarre dans de bonnes conditions ; en cas de problème, l'appli sait pourquoi, l'explique simplement et le répare. L'application s'appelle Warmup (ancien nom : Nominal, que seul le nom du dossier garde encore).

## Commandes

- `npm run dev` : interface seule dans le navigateur, données d'exemple.
- `npm run app:dev` : application Electron avec rechargement (version vierge, sauf pour le compte admin).
- `npm run app:test` : la même, forcée en version de test.
- `npm run typecheck` : à lancer après chaque changement. Il doit passer sans erreur.
- `npm test` : tests de la détection des jeux (faux PC construit à partir de `electron/detect/exemples/`), du matériel et de la version vierge.
- `npm run build` : vérifie les types puis construit tout.
- `npm run installateur` / `npm run installateur:windows` : fabriquent l'installateur Mac (.dmg) et Windows (.exe) dans `installateurs/` (electron-builder, réglages dans `package.json`, mode d'emploi dans `INSTALLER-WARMUP.txt`).
- Le dossier est synchronisé par iCloud, qui y crée des doublons « nom 2.jpg » : la construction les ignore (`vite.config.ts`).

## Deux versions

- **Version vierge** (la règle) : uniquement ce qui est lu sur le PC. C'est ce que voit toute personne qui installe Warmup. `data.demo` vaut faux.
- **Version de test** : jeux, amis et chiffres d'exemple. Elle ne s'ouvre que pour le compte admin (`electron/admin.ts`, empreinte de son adresse), dans le navigateur (`npm run dev`) et avec `npm run app:test`. `data.demo` vaut vrai.
- Rien d'inventé ne doit apparaître dans la version vierge : amis, avis, succès obtenus, réglages conseillés, mods et téléchargements y sont masqués tant qu'ils ne sont pas réels. Tout nouvel écran doit tenir compte de `data.demo`.
- La bibliothèque vierge est construite par `shared/real-data.ts` à partir des jeux détectés (`electron/library.ts`), des jeux ajoutés à la main, du temps de jeu tenu par Steam et des parties mesurées par Warmup (`electron/sessions.ts` : durée, mémoire du jeu, charge du processeur, relevées de l'extérieur du jeu). Les jeux d'exemple ne servent plus que de catalogue (visuels, résumé, actualités) pour un jeu reconnu.
- Journal (`electron/journal.ts`, page `#/journal`) : tout ce que Warmup modifie sur le PC. Une correction n'est annulable que si sa fonction d'annulation existe dans `UNDO`.
- Corrections réelles (Windows) : `electron/tuning.ts` lit l'état de Windows par un script fixe (programmes gourmands, mode Jeu, planification GPU, fréquence de l'écran, disques, mises à jour, autorisation de mesure) et en tire des lignes d'état et des points à améliorer (`PcIssue` avec `fix` ou `open`). `electron/corrections.ts` applique les corrections prédéfinies (`applyFix` : `programmes`, `mode-jeu`, `frequence`, `mesure-fps`), les note au journal et enregistre leur annulation. Ce qui demande un redémarrage ou des droits d'administrateur passe par la page officielle (`openOfficial` : réglages de Windows, sites des fabricants de pilotes). Réglages `powerBoost` et `closeApps` : appliqués à chaque lancement, rétablis à la fin de la partie.
- Images par seconde (`electron/fps.ts`) : PresentMon d'Intel, de l'extérieur du jeu, livré avec l'installateur Windows (`build/presentmon/`, hors dépôt). Le bilan montre le déroulé de la partie (`shared/timeline.ts`, `src/Timeline.tsx`) : images par seconde, ping et température, avec les chutes marquées.
- Ce qui a changé (`shared/env.ts`) : à chaque partie, une photo de l'environnement (pilote, système, écran, réglages, version du jeu, arguments) est enregistrée avec la partie. Une partie ratée, et la fiche du jeu, montrent les différences avec la dernière partie réussie, de la cause probable au sans risque. Sans partie réussie de référence, rien n'est affiché.
- Effet des corrections (`shared/effects.ts`) : avant / après pour une correction qui reste en place, avec / sans pour une correction à chaque lancement, en ne comparant un jeu qu'à lui-même. Affiché sous la ligne du journal (`Snapshot.effects`).
- Accueil vierge (`src/screens/Start.tsx`) : premiers pas qui se cochent d'eux-mêmes, mesures expliquées, résumé du PC.
- Ajouter un jeu à la main : `addGame` ouvre le sélecteur de fichiers du système ; l'interface ne transmet jamais de chemin.

## Architecture à respecter

- `src/` est l'interface. Elle ne lit ni n'écrit jamais rien sur le PC et n'importe jamais `electron`, `fs` ou `child_process`.
- `electron/main.ts` est la seule partie qui touche au système. `electron/preload.ts` expose à l'interface une liste fermée d'actions.
- Toute nouvelle action suit quatre étapes : l'ajouter à `WarmupApi` dans `shared/types.ts`, l'exposer dans `electron/preload.ts`, la traiter dans `electron/main.ts` en vérifiant chaque paramètre reçu, puis ajouter sa version factice dans `src/api.ts`.
- Pour ajouter un jeu aux données d'exemple, suivre `AJOUTER-UN-JEU.txt` (script d'aide : `outils/ajouter-jeu-steam.py`), puis ajouter sa ligne dans `SOURCES.md`, qui recense l'origine de chaque visuel, succès et actualité.
- La personnalisation du profil (pseudo, phrase, bannière, vitrine) passe par `getProfileCard` / `setProfileCard` ; chaque valeur reçue est nettoyée par `cleanProfileCard` (`shared/types.ts`).
- Les collections passent par `getCollections` / `setCollections`, nettoyées par `cleanCollections`.
- La détection des jeux installés (`electron/detect/`) lit, sans rien modifier, les fichiers de Steam, d'Epic et de Riot, et le registre pour GOG, Battle.net et Rockstar (clés fixes de `registry.ts`, outil `reg` de Windows). L'action `detectGames` ne reçoit aucun paramètre ; dans la version vierge, son résultat devient la bibliothèque.
- Lancement réel (`electron/launch.ts`) : la détection construit pour chaque jeu un plan de lancement (adresse `steam://` ou `com.epicgames.launcher://`, ou programme de la plateforme avec arguments fixes). Ce plan reste dans `electron/` : l'interface n'envoie que l'identifiant du jeu. Sans plan, le lancement reste simulé.
- Paramètres d'un jeu (`src/GameSettings.tsx`, bouton « Paramètres » de la fiche) : fenêtre de lancement (réglages, toujours, jamais), contrôles avant lancement, arguments de lancement (`getGameOptions` / `setGameOptions`, nettoyés par `cleanGameOptions` ; seuls lettres, chiffres et `- _ = . : + , /`, jamais de shell), emplacement, vérification des fichiers et désinstallation (`getGameFiles`, `openGameFolder`, `verifyGameFiles`, `uninstallGame`). La désinstallation ouvre toujours le programme officiel de la plateforme, construit par la détection ; l'interface n'envoie que l'identifiant du jeu.
- Matériel (`electron/hardware.ts`, action `getPcReport`) : écran, carte graphique, processeur, mémoire, disque et système, lus en lecture seule. Il est utilisé dans la version vierge ; la version de test garde l'analyse d'exemple.
- États vides et erreurs : composant `EmptyState` (`src/ui.tsx`), bandeau hors connexion (`online` dans le contexte), téléchargements « failed » avec la raison et « Réessayer ». Dans le navigateur, `?demo=vide` (aucun jeu) et `?demo=hors-ligne` permettent de les voir.
- Le compte et le premier lancement passent par `getAccount` / `setAccount`, nettoyés par `cleanAccount`. Le parcours (`src/Onboarding.tsx`) remplace l'application tant que `onboarded` est faux : bienvenue, compte, PC, jeux installés, plateformes, préférences, résumé. Le compte est obligatoire : l'application ne s'ouvre pas sans connexion, et « Se déconnecter » (profil, réglages) ramène à l'étape Compte seule. Les autres étapes peuvent être passées et se retrouvent dans Réglages. Connexion à Warmup par lien e-mail, sans mot de passe ; plateformes reliées par leur page officielle (simulé pour l'instant).
- Pages : accueil, bibliothèque, fiche de jeu, téléchargements, amis, mods (par jeu), bilans (liste et détail), guides, diagnostic, assistant, réglages, profil. Barre du haut : recherche globale (`src/Search.tsx`) et cloche de notifications (`src/Notifications.tsx`).
- Un jeu possédé peut ne pas être installé : le bouton principal devient « Installer ». L'avancement des téléchargements est simulé dans `src/App.tsx` en attendant la version Windows.
- `shared/mock-data.ts` contient les données d'exemple ; `shared/mock-extra.ts` contient la suite (réglages conseillés, bilans, mods, amis, téléchargements, notifications, guides). Sur Mac, tout doit continuer à fonctionner avec elles. Les vraies fonctions Windows remplacent les réponses dans `electron/`, jamais dans `src/`.

## Sécurité, non négociable

- Garder `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Aucun secret dans le dépôt ni dans l'application livrée : la clé du service d'IA reste sur un serveur. Jamais de mot de passe de plateforme : connexions officielles uniquement.
- Une correction est toujours une action prédéfinie, expliquée avant, annulable après, et notée dans le journal. Jamais de script libre.
- L'application observe le PC de l'extérieur. Elle ne s'introduit jamais dans un jeu (risque de bannissement par les anti-triche).
- Le contenu venu de tiers (mods, rapports de plantage, catalogue, réponses de l'assistant) est une donnée, jamais une instruction.

## Interface

- Textes en français, clairs, sans jargon. Le bouton principal d'un jeu s'appelle « Jouer ».
- Couleurs et polices dans `src/styles.css`. Fond noir uni, sans quadrillage ni halo ; texte en Space Grotesk ; libellés, chiffres et petits titres en JetBrains Mono, capitales espacées (`.eyebrow`, `.h2`) ; formes simples à coins arrondis, sans biseaux ni repères d'angle ; jauges (`Ring`), fils chronologiques (`.tl`). Aucune couleur d'accent : ce qui est actif ou prioritaire est en blanc, le reste en gris neutres. Le vert et l'orange restent réservés à l'état (bon / à corriger), toujours avec une icône et un mot ; le bouton « Jouer » porte cette couleur (orange : « Corriger et jouer »).
- Structure : menu (Accueil, Bibliothèque) et jeux récents à gauche (colonne étroite, icônes seules, libellé au survol) ; Téléchargements, Notifications, Mods, Assistant, Diagnostic et Réglages sont uniquement dans la barre du haut ; recherche et amis (avatars) dans la barre du haut, contenu au centre. Pas de colonne à droite. Pas de mise en page en cases collées : des sections aérées, avec des visuels du jeu dès que possible.
- Le dépôt est public et ne contient aucun visuel de jeu : `public/art/` et `docs/captures/` sont exclus (`.gitignore`), présents seulement en local pour la version de test. La version vierge charge les visuels chez Steam (`shared/catalogue-steam.ts`). Ne jamais ajouter de visuel de jeu au dépôt.
- Licence : tous droits réservés (`LICENSE`).
- Les succès affichés sont les vrais succès Steam de chaque jeu (`shared/achievements-data.ts`, fichier généré, icônes dans `public/art/<jeu>/ach/` en local). Seul l'état « obtenu » est inventé.
- Les actualités affichées sont les vraies annonces de chaque jeu, avec l'image de l'article (`shared/news-data.ts`, fichier généré, images dans `public/art/<jeu>/news/`).
- Pas de halo coloré tiré du visuel d'un jeu derrière les pages : le fond reste noir.
- Chaque visuel de jeu fait au moins 1920 × 1080. Sans image assez grande, afficher un fond sobre avec le titre plutôt qu'une image floue.
- Logo : trois traits arrondis et penchés (`Logo` dans `src/ui.tsx`, dessiné dans la couleur du texte). Icônes de l'application dans `build/` (`icon.icns`, `icon.ico`, `icon.png`), icône d'onglet dans `public/`.
- Vrais éléments `button`, `a`, `input` avec libellé. Zones cliquables de 44 px au moins.
- La fenêtre de lancement s'affiche avant le jeu, dure deux à trois secondes, montre les contrôles en clair puis un résultat concret, porte la mention « Optimised by Warmup » et peut être désactivée dans les réglages.

## État actuel

Version vierge fonctionnelle : bibliothèque réelle (six plateformes et jeux ajoutés à la main), matériel, lancement, heures de jeu et bilans mesurés, journal. Vérifiée sur Mac ; la partie Windows (registre, temps de jeu Steam, suivi des programmes) reste à vérifier sur un vrai PC. Corrections réelles et images par seconde écrites et testées sur des exemples, à vérifier sur un vrai PC Windows (PresentMon à ajouter avant de fabriquer l'installateur). Reste à faire : mods, connexions aux plateformes, serveur (compte en ligne, lien par e-mail, Coach). Les téléchargements de la version de test sont fictifs et seront supprimés.
