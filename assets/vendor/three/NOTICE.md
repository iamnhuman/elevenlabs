# Three.js 0.187.0

Official project: https://github.com/mrdoob/three.js

Package: https://registry.npmjs.org/three/-/three-0.187.0.tgz

Original ESM builds `three.module.js` and `three.core.js`, distributed under the MIT license included in `LICENSE`. The archive's SHA-512 integrity was verified against the official npm metadata before copying. No upstream install scripts were run.

`three.js` is a minified, self-contained classic-script bundle of these sources, generated with esbuild 0.25.12:

```sh
npx --package esbuild@0.25.12 esbuild assets/vendor/three/three.module.js --bundle --format=iife --global-name=THREE --minify --legal-comments=eof --outfile=assets/vendor/three/three.js
```

This bundle is retained from the previous 3D renderer for reference. The site now loads the specialized Sonoscope Terrain bundle from `assets/vendor/sonoscope/` instead; Three.js is no longer requested by the page.
