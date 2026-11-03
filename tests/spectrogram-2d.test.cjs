const { test } = require('node:test');
const assert = require('node:assert/strict');
const Spectrogram2D = require('../spectrogram-2d.js');

function fixture() {
  const contexts = [];
  const element = { clientWidth: 1200, clientHeight: 165, replaceChildren() {}, ownerDocument: {
    createElement() {
      const ctx = {
        images: [], rectangles: [], labels: [], setTransform() {}, clearRect() { this.rectangles = []; this.labels = []; },
        createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
        putImageData(image) { this.images.push(image); }, drawImage(...args) { this.drawnImage = args; },
        fillRect(...rect) { this.rectangles.push(rect); }, fillText(label) { this.labels.push(label); },
      };
      contexts.push(ctx);
      return { getContext: () => ctx, remove() {} };
    },
  } };
  const visual = new Spectrogram2D(element);
  const recording = { frames: 4, bins: 64, rate: 4, data: new Uint8Array(256) };
  recording.data[0] = 255;
  recording.data[3 * 64 + 63] = 255;
  return { visual, recording, ctx: contexts[0], imageCtx: contexts[1] };
}

test('the flat spectrogram maps time left-to-right and low frequencies below high frequencies', () => {
  const f = fixture(); f.visual.show(f.recording, .25, 1);
  const image = f.imageCtx.images[0];
  const pixel = (x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
  assert.deepEqual(pixel(0, 63), [255, 255, 225, 255], 'Low tone at the start is at bottom left');
  assert.deepEqual(pixel(3, 0), [255, 255, 225, 255], 'High tone at the end is at top right');
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 255], 'Silent bands stay black');
  assert.deepEqual(f.ctx.drawnImage.slice(1), [0, 0, 1200, 165], 'The heat map fills the player edge to edge');
  assert.equal(f.ctx.rectangles[1][0], .25 * 1200, 'Playback cursor follows audio time');
});

test('cursor movement reuses the FFT image; muting removes its energy', () => {
  const f = fixture(); f.visual.show(f.recording, .25, 1);
  f.visual.show(f.recording, .75, 1);
  assert.equal(f.imageCtx.images.length, 1, 'No full image rebuild on every animation frame');
  assert.equal(f.ctx.rectangles[1][0], .75 * 1200);
  f.visual.show(f.recording, .75, 0);
  const data = f.imageCtx.images[1].data;
  assert.ok([...data].every((value, i) => i % 4 === 3 ? value === 255 : value === 0));
});

test('flat heat colors include violet lows, red mids and yellow-white peaks', () => {
  const violet = Spectrogram2D.heatColor(.28), red = Spectrogram2D.heatColor(.65), hot = Spectrogram2D.heatColor(1);
  assert.ok(violet[2] > violet[0] && violet[2] > violet[1]);
  assert.ok(red[0] > red[1] * 5 && red[0] > red[2] * 5);
  assert.ok(hot[0] === 255 && hot[1] === 255 && hot[2] > 200);
});
