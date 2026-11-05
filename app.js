(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const library = window.SAMPLE_LIBRARY;
  if (!library?.samples?.length) {
    $('#sample-list').textContent = 'Коллекция недоступна. Обнови страницу.';
    return;
  }
  const samples = library.samples;
  const byId = new Map(samples.map(sample => [sample.id, sample]));
  const audio = $('#audio');
  const playerPanel = $('.player');
  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(`sample-room:${key}`)) ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`sample-room:${key}`, JSON.stringify(value)); }
      catch { /* Private browsing and full storage do not interrupt listening. */ }
    },
  };
  let filter = 'samples';
  const views = ['cards', 'compact', 'list'];
  let displayView = storage.get('view', 'compact');
  if (!views.includes(displayView)) displayView = 'compact';
  const sectionOf = sample => sample.duration > 30 ? 'track' : 'samples';
  let visible = [...samples];
  const shuffledOrders = new Map();
  const savedSpectrumView = storage.get('spectrum-view', '2d');
  let visualEnabled = storage.get('visual-enabled', true) === true;
  const spectrum = new window.PlayerSpectrum($('#player-spectrum'), audio, { mode: savedSpectrumView });
  function setSpectrumView(mode, persist = true) {
    mode = ['1d', '2d', '3d'].includes(mode) ? mode : '2d';
    spectrum.setMode(mode);
    $('.player').dataset.spectrumView = mode;
    $('#enable-visual').hidden = mode !== '2d';
    $$('.spectrum-switch [data-spectrum-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.spectrumView === mode)));
    if (persist) storage.set('spectrum-view', mode);
  }
  $$('.spectrum-switch [data-spectrum-view]').forEach(button => button.addEventListener('click', () => setSpectrumView(button.dataset.spectrumView)));
  setSpectrumView(savedSpectrumView, false);
  let progressFrame = 0;
  let lastProgressTime = 0;
  let lastPlayerId = null;
  let lastPlaying = null;
  let toastTimeout;
  let rememberedVolume = .8;
  const rowElements = new Map();
  const time = seconds => {
    seconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  };
  const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const word = count => count % 10 === 1 && count % 100 !== 11 ? 'семпл' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'семпла' : 'семплов';

  function toast(message) {
    const element = $('#toast');
    clearTimeout(toastTimeout);
    element.textContent = message;
    element.hidden = false;
    toastTimeout = setTimeout(() => { element.hidden = true; }, 4500);
  }

  const player = new window.SamplePlayer(audio, {
    onChange: updatePlayer,
    onError: toast,

  });
  const visualAudio = new window.SpectralImage(player, spectrum, {
    onError: toast,
    onChange: state => {
      const button = $('#enable-visual');
      button.disabled = !state.available;
      button.textContent = state.busy ? `Cancel · ${state.progress}%` : state.enabled ? 'Disable visual' : 'Enable visual';
      button.setAttribute('aria-pressed', String(state.enabled || state.busy));
      button.setAttribute('aria-busy', String(state.busy));
      button.title = state.busy ? 'Отменить обработку' : state.enabled ? 'Вернуть оригинальный звук' : 'Встроить изображение выбранного звука в его спектрограмму';
      if (state.sample && state.sample.id === player.sample?.id) {
        const download = $('#player-download');
        download.href = state.enabled ? state.result.url : state.sample.original;
        download.download = state.enabled ? `${state.sample.title}-visual.wav` : `${state.sample.title}.mp3`;
        download.title = state.enabled ? 'Скачать звук с изображением (WAV)' : 'Скачать оригинал';
        download.setAttribute('aria-label', download.title);
      }
    },
  });
  $('#enable-visual').addEventListener('click', () => {
    if (!visualAudio.available) return;
    visualEnabled = !(visualAudio.enabled || visualAudio.busy);
    storage.set('visual-enabled', visualEnabled);
    void visualAudio.toggle();
  });

  // Refresh the current waveform and timeline while audio is playing.
  function paintProgress(timestamp = 0) {
    progressFrame = 0;
    if (document.hidden) return;
    if (!timestamp || timestamp - lastProgressTime >= 1000 / 30) {
      lastProgressTime = timestamp;
      // Also refresh progress smoothly; HTML timeupdate can be as slow as 4 Hz.
      if (player.sample) updatePlayer();
    }
    if (!audio.paused && !audio.ended) progressFrame = requestAnimationFrame(paintProgress);
  }
  function syncProgress() {
    cancelAnimationFrame(progressFrame);
    paintProgress();
  }
  ['playing', 'pause', 'ended', 'seeked', 'volumechange'].forEach(event => audio.addEventListener(event, syncProgress));
  document.addEventListener('visibilitychange', () => {
    syncProgress();
  });

  function play(sample, options = {}) {
    if (!sample) { toast('Сначала выбери коллекцию со звуками.'); return; }
    const changed = player.sample?.id !== sample.id;
    visualAudio.select(sample);
    void spectrum.select(sample);
    void player.select(sample, options);
    if (changed && visualEnabled) void visualAudio.toggle();
  }

  function togglePlayback() {
    if (player.sample && !audio.paused) player.pause();
    else play(player.sample || visible[0]);
  }

  function adjacent(direction) {
    if (!visible.length) return;
    const index = visible.findIndex(sample => sample.id === player.sample?.id);
    const next = index < 0 ? (direction > 0 ? 0 : visible.length - 1) : (index + direction + visible.length) % visible.length;
    play(visible[next]);
    rowElements.get(visible[next].id)?.element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }

  function random() {
    const choices = visible.filter(sample => sample.id !== player.sample?.id);
    const sample = choices[Math.floor(Math.random() * choices.length)] || visible[0];
    play(sample);
    rowElements.get(sample?.id)?.element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }

  function createShuffledOrder() {
    const ids = samples.filter(sample => sectionOf(sample) === filter).map(sample => sample.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // Even a coincidentally identical draw must visibly change the current order.
    if (ids.length > 1 && ids.length === visible.length && ids.every((id, index) => id === visible[index].id)) ids.push(ids.shift());
    return new Map(ids.map((id, index) => [id, index]));
  }

  function shuffleCards() {
    if (visible.length < 2) return;
    shuffledOrders.set(filter, createShuffledOrder());
    $('#sort').value = 'shuffle';
    renderList();
  }

  function setSprite(element, sample) {
    // Artwork identity is independent of each section's displayed numbering.
    // Never wrap to the first image when the prepared artwork runs out.
    const artwork = window.SAMPLE_ART;
    const crop = artwork?.cards[sample.artworkNumber - 1];
    if (!crop) return;
    const sheet = artwork.sheets[crop.sheet];
    element.style.setProperty('--sprite-image', `url("${sheet.file}")`);
    element.style.setProperty('--sprite-size', `${sheet.width / crop.size * 100}%`);
    element.style.setProperty('--sprite-x', `${crop.x / (sheet.width - crop.size) * 100}%`);
    element.style.setProperty('--sprite-y', `${crop.y / (sheet.height - crop.size) * 100}%`);
  }

  // Build waveforms once. Filtering reuses nodes and never downloads audio.
  samples.forEach(sample => {
    const row = document.createElement('div');
    row.className = 'sample-row';
    row.dataset.id = sample.id;
    row.setAttribute('role', 'listitem');
    setSprite(row, sample);
    row.innerHTML = `<span class="card-art" aria-hidden="true"><span class="macro-sprite"></span></span>
      <button class="sample-number" data-action="play" aria-label="Воспроизвести ${escapeHTML(sample.title)}"><span class="sample-title">${escapeHTML(sample.title)}</span></button>
      <div class="waveform"><canvas class="waveform-canvas" aria-hidden="true"></canvas><input type="range" min="0" max="1000" value="0" data-action="seek" aria-label="Позиция: ${escapeHTML(sample.title)}" aria-valuetext="0:00 из ${time(sample.duration)}"></div>
      <span class="sample-duration">${time(sample.duration)}</span>
      <a class="icon-button sample-download" href="${escapeHTML(sample.original)}" download="${sample.title}.mp3" aria-label="Скачать ${escapeHTML(sample.title)}" title="Скачать оригинал">${icon('download')}</a>`;
    rowElements.set(sample.id, {
      element: row,
      numberButton: row.querySelector('.sample-number'),
      wave: row.querySelector('.waveform'),
      waveView: new window.Waveform(row.querySelector('.waveform'), sample.peaks),
      seek: row.querySelector('input'),
    });
  });

  function setView(next, persist = true) {
    displayView = views.includes(next) ? next : 'compact';
    $('#sample-list').dataset.view = displayView;
    $('#sound-canvas').dataset.view = displayView;
    $$('.view-switch [data-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.view === displayView));
    });
    visible.forEach(sample => rowElements.get(sample.id).waveView.refresh());
    if (persist) storage.set('view', displayView);
  }
  $$('.view-switch [data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  // ResizeObserver is used when available; this also covers older browsers.
  window.addEventListener('resize', () => visible.forEach(sample => rowElements.get(sample.id).waveView.refresh()));

  function renderList() {
    const query = $('#search').value.trim().replace(/^[#№]\s*/, '');
    visible = samples.filter(sample => {
      const inGroup = sectionOf(sample) === filter;
      return inGroup && (!query || (/^\d+$/.test(query) && sample.number === Number(query)));
    });
    const sort = $('#sort').value;
    if (sort === 'short') visible.sort((a, b) => a.duration - b.duration);
    if (sort === 'long') visible.sort((a, b) => b.duration - a.duration);
    if (sort === 'shuffle') {
      if (!shuffledOrders.has(filter)) shuffledOrders.set(filter, createShuffledOrder());
      const order = shuffledOrders.get(filter);
      visible.sort((a, b) => order.get(a.id) - order.get(b.id));
    }
    $('#sample-list').replaceChildren(...visible.map(sample => rowElements.get(sample.id).element));
    visible.forEach(sample => rowElements.get(sample.id).waveView.refresh());
    $('#result-label').textContent = `${visible.length} ${filter === 'track' ? (visible.length === 1 ? 'трек' : 'треков') : word(visible.length)}${query ? ` по запросу «${$('#search').value.trim()}»` : ''}`;
    $('#sample-count').textContent = visible.length;
    $('#collection-title').textContent = filter;
    $('#sample-list').setAttribute('aria-label', filter === 'track' ? 'Треки' : 'Семплы');
    $('#collection-meta').textContent = filter === 'track' ? 'Больше 30 секунд' : 'До 30 секунд';
    $('#empty-state').hidden = visible.length > 0;
    $('#shuffle-cards').disabled = visible.length < 2;
    $('#empty-title').textContent = 'Ничего не нашлось';
    $('#empty-description').textContent = `Проверь номер или открой раздел ${filter === 'track' ? 'samples' : 'track'}.`;
    $$('[data-filter]').forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function updatePlayer() {
    // Volume restoration can dispatch a queued event before the first render.
    if (!player) return;
    const sample = player.sample;
    const playing = !!sample && !audio.paused && !audio.ended;
    const duration = Number.isFinite(audio.duration) ? audio.duration : sample?.duration || 0;
    const fraction = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
    if (sample?.id !== lastPlayerId) {
      if (lastPlayerId) {
        const previous = rowElements.get(lastPlayerId);
        previous.element.classList.remove('is-current');
        previous.waveView.setActive(false);
        previous.waveView.setProgress(0);
        previous.seek.value = 0;
        previous.seek.setAttribute('aria-valuetext', `0:00 из ${time(byId.get(lastPlayerId).duration)}`);
        previous.numberButton.classList.remove('is-loading');
        previous.numberButton.setAttribute('aria-label', `Воспроизвести ${byId.get(lastPlayerId).title}`);
      }
      lastPlayerId = sample?.id || null;
      lastPlaying = null;
      if (sample) {
        $('#player-title').textContent = sample.title;
        $('#player-download').href = sample.original;
        $('#player-download').download = `${sample.title}.mp3`;
        $('#player-download').title = 'Скачать оригинал';
        $('#player-download').setAttribute('aria-label', 'Скачать оригинал');
        $('#player-download').hidden = false;
        $('#seek').disabled = false;
        playerPanel.classList.add('can-seek');
        rowElements.get(sample.id).element.classList.add('is-current');
        rowElements.get(sample.id).waveView.setActive(true);
        if ('mediaSession' in navigator && 'MediaMetadata' in window) {
          navigator.mediaSession.metadata = new MediaMetadata({title: sample.title, album: `elevenlabs test / ${sectionOf(sample)}`});
        }
      }
    }
    if (playing !== lastPlaying) {
      $('#play-pause use').setAttribute('href', playing ? '#i-pause' : '#i-play');
      $('#play-pause').setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
      document.body.classList.toggle('is-playing', playing);
      if (sample) $('#player-subtitle').textContent = `${sectionOf(sample)} · ${playing ? 'Сейчас играет' : 'На паузе'}`;
      if (sample) {
        const row = rowElements.get(sample.id);
        row.numberButton.setAttribute('aria-label', `${playing ? 'Пауза' : 'Воспроизвести'} ${sample.title}`);
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      lastPlaying = playing;
    }
    $('#current-time').textContent = time(audio.currentTime);
    $('#duration').textContent = time(duration);
    $('#seek').value = Math.round(fraction * 1000);
    $('#seek').style.setProperty('--fill', `${fraction * 100}%`);
    $('#seek').setAttribute('aria-valuetext', `${time(audio.currentTime)} из ${time(duration)}`);
    if (sample) {
      const row = rowElements.get(sample.id);
      row.waveView.setProgress(fraction);
      row.seek.value = Math.round(fraction * 1000);
      row.seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} из ${time(duration)}`);
      row.numberButton.classList.toggle('is-loading', player.loading);
    }
  }

  $('#sample-list').addEventListener('click', event => {
    const row = event.target.closest('.sample-row');
    if (!row) return;
    const target = event.target.closest('[data-action]');
    const sample = byId.get(row.dataset.id);
    if (!target) {
      if (!event.target.closest('a, input, button, .waveform')) play(sample, { toggle: true });
      return;
    }
    if (target.dataset.action === 'play') play(sample, { toggle: true });
  });
  $('#sample-list').addEventListener('input', event => {
    if (event.target.dataset.action !== 'seek') return;
    const sample = byId.get(event.target.closest('.sample-row').dataset.id);
    const fraction = Number(event.target.value) / 1000;
    if (player.sample?.id === sample.id) player.seek(fraction);
    else play(sample, { fraction });
  });
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    $('#search').value = '';
    renderList();
  }));
  $('#search').addEventListener('input', renderList);
  $('#sort').addEventListener('change', () => {
    if ($('#sort').value === 'shuffle' && visible.length > 1) shuffleCards();
    else renderList();
  });
  $('#reset-filters').addEventListener('click', () => { $('#search').value = ''; renderList(); $('#search').focus(); });
  $('#play-pause').addEventListener('click', togglePlayback);
  $('#previous').addEventListener('click', () => adjacent(-1));
  $('#next').addEventListener('click', () => adjacent(1));
  $('#shuffle-cards').addEventListener('click', shuffleCards);
  $('#player-random').addEventListener('click', random);
  $('#seek').addEventListener('input', event => player.seek(Number(event.target.value) / 1000));
  playerPanel.addEventListener('click', event => {
    if (!player.sample || event.button !== 0 || event.defaultPrevented) return;
    if (event.target.closest('button, a, input, select, label, [role="button"], .transport, .player-options, .player-timeline')) return;
    const bounds = playerPanel.getBoundingClientRect();
    if (bounds.width > 0) player.seek((event.clientX - bounds.left) / bounds.width);
  });
  $('#loop').addEventListener('click', () => { audio.loop = !audio.loop; $('#loop').setAttribute('aria-pressed', String(audio.loop)); storage.set('loop', audio.loop); });

  function updateVolume() {
    const volume = audio.muted ? 0 : audio.volume;
    $('#volume').value = volume;
    $('#volume').style.setProperty('--fill', `${volume * 100}%`);
    $('#mute use').setAttribute('href', volume ? '#i-volume' : '#i-muted');
    $('#mute').setAttribute('aria-label', volume ? 'Выключить звук' : 'Включить звук');
  }
  $('#volume').addEventListener('input', event => {
    audio.volume = Number(event.target.value);
    audio.muted = false;
    if (audio.volume > 0) rememberedVolume = audio.volume;
    storage.set('volume', audio.volume);
    updateVolume();
  });
  $('#mute').addEventListener('click', () => {
    if (!audio.volume) { audio.volume = rememberedVolume; audio.muted = false; }
    else audio.muted = !audio.muted;
    updateVolume();
  });
  const savedVolume = Number(storage.get('volume', .8));
  audio.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : .8;
  if (audio.volume > 0) rememberedVolume = audio.volume;
  audio.loop = storage.get('loop', false) === true;
  $('#loop').setAttribute('aria-pressed', String(audio.loop));
  updateVolume();

  const dialog = $('#shortcuts-dialog');
  $('#show-shortcuts').addEventListener('click', () => dialog.showModal());
  $('#close-shortcuts').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const editing = event.target.closest('input, select, textarea, [contenteditable="true"]');
    if (editing) {
      if (event.key === 'Escape' && event.target === $('#search')) { $('#search').value = ''; renderList(); $('#search').blur(); }
      return;
    }
    if (dialog.open) return;
    if (event.key === ' ' && event.target.closest('button, a')) return;
    const handlers = {
      ' ': togglePlayback, ArrowDown: () => adjacent(1), ArrowUp: () => adjacent(-1),
      ArrowLeft: () => player.seek((audio.currentTime - 2) / (audio.duration || 1)),
      ArrowRight: () => player.seek((audio.currentTime + 2) / (audio.duration || 1)),
      '/': () => $('#search').focus(), '?': () => dialog.showModal(),
      r: random,
      v: () => setView(views[(views.indexOf(displayView) + 1) % views.length]),
      l: () => $('#loop').click(), m: () => $('#mute').click(),
    };
    const handler = handlers[event.key] || handlers[event.key.toLowerCase()];
    if (handler) { event.preventDefault(); if (!event.repeat || event.key.startsWith('Arrow')) handler(); }
  });
  if ('mediaSession' in navigator) {
    const actions = {play: () => play(player.sample || visible[0]), pause: () => player.pause(), previoustrack: () => adjacent(-1), nexttrack: () => adjacent(1), seekto: details => player.seek(details.seekTime / (audio.duration || 1))};
    Object.entries(actions).forEach(([name, action]) => { try { navigator.mediaSession.setActionHandler(name, action); } catch { /* Unsupported system-media action. */ } });
  }

  ['track', 'samples'].forEach(section => { $(`[data-count="${section}"]`).textContent = samples.filter(sample => sectionOf(sample) === section).length; });
  setView(displayView, false);
  renderList();
  updatePlayer();
})();
