/**
 * Audio playback.
 *
 * Every spoken string in the deck ships as an MP3 -- Korean read by Google
 * Translate's voice, English glosses by Piper -- so playback does not depend on
 * the viewer having either voice installed. The Web Speech API is kept only as a
 * fallback for text that has no clip, which in practice means nothing unless
 * data.js gains an entry before the audio is rebuilt.
 */
const Voice = (() => {
  'use strict';

  const hasClips = typeof AUDIO === 'object' && AUDIO !== null;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  let element = null;
  let token = 0;

  function clipUrl(text) {
    if (!hasClips) return null;
    const file = AUDIO[text];
    if (!file) return null;
    return file.startsWith('data:') ? file : AUDIO_BASE + file;
  }

  function player() {
    if (!element) {
      element = new Audio();
      element.preload = 'auto';
    }
    return element;
  }

  /** True when `text` has a bundled clip, i.e. playback is guaranteed. */
  function has(text) {
    return Boolean(clipUrl(text));
  }

  /**
   * Plays a bundled clip. `rate` below 1 slows playback without shifting pitch.
   * `lang` only matters to the synthesiser fallback, which needs to know which
   * voice to reach for -- the deck speaks English glosses as well as Korean.
   * Resolves when playback finishes, rejects only if no audio could be produced.
   */
  function play(text, { rate = 1, lang = 'ko-KR' } = {}) {
    const url = clipUrl(text);
    if (!url) return speak(text, rate, lang);

    stop();
    const audio = player();
    const mine = ++token;

    return new Promise((resolve, reject) => {
      const done = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', failed);
        releaseWarm();
        resolve();
      };
      const failed = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', failed);
        releaseWarm();
        // A missing or undecodable clip should still make a sound if it can.
        speak(text, rate, lang).then(resolve, reject);
      };

      audio.addEventListener('ended', done);
      audio.addEventListener('error', failed);
      holdWarm();
      audio.addEventListener('canplaythrough', releaseWarm, { once: true });
      audio.src = url;
      audio.playbackRate = rate;
      // Non-standard spellings are still needed by older WebKit and Firefox.
      audio.preservesPitch = true;
      audio.mozPreservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.currentTime = 0;

      const started = audio.play();
      if (started && typeof started.catch === 'function') {
        started.catch((error) => {
          if (mine !== token) return resolve();
          // Autoplay policy or a decode failure — try the synthesiser.
          speak(text, rate, lang).then(resolve, () => reject(error));
        });
      }
    });
  }

  function speak(text, rate, lang = 'ko-KR') {
    if (!canSpeak) return Promise.reject(new Error('no-audio'));
    window.speechSynthesis.cancel();
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = Math.max(0.4, rate * 0.9);
      const family = new RegExp(`^${lang.slice(0, 2)}(-|_|$)`, 'i');
      const match = (window.speechSynthesis.getVoices() || [])
        .find((v) => family.test(v.lang || ''));
      if (match) utterance.voice = match;
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') resolve();
        else reject(new Error(event.error || 'speech-failed'));
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  function stop() {
    token += 1;
    releaseWarm();
    if (element) {
      element.pause();
      try {
        element.currentTime = 0;
      } catch {
        /* Not seekable yet; pausing is enough. */
      }
    }
    if (canSpeak) window.speechSynthesis.cancel();
  }

  if (typeof window !== 'undefined') window.addEventListener('beforeunload', stop);

  /**
   * The clip URLs to warm: one per distinct file, skipping inline data. Keys listed in
   * `order` come first, in that order, so the words on screen load before the rest.
   */
  function clipUrlsToWarm(table, base, order = []) {
    const keys = [
      ...order.filter((key) => key in table),
      ...Object.keys(table).filter((key) => !order.includes(key)),
    ];
    const seen = new Set();
    const urls = [];
    for (const key of keys) {
      const file = table[key];
      if (typeof file !== 'string' || file.startsWith('data:') || seen.has(file)) continue;
      seen.add(file);
      urls.push(base + file);
    }
    return urls;
  }

  /** True when the viewer asked for less data or has a very slow connection. */
  function prefersLessData() {
    const connection = typeof navigator !== 'undefined' ? navigator.connection : undefined;
    if (!connection) return false;
    return Boolean(connection.saveData) || /2g/.test(connection.effectiveType || '');
  }

  /** Strings in the order the deck shows them, so the first card's clips load first. */
  function displayOrder() {
    if (typeof WORDS === 'undefined') return [];
    return WORDS.flatMap((word) => [word.ko, word.example && word.example.ko, word.en]);
  }

  // Background warm-up of the clips. A play press holds it so the pressed clip loads first.
  const warm = { urls: [], next: 0, held: false, queued: false };
  const idle = typeof requestIdleCallback === 'function'
    ? (cb) => requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => setTimeout(cb, 300);

  function warmStep() {
    warm.queued = false;
    if (warm.held) return;
    const end = Math.min(warm.next + 20, warm.urls.length);
    for (; warm.next < end; warm.next++) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'audio';
      link.href = warm.urls[warm.next];
      link.dataset.warm = '1';
      document.head.appendChild(link);
    }
    if (warm.next < warm.urls.length) scheduleWarm();
  }

  function scheduleWarm() {
    if (warm.queued || warm.held) return;
    warm.queued = true;
    idle(warmStep);
  }

  /**
   * Stops adding new batches while the clip the user pressed is loading. Links already
   * added stay, so no clip is skipped. At most one batch is queued at a time.
   */
  function holdWarm() {
    warm.held = true;
  }

  /** Lets the warm-up continue once the pressed clip is done loading or has ended. */
  function releaseWarm() {
    warm.held = false;
    scheduleWarm();
  }

  function warmClips() {
    if (!hasClips || prefersLessData()) return;
    warm.urls = clipUrlsToWarm(AUDIO, AUDIO_BASE, displayOrder());
    if (document.readyState === 'complete') scheduleWarm();
    else window.addEventListener('load', scheduleWarm, { once: true });
  }
  warmClips();

  return { play, stop, has, clipUrlsToWarm, get clipCount() { return hasClips ? Object.keys(AUDIO).length : 0; } };
})();
