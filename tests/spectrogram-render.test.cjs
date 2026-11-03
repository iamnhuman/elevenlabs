const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Spectrogram3D = require('../spectrogram-3d.js');

test('the shipped Sonoscope Terrain bundle projects an actual MP3 spectrum into the player viewport', () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/vendor/sonoscope/terrain.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.SonoscopeTerrain.TerrainSpectrogramProgram, 'function');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/spectrum/manifest.json')));
  const first = manifest.samples[0];
  const dataWindow = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', first.file), 'utf8'), { window: dataWindow });
  const recording = dataWindow.SAMPLE_SPECTRA[first.id];
  recording.data = new Uint8Array(Buffer.from(recording.values, 'base64'));
  assert.equal(recording.data.length, recording.frames * recording.bins);
  assert.equal(recording.bins, 256, 'The published data contains the measured high-resolution spectrum');
  const polygons = [];
  let points = [];
  const ctx = {
    clearRect() { polygons.length = 0; }, beginPath() { points = []; },
    moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); }, closePath() {},
    fill() { polygons.push({ points, color: this.fillStyle }); },
  };
  const canvas = { getContext: type => type === '2d' ? ctx : null, remove() {} };
  const element = { clientWidth: 1200, clientHeight: 165, ownerDocument: { createElement: () => canvas }, replaceChildren() {} };
  const visual = new Spectrogram3D(element, sandbox.SonoscopeTerrain);
  visual.show(recording, 2, .8);
  assert.ok(polygons.length > 100, 'Measured energy produces a visible relief');
  const visible = polygons.filter(({ points }) => points.some(([x, y]) => x >= 0 && x <= 1200 && y >= 0 && y <= 165));
  assert.ok(visible.length > 100, 'The terrain falls within the player, not outside its clipping region');
  assert.ok(polygons.every(({ points }) => points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))));
  visual.show(recording, 5, .8);
  assert.ok(polygons.length > 0, 'Paused seek redraws its actual time slice');
  visual.show(recording, 2, 0);
  assert.equal(polygons.length, 0, 'Muted output has no invented energy');
  visual.destroy();
});

test('the adapter uses the shipped Sonoscope shader, mesh and texture upload API', () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/vendor/sonoscope/terrain.js'), 'utf8'), sandbox);
  const library = sandbox.SonoscopeTerrain;
  const sourceShaders = [], uploads = [], draws = [], uniforms = new Map();
  let enumeration = 100, objects = 0;
  const gl = new Proxy({
    NO_ERROR: 0,
    createShader: () => ({ id: ++objects }), createProgram: () => ({ id: ++objects }),
    createBuffer: () => ({ id: ++objects }), createVertexArray: () => ({ id: ++objects }),
    createTexture: () => ({ id: ++objects }),
    shaderSource: (_, source) => sourceShaders.push(source),
    getShaderParameter: () => true, getProgramParameter: () => true,
    getShaderInfoLog: () => '', getProgramInfoLog: () => '',
    getAttribLocation: (_, name) => name === 'a_tileUv' ? 1 : -1,
    getUniformLocation: (_, name) => ({ name }),
    uniform1i: (location, value) => uniforms.set(location.name, value),
    uniform1f: (location, value) => uniforms.set(location.name, value),
    uniform2f: (location, ...value) => uniforms.set(location.name, value),
    uniform3f: (location, ...value) => uniforms.set(location.name, value),
    uniform4f: (location, ...value) => uniforms.set(location.name, value),
    uniformMatrix4fv: (location, _, value) => uniforms.set(location.name, value),
    texImage2D: (...args) => uploads.push({ width: args[3], height: args[4], data: args[8].slice() }),
    drawArrays: (...args) => draws.push(args),
    getParameter: () => 0, getError: () => 0, isContextLost: () => false,
  }, { get(target, key) {
    if (key in target) return target[key];
    if (typeof key === 'string' && key === key.toUpperCase()) return target[key] = ++enumeration;
    return () => {};
  } });
  const canvas = { getContext: type => type === 'webgl2' ? gl : null, addEventListener() {}, remove() {} };
  const element = { clientWidth: 1200, clientHeight: 165, ownerDocument: { createElement: () => canvas }, replaceChildren() {} };
  const visual = new Spectrogram3D(element, library);
  assert.ok(visual.renderer instanceof library.WebGL2SpectrogramRenderer);
  assert.ok(visual.program instanceof library.TerrainSpectrogramProgram);
  assert.equal(sourceShaders.length, 2, 'The original library supplies both shader stages');
  assert.ok(sourceShaders[0].includes('u_viewProjection') && sourceShaders[0].includes('u_smoothing'));
  const recording = { bins: 256, rate: 96, frames: 480, minDb: -96, maxDb: -12, data: new Uint8Array(256 * 480) };
  for (let frame = 0; frame < 480; frame++) recording.data[frame * 256 + frame % 256] = 255;
  visual.show(recording, 2, 1);
  assert.ok(draws.at(-1)[2] > 100000, 'The library renders its dense terrain mesh');
  assert.equal(uniforms.get('u_terrainHeight'), Spectrogram3D.options.heightScale);
  assert.equal(uniforms.get('u_viewProjection').length, 16);
  assert.ok([...uniforms.get('u_viewProjection')].every(Number.isFinite));
  assert.deepEqual(uniforms.get('u_tileTimeRange'), [0, 1]);
  const terrain = uploads.filter(upload => upload.height > 1).at(-1);
  assert.equal(terrain.width, 256); assert.equal(terrain.height, 128);
  assert.ok(terrain.data.some((value, i) => i % 4 !== 3 && value > 0), 'The measured frequency peak reaches the library texture');
  visual.show(recording, 4, 1);
  assert.notDeepEqual(uploads.filter(upload => upload.height > 1).at(-1).data, terrain.data, 'Seeking uploads fresh data rather than a stale cached tile');
  visual.show(recording, 4, 0);
  assert.ok(uploads.filter(upload => upload.height > 1).at(-1).data.every((value, i) => i % 4 === 3 || value === 0));
  visual.destroy();
});
