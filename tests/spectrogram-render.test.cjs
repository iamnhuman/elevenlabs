const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Spectrogram3D = require('../spectrogram-3d.js');

test('the shipped classic Three.js bundle projects an actual MP3 spectrum into the player viewport', () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/vendor/three/three.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.THREE.PerspectiveCamera, 'function');
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
  const canvas = { getContext: () => ctx, remove() {} };
  const element = { clientWidth: 1200, clientHeight: 165, ownerDocument: { createElement: () => canvas }, replaceChildren() {} };
  const visual = new Spectrogram3D(element, sandbox.THREE);
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
