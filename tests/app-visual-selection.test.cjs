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
  document.querySelector = selector => selector === '#sort' ? null : Element.prototype.querySelector.call(document, selector);
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

test('each fresh visit enables visual in 2D and respects saved modes and manual changes', () => {
  for (const mode of ['1d', '2d', '3d']) {
    const saved = new Map([['sample-room:spectrum-view', JSON.stringify(mode)], ['sample-room:visual-enabled', 'false']]);
    const f = fixture(saved);
    f.select(0);
    assert.equal(f.spectrum.mode, mode);
    assert.equal(f.jobs.length, mode === '2d' ? 1 : 0, 'Only 2D generates spectral artwork');
    assert.equal(f.button.attributes['aria-pressed'], String(mode === '2d'));
    assert.equal(f.button.hidden, mode !== '2d');
    f.modes[1].click();
    assert.equal(f.jobs.length, 1, 'Entering 2D enables visual even if a previous visit saved it as off');
    f.button.click();
    f.document.querySelector('#next').click();
    assert.equal(f.spectrum.mode, '2d');
    assert.equal(f.jobs.length, 1, 'Subsequent samples keep the manual off choice');
    assert.equal(f.button.attributes['aria-pressed'], 'false');
    assert.equal(f.button.hidden, false);

    const reopened = fixture(saved);
    reopened.select(1);
    assert.equal(reopened.spectrum.mode, '2d');
    assert.equal(reopened.jobs.length, 1, 'Opening the site again starts the first sample with visual on');
    assert.equal(reopened.button.attributes['aria-pressed'], 'true');
    reopened.effect.cancel();
  }
});

test('1D and 3D restore the original audio and FFT, then 2D reuses enabled artwork', async () => {
  const f = fixture();
  f.select(0);
  f.jobs[0].resolve({ blob: {}, recording: { artwork: true } });
  await new Promise(setImmediate);
  f.audio.duration = 8; f.audio.readyState = 1; f.audio.emit('loadedmetadata');
  f.audio.currentTime = 3; f.audio.pause();
  for (const mode of [0, 2]) {
    f.modes[mode].click();
    await new Promise(setImmediate);
    assert.equal(f.effect.enabled, false);
    assert.equal(f.audio.src, 'a.mp3');
    assert.equal(f.spectrum.recording, null, 'Other modes load the original measured FFT');
    assert.equal(f.button.hidden, true);
    assert.equal(f.audio.currentTime, 3);
    assert.equal(f.audio.paused, true);
    f.modes[1].click();
    await new Promise(setImmediate);
    assert.equal(f.effect.enabled, true);
    assert.equal(f.audio.src, 'blob:visual');
    assert.equal(f.spectrum.recording.artwork, true);
    assert.equal(f.jobs.length, 1, 'Returning to 2D reuses the processed recording');
    assert.equal(f.audio.currentTime, 3);
    assert.equal(f.audio.paused, true);
  }
  f.button.click();
  f.modes[2].click(); f.modes[1].click();
  assert.equal(f.effect.enabled, false, 'A manual off choice also survives mode changes');
  assert.equal(f.audio.src, 'a.mp3');
});

test('leaving 2D cancels generation and new tracks stay original in other modes', async () => {
  const f = fixture();
  f.select(0);
  f.modes[2].click();
  assert.equal(f.jobs[0].options.signal.aborted, true);
  assert.equal(f.effect.busy, false);
  f.jobs[0].resolve({ blob: {}, recording: { stale: true } });
  await new Promise(setImmediate);
  assert.equal(f.audio.src, 'a.mp3');
  assert.equal(f.effect.enabled, false);
  f.document.querySelector('#next').click();
  assert.equal(f.audio.src, 'b.mp3');
  assert.equal(f.jobs.length, 1, 'Selecting a track in 3D does not start image synthesis');
  f.modes[1].click();
  assert.equal(f.jobs.length, 2);
  f.jobs[1].resolve({ blob: {}, recording: { current: true } });
  await new Promise(setImmediate);
  assert.equal(f.effect.enabled, true);
  assert.equal(f.spectrum.recording.current, true);
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

test('the shuffle button works without a sort dropdown and preserves search order and playback', () => {
  const f = fixture();
  const list = f.document.querySelector('#sample-list');
  const ids = () => Array.from(list.children, row => row.dataset.id);
  f.select(0);
  f.audio.currentTime = 2;
  f.document.querySelector('#shuffle-cards').click();
  assert.deepEqual(ids(), ['b', 'a']);
  assert.equal(f.audio.src, 'a.mp3');
  assert.equal(f.audio.currentTime, 2);
  assert.equal(f.audio.paused, false);
  const search = f.document.querySelector('#search');
  search.value = '1'; search.emit('input');
  assert.deepEqual(ids(), ['a']);
  search.value = ''; search.emit('input');
  assert.deepEqual(ids(), ['b', 'a']);
  f.document.querySelector('#shuffle-cards').click();
  assert.deepEqual(ids(), ['a', 'b']);
  f.effect.cancel();
});
