# Jingle the Bells

Everyone the camera sees becomes a pair of iced gingerbread hands, each player
in their own icing colour. Three of the Christmas ornaments (julehjerter, straw
stars, baubles, bells, kræmmerhuse, snowflakes) are magic: they glow, sparkle
and wear a ring of golden stars. Push a magic one into a wall and it rings the
next note of the carol on bells, and the last player to touch it scores a
point. When a magic ornament bumps a plain one, the magic (and the credit)
jumps across, so there are always three to hunt. Plain ornaments glide and
stop quietly. Scores are along the bottom.

```sh
npm install
npm run dev         # http://localhost:5173
```

Open `?demo` for three synthetic players without a camera, or `?mouse` to play
with the mouse as an extra player.

**Calibration:** arms up and out, hands just above shoulder height, puts the
hands in the top corners of the screen; hands at hip height reach the bottom.
It's measured in shoulder widths, so it works at any distance from the camera.

**Debug mode:** press `D` (or double-tap). It shows the camera image, the
tracked skeletons and each player's calibration box. Settings are remembered
per browser:

| Key | Setting | Default |
|---|---|---|
| ← / → | reach: hands this many shoulder widths out to the side = screen edge | 1.9 |
| ↑ / ↓ | lift: hands this far above the shoulders = top of the screen | 0.7 |
| [ / ] | drop: hands this far below the shoulders = bottom of the screen | 1.6 |
| + / − | smoothing (One Euro cutoff; lower Hz = smoother, more lag) | 1.5 Hz |
| 0 | reset | |

Any time: `R` resets the scores, `N` skips to the next song.

URL options: `?debug` `?demo` `?mouse` `?mirror=0` `?camera=back` `?model=lite`
`?reach=` `?lift=` `?drop=` `?smooth=`.

Privacy: the camera image is processed entirely in your browser and never
leaves your machine. Nothing is recorded or uploaded.

## Acknowledgements

- **Pose tracking:** [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
  by Google (Apache 2.0). The WASM runtime and model are fetched from jsDelivr
  and Google's model storage at startup.
- **Game engine:** [Phaser](https://phaser.io) 4 (MIT).
- **Christmas trees:** [Kenney](https://www.kenney.nl) Holiday Pack 2016, CC0,
  see `public/kenney/KENNEY-LICENSE.txt`.
- **Font:** [Mountains of Christmas](https://fonts.google.com/specimen/Mountains+of+Christmas)
  by Tart Workshop (SIL Open Font License), via Google Fonts.
- **Songs:** Jingle Bells (James Lord Pierpont, 1857), Deck the Halls
  (traditional Welsh) and We Wish You a Merry Christmas (traditional English),
  all public domain. Bells are synthesized with Web Audio: no samples.
- **Smoothing:** the [One Euro Filter](https://gery.casiez.net/1euro/) by
  Géry Casiez, Nicolas Roussel and Daniel Vogel.
- Ornaments, hands, garland and room are painted procedurally in `src/art.ts`,
  inspired by Danish Christmas decorations.
- Built with [Vite](https://vite.dev) and TypeScript.

## License

[MIT](LICENSE) © 2026 Claus Dahl. Third-party assets keep their own licenses
(listed above).
