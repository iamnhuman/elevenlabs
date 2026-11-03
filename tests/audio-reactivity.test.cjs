const { test } = require('node:test');
const assert = require('node:assert/strict');
const AudioReactivity = require('../audio-reactivity.js');

const sample = {
  envelope: [0, 128, 255, 64, 0], bassEnvelope: [0, 255, 64, 128, 0],
  envelopeRate: 2, rmsReference: .2,
};
const makeAudio = () => ({ paused: false, ended: false, muted: false, volume: 1, currentTime: 1 });

test('file:// reacts from real envelopes without creating a restricted media source', () => {
  let created = false;
  const signal = new AudioReactivity(makeAudio(), { protocol: 'file:', Context: class { constructor() { created = true; } } });
  signal.wake();
  assert.equal(created, false);
  assert.equal(signal.read(sample).level, 1);
  assert.equal(signal.read(sample).bass, 64 / 255);
});

test('recorded dynamics interpolate and follow seeking immediately', () => {
  const audio = makeAudio();
  const signal = new AudioReactivity(audio);
  audio.currentTime = .75;
  assert.equal(signal.read(sample).level, (128 + 255) / 510);
  audio.currentTime = 0;
  assert.equal(signal.read(sample).level, 0);
  audio.currentTime = 1;
  assert.equal(signal.read(sample).level, 1);
  audio.currentTime = 20;
  assert.equal(signal.read(sample).level, 0);
});

test('pause, mute, zero volume and ending all return silence', () => {
  for (const [key, value] of [['paused', true], ['muted', true], ['ended', true], ['volume', 0]]) {
    const audio = { ...makeAudio(), [key]: value };
    assert.deepEqual(new AudioReactivity(audio).read(sample), { bass: 0, level: 0, bands: [0, 0, 0, 0, 0] });
  }
});

test('switching the sample replaces its dynamics without retaining the old envelope', () => {
  const signal = new AudioReactivity(makeAudio());
  assert.equal(signal.read(sample).level, 1);
  assert.equal(signal.read({ ...sample, envelope: [0, 0, 0, 0] }).level, 0);
});

function mockContext() {
  const connections = [];
  let created = 0;
  class Context {
    constructor() {
      created++;
      this.state = 'interrupted'; this.sampleRate = 48000; this.destination = { name: 'destination' };
    }
    createAnalyser() {
      this.analyser = {
        name: 'analyser', fftSize: 2048, frequencyBinCount: 1024,
        connect: to => connections.push(['analyser', to.name]),
        getFloatTimeDomainData: data => data.fill(.1),
        getByteFrequencyData: data => data.fill(128),
      };
      return this.analyser;
    }
    createMediaElementSource() {
      return { connect: to => connections.push(['source', to.name]), disconnect() {} };
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }
  return { Context, connections, created: () => created };
}

test('one connected audio graph resumes interrupted contexts and samples real RMS', () => {
  const { Context, connections, created } = mockContext();
  const signal = new AudioReactivity(makeAudio(), { Context });
  signal.wake(); signal.wake();
  assert.equal(created(), 1);
  assert.deepEqual(connections, [['source', 'analyser'], ['analyser', 'destination']]);
  assert.equal(signal.context.state, 'running');
  const result = signal.read(sample);
  assert.ok(Math.abs(result.level - (.1 / .2) ** .8) < .00001);
  assert.equal(result.bands.length, 5);
  assert.ok(result.bands.every(value => value > 0 && value <= 1));
});

test('zero-filled or suspended Web Audio falls back to the current recorded signal', () => {
  const { Context } = mockContext();
  const signal = new AudioReactivity(makeAudio(), { Context });
  signal.wake();
  signal.analyser.getFloatTimeDomainData = data => data.fill(0);
  assert.equal(signal.read(sample).level, 1);
  signal.context.state = 'suspended';
  assert.equal(signal.read(sample).level, 1);
});

test('unavailable AudioContext cannot break playback or signal generation', () => {
  const signal = new AudioReactivity(makeAudio(), { Context: class { constructor() { throw new Error('unavailable'); } } });
  assert.doesNotThrow(() => signal.wake());
  assert.equal(signal.read(sample).level, 1);
});
