const { test } = require('node:test');
const assert = require('node:assert/strict');
const Spectrogram3D = require('../spectrogram-3d.js');

test('FFT history keeps distinct moments and clears when changing the audio source', () => {
  const history = new Spectrogram3D.History(8, 4);
  history.push([{ freq: 32, value: [.8] }, { freq: 16000, value: [.8] }]);
  history.push([{ freq: 32, value: [.2] }, { freq: 16000, value: [.2] }]);
  assert.ok(Math.abs(history.values[0] - .2) < .000001);
  assert.ok(Math.abs(history.values[8] - .8) < .000001);
  assert.equal(history.values[16], 0);
  history.clear();
  assert.ok(history.values.every(v => v === 0));
});

test('low and high frequency peaks occupy opposite ends of the logarithmic surface', () => {
  const history = new Spectrogram3D.History(9, 3);
  const bars = history.frequencies.map((freq, index) => ({ freq, value: [index === 1 ? 1 : 0] }));
  history.push(bars);
  assert.equal(history.values[1], 1);
  assert.equal(history.values[7], 0);
  bars[1].value[0] = 0; bars[7].value[0] = 1;
  history.push(bars);
  assert.equal(history.values[1], 0);
  assert.equal(history.values[7], 1);
  assert.equal(history.values[10], 1, 'The preceding low-frequency peak recedes into time');
  const ratio = history.frequencies[1] / history.frequencies[0];
  assert.ok(history.frequencies.slice(1).every((freq, i) => Math.abs(freq / history.frequencies[i] - ratio) < .000001));
});

test('silence stays flat and invalid FFT values cannot produce spikes or NaN vertices', () => {
  const history = new Spectrogram3D.History(8, 4);
  history.push([{ freq: 32, value: [0] }, { freq: 16000, value: [0] }]);
  assert.ok(history.values.every(v => v === 0));
  history.push([{ freq: 32, value: [NaN] }, { freq: 16000, value: [2] }]);
  assert.ok(history.values.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
});

test('thermal color progresses from deep red through orange to yellow at high energy', () => {
  const red = Spectrogram3D.thermalColor(.33), orange = Spectrogram3D.thermalColor(.67), yellow = Spectrogram3D.thermalColor(1);
  assert.ok(red[0] > red[1] * 10);
  assert.ok(orange[1] > red[1]);
  assert.ok(yellow[0] > .95 && yellow[1] > .9 && yellow[2] < .2);
});
