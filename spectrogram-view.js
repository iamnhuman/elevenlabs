/* Switching views reuses their canvases and never owns the audio element. */
(function (root) {
  'use strict';
  class SpectrogramView {
    static create(element, mode) { return new SpectrogramView(element, mode); }

    constructor(element, mode = '2d', { ThreeD = root.Spectrogram3D, TwoD = root.Spectrogram2D } = {}) {
      this.element = element;
      this.factories = { '3d': ThreeD, '2d': TwoD };
      this.views = new Map();
      this.lastFrame = null;
      this.setMode(mode);
    }

    get software() { return Boolean(this.active.software); }

    setMode(mode) {
      mode = mode === '3d' ? '3d' : '2d';
      if (mode === this.mode) return;
      if (!this.views.has(mode)) this.views.set(mode, this.factories[mode].create(this.element));
      this.mode = mode;
      this.active = this.views.get(mode);
      this.element.replaceChildren(this.active.canvas);
      this.active.resize();
      if (this.lastFrame) this.active.show(...this.lastFrame);
    }

    show(...frame) {
      this.lastFrame = frame;
      this.active.show(...frame);
    }

    clear() {
      this.lastFrame = null;
      this.views.forEach(view => view.clear());
    }

    destroy() { this.views.forEach(view => view.destroy()); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SpectrogramView;
  else root.SpectrogramView = SpectrogramView;
})(typeof window !== 'undefined' ? window : globalThis);
