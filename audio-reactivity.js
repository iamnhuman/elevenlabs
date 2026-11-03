/* Real-time analysis with a sample-accurate, precomputed envelope fallback. */
(function (root) {
  'use strict';
  const silence = () => ({ bass: 0, level: 0, bands: [0, 0, 0, 0, 0] });
  const clamp = value => Math.min(1, Math.max(0, value));

  function envelopeAt(values, rate, seconds) {
    if (!values?.length || !Number.isFinite(seconds)) return 0;
    const position = Math.max(0, seconds * rate);
    if (position >= values.length) return 0;
    const index = Math.floor(position);
    const fraction = position - index;
    return (values[index] * (1 - fraction) + (values[index + 1] ?? values[index]) * fraction) / 255;
  }

  class AudioReactivity {
    constructor(audio, { Context, protocol = 'http:' } = {}) {
      this.audio = audio;
      this.Context = Context;
      this.protocol = protocol;
      this.context = null;
      this.analyser = null;
      this.source = null;
    }

    wake() {
      if (!this.Context || this.protocol === 'file:') return;
      if (!this.context) {
        try {
          this.context = new this.Context();
          this.analyser = this.context.createAnalyser();
          this.analyser.fftSize = 2048;
          this.analyser.smoothingTimeConstant = .35;
          this.analyser.minDecibels = -85;
          this.analyser.maxDecibels = -15;
          this.wave = new Float32Array(this.analyser.fftSize);
          this.frequencies = new Uint8Array(this.analyser.frequencyBinCount);
          this.source = this.context.createMediaElementSource(this.audio);
          // A single, fully connected graph: the analysed signal is the heard signal.
          this.source.connect(this.analyser);
          this.analyser.connect(this.context.destination);
        } catch (error) {
          // If graph construction partially succeeds, keep the audio audible.
          if (this.source) {
            this.source.disconnect();
            this.source.connect(this.context.destination);
          }
          this.analyser = null;
          console.info('Using recorded audio dynamics:', error.message);
        }
      }
      // Safari can report "interrupted" after backgrounding, not just "suspended".
      if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') {
        this.context.resume().catch(() => {});
      }
    }

    read(sample) {
      const audio = this.audio;
      if (!sample || audio.paused || audio.ended || audio.muted || audio.volume === 0) return silence();
      const volume = Math.sqrt(audio.volume);
      const level = envelopeAt(sample.envelope, sample.envelopeRate, audio.currentTime) * volume;
      const bass = envelopeAt(sample.bassEnvelope, sample.envelopeRate, audio.currentTime) * volume;
      const recorded = { bass, level, bands: [bass, (bass + level) / 2, level, level * .8, level * .6] };
      if (!this.analyser || this.context.state !== 'running') return recorded;
      this.analyser.getFloatTimeDomainData(this.wave);
      let sum = 0;
      for (const value of this.wave) sum += value * value;
      const rms = Math.sqrt(sum / this.wave.length);
      // Some contexts start late or return zero despite audible HTML audio.
      if (rms < .00001) return recorded;
      this.analyser.getByteFrequencyData(this.frequencies);
      const boundaries = [30, 180, 550, 1600, 4500, 12000];
      const hertzPerBin = this.context.sampleRate / this.analyser.fftSize;
      const bands = boundaries.slice(0, -1).map((low, index) => {
        const start = Math.max(1, Math.floor(low / hertzPerBin));
        const end = Math.min(this.frequencies.length, Math.ceil(boundaries[index + 1] / hertzPerBin));
        let total = 0;
        for (let bin = start; bin < end; bin++) total += this.frequencies[bin];
        return clamp(total / (Math.max(1, end - start) * 255));
      });
      return {
        level: clamp((rms / Math.max(.005, sample.rmsReference || .12)) ** .8),
        bass: clamp(Math.max(bands[0], bass * .65)),
        bands,
      };
    }
  }
  AudioReactivity.envelopeAt = envelopeAt;
  if (typeof module !== 'undefined' && module.exports) module.exports = AudioReactivity;
  else root.AudioReactivity = AudioReactivity;
})(typeof window !== 'undefined' ? window : globalThis);
