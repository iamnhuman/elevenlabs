# Sonoscope Terrain

Official project: https://github.com/mbsantiago/sonoscope

Documentation and reference: https://mbsantiago.github.io/sonoscope/plugins/terrain/

License: MIT, included in `LICENSE`.

- `terrain-source.ts` is the unmodified upstream Terrain renderer at commit `370388884aacf0bdf540ed40215dca4a2f0775d9`, including its public camera and lighting options.
- `core.js` is the unmodified official `@sonoscope/core` 0.2.0 npm build. The npm archive's SHA-512 integrity was verified before copying. Exact revision, package URL and integrity are in `provenance.json`.
- `terrain.js` is a local classic-script bundle exposing `SonoscopeTerrain`. It contains the ready `TerrainSpectrogramProgram`, `WebGL2SpectrogramRenderer`, camera helpers, colormap support and terrain triangulation. No upstream install scripts were executed.

Rebuild from the included source:

```sh
npx --package esbuild@0.25.12 esbuild assets/vendor/sonoscope/entry.js --bundle --format=iife --global-name=SonoscopeTerrain --minify --legal-comments=eof --alias:@sonoscope/core=./assets/vendor/sonoscope/core.js --outfile=assets/vendor/sonoscope/terrain.js
```

The site uses the original library shaders. `spectrogram-3d.js` only adapts the measured MP3 matrix to the library's input, selects camera/palette settings and supplies a software fallback using the same upstream mesh and camera helpers. There are no CDN requests, microphone permissions, extra audio routes or continuous rendering loops outside the existing player scheduler. 2D remains the default.
