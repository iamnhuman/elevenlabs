const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SamplePlayer = require('../audio-player.js');
const SpectralImage = require('../spectral-image.js');

// Run the app's real event wiring without a browser, decoding audio or drawing canvases.
function fixture(saved = new Map()) {
  class Element {
    constructor() {
      this.dataset = {}; this.value = ''; this.attributes = {}; this.listeners = new Map(); this.nodes = new Map();
      this.style = { setProperty() {} }; this.classList = { add() {}, remove() {}, toggle() {} };
      this.clientWidth = 1200; this.clientHeight = 160;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
    emit(name, event = {}) { this.listeners.get(name)?.forEach(fn => fn(event)); }
    querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
    replaceChildren(...children) { this.children = children; }
    scrollIntoView() {}
    click() { this.emit('click', { target: this }); }
  }
  const document = new Element(); document.body = new Element(); document.createElement = () => new Element();
  const modes = ['1d', '2d', '3d'].map(mode => { const button = new Element(); button.dataset.spectrumView = mode; return button; });
  document.querySelectorAll = selector => selector === '.spectrum-switch [data-spectrum-view]' ? modes : [];
  const audio = document.querySelector('#audio');
  Object.assign(audio, { paused: true, currentTime: 0, duration: NaN, readyState: 0, ended: false });
  audio.pause = () => { audio.paused = true; audio.emit('pause'); };
  audio.play = async () => { audio.paused = false; };
  audio.load = () => { audio.currentTime = 0; };
  const artwork = { cards: [{ sheet: 0, size: 100, x: 0, y: 0 }], sheets: [{ file: 'atlas.webp', width: 500, height: 500 }] };
  const samples = ['a', 'b'].map((id, i) => ({ id, src: `${id}.mp3`, original: `${id}-original.mp3`, duration: 8, title: String(i + 1), number: i + 1, artworkNumber: 1, peaks: [] }));
  const jobs = []; let effect, spectrum;
  const window = {
    SAMPLE_LIBRARY: { samples }, SAMPLE_ART: artwork, SamplePlayer, addEventListener() {},
    PlayerSpectrum: class {
      constructor(element) { this.element = element; spectrum = this; }
      setMode(mode) { this.mode = mode; }
      async select(sample, options) { this.sample = sample; this.recording = options?.recording; }
    },
    SpectralImage: class extends SpectralImage {
      constructor(player, spectrum, options) {
        super(player, spectrum, { ...options, artwork, createURL: () => 'blob:visual', revokeURL() {},
          generate: (sample, options) => new Promise(resolve => jobs.push({ sample, options, resolve })),
        });
        effect = this;
      }
    },
    Waveform: class { refresh() {} setActive() {} setProgress() {} },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window, document, navigator: {}, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
  });
  const select = index => {
    const list = document.querySelector('#sample-list'), row = list.children[index];
    list.emit('click', { target: { closest: selector => selector === '.sample-row' ? row : { dataset: { action: 'play' } } } });
  };
  return { select, document, modes, jobs, audio, effect, spectrum, saved, button: document.querySelector('#enable-visual') };
}

test('2D and visual start enabled by default, then manual choices survive track changes', async () => {
  const f = fixture();
  assert.equal(f.spectrum.mode, '2d');
  f.select(0);
  assert.equal(f.spectrum.mode, '2d');
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.attributes['aria-pressed'], 'true');
  assert.equal(f.button.attributes['aria-busy'], 'true');
  assert.equal(f.jobs.length, 1);
  assert.equal(f.jobs[0].options.viewport.width, 1200);
  f.jobs[0].resolve({ blob: {}, recording: { repeated: true } });
  await new Promise(setImmediate);
  assert.equal(f.effect.enabled, true);
  assert.equal(f.audio.src, 'blob:visual');
  assert.equal(f.spectrum.recording.repeated, true);

  f.button.click();
  f.modes[2].click();
  f.select(0);
  assert.equal(f.effect.enabled, false);
  assert.equal(f.spectrum.mode, '3d');
  assert.equal(f.jobs.length, 1);
  f.document.querySelector('#next').click();
  assert.equal(f.spectrum.mode, '3d');
  assert.equal(f.button.attributes['aria-pressed'], 'false');
  assert.equal(f.audio.src, 'b.mp3');
  assert.equal(f.jobs.length, 1, 'Disabling visual persists when selecting the next track');

  f.modes[1].click();
  f.button.click();
  assert.equal(f.button.attributes['aria-pressed'], 'true');
  assert.equal(f.jobs.length, 2);
  f.document.querySelector('#player-random').click();
  assert.equal(f.spectrum.mode, '2d');
  assert.equal(f.jobs.length, 3, 'Re-enabling visual applies to subsequent tracks');
  f.effect.cancel();
});

test('each fresh visit enables visual on the first sample, then respects manual changes', () => {
  for (const mode of ['1d', '2d', '3d']) {
    const saved = new Map([['sample-room:spectrum-view', JSON.stringify(mode)], ['sample-room:visual-enabled', 'false']]);
    const f = fixture(saved);
    f.select(0);
    assert.equal(f.spectrum.mode, mode);
    assert.equal(f.jobs.length, 1, 'The first sample enables visual even if a previous visit saved it as off');
    assert.equal(f.button.attributes['aria-pressed'], 'true');
    f.button.click();
    f.document.querySelector('#next').click();
    assert.equal(f.spectrum.mode, mode);
    assert.equal(f.jobs.length, 1, 'Subsequent samples keep the manual off choice');
    assert.equal(f.button.attributes['aria-pressed'], 'false');
    assert.equal(f.button.hidden, mode !== '2d');

    const reopened = fixture(saved);
    reopened.select(1);
    assert.equal(reopened.spectrum.mode, mode);
    assert.equal(reopened.jobs.length, 1, 'Opening the site again starts the first sample with visual on');
    assert.equal(reopened.button.attributes['aria-pressed'], 'true');
    reopened.effect.cancel();
  }
});

test('cancelling visual generation keeps it disabled for the next track', async () => {
  const f = fixture();
  f.select(0);
  f.button.click();
  assert.equal(f.jobs[0].options.signal.aborted, true);
  f.select(1);
  f.jobs[0].resolve({ blob: {}, recording: { wrong: true } });
  await new Promise(setImmediate);
  assert.equal(f.jobs.length, 1);
  assert.equal(f.audio.src, 'b.mp3');
  assert.equal(f.effect.enabled, false);
  assert.equal(f.button.attributes['aria-pressed'], 'false');
});

test('rapid automatic selection aborts the previous job without applying its audio', async () => {
  const f = fixture();
  f.select(0); f.select(1);
  assert.equal(f.jobs[0].options.signal.aborted, true);
  f.jobs[0].resolve({ blob: {}, recording: { wrong: true } });
  await new Promise(setImmediate);
  assert.equal(f.audio.src, 'b.mp3');
  assert.equal(f.effect.busy, true);
  f.jobs[1].resolve({ blob: {}, recording: { right: true } });
  await new Promise(setImmediate);
  assert.equal(f.effect.enabled, true);
  assert.equal(f.spectrum.recording.right, true);
});
