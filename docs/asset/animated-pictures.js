/* One active preview. Images and navigation work without JavaScript. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const preferences = window.SinStarMedia;
  const items = [];
  let active = null;

  function buttonLabel(item, text) {
    item.button.textContent = text;
    item.button.setAttribute('aria-label', text + ': ' + item.button.dataset.caption);
  }

  function stop(item, message = '') {
    if (!item) return;
    item.generation += 1;
    clearTimeout(item.loadingTimer);
    clearTimeout(item.failureTimer);
    item.host.classList.remove('is-playing', 'is-loading', 'is-youtube');
    buttonLabel(item, 'Play Preview');
    item.button.setAttribute('aria-pressed', 'false');
    item.status.textContent = message;
    item.mode = null;
    item.audioBlocked = false;
    item.provider = null;
    item.youtubePlayer?.destroy();
    item.youtubePlayer = null;
    item.youtubeContainer?.replaceChildren();
    if (item.youtubeButton) item.youtubeButton.textContent = 'YouTube';
    if (active === item) active = null;
    item.video.pause();
    item.video.removeAttribute('src');
    item.video.load();
  }

  function availableYouTube(item) {
    return window.SinStarUploads?.[item.selected || item.id];
  }

  function ready(item) {
    clearTimeout(item.loadingTimer);
    clearTimeout(item.failureTimer);
    item.host.classList.remove('is-loading');
    item.status.textContent = '';
  }

  async function playYouTube(item, generation) {
    const id = availableYouTube(item);
    const bounds = item.host.querySelector('.picture-stage').getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(0, bounds.top));
    const visibleWidth = Math.max(0, Math.min(bounds.right, window.innerWidth) - Math.max(0, bounds.left));
    if (item.mode === 'auto' && visibleHeight * visibleWidth < bounds.height * bounds.width * 0.5) {
      stop(item);
      return;
    }
    if (!id || !window.SinStarYouTube.supported()) {
      if (id) console.info('[Sin Star I] Use Start Website.cmd for embedded YouTube playback.');
      stop(item);
      return;
    }
    ready(item);
    item.provider = 'youtube';
    item.video.pause();
    item.video.removeAttribute('src');
    item.video.load();
    item.host.classList.remove('is-playing');
    item.host.classList.add('is-youtube');
    item.youtubeButton.textContent = 'Stop YouTube';
    const current = () => active === item && generation === item.generation && !document.hidden;
    item.failureTimer = setTimeout(() => {
      if (current()) { console.warn('[Sin Star I] YouTube preview timed out:', id); stop(item); }
    }, 15000);
    try {
      const player = await window.SinStarYouTube.play(item.youtubeContainer, id, () => preferences.audioEnabled, {
        current, ready:() => ready(item), playing:() => ready(item),
        error:error => { console.warn('[Sin Star I]', item.selected || item.id, error.message); stop(item); }
      });
      if (!current()) player?.destroy();
      else item.youtubePlayer = player;
    } catch (error) {
      if (current()) { console.warn('[Sin Star I]', error.message); stop(item); }
    }
  }

  function unavailable(item, generation, error) {
    if (generation !== item.generation || active !== item || item.provider === 'youtube') return;
    console.warn('[Sin Star I] Local preview unavailable:', item.video.dataset.src, error?.message || 'media error');
    item.missing.add(item.video.dataset.src);
    playYouTube(item, generation);
  }

  async function start(item, explicit = false, provider = 'youtube') {
    if (!explicit && reducedMotion.matches) return;
    if (active === item) return;
    stop(active);
    active = item;
    item.mode = explicit ? 'manual' : 'auto';
    item.provider = provider;
    const generation = ++item.generation;
    item.status.textContent = '';
    buttonLabel(item, 'Stop Preview');
    item.button.setAttribute('aria-pressed', 'true');
    if (provider === 'youtube' || item.missing.has(item.video.dataset.src)) {
      await playYouTube(item, generation);
      return;
    }
    item.loadingTimer = setTimeout(() => {
      if (active === item) {
        item.host.classList.add('is-loading');
        item.status.textContent = 'Loading preview…';
      }
    }, 350);
    item.failureTimer = setTimeout(() => {
      if (active === item && !item.host.classList.contains('is-playing')) {
        unavailable(item, generation, new Error('Local preview timed out'));
      }
    }, 12000);
    item.audioBlocked = false;
    item.video.muted = !preferences.audioEnabled;
    item.video.src = item.video.dataset.src;
    try {
      try {
        await item.video.play();
      } catch (error) {
        if (error.name !== 'NotAllowedError' || generation !== item.generation || active !== item) throw error;
        item.video.muted = true;
        item.audioBlocked = preferences.audioEnabled;
        await item.video.play();
      }
      if (generation !== item.generation || active !== item || item.provider !== 'local' || document.hidden) {
        if (active !== item) item.video.pause();
        return;
      }
      clearTimeout(item.loadingTimer);
      clearTimeout(item.failureTimer);
      item.host.classList.remove('is-loading');
      item.host.classList.add('is-playing');
      buttonLabel(item, item.audioBlocked ? 'Play With Sound' : 'Stop Preview');
      item.button.setAttribute('aria-pressed', String(!item.audioBlocked));
      item.status.textContent = item.audioBlocked ? 'Click Play With Sound to enable audio.' : '';
    } catch (error) {
      if (generation === item.generation && active === item) {
        unavailable(item, generation, error);
      }
    }
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      for (const entry of entries) {
      if (!entry.isIntersecting && active?.host === entry.target) stop(active);
      else if (entry.intersectionRatio < 0.5 && active?.host === entry.target && active.provider === 'youtube' && active.mode === 'auto') stop(active);
      }
    }, {threshold: [0, 0.5]}) : null;

  document.querySelectorAll('.animated-picture').forEach(host => {
    const item = {
      host, video: host.querySelector('video'),
      button: host.querySelector('.animation-toggle'),
      status: host.querySelector('.animation-status'), generation: 0, mode: null,
      audioBlocked:false, id:host.dataset.mediaId, missing:new Set(),
      youtubeButton:host.querySelector('.youtube-option'),
      youtubeContainer:host.querySelector('.youtube-preview'),
      youtubeLink:host.querySelector('.youtube-link'),
      choices:[...host.querySelectorAll('[data-clip]')], remember:host.querySelector('.remember-clip')
    };
    items.push(item);
    const updateYouTube = () => {
      const id = availableYouTube(item);
      item.youtubeButton.hidden = !id || !window.SinStarYouTube.supported();
      item.youtubeLink.hidden = !id;
      if (id) item.youtubeLink.href = 'https://youtu.be/' + id;
      host.querySelector('.youtube-options').hidden = !id;
    };
    item.select = (id, play = false) => {
      const choice = item.choices.find(button => button.dataset.clip === id);
      if (!choice) return;
      const wasActive = active === item;
      const explicit = play || item.mode === 'manual';
      if (wasActive) stop(item);
      item.selected = id;
      item.video.dataset.src = choice.dataset.src;
      updateYouTube();
      item.choices.forEach(button => button.setAttribute('aria-pressed', String(button === choice)));
      if (play || wasActive) start(item, explicit);
    };
    if (item.choices.length) {
      const saved = preferences.remembered(item.id);
      const valid = item.choices.some(button => button.dataset.clip === saved);
      item.select(valid ? saved : host.dataset.defaultClip);
      item.remember.checked = valid;
      host.querySelector('.clip-choices').hidden = false;
      const remember = () => {
        preferences.remember(item.id, item.remember.checked ? item.selected : null);
        host.querySelector('.clip-save-status').textContent = item.remember.checked && !preferences.storageAvailable
          ? 'Selection follows view links; browser storage is unavailable.' : '';
      };
      item.choices.forEach(button => button.addEventListener('click', () => {
        item.select(button.dataset.clip, true);
        if (item.remember.checked) remember();
      }));
      item.remember.addEventListener('change', remember);
    }
    updateYouTube();
    item.youtubeButton.addEventListener('click', () => {
      if (active === item && item.provider === 'youtube') stop(item);
      else { stop(active); start(item, true, 'youtube'); }
    });
    item.button.hidden = false;
    host.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') start(item);
    });
    host.addEventListener('pointerleave', () => {
      if (active === item && item.mode === 'auto' && !host.contains(document.activeElement)) stop(item);
    });
    host.addEventListener('focusin', event => {
      // Buttons start only on activation, so a keyboard user can reliably toggle them.
      if (event.target.closest('a')) start(item);
    });
    host.addEventListener('focusout', event => {
      if (active === item && !host.contains(event.relatedTarget) && !host.matches(':hover')) stop(item);
    });
    item.button.addEventListener('click', () => {
      if (active === item && !item.audioBlocked) stop(item);
      else { stop(active); start(item, true); }
    });
    item.video.addEventListener('error', () => {
      if (active === item) unavailable(item, item.generation, item.video.error);
    });
    observer?.observe(host);
  });
  preferences.subscribe(event => {
    if (event.kind === 'choices' || event.kind === 'external') {
      items.filter(item => item.remember && (!event.id || item.id === event.id)).forEach(item => {
        const saved = preferences.remembered(item.id);
        const valid = item.choices.some(button => button.dataset.clip === saved);
        item.remember.checked = valid;
        const selected = valid ? saved : event.kind === 'external' ? item.host.dataset.defaultClip : item.selected;
        if (selected !== item.selected) item.select(selected);
      });
    }
    if (active && (event.kind === 'audio' || event.kind === 'external')) {
      if (active.provider === 'youtube') {
        if (preferences.audioEnabled) active.youtubePlayer?.unMute?.();
        else active.youtubePlayer?.mute?.();
      } else if (preferences.audioEnabled && (active.video.muted || active.audioBlocked)) {
        const item = active;
        const explicit = item.mode === 'manual';
        stop(item);
        start(item, explicit);
      } else if (!preferences.audioEnabled) {
        active.video.muted = true;
        active.audioBlocked = false;
        buttonLabel(active, 'Stop Preview');
        active.button.setAttribute('aria-pressed', 'true');
        active.status.textContent = '';
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') stop(active);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(active);
  });
  window.addEventListener('pagehide', () => stop(active));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && active?.mode === 'auto') stop(active);
  });
})();
