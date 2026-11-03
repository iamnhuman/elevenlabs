/* Canvas waveforms adapt bar count to the actual card width, including dense view. */
(() => {
  'use strict';
  const pending = new Set();
  let frame = 0;
  function queue(view) {
    pending.add(view);
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      pending.forEach(item => item.draw());
      pending.clear();
    });
  }
  const resize = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    entries.forEach(entry => { if (entry.target.waveformView) queue(entry.target.waveformView); });
  }) : null;

  class Waveform {
    constructor(element, peaks) {
      this.element = element;
      this.canvas = element.querySelector('canvas');
      this.context = this.canvas.getContext('2d');
      this.peaks = peaks;
      this.progress = 0;
      this.active = false;
      this.lastPixel = -1;
      element.waveformView = this;
      resize?.observe(element);
    }
    refresh() { this.lastPixel = -1; queue(this); }
    setActive(active) { this.active = active; this.refresh(); }
    setProgress(progress) {
      this.progress = Math.min(1,Math.max(0,progress));
      const pixel = Math.round(this.progress * this.canvas.width);
      if (pixel !== this.lastPixel) { this.lastPixel = pixel; queue(this); }
    }
    draw() {
      if (!this.context || !this.element.isConnected) return;
      const rect = this.element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(window.devicePixelRatio || 1,2);
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width; this.canvas.height = height;
      }
      const ctx = this.context;
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.clearRect(0,0,rect.width,rect.height);
      const style = getComputedStyle(this.element);
      const idle = style.getPropertyValue('--wave-idle').trim() || '#57574e';
      const played = style.getPropertyValue('--wave-active').trim() || '#e0d9c3';
      const count = Math.min(this.peaks.length,Math.max(12,Math.floor(rect.width/3.3)));
      const pitch = rect.width/count;
      const bar = Math.max(1,pitch*.5);
      for (let i=0;i<count;i++) {
        const from = Math.floor(i*this.peaks.length/count);
        const to = Math.max(from+1,Math.floor((i+1)*this.peaks.length/count));
        let peak = 0;
        for (let j=from;j<to;j++) peak = Math.max(peak,this.peaks[j]);
        const h = Math.max(2,Math.pow(peak,.82)*(rect.height-4));
        const x = i*pitch+(pitch-bar)/2;
        ctx.fillStyle = this.active && x < rect.width*this.progress ? played : idle;
        ctx.fillRect(x,(rect.height-h)/2,bar,h);
      }
      if (this.active && this.progress>0 && this.progress<1) {
        ctx.fillStyle = played;
        ctx.fillRect(Math.floor(rect.width*this.progress),0,1,rect.height);
      }
    }
  }
  window.Waveform = Waveform;
})();
