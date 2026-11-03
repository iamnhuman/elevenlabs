/* A conventional time × frequency spectrogram, using the same measured FFT data. */
(function (root) {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const STOPS = [
    [0, [0, 0, 0]], [.10, [6, 2, 38]], [.28, [44, 0, 110]],
    [.48, [155, 0, 108]], [.65, [248, 20, 15]], [.80, [255, 130, 0]],
    [.93, [255, 238, 70]], [1, [255, 255, 225]],
  ];
  function heatColor(energy) {
    const t = clamp(energy);
    const upper = STOPS.findIndex(stop => stop[0] >= t);
    if (upper <= 0) return STOPS[0][1];
    const [a, first] = STOPS[upper - 1], [b, last] = STOPS[upper];
    const mix = (t - a) / (b - a);
    return first.map((channel, index) => Math.round(channel + (last[index] - channel) * mix));
  }
  const COLORS = Array.from({ length: 256 }, (_, i) => heatColor(i / 255));
  const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  class Spectrogram2D {
    static create(element) { return new Spectrogram2D(element); }

    constructor(element) {
      this.element = element;
      this.canvas = element.ownerDocument.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.image = element.ownerDocument.createElement('canvas');
      this.imageCtx = this.image.getContext('2d');
      this.recording = null;
      this.seconds = 0;
      this.volume = 1;
      element.replaceChildren(this.canvas);
      this.resize = this.resize.bind(this);
      if (root.ResizeObserver) {
        this.observer = new root.ResizeObserver(this.resize);
        this.observer.observe(element);
      } else root.addEventListener?.('resize', this.resize);
      this.resize();
    }

    resize() {
      this.width = this.element.clientWidth || 1000;
      this.height = this.element.clientHeight || 160;
      const ratio = Math.min(root.devicePixelRatio || 1, 1.5);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.render();
    }

    buildImage(recording, volume) {
      const width = Math.min(recording.frames, 2048), bins = recording.bins;
      this.image.width = width;
      this.image.height = bins;
      const pixels = this.imageCtx.createImageData(width, bins);
      const offset = volume > 0 ? 20 * Math.log10(volume) / 65 * 255 : -255;
      for (let x = 0; x < width; x++) {
        const first = Math.floor(x * recording.frames / width);
        const end = Math.max(first + 1, Math.floor((x + 1) * recording.frames / width));
        for (let bin = 0; bin < bins; bin++) {
          let peak = 0;
          for (let frame = first; frame < end; frame++) peak = Math.max(peak, recording.data[frame * bins + bin]);
          const level = Math.round(Math.max(0, Math.min(255, peak + offset)));
          const color = COLORS[level];
          const i = ((bins - 1 - bin) * width + x) * 4;
          pixels.data[i] = color[0]; pixels.data[i + 1] = color[1]; pixels.data[i + 2] = color[2]; pixels.data[i + 3] = 255;
        }
      }
      this.imageCtx.putImageData(pixels, 0, 0);
    }

    show(recording, seconds, volume = 1) {
      if (recording !== this.recording || volume !== this.volume) this.buildImage(recording, volume);
      this.recording = recording;
      this.seconds = seconds;
      this.volume = volume;
      this.render();
    }

    clear() {
      this.recording = null;
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.recording) return;
      const left = 0, top = 0, width = this.width, height = this.height;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.image, left, top, width, height);
      const duration = this.recording.frames / this.recording.rate;
      const cursor = left + clamp(this.seconds / duration) * width;
      // The full clip remains visible, with an advancing cursor at the heard moment.
      ctx.fillStyle = '#00000020';
      ctx.fillRect(cursor, top, left + width - cursor, height);
      ctx.fillStyle = '#ffffffe0';
      ctx.fillRect(Math.min(left + width - 1, cursor), top, 1, height);
      ctx.font = '400 9px "Oxanium", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#aaa';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      for (let tick = 0; tick <= 4; tick++) {
        ctx.textAlign = tick === 0 ? 'left' : tick === 4 ? 'right' : 'center';
        const label = duration < 10 ? `${(duration * tick / 4).toFixed(1)} s` : time(duration * tick / 4);
        ctx.fillText(label, 14 + (width - 28) * tick / 4, 9);
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      for (const [frequency, label] of [[16000, '16k Hz'], [2000, '2k'], [250, '250'], [32, '32 Hz']]) {
        const y = Math.max(24, Math.min(height - 18, (1 - Math.log(frequency / 32) / Math.log(500)) * height));
        ctx.fillStyle = '#050505c9';
        ctx.fillRect(10, y, 38, 11);
        ctx.fillStyle = '#c5c5c5';
        ctx.fillText(label, 14, y + 1);
      }
    }

    destroy() {
      this.observer?.disconnect();
      root.removeEventListener?.('resize', this.resize);
      this.canvas.remove();
      this.image.width = this.image.height = 0;
    }
  }
  Spectrogram2D.heatColor = heatColor;
  if (typeof module !== 'undefined' && module.exports) module.exports = Spectrogram2D;
  else root.Spectrogram2D = Spectrogram2D;
})(typeof window !== 'undefined' ? window : globalThis);
