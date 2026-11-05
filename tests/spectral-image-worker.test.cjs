const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('the shipped worker and its versioned DSP import synthesize WAV without eval', () => {
  const messages = [];
  const self = { postMessage: message => messages.push(message) };
  const context = vm.createContext({ self, importScripts(url) {
    const file = path.resolve(__dirname, '..', url.split('?')[0]);
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }).runInContext(context);
  } }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(fs.readFileSync(path.resolve(__dirname, '../spectral-image-worker.js'), 'utf8')).runInContext(context);
  self.onmessage({ data: {
    channels: [new Float32Array(32000)],
    image: { width: 2, height: 2, rgba: Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]) },
    viewport: { width: 1000, height: 160 },
  } });
  const result = messages.at(-1);
  assert.equal(result.error, undefined);
  assert.equal(Buffer.from(result.wav).subarray(0, 4).toString(), 'RIFF');
  assert.ok(result.recording.data.some(value => value > 0));
  assert.ok(messages.some(message => message.progress !== undefined));
});
