/* A rolling FFT surface: frequency across X, recent time along Z, energy as height. */
(function (root) {
  'use strict';
  const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const MIN_FREQ = 32, MAX_FREQ = 16000, DEPTH = 10, HEIGHT = 3.6;

  class SpectrogramHistory {
    constructor(bins = 96, rows = 72) {
      this.bins = bins;
      this.rows = rows;
      this.values = new Float32Array(bins * rows);
      this.frequencies = Array.from({ length: bins }, (_, i) => MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** (i / (bins - 1)));
    }

    push(bars) {
      if (!bars.length) return;
      this.values.copyWithin(this.bins, 0, this.values.length - this.bins);
      let index = 0;
      for (let x = 0; x < this.bins; x++) {
        const frequency = this.frequencies[x];
        while (index + 1 < bars.length && bars[index + 1].freq < frequency) index++;
        const a = bars[index], b = bars[Math.min(index + 1, bars.length - 1)];
        const mix = a === b ? 0 : clamp(Math.log(frequency / a.freq) / Math.log(b.freq / a.freq));
        this.values[x] = clamp(clamp(a.value[0]) * (1 - mix) + clamp(b.value[0]) * mix);
      }
    }

    clear() { this.values.fill(0); }
  }

  // The same thermal palette is used by the GPU surface and the software fallback.
  function thermalColor(value) {
    const t = clamp(value);
    const stops = [[.07, 0, 0], [.85, .015, 0], [1, .22, .005], [1, .94, .12]];
    const p = Math.min(2.9999, t * 3), i = Math.floor(p), f = p - i;
    return stops[i].map((channel, c) => channel + (stops[i + 1][c] - channel) * f);
  }

  class Spectrogram3D {
    static create(element) {
      return new Spectrogram3D(element, root.THREE);
    }

    constructor(element, THREE) {
      this.element = element;
      this.THREE = THREE;
      this.history = new SpectrogramHistory(64, 72);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
      this.camera.position.set(0, 6.4, 9.2);
      this.camera.lookAt(0, .4, -1.4);
      this.camera.updateMatrixWorld();
      const { bins, rows, values } = this.history;
      const positions = new Float32Array(bins * rows * 3);
      const indices = [];
      for (let row = 0; row < rows; row++) {
        for (let x = 0; x < bins; x++) {
          const i = row * bins + x;
          positions[i * 3 + 2] = DEPTH / 2 - row / (rows - 1) * DEPTH;
          if (row < rows - 1 && x < bins - 1) indices.push(i, i + bins, i + 1, i + 1, i + bins, i + bins + 1);
        }
      }
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.geometry.setAttribute('energy', new THREE.BufferAttribute(values, 1).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setIndex(indices);
      this.material = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `
          attribute float energy;
          varying float heat;
          varying float age;
          varying vec3 viewPosition;
          void main() {
            heat = clamp(energy, 0.0, 1.0);
            age = .5 - position.z / 10.0;
            vec3 point = position;
            point.y = pow(heat, 1.5) * 3.6;
            vec4 view = modelViewMatrix * vec4(point, 1.0);
            viewPosition = view.xyz;
            gl_Position = projectionMatrix * view;
          }
        `,
        fragmentShader: `
          varying float heat;
          varying float age;
          varying vec3 viewPosition;
          void main() {
            if (heat < .025) discard;
            vec3 color = mix(vec3(.07, 0.0, 0.0), vec3(.85, .015, 0.0), clamp(heat * 3.0, 0.0, 1.0));
            color = mix(color, vec3(1.0, .22, .005), clamp(heat * 3.0 - 1.0, 0.0, 1.0));
            color = mix(color, vec3(1.0, .94, .12), clamp(heat * 3.0 - 2.0, 0.0, 1.0));
            vec3 normal = normalize(cross(dFdx(viewPosition), dFdy(viewPosition)));
            float light = .68 + .32 * abs(dot(normal, normalize(vec3(.2, .8, .4))));
            float fade = 1.0 - age * .60;
            gl_FragColor = vec4(color * light, smoothstep(.025, .13, heat) * fade * .96);
          }
        `,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      // Vertex heights are displaced in the shader, outside the flat CPU bounds.
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
      try {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power', depth: true, stencil: false });
        this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.debug.onShaderError = () => { this.shaderFailed = true; };
        this.canvas = this.renderer.domElement;
        this.canvas.addEventListener('webglcontextlost', event => {
          event.preventDefault();
          this.useSoftwareRenderer();
          this.resize();
        }, { once: true });
      } catch {
        this.useSoftwareRenderer();
      }
      element.replaceChildren(this.canvas);
      this.resize = this.resize.bind(this);
      if (root.ResizeObserver) {
        this.observer = new root.ResizeObserver(this.resize);
        this.observer.observe(element);
      } else root.addEventListener?.('resize', this.resize);
      this.resize();
    }

    useSoftwareRenderer() {
      const mounted = !this.canvas || this.canvas.parentNode === this.element;
      this.software = true;
      this.renderer?.dispose();
      this.renderer = null;
      this.canvas = this.element.ownerDocument.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      // A cached, inactive 3D canvas must not replace the visible 2D canvas.
      if (mounted) this.element.replaceChildren(this.canvas);
    }

    resize() {
      const width = this.element.clientWidth || 1000, height = this.element.clientHeight || 160;
      this.width = width; this.height = height;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      // Fill a wide player without stretching the depth or the height of the relief.
      const span = this.camera.aspect * 7.8;
      const positions = this.geometry.getAttribute('position');
      const { bins, rows } = this.history;
      for (let row = 0; row < rows; row++) {
        for (let x = 0; x < bins; x++) positions.setX(row * bins + x, (x / (bins - 1) - .5) * span);
      }
      positions.needsUpdate = true;
      if (this.renderer) this.renderer.setSize(width, height, false);
      else { this.canvas.width = width; this.canvas.height = height; }
      this.render();
    }

    push(bars, timestamp = 0) {
      this.history.push(bars);
      this.geometry.getAttribute('energy').needsUpdate = true;
      if (this.renderer || !this.lastPaint || timestamp - this.lastPaint >= 1000 / 12) {
        this.lastPaint = timestamp;
        this.render();
      }
    }

    clear() {
      this.history.clear();
      this.geometry.getAttribute('energy').needsUpdate = true;
      this.render();
    }

    show(recording, seconds, volume = 1) {
      const { bins, rows, values } = this.history;
      const latest = Math.min(recording.frames - 1, Math.max(0, Math.floor(seconds * recording.rate)));
      const offset = volume > 0 ? 20 * Math.log10(volume) / 65 : -1;
      for (let row = 0; row < rows; row++) {
        const frame = latest - row;
        for (let x = 0; x < bins; x++) {
          values[row * bins + x] = frame < 0 ? 0 : Math.max(0, recording.data[frame * bins + x] / 255 + offset);
        }
      }
      this.geometry.getAttribute('energy').needsUpdate = true;
      this.render();
    }

    render() {
      if (this.renderer) {
        this.renderer.render(this.scene, this.camera);
        if (!this.shaderFailed) return;
        this.useSoftwareRenderer();
        this.resize();
        return;
      }
      // Genuine perspective projection on Canvas for devices without WebGL 2.
      const ctx = this.ctx;
      if (!ctx) return;
      const { bins, rows, values } = this.history;
      const points = new Array(bins * rows);
      const position = this.geometry.getAttribute('position');
      const point = new this.THREE.Vector3();
      for (let i = 0; i < values.length; i++) {
        point.set(position.getX(i), values[i] ** 1.5 * HEIGHT, position.getZ(i)).project(this.camera);
        points[i] = [(point.x + 1) * this.width / 2, (1 - point.y) * this.height / 2];
      }
      ctx.clearRect(0, 0, this.width, this.height);
      for (let row = rows - 4; row >= 0; row -= 2) {
        for (let x = 0; x < bins - 2; x += 2) {
          const i = row * bins + x, ids = [i, i + 2, i + bins * 2 + 2, i + bins * 2];
          const energy = ids.reduce((sum, index) => sum + values[index], 0) / 4;
          if (energy < .025) continue;
          const rgb = thermalColor(energy).map(v => Math.round(v * 255));
          ctx.fillStyle = `rgba(${rgb.join(',')},${.95 - row / rows * .55})`;
          ctx.beginPath();
          ids.forEach((index, n) => ctx[n ? 'lineTo' : 'moveTo'](...points[index]));
          ctx.closePath(); ctx.fill();
        }
      }
    }

    destroy() {
      this.observer?.disconnect();
      root.removeEventListener?.('resize', this.resize);
      this.renderer?.dispose(); this.geometry.dispose(); this.material.dispose();
      this.canvas.remove();
    }
  }
  Spectrogram3D.History = SpectrogramHistory;
  Spectrogram3D.thermalColor = thermalColor;
  if (typeof module !== 'undefined' && module.exports) module.exports = Spectrogram3D;
  else root.Spectrogram3D = Spectrogram3D;
})(typeof window !== 'undefined' ? window : globalThis);
