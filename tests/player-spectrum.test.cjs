const { test } = require('node:test');
const assert = require('node:assert/strict');
const PlayerSpectrum = require('../player-spectrum.js');

function fixture({ reduced = false, load, mode = '2d' } = {}) {
  const audio = Object.assign(new EventTarget(), { paused: true, ended: false, muted: false, volume: .8, currentTime: 2 });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const element = { dataset: {} }, frames = new Map();
  const visual = { paints: [], clears: 0, setMode(mode) { this.mode = mode; }, show(...args) { this.paints.push(args); }, clear() { this.clears++; } };
  let id = 0, creates = 0;
  const recording = { bins: 64, rate: 24, frames: 100, data: new Uint8Array(6400).fill(200) };
  const spectrum = new PlayerSpectrum(element, audio, {
    Visual: { create() { creates++; return visual; } }, document, motion, mode,
    load: load || (async () => recording),
    requestFrame: callback => { frames.set(++id, callback); return id; },
    cancelFrame: frame => frames.delete(frame),
  });
  const fire = (target, type) => target.dispatchEvent(new Event(type));
  const play = async () => { await spectrum.select({ id: '001' }); audio.paused = false; fire(audio, 'playing'); };
  const step = timestamp => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(timestamp)); };
  return { audio, document, motion, element, spectrum, visual, recording, frames, fire, play, step, creates: () => creates };
}

test('spectrum follows the audio clock without an AudioContext, ESM or an extra speaker route', async () => {
  const f = fixture(); await f.play(); f.step(100);
  assert.equal(f.spectrum.mode, '2d', 'The default is the flat spectrogram');
  assert.equal(f.element.dataset.state, 'live');
  assert.equal(f.visual.paints.at(-1)[0], f.recording);
  assert.equal(f.visual.paints.at(-1)[1], 2);
  f.audio.currentTime = 4; f.step(200);
  assert.equal(f.visual.paints.at(-1)[1], 4);
  assert.equal(f.creates(), 1);
  assert.equal(f.frames.size, 1);
});

test('pause and ending preserve the visible relief and stop the frame loop', async () => {
  for (const [property, event] of [['paused', 'pause'], ['ended', 'ended']]) {
    const f = fixture(); await f.play();
    f.audio[property] = true; f.fire(f.audio, event);
    assert.equal(f.frames.size, 0);
    assert.equal(f.element.dataset.state, 'paused');
    assert.equal(f.visual.paints.at(-1)[1], 2);
    assert.equal(f.visual.clears, 0);
  }
});

test('seeking while paused draws the measured history at the new position immediately', async () => {
  const f = fixture(); await f.play();
  f.audio.paused = true; f.fire(f.audio, 'pause');
  f.audio.currentTime = 9; f.fire(f.audio, 'seeked');
  assert.equal(f.visual.paints.at(-1)[1], 9);
  assert.equal(f.element.dataset.state, 'paused');
  assert.equal(f.frames.size, 0);
});

test('muting, zero volume and hidden tabs stop the animation; unmuting resumes it', async () => {
  const f = fixture(); await f.play();
  f.audio.muted = true; f.fire(f.audio, 'volumechange');
  assert.equal(f.frames.size, 0);
  assert.equal(f.visual.paints.at(-1)[2], 0);
  f.audio.muted = false; f.fire(f.audio, 'volumechange');
  assert.equal(f.frames.size, 1);
  f.audio.volume = 0; f.fire(f.audio, 'volumechange');
  assert.equal(f.frames.size, 0);
  f.audio.volume = .8; f.fire(f.audio, 'volumechange');
  f.document.hidden = true; f.fire(f.document, 'visibilitychange');
  assert.equal(f.frames.size, 0);
  f.document.hidden = false; f.fire(f.document, 'visibilitychange');
  assert.equal(f.frames.size, 1);
});

test('rapid selections discard the obsolete spectrum and keep one renderer', async () => {
  const pending = new Map();
  const f = fixture({ load: sample => new Promise(resolve => pending.set(sample.id, resolve)) });
  const first = f.spectrum.select({ id: 'a' });
  const second = f.spectrum.select({ id: 'b' });
  pending.get('b')({ name: 'new' }); await second;
  pending.get('a')({ name: 'old' }); await first;
  assert.equal(f.spectrum.recording.name, 'new');
  assert.equal(f.creates(), 1);
});

test('pausing during data loading cannot start an idle frame loop', async () => {
  const f = fixture();
  f.audio.paused = false;
  const pending = f.spectrum.select({ id: 'a' });
  f.audio.paused = true; f.fire(f.audio, 'pause');
  await pending;
  assert.equal(f.frames.size, 0);
  assert.equal(f.element.dataset.state, 'paused');
  assert.ok(f.visual.paints.length > 0);
});

test('missing FFT data leaves audio untouched and allows a later retry', async () => {
  let fails = true;
  const f = fixture({ load: async () => { if (fails) throw new Error('404'); return { data: [] }; } });
  await f.play();
  assert.equal(f.element.dataset.state, 'unavailable');
  assert.equal(f.audio.paused, false);
  fails = false; await f.spectrum.select({ id: '001' });
  assert.equal(f.element.dataset.state, 'live');
});

test('reduced motion limits updates and preference changes restart only one frame loop', async () => {
  const f = fixture({ reduced: true }); await f.play();
  f.step(100); const before = f.visual.paints.length;
  f.step(150); assert.equal(f.visual.paints.length, before);
  f.step(200); assert.equal(f.visual.paints.length, before + 1);
  f.motion.matches = false; f.fire(f.motion, 'change');
  assert.equal(f.frames.size, 1);
});

test('changing spectrum mode preserves playback time and keeps exactly one animation loop', async () => {
  const f = fixture(); await f.play();
  for (const mode of ['1d', '2d', '3d', '1d', '2d']) {
    f.spectrum.setMode(mode);
    assert.equal(f.visual.mode, mode);
    assert.equal(f.visual.paints.at(-1)[1], 2);
    assert.equal(f.audio.currentTime, 2);
    assert.equal(f.audio.paused, false);
    assert.equal(f.frames.size, 1);
  }
  assert.equal(f.creates(), 1);
  f.audio.paused = true; f.fire(f.audio, 'pause');
  f.spectrum.setMode('1d');
  assert.equal(f.frames.size, 0, 'Switching while paused cannot start idle animation');
});

test('a mode changed during data loading is applied when the spectrum becomes ready', async () => {
  const f = fixture();
  const pending = f.spectrum.select({ id: 'a' });
  f.spectrum.setMode('1d');
  await pending;
  assert.equal(f.visual.mode, '1d');
});

test('saved 1D mode follows playback, paused seeks and mute without an independent animation loop', async () => {
  const f = fixture({ mode: '1d' }); await f.play();
  assert.equal(f.visual.mode, '1d');
  f.step(100); const before = f.visual.paints.length;
  f.audio.currentTime = 3; f.step(120);
  assert.equal(f.visual.paints.length, before + 1, 'SVG can update faster than the 24 fps terrain');
  assert.equal(f.visual.paints.at(-1)[1], 3);
  f.audio.paused = true; f.fire(f.audio, 'pause');
  assert.equal(f.frames.size, 0);
  f.audio.currentTime = 8; f.fire(f.audio, 'seeked');
  assert.equal(f.visual.paints.at(-1)[1], 8);
  assert.equal(f.frames.size, 0);
  f.audio.muted = true; f.fire(f.audio, 'volumechange');
  assert.equal(f.visual.paints.at(-1)[2], 0);
  f.audio.muted = false; f.audio.paused = false; f.fire(f.audio, 'playing');
  assert.equal(f.frames.size, 1);
});

test('1D respects reduced motion', async () => {
  const f = fixture({ mode: '1d', reduced: true }); await f.play();
  f.step(100); const before = f.visual.paints.length;
  f.step(120); assert.equal(f.visual.paints.length, before);
  f.step(190); assert.equal(f.visual.paints.length, before + 1);
});

test('a processed recording replaces pending original FFT and can be restored without changing the clock', async () => {
  let resolveOriginal;
  const f = fixture({ load: () => new Promise(resolve => { resolveOriginal = resolve; }) });
  const original = f.spectrum.select({ id: 'a' });
  const replacement = { data: [], processed: true };
  await f.spectrum.select({ id: 'a' }, { recording: replacement, force: true });
  resolveOriginal(f.recording); await original;
  assert.equal(f.spectrum.recording, replacement);
  assert.equal(f.audio.currentTime, 2);
  const restore = f.spectrum.select({ id: 'a' }, { force: true });
  resolveOriginal(f.recording); await restore;
  assert.equal(f.spectrum.recording, f.recording);
});
