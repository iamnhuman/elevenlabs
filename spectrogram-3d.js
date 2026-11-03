/* Sonoscope Terrain adapter: measured frequency across X, recent time into depth. */
(function (root) {
  'use strict';
  const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const ROWS = 128, HISTORY_SECONDS = 3;
  const DISPLAY_MIN_DB = -82, DISPLAY_MAX_DB = -12;
  const OPTIONS = {
    meshResolution: [256, 128], heightScale: 1.15, heightGamma: 1.8,
    fov: 45, cameraPitch: 52, cameraYaw: 0, cameraDistance: 2.8,
    cameraTarget: [0, 0, .12], smoothing: .65,
    ambientLight: .48, diffuseLight: .60, lightDirection: [.15, -.35, .85],
  };
  const COLOR_MAP = { points: [
    { at: 0, color: '#000000' }, { at: .2, color: '#230303' },
    { at: .45, color: '#7d0d04' }, { at: .70, color: '#ee4605' },
    { at: .85, color: '#ff9c15' }, { at: 1, color: '#fff89b' },
  ] };

  function updateTerrainTile(recording, seconds, volume = 1, tile) {
    const bins = recording.bins;
    if (!tile || tile.frameCount !== bins) tile = {
      channel: 0, frameStart: 0, timeStart: 0, timeEnd: 1,
      frameCount: bins, binCount: ROWS, sampleRate: 32000,
      times: Float32Array.from({ length: bins }, (_, i) => i / bins),
      frequencies: Float32Array.from({ length: ROWS }, (_, i) => i / (ROWS - 1)),
      magnitude: new Float32Array(bins * ROWS),
      db: new Float32Array(bins * ROWS),
      normalized: new Float32Array(bins * ROWS),
    };
    if (volume <= 0) { tile.magnitude.fill(0); tile.db.fill(-120); tile.normalized.fill(0); return tile; }
    const minDb = recording.minDb ?? -90;
    const range = (recording.maxDb ?? -25) - (recording.minDb ?? -90);
    const offset = 20 * Math.log10(volume);
    const now = Math.min(Math.max(0, seconds), (recording.frames - 1) / recording.rate);
    for (let age = 0; age < ROWS; age++) {
      const position = (now - age / (ROWS - 1) * HISTORY_SECONDS) * recording.rate;
      const first = Math.floor(Math.max(0, position));
      const last = Math.min(recording.frames - 1, first + 1);
      const mix = Math.max(0, position) - first;
      for (let bin = 0; bin < bins; bin++) {
        const a = recording.data[first * bins + bin] / 255;
        const b = recording.data[last * bins + bin] / 255;
        // Sonoscope lays its first axis horizontally. Transpose the measured
        // matrix so it shows frequency across X and sound history in depth.
        const i = bin * ROWS + age;
        const db = position < 0 ? -120 : (a * (1 - mix) + b * mix) * range + minDb + offset;
        tile.db[i] = db;
        tile.magnitude[i] = position < 0 ? 0 : 10 ** (db / 20);
        tile.normalized[i] = clamp((db - DISPLAY_MIN_DB) / (DISPLAY_MAX_DB - DISPLAY_MIN_DB));
      }
    }
    return tile;
  }

  class Spectrogram3D {
    static create(element) { return new Spectrogram3D(element, root.SonoscopeTerrain); }

    constructor(element, library = root.SonoscopeTerrain) {
      if (!library) throw new Error('Sonoscope Terrain is unavailable');
      this.element = element; this.library = library;
      this.tile = null;
      this.palette = library.buildColorMap(COLOR_MAP);
      this.canvas = element.ownerDocument.createElement('canvas');
      try {
        const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'low-power' });
        if (!gl) throw new Error('WebGL2 is unavailable');
        this.program = new library.TerrainSpectrogramProgram(gl, OPTIONS);
        this.renderer = new library.WebGL2SpectrogramRenderer(gl, this.program);
        this.canvas.addEventListener('webglcontextlost', event => {
          event.preventDefault(); this.useSoftwareRenderer(); this.resize();
        }, { once: true });
      } catch { this.useSoftwareRenderer(); }
      element.replaceChildren(this.canvas);
      this.resize = this.resize.bind(this);
      if (root.ResizeObserver) {
        this.observer = new root.ResizeObserver(this.resize); this.observer.observe(element);
      } else root.addEventListener?.('resize', this.resize);
      this.resize();
    }

    useSoftwareRenderer() {
      const mounted = !this.canvas || this.canvas.parentNode === this.element;
      if (this.renderer) this.renderer.destroy?.();
      else this.program?.delete();
      this.program = this.renderer = null;
      this.software = true;
      this.canvas = this.element.ownerDocument.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (mounted) this.element.replaceChildren(this.canvas);
    }

    resize() {
      this.width = this.element.clientWidth || 1000;
      this.height = this.element.clientHeight || 160;
      const ratio = Math.min(root.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.ctx?.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      const { eye, target, up } = this.library.computeTerrainCamera(OPTIONS);
      this.viewProjection = this.library.multiplyMat4(
        this.library.perspective(OPTIONS.fov * Math.PI / 180, this.width / this.height, .1, 100),
        this.library.lookAt(eye, target, up),
      );
      this.render();
    }

    clear() { this.tile = null; this.render(); }

    show(recording, seconds, volume = 1) {
      this.tile = updateTerrainTile(recording, seconds, volume, this.tile);
      this.render();
    }

    render() {
      if (this.renderer) {
        try {
          // Sonoscope owns shader compilation, mesh, texture upload, palette and lighting.
          this.renderer.invalidate();
          this.renderer.render({
            canvas: this.canvas,
            viewport: { startTime: 0, endTime: 1, minFrequency: 0, maxFrequency: 1 },
            frequencyScale: 'linear',
            valueScale: { mode: 'db', min: DISPLAY_MIN_DB, max: DISPLAY_MAX_DB, gamma: 1, clamp: true },
            colorMap: COLOR_MAP, tiles: this.tile ? [this.tile] : [],
          });
          return;
        } catch { this.useSoftwareRenderer(); this.resize(); return; }
      }
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.tile) return;
      this.renderSoftware();
    }

    sample(u, v) {
      const tile = this.tile;
      const x = clamp(u) * (tile.frameCount - 1), y = clamp(v) * (tile.binCount - 1);
      const x0 = Math.floor(x), x1 = Math.min(tile.frameCount - 1, x0 + 1);
      const y0 = Math.floor(y), y1 = Math.min(tile.binCount - 1, y0 + 1);
      const a = tile.normalized[x0 * tile.binCount + y0] * (1 - (y - y0)) + tile.normalized[x0 * tile.binCount + y1] * (y - y0);
      const b = tile.normalized[x1 * tile.binCount + y0] * (1 - (y - y0)) + tile.normalized[x1 * tile.binCount + y1] * (y - y0);
      return a * (1 - (x - x0)) + b * (x - x0);
    }

    smoothHeight(u, v) {
      const dx = 1 / (this.tile.frameCount - 1), dy = 1 / (this.tile.binCount - 1);
      const neighbors = (this.sample(u - dx, v) + this.sample(u + dx, v) + this.sample(u, v - dy) + this.sample(u, v + dy)) / 4;
      return this.sample(u, v) * (1 - OPTIONS.smoothing) + neighbors * OPTIONS.smoothing;
    }

    project(u, v, energy) {
      const x = (u * 2 - 1) * (this.width / this.height * 1.05);
      const y = (v - .5) * 1.9, z = energy ** OPTIONS.heightGamma * OPTIONS.heightScale * .5;
      const m = this.viewProjection;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) * this.width / 2,
        (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * this.height / 2];
    }

    renderSoftware() {
      // Use the library's triangulation and camera even without WebGL2.
      this.softwareMesh ||= this.library.terrainVerticesForTile(this.tile, 48, 28);
      const mesh = this.softwareMesh, ctx = this.ctx;
      const light = OPTIONS.lightDirection, lightLength = Math.hypot(...light);
      for (let i = mesh.length - 12; i >= 0; i -= 12) {
        const uv = [[mesh[i + 2], mesh[i + 3]], [mesh[i + 6], mesh[i + 7]], [mesh[i + 10], mesh[i + 11]]];
        const heights = uv.map(([u, v]) => this.smoothHeight(u, v));
        const energy = (heights[0] + heights[1] + heights[2]) / 3;
        if (energy < .005) continue;
        const u = (uv[0][0] + uv[1][0] + uv[2][0]) / 3, v = (uv[0][1] + uv[1][1] + uv[2][1]) / 3;
        const dx = 2 / (this.tile.frameCount - 1), dy = 2 / (this.tile.binCount - 1);
        const nx = this.sample(u - dx, v) - this.sample(u + dx, v), ny = this.sample(u, v - dy) - this.sample(u, v + dy);
        const shade = OPTIONS.ambientLight + Math.max(0, (nx * light[0] + ny * light[1] + 1.2 * light[2]) / (Math.hypot(nx, ny, 1.2) * lightLength)) * OPTIONS.diffuseLight;
        const rgb = this.palette[Math.min(255, Math.round(energy * 255))];
        ctx.fillStyle = `rgb(${rgb.slice(0, 3).map(channel => Math.min(255, Math.round(channel * shade))).join(',')})`;
        ctx.beginPath();
        uv.forEach(([a, b], index) => ctx[index ? 'lineTo' : 'moveTo'](...this.project(a, b, heights[index])));
        ctx.closePath(); ctx.fill();
      }
    }

    destroy() {
      this.observer?.disconnect(); root.removeEventListener?.('resize', this.resize);
      if (this.renderer) this.renderer.destroy(); else this.program?.delete();
      this.canvas.remove(); this.tile = null; this.softwareMesh = null;
    }
  }
  Spectrogram3D.updateTerrainTile = updateTerrainTile;
  Spectrogram3D.options = OPTIONS;
  if (typeof module !== 'undefined' && module.exports) module.exports = Spectrogram3D;
  else root.Spectrogram3D = Spectrogram3D;
})(typeof window !== 'undefined' ? window : globalThis);
