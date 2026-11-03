# audioMotion-analyzer 4.5.4

Author: Henrique Avila Vianna. License: AGPL-3.0-or-later (full text in `LICENSE`).

- Official project and API: https://github.com/hvianna/audioMotion-analyzer
- Package: https://registry.npmjs.org/audiomotion-analyzer/-/audiomotion-analyzer-4.5.4.tgz
- `audiomotion-analyzer.js`: unmodified `dist/index.js` UMD build.
- `source.js`: unmodified upstream source, included for reference and redistribution.
- Package integrity verified against npm SHA-512 before copying. No install scripts were run.

The site uses FFT data to draw a thermal 3D spectrogram behind its player controls. `player-spectrum.js` connects an existing AudioNode to the analyzer with `connectSpeakers: false` and `useCanvas: false`; `spectrogram-3d.js` renders the measured history with Three.js. The site's original graph remains the only connection to the speakers. There are no runtime CDN requests.
