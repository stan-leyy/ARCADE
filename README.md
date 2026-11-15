# ARCADE — La Voie du Ninja

Jeu de combat 2D en un contre un, jouable dans le navigateur sur ordinateur (clavier) et sur téléphone (commandes tactiles). Tout est dessiné par code : aucun fichier image ni son n'est nécessaire.

## Contenu

- **6 ninjas originaux** : Bakari, Malik, Devan, Sable, Braza et Tembo, chacun avec une technique spéciale et une attaque ultime.
- **3 arènes** : Champ des Lames, Canyon d'Ocre, Sanctuaire de la Lune.
- **Modes** : contre l'ordinateur (3 difficultés) et en ligne à deux joueurs (salon avec code).
- **Profil** : pseudo, victoires, défaites et classement.

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
| `js/net.js` | Profil, classement et synchronisation en ligne |
| `js/ui.js` | Menus, déroulé du jeu et boucle principale |

## En ligne et comptes

- Publié comme page sur claude.ai, le jeu utilise la base de données et les salons temps réel de la plateforme.
- Lancé ailleurs (en local par exemple), le profil est enregistré sur l'appareil et le mode en ligne relie deux onglets du même navigateur, pour les tests.
- Pour une sortie sur le Play Store et l'App Store, `js/net.js` est le seul fichier à adapter à un autre service de base de données.

## Suite prévue

- Brancher une base de données indépendante pour les comptes et le jeu en ligne.
- Emballer le jeu en application Android et iOS.
- Remplacer les sons synthétisés par des sons originaux.
- Ajouter la monétisation.
