/* One media element, one current sample. Late play promises cannot change a newer selection. */
(function (root) {
  'use strict';
  class SamplePlayer {
    constructor(audio, { onChange = () => {}, onError = () => {}, onEnd = () => {} } = {}) {
      this.audio = audio;
      this.sample = null;
      this.sequence = 0;
      this.pendingSeek = null;
      this.loading = false;
      this.onChange = onChange;
      this.onError = onError;
      this.onEnd = onEnd;
      ['playing', 'pause', 'timeupdate', 'durationchange', 'volumechange'].forEach(event => {
        audio.addEventListener(event, () => {
          if (event === 'playing' || event === 'pause') this.loading = false;
          this.onChange();
        });
      });
      audio.addEventListener('waiting', () => { this.loading = !audio.paused; this.onChange(); });
      audio.addEventListener('loadedmetadata', () => { this.applySeek(); this.onChange(); });
      audio.addEventListener('ended', () => { this.loading = false; this.onChange(); this.onEnd(); });
      audio.addEventListener('error', () => {
        this.loading = false;
        this.onChange();
        this.onError('Не удалось загрузить звук. Попробуй включить его ещё раз.');
      });
    }

    async select(sample, { toggle = false, fraction = null } = {}) {
      if (!sample) return;
      if (this.sample?.id === sample.id && toggle && !this.audio.paused) {
        this.pause();
        return;
      }
      const request = ++this.sequence;
      if (this.sample?.id !== sample.id || this.audio.error) {
        this.source = this.sample?.id === sample.id ? (this.source || sample.src) : sample.src;
        this.audio.pause();
        this.sample = sample;
        this.pendingSeek = fraction;
        this.audio.src = this.source;
        this.audio.load();
      } else if (fraction !== null) {
        this.pendingSeek = fraction;
      } else if (this.audio.ended) {
        this.audio.currentTime = 0;
      }
      this.applySeek();
      await this.startPlayback(request);
    }

    // A processed version uses the same media element and the same transport.
    async replaceSource(src) {
      if (!this.sample || this.source === src) return;
      const playing = !this.audio.paused && !this.audio.ended;
      const fraction = this.pendingSeek ?? this.audio.currentTime / (this.audio.duration || this.sample.duration);
      const request = ++this.sequence;
      this.audio.pause();
      this.source = src;
      this.pendingSeek = Number.isFinite(fraction) ? fraction : 0;
      this.audio.src = src;
      this.audio.load();
      this.applySeek();
      this.onChange();
      if (playing) await this.startPlayback(request);
    }

    async startPlayback(request) {
      this.loading = true;
      this.onChange();
      try {
        await this.audio.play();
        if (request !== this.sequence) return;
        this.loading = false;
        this.onChange();
      } catch (error) {
        if (request !== this.sequence) return;
        this.loading = false;
        this.onChange();
        if (error.name !== 'AbortError') {
          this.onError(error.name === 'NotAllowedError'
            ? 'Нажми воспроизведение ещё раз, чтобы разрешить звук.'
            : 'Не удалось включить семпл. Попробуй другой или повтори загрузку.');
        }
      }
    }

    pause() {
      this.sequence += 1;
      this.loading = false;
      this.audio.pause();
      this.onChange();
    }

    seek(fraction) {
      if (!this.sample || !Number.isFinite(fraction)) return;
      this.pendingSeek = Math.max(0, Math.min(1, fraction));
      this.applySeek();
      this.onChange();
    }

    applySeek() {
      if (this.pendingSeek === null || this.audio.readyState < 1 || !Number.isFinite(this.audio.duration)) return;
      this.audio.currentTime = Math.max(0, Math.min(.999999, this.pendingSeek)) * this.audio.duration;
      this.pendingSeek = null;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SamplePlayer;
  else root.SamplePlayer = SamplePlayer;
})(typeof window !== 'undefined' ? window : globalThis);
