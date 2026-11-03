const { test } = require('node:test');
const assert = require('node:assert/strict');
const SamplePlayer = require('../audio-player.js');

class FakeAudio extends EventTarget {
  constructor() {
    super(); this.paused = true; this.ended = false; this.error = null;
    this.readyState = 0; this.duration = NaN; this.currentTime = 0;
    this.requests = []; this.loads = 0;
  }
  load() { this.loads++; this.readyState = 0; this.duration = NaN; this.currentTime = 0; this.ended = false; }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { this.paused = false; return new Promise((resolve, reject) => this.requests.push({ resolve, reject })); }
  metadata(duration = 15) { this.duration = duration; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata')); }
}
const a = { id: 'a', src: 'a.mp3', duration: 15 };
const b = { id: 'b', src: 'b.mp3', duration: 8 };
const setup = () => {
  const audio = new FakeAudio(); const errors = [];
  const player = new SamplePlayer(audio, { onError: error => errors.push(error) });
  return { audio, player, errors };
};

test('switching quickly ignores an obsolete play rejection', async () => {
  const { audio, player, errors } = setup();
  const first = player.select(a);
  const second = player.select(b);
  audio.requests[1].resolve(); await second;
  audio.requests[0].reject(new Error('old request failed')); await first;
  assert.equal(player.sample.id, 'b');
  assert.equal(audio.src, 'b.mp3');
  assert.equal(audio.paused, false);
  assert.equal(player.loading, false);
  assert.deepEqual(errors, []);
});

test('obsolete play success does not clear the loading state of the latest track', async () => {
  const { audio, player } = setup();
  const first = player.select(a); const second = player.select(b);
  audio.requests[0].resolve(); await first;
  assert.equal(player.loading, true);
  audio.requests[1].resolve(); await second;
  assert.equal(player.loading, false);
});

test('seeking into an unloaded track waits for its metadata', async () => {
  const { audio, player } = setup();
  const playback = player.select(a, { fraction: .75 });
  assert.equal(audio.currentTime, 0);
  audio.metadata(20);
  assert.equal(audio.currentTime, 15);
  assert.equal(player.pendingSeek, null);
  audio.requests[0].resolve(); await playback;
});

test('switching before metadata discards the old track seek', async () => {
  const { audio, player } = setup();
  const first = player.select(a, { fraction: .75 });
  const second = player.select(b);
  audio.metadata(8);
  assert.equal(audio.currentTime, 0);
  audio.requests.forEach(request => request.resolve());
  await Promise.all([first, second]);
});

test('same-track toggle pauses; resume preserves position without reloading', async () => {
  const { audio, player } = setup();
  const first = player.select(a); audio.metadata(15); audio.requests[0].resolve(); await first;
  audio.currentTime = 5;
  await player.select(a, { toggle: true });
  assert.equal(audio.paused, true);
  const resume = player.select(a, { toggle: true }); audio.requests[1].resolve(); await resume;
  assert.equal(audio.loads, 1);
  assert.equal(audio.currentTime, 5);
});

test('pausing invalidates a pending request and suppresses its late error', async () => {
  const { audio, player, errors } = setup();
  const first = player.select(a); player.pause();
  audio.requests[0].reject(new Error('late failure')); await first;
  assert.equal(audio.paused, true);
  assert.equal(player.loading, false);
  assert.deepEqual(errors, []);
});

test('seek clamps to track bounds and ignores non-finite input', async () => {
  const { audio, player } = setup();
  const first = player.select(a); audio.metadata(10); audio.requests[0].resolve(); await first;
  player.seek(-1); assert.equal(audio.currentTime, 0);
  player.seek(2); assert.ok(audio.currentTime < 10 && audio.currentTime > 9.99);
  const previous = audio.currentTime; player.seek(NaN); assert.equal(audio.currentTime, previous);
});

test('a real playback failure clears loading and provides a user-visible error', async () => {
  const { audio, player, errors } = setup();
  const first = player.select(a);
  audio.requests[0].reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  await first;
  assert.equal(player.loading, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /разрешить звук/);
});
