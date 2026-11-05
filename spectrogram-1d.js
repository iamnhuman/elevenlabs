/* Three independent SVG waves driven by measured bass, mid and treble energy. */
(function (root) {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const clamp = value => Math.max(0, Math.min(1, value));
  const TAU = Math.PI * 2;
  const BANDS = [
    { name: 'bass', min: 32, max: 250, cycles: 4.5, speed: 6, offset: .06, opacity: .95, stroke: 1.65 },
    { name: 'mid', min: 250, max: 2000, cycles: 9, speed: -9, offset: 0, opacity: .72, stroke: 1.25 },
    { name: 'treble', min: 2000, max: 16000, cycles: 16, speed: 13, offset: -.06, opacity: .54, stroke: 1 },
  ];
  const analyses = new WeakMap();
  let nextId = 0;

  function analyze(recording) {
    if (analyses.has(recording)) return analyses.get(recording);
    const minDb = recording.minDb ?? -96;
    const range = (recording.maxDb ?? -12) - minDb;
    const powers = Float64Array.from({ length: 256 }, (_, value) => {
      const db = minDb + value / 255 * range;
      return value && db > -76 ? 10 ** (db / 10) : 0;
    });
    const frequencyBin = frequency => Math.ceil(Math.log(frequency / 32) / Math.log(500) * (recording.bins - 1));
    const bands = BANDS.map((band, index) => {
      const start = frequencyBin(band.min);
      const end = index === BANDS.length - 1 ? recording.bins : frequencyBin(band.max);
      const count = Math.max(1, end - start);
      const energy = new Float32Array(recording.frames), color = new Float32Array(recording.frames);
      for (let frame = 0; frame < recording.frames; frame++) {
        let sum = 0, weighted = 0;
        for (let bin = start; bin < end; bin++) {
          const power = powers[recording.data[frame * recording.bins + bin]];
          sum += power;
          weighted += power * (bin - start) / Math.max(1, count - 1);
        }
        energy[frame] = Math.sqrt(sum / count);
        color[frame] = sum ? weighted / sum : 0;
      }
      // Calibrate each range independently; a quiet high band must not disappear
      // behind the bass. The floor prevents background noise from becoming a wave.
      const audible = Array.from(energy).filter(value => value > .00016).sort((a, b) => a - b);
      const reference = Math.max(.0015, (audible[Math.floor((audible.length - 1) * .96)] || 0) * 1.1);
      return { energy, color, reference };
    });
    analyses.set(recording, bands); // Loaded FFT recordings are immutable.
    return bands;
  }

  function bandAt(recording, seconds, volume, bandIndex) {
    if (!(volume > 0) || seconds < 0 || !recording.frames) return { strength: 0, attack: 0, color: 0 };
    const band = analyze(recording)[bandIndex];
    const sample = (values, time) => {
      if (time < 0) return 0;
      const position = Math.min(recording.frames - 1, time * recording.rate);
      const first = Math.floor(position), last = Math.min(recording.frames - 1, first + 1);
      return values[first] + (values[last] - values[first]) * (position - first);
    };
    const energy = sample(band.energy, seconds);
    const previous = sample(band.energy, seconds - .025);
    const gain = clamp(volume) ** .7;
    const level = Math.max(0, energy - .00016) / band.reference;
    const attack = clamp((energy - previous) / band.reference * 2);
    return {
      strength: clamp(level ** .85 * .85 + attack * .5) * gain,
      attack: attack * gain,
      color: sample(band.color, seconds),
    };
  }

  function wavePoints(recording, seconds, volume, width, height, bandIndex = 0) {
    const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const band = BANDS[bandIndex];
    const { strength, attack, color } = bandAt(recording, time, volume, bandIndex);
    const top = 10, bottom = Math.max(top, height - 38);
    const span = bottom - top;
    const center = (top + bottom) / 2 + span * band.offset;
    const amplitude = span * (.49 - Math.abs(band.offset)) * strength;
    const count = Math.max(256, Math.min(768, Math.ceil(width / 2)));
    return Array.from({ length: count + 1 }, (_, index) => {
      const u = index / count;
      const taper = index === 0 || index === count ? 0 : Math.sin(Math.PI * u) ** .65;
      const phase = u * TAU * (band.cycles + color * 2) - time * band.speed;
      const body = Math.sin(phase) * (.62 - attack * .12);
      const edge = Math.sin(phase * 2.3 + color * TAU) * .25;
      const detail = Math.sin(phase * 4.1 - color * 3 + bandIndex) * (.13 + attack * .12);
      return [16 + Math.max(0, width - 32) * u, center - (body + edge + detail) * amplitude * taper];
    });
  }

  function wavePath(points) {
    return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('');
  }

  class Spectrogram1D {
    static create(element) { return new Spectrogram1D(element); }

    constructor(element) {
      this.element = element;
      this.svg = element.ownerDocument.createElementNS(SVG_NS, 'svg');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.setAttribute('focusable', 'false');
      const defs = element.ownerDocument.createElementNS(SVG_NS, 'defs');
      const gradient = element.ownerDocument.createElementNS(SVG_NS, 'linearGradient');
      const id = `player-wave-${++nextId}`;
      gradient.setAttribute('id', id);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('y2', '0%');
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
      for (const [offset, opacity] of [[0, 0], [12, .4], [32, .9], [50, 1], [68, .9], [88, .4], [100, 0]]) {
        const stop = element.ownerDocument.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', `${offset}%`);
        stop.setAttribute('stop-color', '#fff');
        stop.setAttribute('stop-opacity', String(opacity));
        gradient.append(stop);
      }
      defs.append(gradient);
      this.svg.append(defs);
      this.traces = [2, 1, 0].map(bandIndex => {
        const band = BANDS[bandIndex];
        const path = element.ownerDocument.createElementNS(SVG_NS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', `url(#${id})`);
        path.setAttribute('stroke-width', String(band.stroke));
        path.setAttribute('opacity', String(band.opacity));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('class', 'wave-core');
        path.setAttribute('data-band', band.name);
        this.svg.append(path);
        return { path, bandIndex, opacity: band.opacity };
      });
      this.path = this.traces.at(-1).path;
      this.recording = null;
      this.seconds = 0;
      this.volume = 1;
      element.replaceChildren(this.svg);
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
      this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
      this.render();
    }

    show(recording, seconds, volume = 1) {
      this.recording = recording;
      this.seconds = seconds;
      this.volume = volume;
      this.render();
    }

    clear() {
      this.recording = null;
      this.traces.forEach(({ path }) => path.setAttribute('d', ''));
    }

    render() {
      if (!this.recording) return;
      for (const { path, bandIndex, opacity } of this.traces) {
        const points = wavePoints(this.recording, this.seconds, this.volume, this.width, this.height, bandIndex);
        const active = points.some(([, y]) => Math.abs(y - points[0][1]) > .1);
        path.setAttribute('d', wavePath(points));
        path.setAttribute('opacity', String(active ? opacity : bandIndex === 0 ? .12 : 0));
      }
    }

    destroy() {
      this.observer?.disconnect();
      root.removeEventListener?.('resize', this.resize);
      this.svg.remove();
      this.recording = null;
    }
  }
  Spectrogram1D.bandAt = bandAt;
  Spectrogram1D.bands = BANDS;
  Spectrogram1D.wavePoints = wavePoints;
  if (typeof module !== 'undefined' && module.exports) module.exports = Spectrogram1D;
  else root.Spectrogram1D = Spectrogram1D;
})(typeof window !== 'undefined' ? window : globalThis);
