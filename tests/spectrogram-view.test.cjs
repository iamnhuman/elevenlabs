const { test } = require('node:test');
const assert = require('node:assert/strict');
const SpectrogramView = require('../spectrogram-view.js');
const Spectrogram3D = require('../spectrogram-3d.js');

test('switching reuses each SVG/canvas and displays the same recording and playback position', () => {
  const creates = { '3d': 0, '2d': 0, '1d': 0 };
  const element = { replaceChildren(canvas) { this.canvas = canvas; } };
  const factory = mode => ({ create() {
    creates[mode]++;
    return { [mode === '1d' ? 'svg' : 'canvas']: { mode }, frames: [], resize() {}, show(...frame) { this.frames.push(frame); }, clear() { this.cleared = true; } };
  } });
  const view = new SpectrogramView(element, '1d', { ThreeD: factory('3d'), TwoD: factory('2d'), OneD: factory('1d') });
  const recording = { data: [1, 2, 3] };
  assert.deepEqual(creates, { '3d': 0, '2d': 0, '1d': 1 }, 'Saved 1D mode only initializes SVG');
  assert.equal(element.canvas.mode, '1d');
  view.show(recording, 4.5, .8);
  view.setMode('3d');
  assert.equal(element.canvas.mode, '3d');
  assert.deepEqual(view.active.frames.at(-1), [recording, 4.5, .8]);
  view.show(recording, 9, .6);
  view.setMode('2d');
  assert.equal(element.canvas.mode, '2d');
  assert.deepEqual(view.active.frames.at(-1), [recording, 9, .6]);
  view.setMode('3d');
  view.setMode('1d');
  assert.equal(element.canvas.mode, '1d');
  assert.deepEqual(view.active.frames.at(-1), [recording, 9, .6]);
  assert.deepEqual(creates, { '3d': 1, '2d': 1, '1d': 1 });
  view.clear();
  assert.ok([...view.views.values()].every(renderer => renderer.cleared));
  assert.equal(view.lastFrame, null, 'No previous clip leaks into the next selection');
});

test('a WebGL context loss in the inactive 3D view cannot displace the active 2D canvas', () => {
  const active2D = {};
  const fallback = { getContext: () => ({}) };
  const element = {
    canvas: active2D, ownerDocument: { createElement: () => fallback },
    replaceChildren(canvas) { this.canvas = canvas; },
  };
  const inactive3D = { element, canvas: { parentNode: null }, renderer: { dispose() {} } };
  Spectrogram3D.prototype.useSoftwareRenderer.call(inactive3D);
  assert.equal(element.canvas, active2D);
  assert.equal(inactive3D.canvas, fallback, 'The 3D fallback remains available on the next mode switch');
});
