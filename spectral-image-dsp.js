/* Image sonification by windowed inverse FFT. No rendering or browser dependencies. */
(function (root) {
  'use strict';
  const SAMPLE_RATE = 32000, SIZE = 8192;
  const MIN_FREQ = 180, MAX_FREQ = 12000, MIN_DB = -96, MAX_DB = -12;
  const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));

  function repeatCount(width = 1000, height = 160) {
    // Only this portion of the logarithmic frequency axis contains the image.
    const bandHeight = height * Math.log(MAX_FREQ / MIN_FREQ) / Math.log(16000 / 32);
    return Math.max(2, Math.round(width / bandHeight));
  }

  function tileFFTSize(seconds) {
    // Short tiles need a shorter time window to keep their horizontal details.
    return 2 ** clamp(Math.floor(Math.log2(seconds * SAMPLE_RATE / 16)), 11, 13);
  }

  function tileLayout(seconds, width = 1000, height = 160) {
    const gap = .22;
    // Give each drawing enough audio time to retain horizontal detail.
    const limit = seconds <= 2.1 ? 1 : seconds <= 4.1 ? 2 : Math.max(2, Math.floor(seconds / 1.25));
    const repeats = Math.min(repeatCount(width * (1 - gap), height), limit);
    const imageSeconds = seconds / repeats * (1 - gap);
    return { repeats, gap, fftSize: tileFFTSize(imageSeconds) };
  }

  class FFT {
    constructor(size) {
      this.size = size;
      this.reverse = new Uint32Array(size);
      for (let i = 0; i < size; i++) {
        let n = i, r = 0;
        for (let bit = 0; bit < Math.log2(size); bit++) { r = (r << 1) | (n & 1); n >>= 1; }
        this.reverse[i] = r;
      }
    }
    transform(re, im, inverse = false) {
      const size = this.size;
      for (let i = 0; i < size; i++) {
        const j = this.reverse[i];
        if (j > i) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let length = 2; length <= size; length *= 2) {
        const angle = (inverse ? 2 : -2) * Math.PI / length;
        const cos = Math.cos(angle), sin = Math.sin(angle), half = length / 2;
        for (let i = 0; i < size; i += length) {
          let wr = 1, wi = 0;
          for (let j = 0; j < half; j++) {
            const a = i + j, b = a + half;
            const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
            const next = wr * cos - wi * sin; wi = wr * sin + wi * cos; wr = next;
          }
        }
      }
      if (inverse) for (let i = 0; i < size; i++) { re[i] /= size; im[i] /= size; }
    }
  }

  function grayscale(rgba, width, height) {
    const pixels = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i++) {
      const at = i * 4;
      pixels[i] = (.2126 * rgba[at] + .7152 * rgba[at + 1] + .0722 * rgba[at + 2]) / 255 * rgba[at + 3] / 255;
    }
    // Local contrast makes both dark and bright photographs readable as sound.
    const sorted = pixels.slice().sort();
    const low = sorted[Math.floor(sorted.length * .03)], high = sorted[Math.floor(sorted.length * .97)];
    if (high - low > .02) for (let i = 0; i < pixels.length; i++) pixels[i] = clamp((pixels[i] - low) / (high - low));
    return { pixels, width, height };
  }

  function brightness(image, x, y) {
    x = clamp(x) * (image.width - 1); y = clamp(y) * (image.height - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, image.width - 1), y1 = Math.min(y0 + 1, image.height - 1);
    const dx = x - x0, dy = y - y0, p = image.pixels, w = image.width;
    return (p[y0 * w + x0] * (1 - dx) + p[y0 * w + x1] * dx) * (1 - dy)
      + (p[y1 * w + x0] * (1 - dx) + p[y1 * w + x1] * dx) * dy;
  }

  function synthesize(channels, image, sampleRate = SAMPLE_RATE, progress = () => {}, { repeats = 1, gap = 0, fftSize: size = SIZE } = {}) {
    const length = channels[0]?.length;
    if (!length || channels.some(channel => channel.length !== length) || !image?.pixels?.length) throw new Error('Invalid audio or artwork');
    const hop = size / 8;
    const fft = new FFT(size), window = Float64Array.from({ length: size }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / size));
    const output = channels.map(() => new Float32Array(length)), weights = new Float32Array(length);
    const re = new Float64Array(size), im = new Float64Array(size);
    const imageRe = new Float64Array(size / 2), imageIm = new Float64Array(size / 2), dry = new Float64Array(size / 2).fill(1);
    const rows = Float64Array.from({ length: size / 2 }, (_, bin) => 1 - Math.log(bin * sampleRate / size / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ));
    const step = length / repeats, inset = step * clamp(gap, 0, .8) / 2;
    for (let center = 0; center < length + size / 2; center += hop) {
      const offset = center % step;
      const x = clamp((offset - inset) / (step - 2 * inset));
      const tileFade = gap > 0 ? clamp((offset - inset) / (sampleRate * .015)) * clamp((step - inset - offset) / (sampleRate * .015)) : 1;
      const fade = clamp(center / (sampleRate * .03)) * clamp((length - center) / (sampleRate * .03));
      imageRe.fill(0); imageIm.fill(0); dry.fill(1);
      for (let bin = 1; bin < size / 2; bin++) {
        const y = rows[bin];
        if (y < 0 || y > 1) continue;
        const edge = clamp(y / .025) * clamp((1 - y) / .025) * fade;
        const light = brightness(image, x, y);
        const magnitude = size / 4 * 10 ** ((-88 + light * 50) / 20) * edge * tileFade;
        // Deterministic phases advance with the sample clock: no clicks at column boundaries.
        const phase = bin * bin * 2.399963229728653 + 2 * Math.PI * bin * (center - size / 2) / size;
        imageRe[bin] = magnitude * Math.cos(phase); imageIm[bin] = magnitude * Math.sin(phase);
        dry[bin] = 1 - .92 * edge;
      }
      const start = center - size / 2;
      for (let i = 0; i < size; i++) if (start + i >= 0 && start + i < length) weights[start + i] += window[i] ** 2;
      channels.forEach((channel, channelIndex) => {
        for (let i = 0; i < size; i++) { re[i] = (channel[start + i] || 0) * window[i]; im[i] = 0; }
        fft.transform(re, im);
        for (let bin = 1; bin < size / 2; bin++) {
          re[bin] = re[bin] * dry[bin] + imageRe[bin]; im[bin] = im[bin] * dry[bin] + imageIm[bin];
          re[size - bin] = re[bin]; im[size - bin] = -im[bin];
        }
        fft.transform(re, im, true);
        for (let i = 0; i < size; i++) if (start + i >= 0 && start + i < length) output[channelIndex][start + i] += re[i] * window[i];
      });
      if (center % (hop * 16) === 0) progress(.65 * Math.min(1, center / length));
    }
    let peak = 0;
    output.forEach(channel => {
      for (let i = 0; i < length; i++) { channel[i] /= Math.max(1e-8, weights[i]); peak = Math.max(peak, Math.abs(channel[i])); }
    });
    const gain = peak > .96 ? .96 / peak : 1;
    // Quantize before analysis, so the displayed FFT measures the actual WAV samples.
    output.forEach(channel => { for (let i = 0; i < length; i++) channel[i] = Math.round(clamp(channel[i] * gain, -1, 1) * 32767) / 32768; });
    return output;
  }

  function measure(channels, sampleRate = SAMPLE_RATE, progress = () => {}, { fftSize: size = SIZE } = {}) {
    const bins = 256, rate = 48, frames = Math.ceil(channels[0].length / sampleRate * rate);
    const data = new Uint8Array(frames * bins), fft = new FFT(size);
    const re = new Float64Array(size), im = new Float64Array(size), power = new Float64Array(size / 2 + 1);
    const window = Float64Array.from({ length: size }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / size));
    const halfBand = 500 ** (1 / (2 * (bins - 1)));
    const ranges = Array.from({ length: bins }, (_, i) => {
      const frequency = 32 * 500 ** (i / (bins - 1));
      return [Math.max(1, Math.floor(frequency / halfBand * size / sampleRate)), Math.min(size / 2, Math.ceil(frequency * halfBand * size / sampleRate))];
    });
    for (let frame = 0; frame < frames; frame++) {
      const start = Math.floor(frame / rate * sampleRate) - size / 2;
      power.fill(0);
      // RMS power across channels preserves stereo material that cancels in a mono sum.
      channels.forEach(channel => {
        for (let i = 0; i < size; i++) { re[i] = (channel[start + i] || 0) * window[i]; im[i] = 0; }
        fft.transform(re, im);
        for (let i = 0; i < power.length; i++) power[i] += (re[i] ** 2 + im[i] ** 2) / channels.length;
      });
      ranges.forEach(([first, last], bin) => {
        let peak = 0;
        for (let i = first; i <= last; i++) peak = Math.max(peak, power[i]);
        const db = 10 * Math.log10(Math.max(1e-20, peak * 16 / (size * size)));
        data[frame * bins + bin] = Math.round(clamp((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255);
      });
      if (frame % 32 === 0) progress(.65 + .35 * frame / frames);
    }
    return { bins, rate, frames, minDb: MIN_DB, maxDb: MAX_DB, data };
  }

  function wav(channels, sampleRate = SAMPLE_RATE) {
    const length = channels[0].length, count = channels.length, buffer = new ArrayBuffer(44 + length * count * 2), view = new DataView(buffer);
    const ascii = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
    view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, length * count * 2, true);
    for (let i = 0; i < length; i++) for (let ch = 0; ch < count; ch++) view.setInt16(44 + (i * count + ch) * 2, Math.round(clamp(channels[ch][i], -1, 32767 / 32768) * 32768), true);
    return buffer;
  }
  const api = { SAMPLE_RATE, MIN_FREQ, MAX_FREQ, FFT, repeatCount, tileFFTSize, tileLayout, grayscale, brightness, synthesize, measure, wav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpectralImageDSP = api;
})(typeof self !== 'undefined' ? self : globalThis);
