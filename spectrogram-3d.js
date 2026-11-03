/* A bank of illuminated metal frequency columns; recent time recedes along Z. */
(function (root) {
  'use strict';
  const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const MIN_FREQ = 32, MAX_FREQ = 16000, DEPTH = 8.6, HEIGHT = 2.4;
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
    static create(element) { return new Spectrogram3D(element, root.THREE); }

    constructor(element, THREE) {
      this.element = element;
      this.THREE = THREE;
      this.history = new SpectrogramHistory(64, 18);
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x050505, .018);
      this.camera = new THREE.OrthographicCamera(-1, 1, 4, -4, .1, 100);
      const profile = new THREE.Shape();
      profile.moveTo(-.5, -.5); profile.lineTo(.5, -.5);
      profile.lineTo(.5, .5); profile.lineTo(-.5, .5); profile.closePath();
      this.geometry = new THREE.ExtrudeGeometry(profile, {
        depth: 1, bevelEnabled: true, bevelSize: .04, bevelThickness: .04,
        bevelSegments: 2, steps: 1, curveSegments: 1,
      });
      this.geometry.scale(1 / 1.08, 1 / 1.08, 1 / 1.08);
      this.geometry.rotateX(-Math.PI / 2);
      this.geometry.center();
      this.geometry.rotateY(.18);
      this.material = new THREE.MeshStandardMaterial({ metalness: .65, roughness: .28 });
      this.capGeometry = new THREE.PlaneGeometry(.88, .88);
      this.capGeometry.rotateX(-Math.PI / 2); this.capGeometry.rotateY(.18);
      this.capMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const count = this.history.values.length;
      this.columns = new THREE.InstancedMesh(this.geometry, this.material, count);
      this.caps = new THREE.InstancedMesh(this.capGeometry, this.capMaterial, count);
      for (const mesh of [this.columns, this.caps]) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
      }
      this.transform = new THREE.Object3D();
      this.color = new THREE.Color();
      this.scene.add(new THREE.AmbientLight(0xffffff, .85));
      const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(-4, 8, 6); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xff8a42, 1.2); rim.position.set(4, 3, -8); this.scene.add(rim);
      try {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', stencil: false });
        this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.debug.onShaderError = () => { this.shaderFailed = true; };
        this.canvas = this.renderer.domElement;
        this.canvas.addEventListener('webglcontextlost', event => {
          event.preventDefault(); this.useSoftwareRenderer(); this.resize();
        }, { once: true });
      } catch { this.useSoftwareRenderer(); }
      element.replaceChildren(this.canvas);
      this.resize = this.resize.bind(this);
      if (root.ResizeObserver) {
        this.observer = new root.ResizeObserver(this.resize); this.observer.observe(element);
      } else root.addEventListener?.('resize', this.resize);
      this.resize();
    }

    useSoftwareRenderer() {
      const mounted = !this.canvas || this.canvas.parentNode === this.element;
      this.software = true; this.renderer?.dispose(); this.renderer = null;
      this.canvas = this.element.ownerDocument.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (mounted) this.element.replaceChildren(this.canvas);
    }

    resize() {
      this.width = this.element.clientWidth || 1000; this.height = this.element.clientHeight || 160;
      const aspect = this.width / this.height;
      this.camera.left = -aspect * 4; this.camera.right = aspect * 4;
      this.camera.position.set(2 / Math.max(1, aspect / 2), 6.8, 11.8);
      this.camera.lookAt(0, .65, -.4); this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix();
      this.span = aspect * 8 * .93;
      this.barWidth = this.span / this.history.bins * .70;
      this.barDepth = DEPTH / (this.history.rows - 1) * .60;
      if (this.renderer) this.renderer.setSize(this.width, this.height, false);
      else { this.canvas.width = this.width; this.canvas.height = this.height; }
      this.render();
    }

    clear() { this.history.clear(); this.render(); }
    push(bars) { this.history.push(bars); this.render(); }

    show(recording, seconds, volume = 1) {
      const { bins, rows, values } = this.history;
      const latest = Math.min(recording.frames - 1, Math.max(0, Math.floor(seconds * recording.rate)));
      const range = (recording.maxDb ?? -25) - (recording.minDb ?? -90);
      const offset = volume > 0 ? 20 * Math.log10(volume) / range : -1;
      for (let row = 0; row < rows; row++) {
        const frame = latest - Math.round(row / (rows - 1) * 3 * recording.rate);
        for (let x = 0; x < bins; x++) {
          let peak = 0;
          if (frame >= 0) {
            const start = Math.floor(x * recording.bins / bins);
            const end = Math.max(start + 1, Math.floor((x + 1) * recording.bins / bins));
            for (let bin = start; bin < end; bin++) peak = Math.max(peak, recording.data[frame * recording.bins + bin]);
          }
          values[row * bins + x] = frame < 0 ? 0 : clamp(peak / 255 + offset);
        }
      }
      this.render();
    }

    column(row, x) {
      const value = this.history.values[row * this.history.bins + x];
      const energy = reliefEnergy(value);
      return {
        energy, height: energy < .025 ? 0 : energy ** 1.9 * HEIGHT,
        x: ((x + .5) / this.history.bins - .5) * this.span,
        z: DEPTH / 2 - row / (this.history.rows - 1) * DEPTH,
        fade: 1 - row / (this.history.rows - 1) * .70,
      };
    }

    updateInstances() {
      const { bins, rows } = this.history;
      const object = this.transform;
      for (let row = 0; row < rows; row++) {
        for (let x = 0; x < bins; x++) {
          const i = row * bins + x, bar = this.column(row, x);
          const rgb = thermalColor(bar.energy);
          object.position.set(bar.x, bar.height / 2, bar.z);
          object.scale.set(bar.height ? this.barWidth : 0, bar.height, bar.height ? this.barDepth : 0);
          object.updateMatrix(); this.columns.setMatrixAt(i, object.matrix);
          this.color.setRGB(.045 + rgb[0] * .13, .045 + rgb[1] * .13, .05 + rgb[2] * .13).multiplyScalar(bar.fade);
          this.columns.setColorAt(i, this.color);
          object.position.y = bar.height + .006;
          object.scale.y = bar.height ? 1 : 0;
          object.updateMatrix(); this.caps.setMatrixAt(i, object.matrix);
          this.color.setRGB(...rgb).multiplyScalar((.35 + bar.energy * .65) * bar.fade);
          this.caps.setColorAt(i, this.color);
        }
      }
      for (const mesh of [this.columns, this.caps]) {
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      }
    }

    render() {
      if (this.renderer) {
        this.updateInstances(); this.renderer.render(this.scene, this.camera);
        if (!this.shaderFailed) return;
        this.useSoftwareRenderer(); this.resize(); return;
      }
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.width, this.height);
      const point = new this.THREE.Vector3(), angle = .18, cos = Math.cos(angle), sin = Math.sin(angle);
      const drawFace = (points, indices, color) => {
        ctx.fillStyle = `rgb(${color.map(v => Math.round(clamp(v) * 255)).join(',')})`;
        ctx.beginPath();
        indices.forEach((index, n) => ctx[n ? 'lineTo' : 'moveTo'](...points[index]));
        ctx.closePath(); ctx.fill();
      };
      for (let row = this.history.rows - 1; row >= 0; row--) {
        for (let x = 0; x < this.history.bins; x++) {
          const bar = this.column(row, x);
          if (!bar.height) continue;
          const points = [];
          for (let top = 0; top <= 1; top++) {
            for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
              const dx = sx * this.barWidth / 2, dz = sz * this.barDepth / 2;
              point.set(bar.x + dx * cos + dz * sin, top * bar.height, bar.z + dz * cos - dx * sin).project(this.camera);
              points.push([(point.x + 1) * this.width / 2, (1 - point.y) * this.height / 2]);
            }
          }
          const rgb = thermalColor(bar.energy);
          const body = rgb.map(v => (.075 + v * .16) * bar.fade);
          drawFace(points, [3,2,6,7], body);
          drawFace(points, [2,1,5,6], body.map(v => v * .62));
          drawFace(points, [4,5,6,7], rgb.map(v => v * (.35 + bar.energy * .65) * bar.fade));
        }
      }
    }

    destroy() {
      this.observer?.disconnect(); root.removeEventListener?.('resize', this.resize);
      this.renderer?.dispose(); this.geometry.dispose(); this.material.dispose();
      this.capGeometry.dispose(); this.capMaterial.dispose(); this.canvas.remove();
    }
  }
  Spectrogram3D.History = SpectrogramHistory;
  Spectrogram3D.thermalColor = thermalColor;
  if (typeof module !== 'undefined' && module.exports) module.exports = Spectrogram3D;
  else root.Spectrogram3D = Spectrogram3D;
})(typeof window !== 'undefined' ? window : globalThis);
