const { test } = require('node:test');
const assert = require('node:assert/strict');
const Spectrogram1D = require('../spectrogram-1d.js');

const binAt = frequency => Math.round(Math.log(frequency / 32) / Math.log(500) * 255);
function recording(frequencies = [100], level = 220) {
  const clip = { frames: 20, bins: 256, rate: 100, minDb: -96, maxDb: -12, data: new Uint8Array(20 * 256) };
  for (let frame = 0; frame < clip.frames; frame++) {
    for (const frequency of frequencies) clip.data[frame * clip.bins + binAt(frequency)] = level;
  }
  return clip;
}
const excursion = points => Math.max(...points.map(([, y]) => Math.abs(y - points[0][1])));
const points = (clip, time, volume = 1, band = 0, width = 1280, height = 145) =>
  Spectrogram1D.wavePoints(clip, time, volume, width, height, band);

test('isolated bass, mid and treble tones move only their own wave', () => {
  for (const [selected, frequency] of [100, 700, 6000].entries()) {
    const clip = recording([frequency]);
    for (let band = 0; band < 3; band++) {
      const displacement = excursion(points(clip, .1, 1, band));
      if (band === selected) assert.ok(displacement > 12, 'An audible narrow tone gets a visible response');
      else assert.equal(displacement, 0, 'Other frequency ranges remain still');
    }
  }
});

test('adding a loud bass tone does not change the treble wave', () => {
  const treble = recording([6000]), mixed = recording([100, 6000]);
  assert.deepEqual(points(treble, .1, 1, 2), points(mixed, .1, 1, 2));
  assert.equal(excursion(points(treble, .1)), 0);
  assert.ok(excursion(points(mixed, .1)) > 12);
});

test('a transient responds at the current frame and silence stops it without delayed echoes', () => {
  const clip = recording([]);
  clip.data[10 * clip.bins + binAt(100)] = 255;
  assert.equal(Spectrogram1D.bandAt(clip, .09, 1, 0).strength, 0);
  assert.ok(Spectrogram1D.bandAt(clip, .1, 1, 0).strength > .95);
  assert.equal(Spectrogram1D.bandAt(clip, .11, 1, 0).strength, 0);
  const between = Spectrogram1D.bandAt(clip, .095, 1, 0).strength;
  assert.ok(between > 0 && between < 1, 'Sub-frame playback still interpolates');
});

test('higher frequency waves have more detail and do not duplicate the bass shape', () => {
  const clip = recording([100, 700, 6000]);
  const crossings = wave => {
    const center = wave[0][1];
    return wave.slice(1).filter(([, y], index) => (y - center) * (wave[index][1] - center) < 0).length;
  };
  const waves = [0, 1, 2].map(band => points(clip, .1, 1, band));
  assert.ok(crossings(waves[0]) < crossings(waves[1]));
  assert.ok(crossings(waves[1]) < crossings(waves[2]));
});

test('all waves honor volume and mute, stay within the player and leave quiet noise flat', () => {
  const clip = recording([100, 700, 6000]);
  for (let band = 0; band < 3; band++) {
    assert.ok(excursion(points(clip, .1, 1, band)) > excursion(points(clip, .1, .1, band)));
    assert.equal(excursion(points(clip, .1, 0, band)), 0);
    for (const [width, height] of [[320, 190], [768, 145], [1360, 145]]) {
      const wave = points(clip, .1, 1, band, width, height);
      assert.equal(wave[0][1], wave.at(-1)[1]);
      assert.ok(wave.every(([x, y]) => x >= 0 && x <= width && y >= 10 && y <= height - 38));
    }
  }
  const noise = recording([100, 700, 6000], 25);
  for (let band = 0; band < 3; band++) assert.equal(excursion(points(noise, .1, 1, band)), 0);
});

test('three white SVG waves resize, freeze on pause, seek deterministically and clear together', () => {
  const element = {
    clientWidth: 640, clientHeight: 160,
    replaceChildren(surface) { this.surface = surface; },
    ownerDocument: { createElementNS(namespace, tag) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      return {
        tag, attributes: {}, children: [],
        setAttribute(name, value) { this.attributes[name] = value; },
        append(child) { this.children.push(child); }, remove() { this.removed = true; },
      };
    } },
  };
  const visual = Spectrogram1D.create(element), clip = recording([100, 700, 6000]);
  visual.show(clip, 0);
  assert.equal(element.surface.tag, 'svg');
  const gradient = visual.svg.children[0].children[0];
  assert.ok(gradient.children.every(stop => stop.attributes['stop-color'] === '#fff'));
  assert.equal(visual.traces.length, 3);
  assert.deepEqual(visual.traces.map(({ path }) => path.attributes['data-band']), ['treble', 'mid', 'bass']);
  assert.ok(visual.traces.every(({ path }) => path.attributes['vector-effect'] === 'non-scaling-stroke'));
  const paths = () => visual.traces.map(({ path }) => path.attributes.d);
  const original = paths();
  element.clientWidth = 320;
  element.clientHeight = 190;
  visual.resize();
  assert.equal(visual.svg.attributes.viewBox, '0 0 320 190');
  assert.notDeepEqual(paths(), original);
  const paused = paths();
  visual.show(clip, 0);
  assert.deepEqual(paths(), paused, 'Redrawing on pause cannot advance the waves');
  visual.show(clip, .1);
  assert.notDeepEqual(paths(), paused);
  visual.show(clip, 0);
  assert.deepEqual(paths(), paused, 'Seeking back restores all three waves exactly');
  visual.show(clip, .1, 0);
  assert.equal(visual.traces[0].path.attributes.opacity, '0');
  assert.equal(visual.traces[1].path.attributes.opacity, '0');
  visual.clear();
  visual.resize();
  assert.ok(paths().every(path => path === ''), 'Resizing cannot restore a cleared sample');
  visual.destroy();
  assert.equal(visual.svg.removed, true);
});
