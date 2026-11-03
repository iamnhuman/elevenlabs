const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateTerrainTile } = require('../spectrogram-3d.js');

function recording() { return { bins: 4, rate: 100, frames: 601, minDb: -96, maxDb: -12, data: new Uint8Array(2404) }; }

test('Sonoscope input keeps frequency horizontal and the most recent sound at the front', () => {
  const audio = recording();
  audio.data[400 * 4 + 1] = 255;
  audio.data[100 * 4 + 2] = 255;
  const tile = updateTerrainTile(audio, 4, 1);
  assert.equal(tile.frameCount, 4);
  assert.equal(tile.binCount, 128);
  assert.equal(tile.normalized[1 * 128], 1, 'Current frequency occupies the front row');
  assert.equal(tile.normalized[2 * 128 + 127], 1, 'Three seconds ago occupies the rear row');
  assert.equal(tile.normalized[3 * 128], 0);
});

test('seeking replaces the measured history without keeping an obsolete frame', () => {
  const audio = recording(); audio.data[400 * 4 + 1] = 255; audio.data[100 * 4 + 2] = 255;
  const tile = updateTerrainTile(audio, 4, 1);
  assert.equal(updateTerrainTile(audio, 1, 1, tile), tile, 'The matrix buffer is reused');
  assert.equal(tile.normalized[1 * 128], 0);
  assert.equal(tile.normalized[2 * 128], 1);
});

test('silence, muted audio and time before the beginning do not create terrain', () => {
  const audio = recording();
  assert.ok(updateTerrainTile(audio, 3, 1).normalized.every(v => v === 0));
  audio.data.fill(255);
  assert.ok(updateTerrainTile(audio, 3, 0).normalized.every(v => v === 0));
  const tile = updateTerrainTile(audio, 0, 1);
  assert.equal(tile.normalized[0], 1);
  assert.equal(tile.normalized[127], 0, 'No invented history before the clip starts');
});

test('sub-frame playback interpolates real spectral frames into a stable surface', () => {
  const audio = recording(); audio.data[4] = 255;
  const tile = updateTerrainTile(audio, .005, 1);
  assert.ok(tile.normalized[0] > .3 && tile.normalized[0] < .5);
  assert.ok(tile.normalized.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
});
