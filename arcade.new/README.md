# ARCADE — La Voie du Ninja

Jeu de combat 2D en un contre un, jouable dans le navigateur sur ordinateur (clavier) et sur téléphone (commandes tactiles). Tout est dessiné par code : aucun fichier image n'est nécessaire. Sur téléphone, le jeu s'affiche toujours en paysage.

## Contenu

- **6 ninjas originaux** : Bakari, Malik, Devan, Sable, Braza et Tembo, chacun avec une technique spéciale et une attaque ultime.
- **3 arènes** : Champ des Lames, Canyon d'Ocre, Sanctuaire de la Lune.
- **Modes** : contre l'ordinateur (3 difficultés) et en ligne à deux joueurs (salon avec code).
- **9 armes** (lames, faucille, gantelets…) qui donnent un bonus de dégâts, de portée, de vitesse ou d'énergie.
- **Boutique** : les pièces gagnées en combattant débloquent des ninjas et des armes (2 ninjas offerts au départ).
- **Premier lancement** : présentation animée du jeu (environ 1 min 45, passable), puis première partie guidée sans compte, avec des consignes au ralenti. Un compte est ensuite obligatoire.
- **Profil** : pseudo, pièces, victoires, défaites et classement.

## Lancer le jeu

Le jeu est un site statique, sans étape de compilation.

```bash
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

## Commandes

| Action | Clavier | Téléphone |
| --- | --- | --- |
| Avancer / reculer (reculer pare) | Flèches ou `Q` `D` | Croix |
| Sauter / s'accroupir | `↑` ou `Z` / `↓` ou `S` | Croix |
| Poing, pied, coup lourd | `J`, `K`, `L` | Poing, Pied, Lourd |
| Technique spéciale (énergie bleue) | `U` | Spécial |
| Attaque ultime (jauge pleine) | `I` | Ultime |
| Ruée | Double appui sur une direction | Double appui |
| Pause | `Échap` ou `P` | Bouton II |

Les touches suivent la position physique : `ZQSD` sur un clavier AZERTY, `WASD` sur un QWERTY.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page, styles et écrans des menus |
| `js/core.js` | Constantes, entrées clavier et tactiles, sons synthétisés |
| `js/chars.js` | Fiches des personnages, poses et dessin du squelette |
| `js/stages.js` | Arènes en couches et particules |
| `js/fight.js` | Combattants, coups, projectiles, IA, effets, interface de combat |
| `js/net.js` | Comptes, classement, matchs classés et synchronisation en ligne |
| `js/config.js` | Adresse et clé publique du projet Supabase |
| `js/vendor/supabase.js` | Bibliothèque cliente Supabase |
| `supabase/schema.sql` | Tables, règles d'accès et fonctions du serveur |
| `vercel.json` | En-têtes de sécurité pour Vercel |
| `js/shop.js` | Pièces, achats, armes équipées, écran de présentation (boutique et choix du ninja) |
| `js/onboard.js` | Présentation animée et première partie guidée |
| `supabase/shop.sql` | Boutique côté serveur (à exécuter avant de passer `shopServer` à `true`) |
| `version.json` | Numéro de la version en ligne (bandeau « mise à jour disponible ») |
| `audio/` | Musiques et bruitages (à lister dans `js/config.js`) |
| `js/ui.js` | Menus, déroulé du jeu et boucle principale |

## En ligne et comptes

Le jeu choisit son mode tout seul :

- **Supabase** (quand `js/config.js` est rempli) : comptes par e-mail et mot de passe, classement, salons temps réel pour le jeu en ligne.
- **Sans configuration** : profil enregistré sur l'appareil, mode en ligne entre deux onglets du même navigateur, pour les tests.

## Sécurité et anti-triche

- **Le jeu n'écrit jamais dans les tables.** Les joueurs ne peuvent que lire le classement ; toute écriture passe par des fonctions du serveur qui vérifient l'identité du joueur (`supabase/schema.sql`).
- **Une victoire ne compte que si les deux joueurs déclarent le même vainqueur.** En cas de désaccord, le match est contesté et personne ne gagne de point.
- **Seuls les matchs en ligne comptent au classement.** Les combats contre l'ordinateur restent sur l'appareil, car rien ne permet de les vérifier.
- **Garde-fous côté serveur** : un match classé dure au moins 15 secondes, 10 matchs classés par jour au plus entre les deux mêmes joueurs, 40 créations de match par heure, pseudos uniques et filtrés.
- **Contrôles pendant le combat** : vie qui remonte, coups en rafale impossibles, coups ignorés ou arbitrage incohérent annulent le match.
- **Bibliothèque Supabase hébergée dans le dépôt** (`js/vendor/supabase.js`, version 2.119.0) : aucun script n'est chargé depuis un site tiers.
- **En-têtes de sécurité** dans `vercel.json` : politique de contenu stricte (scripts du site uniquement, connexions vers Supabase uniquement), interdiction d'affichage dans un cadre, HTTPS forcé.
- `js/config.js` ne contient que l'adresse du projet et sa clé « publishable », faites pour être publiques. La clé `service_role` ne doit jamais se trouver dans ce dépôt.

- **Journal d'activité anonyme** : visites, parties, tentatives de connexion et type d'appareil, sans e-mail ni adresse IP. Le jeu peut seulement y ajouter des lignes filtrées, à débit limité ; il ne peut pas le lire.

Limite connue : les salons temps réel sont publics. Un tiers qui connaît le code d'un salon peut perturber un combat, mais pas gagner de points au classement.

## Musique et bruitages

Déposer les fichiers dans `audio/`, puis les lister dans `js/config.js` (`audio.menu`, `audio.fight`, `audio.hit`). Les morceaux du menu passent à tour de rôle avec 3 secondes de pause. N'utiliser que des sons dont on a les droits.

## Publier une mise à jour

1. Augmenter `G.VERSION` dans `js/core.js` et le numéro dans `version.json` (les deux identiques, par exemple `2.1.0`).
2. Pousser sur GitHub : Vercel redéploie.
3. Les joueurs qui ont le jeu ouvert voient un bandeau « Une nouvelle version est disponible » (vérification au retour sur l'onglet et toutes les 10 minutes).

## Mise en ligne

Cette version 2 se trouve dans le dossier `arcade.new/` ; la version 1 reste à la racine du dépôt.
Sur Vercel, crée un projet (ou modifie l'existant) avec **Root Directory = `arcade.new`** pour que la page et son `vercel.json` soient pris en compte. Ajoute ensuite la nouvelle adresse dans Supabase > Authentication > URL Configuration.

- **Vercel** (recommandé) : importer le dépôt, choisir le modèle « Other », laisser la commande de build vide. Les en-têtes de `vercel.json` s'appliquent automatiquement.
- **GitHub Pages** : Settings > Pages > « Deploy from a branch », branche `main`, dossier `/ (root)`. Le jeu fonctionne, mais GitHub Pages n'applique pas les en-têtes de sécurité.

Dans Supabase, indiquer ensuite l'adresse du site dans Authentication > URL Configuration.

## Suite prévue

- Passer les salons de match en canaux privés réservés aux deux joueurs.
- Emballer le jeu en application Android et iOS.
- Activer la boutique côté serveur (`supabase/shop.sql`) pour que les pièces suivent le compte sur tous les appareils.
- Vérifier côté serveur l'arme utilisée en ligne.
- Ajouter la monétisation.
