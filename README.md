# Clawd — montage d'entraînement (30 s, 100 % code)

Une animation de trente secondes où **Clawd**, la petite mascotte terracotta,
passe de « il sait juste dire bonjour » à « il s'attaque aux problèmes les plus durs ».

**→ [Voir l'animation](https://nicolas6910.github.io/claude-montage/)** (cliquer sur *lancer* : le son démarre au clic)

**→ [Télécharger le MP4](https://nicolas6910.github.io/claude-montage/clawd-montage-30s.mp4)** (1920×1080, 60 fps, avec le son, 6,8 Mo)

## Ce qui est généré en code

Tout. Il n'y a ni image, ni sample audio, ni asset externe dans ce dépôt.

| Élément | Comment |
| --- | --- |
| Décor, personnage, 3D, particules | Canvas 2D, dessiné image par image (`src/core.js`, `src/scenes.js`) |
| Projection 3D (icosaèdre, tore, protéine) | Rotation + perspective à la main, pas de bibliothèque |
| Musique | Synthèse Web Audio : cordes (saw désaccordés), piano (partiels + marteau), taïko (sinus plongeant + bruit filtré), réverbération à réponse impulsionnelle générée (`src/music.js`) |
| Bruit, grain, étoiles | PRNG déterministe : la même image à chaque rendu |

## Les six séquences

| Temps | Séquence |
| --- | --- |
| 0 – 5 s | v0.1 — un chat maladroit, une faute de frappe corrigée en direct |
| 5 – 10 s | v0.2 — la recherche : globe de sources, requêtes absorbées |
| 10 – 15 s | v0.3 — le code : éditeur, tests, pipeline CI vert |
| 15 – 20 s | v0.4 — les modèles 3D : icosaèdre et tore filaires |
| 20 – 26 s | v1.0 — médecine, science, climat ; convergence et climax |
| 26 – 30 s | final — tout se rassemble en une étincelle |

Les transitions sont des fondus enchaînés : le décor et le personnage vivent dans une couche
continue, seules les *props* de chaque scène se croisent (zoom léger + balayage lumineux).

## Rendu vidéo

```bash
node render/render.js          # 1800 images PNG + audio.wav (OfflineAudioContext)
./render/encode.sh             # assemblage ffmpeg en MP4 1920x1080 60 fps
```

Le rendu est déterministe : `VIZ.drawFrame(t)` ne dépend que de `t`, jamais de l'horloge.

## Licence

MIT pour le code. Clawd est un clin d'œil affectueux, sans lien officiel avec Anthropic.
