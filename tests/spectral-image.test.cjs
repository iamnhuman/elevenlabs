const { test } = require('node:test');
const assert = require('node:assert/strict');
const DSP = require('../spectral-image-dsp.js');
const SpectralImage = require('../spectral-image.js');

test('image creates audible PCM whose measured spectrum contains the correct light/dark pattern', () => {
  const rate = DSP.SAMPLE_RATE, duration = 3;
  // Bright top left and bottom right: checks both time and frequency orientation.
  const image = { width: 2, height: 2, pixels: Float32Array.from([1, 0, 0, 1]) };
  const channels = DSP.synthesize([new Float32Array(rate * duration)], image);
  const pcm = channels[0];
  assert.ok(pcm.some(value => Math.abs(value) > .01), 'The picture must be audible, not a painted overlay');
  assert.ok(pcm.every(value => Number.isFinite(value) && Math.abs(value) <= .96));
  const spectrum = DSP.measure(channels);
  const level = (fraction, frequency) => spectrum.data[Math.round(duration * fraction * spectrum.rate) * spectrum.bins + Math.round(Math.log(frequency / 32) / Math.log(500) * (spectrum.bins - 1))];
  assert.ok(level(.2, 6000) > level(.8, 6000) + 35, 'Top left appears at high frequencies early in the clip');
  assert.ok(level(.8, 350) > level(.2, 350) + 35, 'Bottom right appears at low frequencies later in the clip');
  const buffer = DSP.wav(channels), view = new DataView(buffer);
  assert.equal(Buffer.from(buffer).subarray(0, 4).toString(), 'RIFF');
  assert.equal(view.getUint32(24, true), rate);
  assert.equal(view.getUint32(40, true), pcm.length * 2);
  assert.equal(view.getInt16(44 + 10000 * 2, true) / 32768, pcm[10000], 'FFT measures the exact exported PCM');
});

test('embedding preserves stereo bass, duration and bounded sample peaks', () => {
  const input = Float32Array.from({ length: DSP.SAMPLE_RATE }, (_, i) => .8 * Math.sin(2 * Math.PI * 80 * i / DSP.SAMPLE_RATE));
  const image = { width: 2, height: 2, pixels: new Float32Array(4).fill(.8) };
  const channels = DSP.synthesize([input, Float32Array.from(input, x => -x)], image);
  assert.equal(channels.length, 2);
  assert.equal(channels[0].length, input.length);
  let error = 0, energy = 0;
  for (let i = 5000; i < input.length - 5000; i++) {
    const side = (channels[0][i] - channels[1][i]) / 2;
    error += (side - input[i]) ** 2; energy += input[i] ** 2;
  }
  assert.ok(error / energy < .02, 'The original stereo bass survives the spectral image');
  assert.ok(channels.every(channel => channel.every(value => Number.isFinite(value) && Math.abs(value) <= .961)));
  const wav = new DataView(DSP.wav(channels));
  assert.equal(wav.getUint16(22, true), 2);
  assert.equal(wav.getUint32(40, true), input.length * 4);
});

test('artwork selection follows artworkNumber instead of repeated section numbers', () => {
  const art = { sheets: [{ file: 'one.webp' }, { file: 'two.webp' }], cards: [{ sheet: 0 }, { sheet: 1 }] };
  assert.equal(SpectralImage.artworkFor({ number: 1, artworkNumber: 2 }, art).sheet.file, 'two.webp');
  assert.equal(SpectralImage.artworkFor({ number: 1, artworkNumber: 201 }, art), null);
});

test('repeated artwork stays nearly square within the visible frequency band', () => {
  for (const [width, height] of [[1200, 160], [2400, 300], [320, 220]]) {
    const repeats = DSP.repeatCount(width, height);
    const tileHeight = height * Math.log(DSP.MAX_FREQ / DSP.MIN_FREQ) / Math.log(500);
    const aspect = width / repeats / tileHeight;
    assert.ok(repeats >= 2);
    assert.ok(aspect > .85 && aspect < 1.15, `Unexpected tile aspect ${aspect}`);
  }
});

test('short tiles repeat in the actual PCM with the same time and frequency orientation', () => {
  const duration = 8, repeats = DSP.repeatCount(1200, 160), period = duration / repeats;
  const options = { repeats, fftSize: DSP.tileFFTSize(period) };
  assert.equal(options.fftSize, 2048, 'Short tiles retain temporal detail');
  const image = { width: 2, height: 2, pixels: Float32Array.from([1, 0, 0, 1]) };
  const output = DSP.synthesize([new Float32Array(DSP.SAMPLE_RATE * duration)], image, undefined, undefined, options);
  const spectrum = DSP.measure(output, undefined, undefined, options);
  const level = (seconds, frequency) => spectrum.data[Math.round(seconds * spectrum.rate) * spectrum.bins + Math.round(Math.log(frequency / 32) / Math.log(500) * (spectrum.bins - 1))];
  for (let tile = 0; tile < repeats; tile++) {
    const early = (tile + .2) * period, late = (tile + .8) * period;
    assert.ok(level(early, 6000) > level(late, 6000) + 30, `High frequencies in tile ${tile}`);
    assert.ok(level(late, 350) > level(early, 350) + 30, `Low frequencies in tile ${tile}`);
  }
  assert.equal(output[0].length, duration * DSP.SAMPLE_RATE, 'Only the image repeats; the clip duration stays unchanged');
  assert.ok(output[0].every(value => Number.isFinite(value) && Math.abs(value) <= .961));
});

function fixture(generate = async () => ({ blob: {}, recording: { processed: true } })) {
  const sources = [], spectra = [], errors = [], revoked = [];
  const effect = new SpectralImage({ replaceSource: async src => sources.push(src) }, { select: async (...args) => spectra.push(args) }, {
    generate, artwork: { cards: [{ sheet: 0 }], sheets: [{}] },
    createURL: () => 'blob:processed', revokeURL: url => revoked.push(url), onError: message => errors.push(message),
  });
  const sample = { id: 'a', src: 'a.mp3', artworkNumber: 1 };
  effect.select(sample);
  return { effect, sample, sources, spectra, errors, revoked };
}

test('toggle uses processed audio and measured FFT together, restores original, and reuses the result', async () => {
  let generated = 0;
  const f = fixture(async () => { generated++; return { blob: {}, recording: { processed: true } }; });
  await f.effect.toggle();
  assert.equal(f.effect.enabled, true);
  assert.equal(f.sources.at(-1), 'blob:processed');
  assert.equal(f.spectra.at(-1)[1].recording.processed, true);
  await f.effect.toggle();
  assert.equal(f.effect.enabled, false);
  assert.equal(f.sources.at(-1), 'a.mp3');
  assert.equal(f.spectra.at(-1)[1].recording, null);
  await f.effect.toggle();
  assert.equal(generated, 1);
  f.effect.select({ ...f.sample, id: 'b' });
  assert.equal(f.effect.enabled, false);
  assert.deepEqual(f.revoked, ['blob:processed']);
});

test('changing tracks during synthesis aborts the job and cannot apply a stale image or audio', async () => {
  let finish, signal;
  const f = fixture((sample, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  const pending = f.effect.toggle();
  f.effect.select({ ...f.sample, id: 'b' });
  assert.equal(signal.aborted, true);
  finish({ blob: {}, recording: {} }); await pending;
  assert.equal(f.effect.enabled, false);
  assert.deepEqual(f.sources, []);
  assert.deepEqual(f.spectra, []);
  assert.equal(f.effect.result, null);
});

test('cancel keeps original playing and failures allow retry without leaking busy state', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.effect.toggle();
  await f.effect.toggle();
  finish({ blob: {}, recording: {} }); await pending;
  assert.equal(f.effect.busy, false);
  assert.deepEqual(f.sources, []);
  f.effect.generate = async () => { throw new Error('Cannot decode'); };
  await f.effect.toggle();
  assert.equal(f.effect.busy, false);
  assert.equal(f.effect.enabled, false);
  assert.deepEqual(f.errors, ['Cannot decode']);
  f.effect.generate = async () => ({ blob: {}, recording: {} });
  await f.effect.toggle();
  assert.equal(f.effect.enabled, true);
});
