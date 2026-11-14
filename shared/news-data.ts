// Actualités réelles de chaque jeu, relevées sur les annonces officielles (Steam, Rockstar Newswire), avec l'image de l'article.
// Les titres et résumés des annonces Steam sont traduits en français. Ce fichier se complète à la main : voir AJOUTER-UN-JEU.txt.
import type { NewsItem } from './types';

export const gameNews: Record<string, NewsItem[]> = {
  "baldurs-gate-3": [
    {
      "tag": "Mise à jour",
      "title": "Correctif n° 36 disponible",
      "date": "26 mars 2026",
      "text": "Ce correctif règle les problèmes de performances et les plantages apparus avec la précédente mise à jour, qui visait les sauvegardes corrompues.",
      "image": "art/baldurs-gate-3/news/1.jpg"
    },
    {
      "tag": "Communauté",
      "title": "Mise à jour communautaire n° 36 : un Noël très moddé",
      "date": "1er décembre 2025",
      "text": "Larian revient sur une année marquée par douze nouvelles sous-classes, le jeu multiplateforme et le mode photo.",
      "image": "art/baldurs-gate-3/news/2.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Correctif n° 35 disponible",
      "date": "20 novembre 2025",
      "text": "Un petit correctif centré sur les performances : il règle des plantages sur consoles et certains problèmes sur Steam Deck.",
      "image": "art/baldurs-gate-3/news/3.jpg"
    }
  ],
  "cyberpunk-2077": [
    {
      "tag": "Mise à jour",
      "title": "La mise à jour Edgerunners 2 (2.5) est disponible",
      "date": "22 octobre 2026",
      "text": "Une nouvelle mise à jour gratuite pour Cyberpunk 2077, accompagnée d'une bande-annonce de lancement.",
      "image": "art/cyberpunk-2077/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Ce qui arrive dans la mise à jour Edgerunners 2",
      "date": "21 octobre 2026",
      "text": "Les notes de version de la mise à jour 2.5 sont publiées avant sa sortie le 22 octobre.",
      "image": "art/cyberpunk-2077/news/2.jpg"
    },
    {
      "tag": "Événement",
      "title": "REDstreams : retour sur Cyberpunk: Edgerunners 2",
      "date": "26 octobre 2026",
      "text": "Une émission spéciale avec Bartosz Sztybor et Saya Elder pour revenir sur la série, le 27 octobre à 17 h.",
      "image": "art/cyberpunk-2077/news/3.jpg"
    }
  ],
  "diablo-4": [
    {
      "tag": "Saison",
      "title": "La Saison de l'Héritage des Enfers est lancée, jouable gratuitement",
      "date": "16 septembre 2026",
      "text": "Des Cauchemars éveillés font revivre les moments les plus célèbres du passé de Diablo, sous la conduite de l'âme de Deckard Cain.",
      "image": "art/diablo-4/news/1.jpg"
    },
    {
      "tag": "Saison",
      "title": "Saison 14 : l'Éveil de la Mort est disponible",
      "date": "30 juin 2026",
      "text": "Nouvelles Failles du Pandémonium, nouvelle chambre, objets uniques mythiques revus et collaboration avec Overwatch.",
      "image": "art/diablo-4/news/2.jpg"
    },
    {
      "tag": "Extension",
      "title": "L'extension Lord of Hatred est disponible",
      "date": "28 avril 2026",
      "text": "Une nouvelle campagne contre Méphisto, deux nouvelles classes et une nouvelle région à explorer.",
      "image": "art/diablo-4/news/3.jpg"
    }
  ],
  "elden-ring": [
    {
      "tag": "Contenu",
      "title": "Le DLC Tarnished Pack est disponible",
      "date": "28 août 2026",
      "text": "Deux nouvelles classes de départ, de nouvelles armures et une apparence personnalisable pour Torrent.",
      "image": "art/elden-ring/news/1.jpg"
    },
    {
      "tag": "Événement",
      "title": "Quêtes communautaires Elden Ring",
      "date": "2 septembre 2026",
      "text": "Pour fêter la Tarnished Edition, les joueurs sont invités à relever ensemble des quêtes partagées pour débloquer des récompenses.",
      "image": "art/elden-ring/news/2.jpg"
    },
    {
      "tag": "Produits dérivés",
      "title": "Nouvelles mini-répliques : Malenia, Messmer et Wylder",
      "date": "7 septembre 2026",
      "text": "Une gamme de répliques à l'échelle 1/3 inspirées des designs les plus célèbres du jeu, réalisées par Pure Arts.",
      "image": "art/elden-ring/news/3.jpg"
    }
  ],
  "expedition-33": [
    {
      "tag": "Mise à jour",
      "title": "Clair Obscur: Expedition 33 est disponible en arabe",
      "date": "30 juin 2026",
      "text": "Le jeu gagne les textes en arabe, ce qui porte à 20 le nombre de langues prises en charge.",
      "image": "art/expedition-33/news/1.jpg"
    },
    {
      "tag": "Offre",
      "title": "Lot Clair Obscur: Expedition 33 et Dispatch",
      "date": "27 mai 2026",
      "text": "Les deux jeux sont réunis dans un lot à −10 %, illustré par Derek Stratton.",
      "image": "art/expedition-33/news/2.jpg"
    },
    {
      "tag": "Anniversaire",
      "title": "Premier anniversaire de Clair Obscur: Expedition 33",
      "date": "24 avril 2026",
      "text": "Un an après la sortie, l'équipe partage une illustration spéciale et plusieurs nouveautés.",
      "image": "art/expedition-33/news/3.jpg"
    }
  ],
  "hades-2": [
    {
      "tag": "Communauté",
      "title": "Documentaire Noclip, vidéo du concert et plus encore",
      "date": "25 septembre 2026",
      "text": "Un an après la sortie de la version 1.0, Supergiant marque l'anniversaire avec plusieurs annonces.",
      "image": "art/hades-2/news/1.jpg"
    },
    {
      "tag": "Événement",
      "title": "Le concert orchestral de Hades, en direct de Londres",
      "date": "16 juin 2026",
      "text": "Darren Korb et les voix de Hades au Royal Festival Hall, sous la direction d'Austin Wintory. La vidéo complète est disponible.",
      "image": "art/hades-2/news/2.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Notes du deuxième correctif d'après-lancement",
      "date": "14 avril 2026",
      "text": "Du contenu bonus et des améliorations de confort, en remerciement du soutien des joueurs.",
      "image": "art/hades-2/news/3.jpg"
    }
  ],
  "resident-evil-4": [
    {
      "tag": "Annonce",
      "title": "La page de Resident Evil Veronica est ouverte",
      "date": "8 juin 2026",
      "text": "Le remake de Code: Veronica, annoncé pour 2027, peut être ajouté à la liste de souhaits.",
      "image": "art/resident-evil-4/news/1.jpg"
    },
    {
      "tag": "Offre",
      "title": "Promotions Capcom du Summer Game Fest",
      "date": "8 juin 2026",
      "text": "Resident Evil Requiem et Resident Evil 4 sont en promotion jusqu'au 18 juin, ainsi que Resident Evil 2 et 3.",
      "image": "art/resident-evil-4/news/2.jpg"
    },
    {
      "tag": "Sortie",
      "title": "Resident Evil Requiem est disponible",
      "date": "27 février 2026",
      "text": "Un nouvel épisode partagé entre l'horreur avec l'analyste du FBI Grace Ashcroft et l'action avec Leon S. Kennedy.",
      "image": "art/resident-evil-4/news/3.jpg"
    }
  ],
  "the-last-of-us-2": [
    {
      "tag": "Communauté",
      "title": "The Last of Us Day 2025",
      "date": "26 septembre 2025",
      "text": "Naughty Dog célèbre la journée annuelle consacrée à la série et à ses joueurs.",
      "image": "art/the-last-of-us-2/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Notes du correctif 1.6",
      "date": "22 juillet 2025",
      "text": "Des corrections de bugs issues des retours des joueurs, notamment pour la saisie des codes de coffres au clavier et à la souris.",
      "image": "art/the-last-of-us-2/news/2.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Un mode chronologique pour The Last of Us Part II Remastered",
      "date": "8 juillet 2025",
      "text": "Le correctif 1.5 permet de vivre l'histoire dans l'ordre chronologique, une option pensée pour une seconde partie.",
      "image": "art/the-last-of-us-2/news/3.jpg"
    }
  ],
  "the-witcher-3": [
    {
      "tag": "Mise à jour",
      "title": "Le correctif 5.01 est disponible",
      "date": "8 octobre 2026",
      "text": "Une série de corrections pour la version Remastered, dont l'application automatique des huiles de lame.",
      "image": "art/the-witcher-3/news/1.jpg"
    },
    {
      "tag": "Sortie",
      "title": "The Witcher 3: Wild Hunt — Remastered est disponible",
      "date": "29 septembre 2026",
      "text": "Retour sur le Continent : la version remastérisée est sortie, avec Geralt à la poursuite de Ciri.",
      "image": "art/the-witcher-3/news/2.jpg"
    },
    {
      "tag": "Annonce",
      "title": "Les nouveautés de The Witcher 3: Wild Hunt — Remastered",
      "date": "28 septembre 2026",
      "text": "Toute personne possédant le jeu sur Steam peut passer gratuitement à la version Remastered.",
      "image": "art/the-witcher-3/news/3.jpg"
    }
  ],
  "call-of-duty-mw4": [
    {
      "tag": "Événement",
      "title": "Essai gratuit de DMZ jusqu'au 11 novembre",
      "date": "6 novembre 2026",
      "text": "Du 6 au 11 novembre, le mode DMZ de Modern Warfare 4 est accessible gratuitement et en entier.",
      "image": "art/call-of-duty-mw4/news/1.jpg"
    },
    {
      "tag": "Saison",
      "title": "Saison 1 : passe de combat, BlackCell et nouveaux lots",
      "date": "5 novembre 2026",
      "text": "Plus de 100 récompenses dans le passe de combat de la Saison 1, avec un nouveau système de rattrapage.",
      "image": "art/call-of-duty-mw4/news/2.jpg"
    },
    {
      "tag": "Sortie",
      "title": "Call of Duty: Modern Warfare 4 est disponible dans le monde entier",
      "date": "23 octobre 2026",
      "text": "Dans la campagne, Price est en fuite et un conflit éclate sur la péninsule coréenne.",
      "image": "art/call-of-duty-mw4/news/3.jpg"
    }
  ],
  "gta-6": [
    {
      "tag": "Rockstar Newswire",
      "title": "Préchargez Grand Theft Auto VI dès maintenant",
      "date": "10 novembre 2026",
      "text": "Le préchargement de Grand Theft Auto VI est disponible dès maintenant pour ceux qui ont précommandé le jeu en version numérique. Les joueurs qui ont précommandé la version boîte avec code peuvent également activer leur code et commencer…",
      "image": "art/gta-6/news/1.jpg"
    },
    {
      "tag": "Rockstar Newswire",
      "title": "Grand Theft Auto VI: The Festival",
      "date": "9 novembre 2026",
      "text": "Découvrez la musique de Vice City et de la Leonida grâce à Grand Theft Auto VI: The Festival, un évènement live qui aura lieu le 21 novembre au Mana Wynwood, à Miami, pour fêter la sortie de GTAVI avec d'illustres artistes que vous retrouverez dans…",
      "image": "art/gta-6/news/2.jpg"
    },
    {
      "tag": "Rockstar Newswire",
      "title": "Découvrez la Galerie de lancement de Grand Theft Auto VI",
      "date": "5 novembre 2026",
      "text": "Il ne reste plus que deux semaines avant la sortie de Grand Theft Auto VI. Découvrez aujourd'hui un aperçu époustouflant de Vice City et sa région avec une collection de nouvelles captures d'écran sur le site officiel.",
      "image": "art/gta-6/news/3.jpg"
    },
    {
      "tag": "Rockstar Newswire",
      "title": "Regardez la Bande-annonce de lancement de Grand Theft Auto VI",
      "date": "15 octobre 2026",
      "text": "Vice City, États-Unis. Jason et Lucia ont toujours su que la vie ne leur ferait pas de cadeau. Mais lorsque les choses tournent mal, ils découvrent le côté obscur de la région la plus ensoleillée d'Amérique, et se retrouvent au cœur d'un…",
      "image": "art/gta-6/news/4.jpg"
    }
  ],
  "red-dead-redemption-2": [
    {
      "tag": "Rockstar Newswire",
      "title": "Fêtez Thanksgiving avec des bonus pour les marchands dans Red Dead Online",
      "date": "3 novembre 2026",
      "text": "Fêtez richesse et prospérité au pays des opportunités en travaillant avec votre fidèle compagnon Cripps pour transformer les peaux d'animaux en espèces sonnantes et trébuchantes. Ce mois-ci, toutes les ventes de marchand dans Red Dead Online…",
      "image": "art/red-dead-redemption-2/news/1.jpg"
    },
    {
      "tag": "Rockstar Newswire",
      "title": "Le chaos déferle sur l'Ouest sauvage à l'approche d'Halloween",
      "date": "6 octobre 2026",
      "text": "La saison de l'effroi débarque dans l'Ouest, accompagnée d'alléchants bonus pour les joueurs de Red Dead Online qui participent aux aventures terrifiantes des Histoires étranges. Gagnez des RDO$, de l'or et de l'XP quadruplés tout au long du mois…",
      "image": "art/red-dead-redemption-2/news/2.jpg"
    },
    {
      "tag": "Rockstar Newswire",
      "title": "Distillez de l'alcool de qualité pour gagner des récompenses triplées dans Red Dead Online",
      "date": "1er septembre 2026",
      "text": "Les villes, hameaux et fortifications éloignées de l'Ouest sauvage raffolent d'alcool. Aidez-les à étancher leur soif en terminant des ventes de distillateur clandestin pour gagner des RDO$, de l'XP de rôle et de l'XP triplés tout au long du…",
      "image": "art/red-dead-redemption-2/news/3.jpg"
    }
  ],
  "god-of-war-ragnarok": [
    {
      "tag": "Mise à jour",
      "title": "Correctif 9.1 disponible",
      "date": "20 août 2025",
      "text": "Ajout de la dernière version de la technologie FidelityFX Super Resolution (FSR) d'AMD.",
      "image": "art/god-of-war-ragnarok/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Correctif 9 : mise à jour des 20 ans",
      "date": "20 mars 2025",
      "text": "La collection Dark Odyssey est offerte en jeu à toutes les personnes qui possèdent God of War Ragnarök.",
      "image": "art/god-of-war-ragnarok/news/2.jpg"
    },
    {
      "tag": "Communauté",
      "title": "Avatar et cadre des 20 ans de God of War",
      "date": "20 mars 2025",
      "text": "Deux objets animés rejoignent la boutique de points Steam pour l'anniversaire de la série.",
      "image": "art/god-of-war-ragnarok/news/3.jpg"
    }
  ],
  "ghost-of-tsushima": [
    {
      "tag": "Mise à jour",
      "title": "Meilleure prise en charge de la DualSense Edge",
      "date": "8 juillet 2026",
      "text": "Une petite mise à jour améliore la compatibilité avec la manette DualSense Edge.",
      "image": "art/ghost-of-tsushima/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Génération d'images FSR par apprentissage automatique",
      "date": "16 décembre 2025",
      "text": "Ce correctif ajoute la compatibilité avec la génération d'images FSR « Redstone » d'AMD.",
      "image": "art/ghost-of-tsushima/news/2.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Le mode solo est vérifié pour le Steam Deck",
      "date": "27 octobre 2025",
      "text": "Le correctif 8 sépare le jeu solo du mode multijoueur Legends.",
      "image": "art/ghost-of-tsushima/news/3.jpg"
    }
  ],
  "black-myth-wukong": [
    {
      "tag": "Offre",
      "title": "Black Myth: Wukong bientôt à −30 %",
      "date": "5 août 2026",
      "text": "À l'approche du 20 août, toutes les éditions numériques passent en promotion.",
      "image": "art/black-myth-wukong/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Notes de la version 1.0.21",
      "date": "14 janvier 2026",
      "text": "Un correctif d'environ 2 Go, publié le 14 janvier 2026.",
      "image": "art/black-myth-wukong/news/2.jpg"
    },
    {
      "tag": "Offre",
      "title": "Promotion de −25 % pour le Nouvel An",
      "date": "30 janvier 2026",
      "text": "Une offre limitée sur toutes les éditions pour l'année du Cheval.",
      "image": "art/black-myth-wukong/news/3.jpg"
    }
  ],
  "monster-hunter-wilds": [
    {
      "tag": "Annonce",
      "title": "Le Khezu arrive dans Monster Hunter Wilds: Ascendance",
      "date": "19 septembre 2026",
      "text": "Révélé au Tokyo Game Show 2026, ce monstre bien connu rejoint l'extension prévue pour 2027.",
      "image": "art/monster-hunter-wilds/news/1.jpg"
    },
    {
      "tag": "Annonce",
      "title": "Le dragon ancien Teostra rejoint Ascendance",
      "date": "17 septembre 2026",
      "text": "Présenté lors du Capcom Spotlight, le Teostra fera partie de l'extension.",
      "image": "art/monster-hunter-wilds/news/2.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Résumé de la mise à jour 1.042",
      "date": "28 octobre 2026",
      "text": "La dernière version est nécessaire pour jouer en ligne et accéder aux contenus téléchargeables.",
      "image": "art/monster-hunter-wilds/news/3.jpg"
    }
  ],
  "counter-strike-2": [
    {
      "tag": "Mise à jour",
      "title": "Mise à jour du 12 novembre",
      "date": "12 novembre 2026",
      "text": "Corrections d'animations lors des changements d'arme et du rechargement, et du déplacement des bots en mode Reprise.",
      "image": ""
    },
    {
      "tag": "Mise à jour",
      "title": "Mise à jour du 5 novembre",
      "date": "5 novembre 2026",
      "text": "En mode Reprise, le désamorçage se termine aussitôt quand il reste assez de temps et qu'aucun équipement ne peut l'empêcher.",
      "image": ""
    },
    {
      "tag": "Mise à jour",
      "title": "Mise à jour du 28 octobre",
      "date": "28 octobre 2026",
      "text": "Le rechargement silencieux peut maintenant se faire par appui maintenu ou par bascule.",
      "image": ""
    }
  ],
  "hollow-knight-silksong": [
    {
      "tag": "Annonce",
      "title": "Sea of Sorrow arrive en 2026",
      "date": "16 décembre 2025",
      "text": "Une extension gratuite pour tous : nouvelles zones, nouveaux boss et nouveaux outils sur des mers rongées par le sel.",
      "image": "art/hollow-knight-silksong/news/1.jpg"
    },
    {
      "tag": "Mise à jour",
      "title": "Version 1.0.30000 disponible",
      "date": "16 mars 2026",
      "text": "Ajout du chinois traditionnel et traduction allemande revue.",
      "image": ""
    },
    {
      "tag": "Mise à jour",
      "title": "Version 1.0.29242 disponible",
      "date": "7 novembre 2025",
      "text": "Meilleure prise en charge des manettes et traduction en chinois simplifié mise à jour.",
      "image": ""
    }
  ],
  "kingdom-come-deliverance-2": [
    {
      "tag": "Événement",
      "title": "La musique de Kingdom Come: Deliverance II en concert",
      "date": "2 octobre 2026",
      "text": "Les compositions primées de Jan Valta reviennent sur scène.",
      "image": "art/kingdom-come-deliverance-2/news/1.jpg"
    },
    {
      "tag": "Communauté",
      "title": "Le concert de Kuttenberg en vidéo",
      "date": "24 septembre 2026",
      "text": "Le concert complet, enregistré dans la cathédrale Sainte-Barbe, est disponible sur YouTube.",
      "image": "art/kingdom-come-deliverance-2/news/2.jpg"
    },
    {
      "tag": "Offre",
      "title": "Jusqu'à −60 % sur Kingdom Come: Deliverance II",
      "date": "26 septembre 2026",
      "text": "Une promotion sur le jeu et ses extensions.",
      "image": "art/kingdom-come-deliverance-2/news/3.jpg"
    }
  ],
  "fable": [
    {
      "tag": "Présentation",
      "title": "Visitez Wraithmarsh",
      "date": "3 novembre 2026",
      "text": "Une région mystérieuse et magique du nord sauvage d'Albion, présentée par l'Office du tourisme d'Albion.",
      "image": "art/fable/news/1.jpg"
    },
    {
      "tag": "Présentation",
      "title": "Visitez Bowerstone",
      "date": "22 octobre 2026",
      "text": "Boutiques, pubs et marchés animés : la ville où aller pour quitter le calme de la campagne.",
      "image": "art/fable/news/2.jpg"
    },
    {
      "tag": "Offre",
      "title": "Précommandez l'édition Premium et jouez 5 jours plus tôt",
      "date": "11 juin 2026",
      "text": "Toute précommande donne droit à un pack de contenu, dont le costume de poulet.",
      "image": "art/fable/news/3.jpg"
    }
  ],
  "valorant": [
    {
      "tag": "Mises à jour du jeu",
      "title": "Notes de patch 13.10 VALORANT",
      "date": "10 novembre 2026",
      "text": "Signets de replay, mises à jour de Gauntlet: Glitched et des assistances, et corrections de bugs !",
      "image": "art/valorant/news/1.jpg"
    },
    {
      "tag": "Annonces",
      "title": "Présentation du gameplay de Hush // VALORANT",
      "date": "27 octobre 2026",
      "text": "Regardez Hush détourner les lois de la réalité pour créer des ouvertures impossibles.",
      "image": "art/valorant/news/2.jpg"
    },
    {
      "tag": "Mises à jour du jeu",
      "title": "Notes de patch 13.09 VALORANT",
      "date": "27 octobre 2026",
      "text": "Hush est là.",
      "image": "art/valorant/news/3.jpg"
    },
    {
      "tag": "E-sport",
      "title": "Présentation des équipes partenaires du VCT 2027",
      "date": "22 octobre 2026",
      "text": "Découvrez les 32 organisations qui rejoignent le VALORANT Champions Tour en 2027, ainsi que l'évolution du système de partenariat.",
      "image": "art/valorant/news/4.jpg"
    }
  ],
  "forza-horizon-6": [
    {
      "tag": "Mise à jour",
      "title": "La mise à jour City Life est disponible",
      "date": "2 novembre 2026",
      "text": "Deux nouveaux circuits permanents dans Tokyo : la course sur route Edo Circuit et la course de rue Shuto Charge.",
      "image": "art/forza-horizon-6/news/1.jpg"
    },
    {
      "tag": "Événement",
      "title": "La fête des petites voitures commence avec la Citroën Ami",
      "date": "5 novembre 2026",
      "text": "La Citroën Ami 2025, petite électrique pensée pour la ville, rejoint le festival.",
      "image": "art/forza-horizon-6/news/2.jpg"
    },
    {
      "tag": "Événement",
      "title": "La récompense de la semaine : l'Alfa Romeo Giulietta Quadrifoglio Verde",
      "date": "12 novembre 2026",
      "text": "La version la plus puissante de la Giulietta, millésime 2011, est à gagner cette semaine à Horizon Japon.",
      "image": "art/forza-horizon-6/news/3.jpg"
    }
  ],
  "dragon-ball-sparking-zero": [
    {
      "tag": "Anniversaire",
      "title": "Sparking! ZERO fête ses 2 ans et annonce la suite",
      "date": "9 octobre 2026",
      "text": "Événements, mises à jour gratuites, nouveaux modes et nouveaux combattants : le jeu détaille ce qui arrive.",
      "image": "art/dragon-ball-sparking-zero/news/1.jpg"
    },
    {
      "tag": "Présentation",
      "title": "Les personnages de Dragon Ball Super à l'honneur",
      "date": "9 octobre 2026",
      "text": "Rivalités et combats titanesques : un tour d'horizon des combattants de Dragon Ball Super, avec l'extension Super Limit-Breaking NEO.",
      "image": "art/dragon-ball-sparking-zero/news/2.jpg"
    },
    {
      "tag": "Extension",
      "title": "Super Limit-Breaking NEO est disponible",
      "date": "30 juillet 2026",
      "text": "Un nouveau mode « Limit Breaker Journey », de nouveaux personnages, des combats d'épisode et de nouvelles cartes.",
      "image": "art/dragon-ball-sparking-zero/news/3.jpg"
    }
  ]
};
