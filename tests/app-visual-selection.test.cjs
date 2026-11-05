const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SamplePlayer = require('../audio-player.js');
const SpectralImage = require('../spectral-image.js');

// Run the app's real event wiring without a browser, decoding audio or drawing canvases.
function fixture() {
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
    window, document, navigator: {}, localStorage: { getItem: key => key.endsWith('spectrum-view') ? '"3d"' : null, setItem() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
  });
  const select = index => {
    const list = document.querySelector('#sample-list'), row = list.children[index];
    list.emit('click', { target: { closest: selector => selector === '.sample-row' ? row : { dataset: { action: 'play' } } } });
  };
  return { select, document, modes, jobs, audio, effect, spectrum, button: document.querySelector('#enable-visual') };
}

test('selecting a new sample forces 2D and immediately selects visual generation', async () => {
  const f = fixture();
  assert.equal(f.spectrum.mode, '3d');
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

  f.button.click(); // A manual disable survives pausing/resuming this sample.
  f.modes[2].click();
  f.select(0);
  assert.equal(f.effect.enabled, false);
  assert.equal(f.spectrum.mode, '3d');
  assert.equal(f.jobs.length, 1);
  f.select(1);
  assert.equal(f.spectrum.mode, '2d');
  assert.equal(f.button.attributes['aria-pressed'], 'true');
  assert.equal(f.jobs.length, 2);
  f.effect.cancel();
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
