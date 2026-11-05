/* On-demand sprite → PCM → WAV. Playback remains owned by SamplePlayer. */
(function (root) {
  'use strict';
  const aborted = () => new DOMException('Cancelled', 'AbortError');
  function artworkFor(sample, artwork) {
    const crop = artwork?.cards[sample?.artworkNumber - 1];
    const sheet = crop && artwork.sheets[crop.sheet];
    return sheet ? { crop, sheet } : null;
  }

  function readArtwork(sample, signal) {
    return new Promise((resolve, reject) => {
      const art = artworkFor(sample, root.SAMPLE_ART);
      if (!art) { reject(new Error('У этого звука нет изображения в спрайте.')); return; }
      const image = new root.Image();
      const cleanup = () => { signal.removeEventListener('abort', cancel); image.onload = image.onerror = null; };
      const cancel = () => { cleanup(); image.src = ''; reject(aborted()); };
      image.onload = () => {
        try {
          const canvas = root.document.createElement('canvas');
          canvas.width = canvas.height = 192;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const { x, y, size } = art.crop;
          ctx.drawImage(image, x, y, size, size, 0, 0, 192, 192);
          const rgba = ctx.getImageData(0, 0, 192, 192).data;
          cleanup(); resolve({ rgba, width: 192, height: 192 });
        } catch (error) { cleanup(); reject(error); }
      };
      image.onerror = () => { cleanup(); reject(new Error('Не удалось загрузить изображение звука.')); };
      signal.addEventListener('abort', cancel, { once: true });
      image.src = art.sheet.file;
      if (signal.aborted) cancel();
    });
  }

  async function build(sample, { signal, progress, viewport }) {
    if (root.location?.protocol === 'file:') throw new Error('Для Enable visual открой сайт через локальный HTTP-сервер.');
    const OfflineContext = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OfflineContext || !root.Worker) throw new Error('Этот браузер не поддерживает обработку звука.');
    const context = new OfflineContext(2, 1, 32000);
    const [audio, image] = await Promise.all([
      root.fetch(sample.src, { signal }).then(response => {
        if (!response.ok) throw new Error('Не удалось загрузить звук для обработки.');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)),
      readArtwork(sample, signal),
    ]);
    if (signal.aborted) throw aborted();
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i).slice());
    return new Promise((resolve, reject) => {
      const worker = new root.Worker('spectral-image-worker.js');
      const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', cancel); };
      const cancel = () => { cleanup(); reject(aborted()); };
      signal.addEventListener('abort', cancel, { once: true });
      worker.onerror = () => { cleanup(); reject(new Error('Не удалось обработать звук. Попробуй ещё раз.')); };
      worker.onmessage = ({ data }) => {
        if (data.progress !== undefined) { progress(data.progress); return; }
        cleanup();
        if (data.error) reject(new Error(data.error));
        else resolve({ recording: data.recording, blob: new Blob([data.wav], { type: 'audio/wav' }) });
      };
      worker.postMessage({ channels, image, viewport }, [...channels.map(channel => channel.buffer), image.rgba.buffer]);
      if (signal.aborted) cancel();
    });
  }

  class SpectralImage {
    constructor(player, spectrum, {
      generate = build, artwork = root.SAMPLE_ART,
      createURL = blob => root.URL.createObjectURL(blob), revokeURL = url => root.URL.revokeObjectURL(url),
      onChange = () => {}, onError = () => {},
    } = {}) {
      Object.assign(this, { player, spectrum, generate, artwork, createURL, revokeURL, onChange, onError });
      this.sample = null;
      this.result = null;
      this.enabled = false;
      this.busy = false;
      this.progress = 0;
      this.epoch = 0;
    }
    get available() { return Boolean(artworkFor(this.sample, this.artwork)); }

    select(sample) {
      if (this.sample?.id === sample?.id) return;
      this.cancel();
      if (this.result) this.revokeURL(this.result.url);
      this.result = null;
      this.enabled = false;
      this.sample = sample;
      this.onChange(this);
    }

    cancel() {
      this.epoch++;
      this.controller?.abort();
      this.controller = null;
      this.busy = false;
      this.progress = 0;
    }

    async toggle() {
      if (!this.available) return;
      if (this.busy) { this.cancel(); this.onChange(this); return; }
      const sample = this.sample;
      const epoch = ++this.epoch;
      if (!this.enabled && !this.result) {
        this.busy = true;
        const controller = this.controller = new AbortController();
        this.onChange(this);
        try {
          const result = await this.generate(sample, {
            signal: controller.signal,
            viewport: { width: this.spectrum.element?.clientWidth || 1000, height: this.spectrum.element?.clientHeight || 160 },
            progress: value => { if (epoch === this.epoch) { this.progress = value; this.onChange(this); } },
          });
          if (epoch !== this.epoch) return;
          this.result = { ...result, url: this.createURL(result.blob) };
        } catch (error) {
          controller.abort();
          if (epoch !== this.epoch) return;
          this.busy = false; this.controller = null;
          this.onChange(this);
          if (error.name !== 'AbortError') this.onError(error.message || 'Не удалось встроить изображение.');
          return;
        }
        this.busy = false; this.controller = null;
      }
      this.enabled = !this.enabled;
      this.onChange(this);
      await Promise.all([
        this.player.replaceSource(this.enabled ? this.result.url : sample.src),
        this.spectrum.select(sample, { recording: this.enabled ? this.result.recording : null, force: true }),
      ]);
    }

    destroy() { this.select(null); }
  }
  SpectralImage.artworkFor = artworkFor;
  if (typeof module !== 'undefined' && module.exports) module.exports = SpectralImage;
  else root.SpectralImage = SpectralImage;
})(typeof window !== 'undefined' ? window : globalThis);
