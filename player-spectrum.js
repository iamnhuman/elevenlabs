/* Measured MP3 spectra follow the audio clock, without a second audio route or ESM. */
(function (root) {
  'use strict';
  const cache = new Map();
  const decode = entry => ({ ...entry, data: Uint8Array.from(root.atob(entry.values), char => char.charCodeAt(0)) });
  function loadRecording(sample, document) {
    if (cache.has(sample.id)) return cache.get(sample.id);
    const promise = new Promise((resolve, reject) => {
      const stored = root.SAMPLE_SPECTRA?.[sample.id];
      if (stored) { resolve(decode(stored)); return; }
      const script = document.createElement('script');
      script.src = `assets/spectrum/${encodeURIComponent(sample.id)}.js?v=2`;
      script.onload = () => {
        script.remove();
        const entry = root.SAMPLE_SPECTRA?.[sample.id];
        if (entry) resolve(decode(entry));
        else reject(new Error('Missing FFT data'));
      };
      script.onerror = () => { script.remove(); reject(new Error('Cannot load FFT data')); };
      document.head.append(script);
    }).catch(error => { cache.delete(sample.id); throw error; });
    cache.set(sample.id, promise);
    return promise;
  }

  class PlayerSpectrum {
    constructor(element, audio, {
      Visual = root.SpectrogramView,
      mode = '2d',
      document = root.document,
      motion = root.matchMedia?.('(prefers-reduced-motion: reduce)'),
      load = sample => loadRecording(sample, document),
      requestFrame = callback => root.requestAnimationFrame(callback),
      cancelFrame = id => root.cancelAnimationFrame(id),
    } = {}) {
      Object.assign(this, { element, audio, Visual, document, motion, load, requestFrame, cancelFrame });
      this.sample = null;
      this.recording = null;
      this.visual = null;
      this.visualPromise = null;
      this.frame = 0;
      this.epoch = 0;
      this.lastPaint = -Infinity;
      this.mode = ['1d', '2d', '3d'].includes(mode) ? mode : '2d';
      element.dataset.state = 'idle';
      this.syncState = () => this.sync();
      ['playing', 'pause', 'ended', 'volumechange', 'seeking', 'seeked', 'loadedmetadata', 'error'].forEach(event => audio.addEventListener(event, this.syncState));
      document?.addEventListener('visibilitychange', this.syncState);
      motion?.addEventListener?.('change', this.syncState);
    }

    async select(sample, { recording: replacement = null, force = false } = {}) {
      if (!sample) return;
      if (!force && this.sample?.id === sample.id && this.recording) { this.sync(); return; }
      const epoch = ++this.epoch;
      this.sample = sample;
      this.recording = null;
      this.cancelFrame(this.frame); this.frame = 0;
      this.visual?.clear();
      this.element.dataset.state = 'loading';
      try {
        this.visualPromise ||= Promise.resolve(this.Visual.create(this.element, this.mode)).catch(error => { this.visualPromise = null; throw error; });
        const [visual, recording] = await Promise.all([this.visualPromise, replacement || this.load(sample)]);
        if (epoch !== this.epoch) return;
        this.visual = visual;
        this.visual.setMode?.(this.mode);
        this.recording = recording;
        this.sync();
      } catch (error) {
        if (epoch !== this.epoch) return;
        this.element.dataset.state = 'unavailable';
        console.info('Spectrogram unavailable:', error.message);
      }
    }

    paint() {
      if (!this.visual || !this.recording) return;
      this.visual.show(this.recording, this.audio.currentTime || 0, this.audio.muted ? 0 : this.audio.volume);
    }

    setMode(mode) {
      this.mode = ['1d', '2d', '3d'].includes(mode) ? mode : '2d';
      this.visual?.setMode?.(this.mode);
      this.sync();
    }

    sync() {
      this.cancelFrame(this.frame); this.frame = 0;
      if (!this.visual || !this.recording) return;
      this.paint();
      const running = !this.audio.paused && !this.audio.ended && !this.audio.muted && this.audio.volume > 0 && !this.document?.hidden;
      this.element.dataset.state = running ? 'live' : 'paused';
      if (!running) return;
      const frameRate = this.motion?.matches || this.visual.software ? 12 : this.mode === '1d' ? 60 : 24;
      const draw = timestamp => {
        this.frame = 0;
        if (timestamp - this.lastPaint >= 1000 / frameRate) {
          this.lastPaint = timestamp;
          this.paint();
        }
        this.frame = this.requestFrame(draw);
      };
      this.lastPaint = -Infinity;
      this.frame = this.requestFrame(draw);
    }
  }
  PlayerSpectrum.loadRecording = loadRecording;
  if (typeof module !== 'undefined' && module.exports) module.exports = PlayerSpectrum;
  else root.PlayerSpectrum = PlayerSpectrum;
})(typeof window !== 'undefined' ? window : globalThis);
