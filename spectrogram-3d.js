/* Separate FFT time slices: frequency across X, recent time along Z, energy as height. */
(function (root) {
  'use strict';
  const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const MIN_FREQ = 32, MAX_FREQ = 16000, DEPTH = 10, HEIGHT = 2.8;
  const reliefEnergy = value => clamp((value - .18) / .82);

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
      this.camera = new THREE.OrthographicCamera(-1, 1, 3.9, -3.9, .1, 100);
      const { bins, rows, values } = this.history;
      const positions = new Float32Array(bins * rows * 3);
      const edges = new Float32Array(bins * rows);
      const indices = [];
      for (let row = 0; row < rows; row++) {
        for (let x = 0; x < bins; x++) {
          const i = row * bins + x;
          positions[i * 3 + 2] = DEPTH / 2 - row / (rows - 1) * DEPTH;
          edges[i] = row % 3 === 0 ? 0 : 1;
          // Separate thin time slices leave air between the peaks instead of a solid sheet.
          if (row % 3 === 0 && row < rows - 1 && x < bins - 1) indices.push(i, i + bins, i + 1, i + 1, i + bins, i + bins + 1);
        }
      }
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.geometry.setAttribute('energy', new THREE.BufferAttribute(values, 1).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setAttribute('ridge', new THREE.BufferAttribute(edges, 1));
      this.geometry.setIndex(indices);
      this.material = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `
          attribute float energy;
          attribute float ridge;
          varying float heat;
          varying float age;
          varying float edge;
          varying vec3 viewPosition;
          void main() {
            heat = clamp((energy - .18) / .82, 0.0, 1.0);
            age = .5 - position.z / 10.0;
            edge = ridge;
            vec3 point = position;
            point.y = pow(heat, 2.2) * 2.8;
            vec4 view = modelViewMatrix * vec4(point, 1.0);
            viewPosition = view.xyz;
            gl_Position = projectionMatrix * view;
          }
        `,
        fragmentShader: `
          varying float heat;
          varying float age;
          varying float edge;
          varying vec3 viewPosition;
          void main() {
            if (heat < .05) discard;
            vec3 color = mix(vec3(.07, 0.0, 0.0), vec3(.85, .015, 0.0), clamp(heat * 3.0, 0.0, 1.0));
            color = mix(color, vec3(1.0, .22, .005), clamp(heat * 3.0 - 1.0, 0.0, 1.0));
            color = mix(color, vec3(1.0, .94, .12), clamp(heat * 3.0 - 2.0, 0.0, 1.0));
            vec3 normal = normalize(cross(dFdx(viewPosition), dFdy(viewPosition)));
            float rim = 1.0 - smoothstep(0.0, .20, edge);
            float light = .46 + .34 * abs(dot(normal, normalize(vec3(.2, .8, .4)))) + rim * .32;
            float fade = 1.0 - age * .72;
            gl_FragColor = vec4(color * light, smoothstep(.05, .22, heat) * fade * .94);
          }
        `,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      // Vertex heights are displaced in the shader, outside the flat CPU bounds.
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
      try {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', depth: true, stencil: false });
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
      const aspect = width / height;
      this.camera.left = -aspect * 3.9;
      this.camera.right = aspect * 3.9;
      this.camera.position.set(1.4 / Math.max(1, aspect / 2), 6.5, 11.5);
      this.camera.lookAt(0, .75, -.3);
      this.camera.updateMatrixWorld();
      this.camera.updateProjectionMatrix();
      // Orthographic projection keeps distant slices legible and avoids a stretched plateau.
      const span = aspect * 7.8 * .95;
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
      // The same 3D projection and separated slices on devices without WebGL 2.
      const ctx = this.ctx;
      if (!ctx) return;
      const { bins, rows, values } = this.history;
      const points = new Array(bins * rows);
      const position = this.geometry.getAttribute('position');
      const point = new this.THREE.Vector3();
      for (let i = 0; i < values.length; i++) {
        point.set(position.getX(i), reliefEnergy(values[i]) ** 2.2 * HEIGHT, position.getZ(i)).project(this.camera);
        points[i] = [(point.x + 1) * this.width / 2, (1 - point.y) * this.height / 2];
      }
      ctx.clearRect(0, 0, this.width, this.height);
      for (let row = Math.floor((rows - 2) / 3) * 3; row >= 0; row -= 3) {
        for (let x = 0; x < bins - 1; x++) {
          const i = row * bins + x, ids = [i, i + 1, i + bins + 1, i + bins];
          const energy = ids.reduce((sum, index) => sum + reliefEnergy(values[index]), 0) / 4;
          if (energy < .05) continue;
          const rgb = thermalColor(energy).map(v => Math.round(v * 255 * (.7 + energy * .25)));
          ctx.fillStyle = `rgba(${rgb.join(',')},${.94 - row / rows * .68})`;
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
