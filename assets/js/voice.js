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
        resolve();
      };
      const failed = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', failed);
        // A missing or undecodable clip should still make a sound if it can.
        speak(text, rate, lang).then(resolve, reject);
      };

      audio.addEventListener('ended', done);
      audio.addEventListener('error', failed);
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

  return { play, stop, has, get clipCount() { return hasClips ? Object.keys(AUDIO).length : 0; } };
})();
