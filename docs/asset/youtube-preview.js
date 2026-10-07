/* Lazy YouTube adapter. The preview owner controls lifetime and the audio setting. */
(() => {
  let api;
  function loadAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (api) return api;
    api = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('YouTube API timed out')), 12000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { clearTimeout(timer); reject(new Error('YouTube API unavailable')); };
      document.head.append(script);
    });
    return api;
  }

  window.SinStarYouTube = {
    supported: () => /^https?:$/.test(location.protocol),
    async play(container, id, audio, callbacks) {
      const yt = await loadAPI();
      if (!callbacks.current()) return null;
      const mount = document.createElement('div');
      container.replaceChildren(mount);
      let mutedRetry = false;
      return new yt.Player(mount, {
        host: 'https://www.youtube-nocookie.com', width:'100%', height:'100%', videoId:id,
        playerVars: {autoplay:1, playsinline:1, controls:1, rel:0, loop:1,
          playlist:id, mute:audio() ? 0 : 1, origin:location.origin},
        events: {
          onReady(event) {
            if (!callbacks.current()) { event.target.destroy(); return; }
            const frame = event.target.getIframe();
            frame.setAttribute('title', 'YouTube video preview');
            frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            if (audio()) event.target.unMute();
            else event.target.mute();
            event.target.playVideo();
          },
          onStateChange(event) {
            if (callbacks.current() && event.data === yt.PlayerState.PLAYING) callbacks.playing();
          },
          onError(event) {
            if (callbacks.current()) callbacks.error(new Error('YouTube player error ' + event.data));
          },
          onAutoplayBlocked(event) {
            if (!callbacks.current()) return;
            if (!mutedRetry && audio()) {
              mutedRetry = true;
              event.target.mute();
              event.target.playVideo();
            } else {
              // Native player controls remain available for explicit activation.
              callbacks.ready();
              console.info('[Sin Star I] YouTube autoplay needs a click.');
            }
          }
        }
      });
    }
  };
})();
