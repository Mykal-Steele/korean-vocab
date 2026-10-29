/**
 * Application controller: routing, the deck, the study sheet, the practice
 * drill and persisted preferences.
 */
(() => {
  'use strict';

  const STORE_KEY = 'hangul-deck.v2';
  const PAGES = ['deck', 'practice'];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const ICONS = {
    say: '<path d="M3.5 6h2.6L10 2.8v10.4L6.1 10H3.5A.5.5 0 0 1 3 9.5v-3a.5.5 0 0 1 .5-.5Z"/><path d="M12.4 5.6a3.4 3.4 0 0 1 0 4.8"/>',
    strokes: '<path d="M2.5 13.5 5 13l7.6-7.6a1.4 1.4 0 0 0-2-2L3 11l-.5 2.5Z"/><path d="M9.8 3.6 12.4 6.2"/>',
    learn: '<path d="m3 8.4 3.4 3.4L13 5.2"/>'
  };

  const state = {
    page: 'deck',
    query: '',
    filter: 'all',
    theme: 'dark',
    speed: 1,
    showNumbers: true,
    showGhost: true,
    showGrid: true,
    studyGuide: true,
    learned: new Set(),
    visible: [],
    current: -1
  };

  let player = null;
  let studyPads = [];
  let drillPads = [];
  let toastTimer = null;

  /* ------------------------------------------------------------ storage */
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (Array.isArray(saved.learned)) state.learned = new Set(saved.learned);
      if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
      if (typeof saved.speed === 'number') state.speed = saved.speed;
      ['showNumbers', 'showGhost', 'showGrid', 'studyGuide'].forEach((key) => {
        if (typeof saved[key] === 'boolean') state[key] = saved[key];
      });
    } catch {
      /* First run, private mode, or a corrupted value — defaults are fine. */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        learned: [...state.learned],
        theme: state.theme,
        speed: state.speed,
        showNumbers: state.showNumbers,
        showGhost: state.showGhost,
        showGrid: state.showGrid,
        studyGuide: state.studyGuide
      }));
    } catch {
      /* Storage unavailable — the session works, it just will not persist. */
    }
  }

  /* -------------------------------------------------------------- toast */
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function say(text, options) {
    Voice.play(text, options).catch(() => toast('Audio could not play. Check that this device is not muted.'));
  }

  /* -------------------------------------------------------------- theme */
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    const dark = state.theme === 'dark';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    $('#theme-label').textContent = dark ? 'Dark' : 'Light';
    $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121110' : '#f7f6f3');
    // Canvases paint with resolved colours, so they need repainting on a swap.
    [...studyPads, ...drillPads].forEach((pad) => pad.refresh());
  }

  /* ------------------------------------------------------------ routing */
  function readHash() {
    const name = (location.hash || '').replace(/^#\/?/, '');
    return PAGES.includes(name) ? name : 'deck';
  }

  function showPage(name) {
    state.page = name;
    PAGES.forEach((page) => { $(`#page-${page}`).hidden = page !== name; });
    $$('.tab').forEach((tab) => {
      const on = tab.dataset.page === name;
      tab.classList.toggle('is-current', on);
      if (on) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    document.title = name === 'practice' ? 'Practice · Hangul Study Deck' : 'Hangul Study Deck';
    if (name !== 'practice') Voice.stop();
  }

  /* --------------------------------------------------------------- deck */
  const categoryOf = (id) => CATEGORIES.find((c) => c.id === id);

  function matches(word) {
    if (state.filter === 'learned' && !state.learned.has(word.ko)) return false;
    if (state.filter !== 'all' && state.filter !== 'learned' && word.category !== state.filter) return false;
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    return [word.ko, word.rom, word.en, word.th, word.say || '', ...word.syl, ...word.accept]
      .join(' ').toLowerCase().includes(q);
  }

  const icon = (name, label) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg><span class="visually-hidden">${label}</span>`;

  function cardMarkup(word, index) {
    const cat = categoryOf(word.category);
    const learned = state.learned.has(word.ko);
    const say = word.say ? ` <span class="say">[${word.say}]</span>` : '';
    return `
      <article class="card${learned ? ' is-learned' : ''}" data-index="${index}">
        <div class="card__top">
          <h3 class="card__hangul" lang="ko"><button type="button" class="card__open"
            aria-label="Study ${word.ko}, ${word.en}">${word.ko}</button></h3>
        </div>
        <p class="card__rom">${word.rom}${say}</p>
        <p class="card__en">${word.en}</p>
        <p class="card__th" lang="th">${word.th}</p>
        <div class="card__foot">
          <span class="card__tag">${learned ? 'Learned' : `${cat.ko} · ${cat.en}`}</span>
          <div class="card__tools">
            <button type="button" class="iconbtn" data-act="say" data-index="${index}">${icon('say', `Say ${word.ko}`)}</button>
            <button type="button" class="iconbtn" data-act="strokes" data-index="${index}">${icon('strokes', `Stroke order for ${word.ko}`)}</button>
            <button type="button" class="iconbtn" data-act="learn" data-index="${index}"
              aria-pressed="${learned}">${icon('learn', `Mark ${word.ko} as learned`)}</button>
          </div>
        </div>
      </article>`;
  }

  function renderDeck(refocus) {
    state.visible = WORDS.map((w, i) => ({ w, i })).filter(({ w }) => matches(w));

    $('#deck').innerHTML = CATEGORIES.map((cat) => {
      const items = state.visible.filter(({ w }) => w.category === cat.id);
      if (!items.length) return '';
      return `
        <section class="set" aria-labelledby="set-${cat.id}">
          <div class="set__head">
            <h2 class="set__ko" id="set-${cat.id}" lang="ko">${cat.ko}</h2>
            <p class="set__en">${cat.en} <span lang="th">&middot; ${cat.th}</span></p>
            <p class="set__count">${items.length} ${items.length === 1 ? 'word' : 'words'}</p>
          </div>
          <div class="grid">${items.map(({ w, i }) => cardMarkup(w, i)).join('')}</div>
        </section>`;
    }).join('');

    $('#empty').hidden = state.visible.length > 0;
    renderProgress();
    if (refocus) $(refocus)?.focus();
  }

  function renderProgress() {
    const total = WORDS.length;
    const done = WORDS.filter((w) => state.learned.has(w.ko)).length;
    $('#progress-fill').style.width = `${(done / total) * 100}%`;
    $('#progress-text').textContent = `${done} of ${total} marked learned`;
  }

  function toggleLearned(index) {
    const word = WORDS[index];
    if (state.learned.has(word.ko)) state.learned.delete(word.ko);
    else state.learned.add(word.ko);
    const fromCard = document.activeElement?.closest?.('.card');
    save();
    renderDeck(fromCard ? `.card[data-index="${index}"] .iconbtn[data-act="learn"]` : null);
    if ($('#study').open && state.current === index) syncLearnButton();
  }

  /* ----------------------------------------------------------- pad host */
  /**
   * Builds one handwriting pad per syllable inside `host`.
   *
   * `captions` labels each pad with its romanized syllable. That label is the
   * answer wherever Hangul is what the question is after, so those modes build
   * the pads unlabelled and fill the captions in once the question is settled.
   */
  function buildPads(host, word, { guide, captions = true }) {
    host.textContent = '';
    const cells = Hangul.syllablesOf(word.ko).map((char, i) => {
      const cell = document.createElement('div');
      cell.className = 'pad';
      const caption = document.createElement('p');
      caption.className = 'pad__caption';
      caption.textContent = captions ? (word.syl[i] || char) : '';

      const surface = document.createElement('div');
      surface.className = 'pad__surface';
      cell.append(surface, caption);
      host.append(cell);
      return { surface, char };
    });

    // Every pad has to be in the container before any of them measures itself.
    // Attaching as we went sized each canvas against the pads that existed at
    // the time, so the first one measured a container it had all to itself and
    // kept that width -- clipped by the surface, and drawing on the wrong scale.
    return cells.map(({ surface, char }) => Draw.createPad(surface, { char, guide }));
  }

  function disposePads(pads) {
    pads.forEach((pad) => pad.destroy());
    return [];
  }

  /* -------------------------------------------------------- study sheet */
  function buildSyllables(word) {
    const host = $('#syllables');
    host.textContent = '';

    Hangul.syllablesOf(word.ko).forEach((char, i) => {
      const parts = Writer.renderSyllable(char, i);
      applyGlyphOptions(parts.svg);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'syl__btn';
      button.dataset.char = char;
      button.setAttribute('aria-label', `Say ${char}`);
      button.append(parts.svg);

      const caption = document.createElement('p');
      caption.className = 'syl__rom';
      caption.textContent = word.syl[i] || Hangul.spell(char);

      const cell = document.createElement('div');
      cell.className = 'syl';
      cell.append(button, caption);
      host.append(cell);

      Writer.renderMarks(parts);
    });

    return $$('#syllables .stroke');
  }

  function applyGlyphOptions(svg) {
    svg.classList.toggle('no-marks', !state.showNumbers);
    svg.classList.toggle('no-ghost', !state.showGhost);
    svg.classList.toggle('no-grid', !state.showGrid);
  }

  function openStudy(index, { autoplay = false } = {}) {
    const dialog = $('#study');
    state.current = ((index % WORDS.length) + WORDS.length) % WORDS.length;
    if (!dialog.open) dialog.showModal();
    renderStudy({ autoplay });
  }

  function renderStudy({ autoplay = false } = {}) {
    const word = WORDS[state.current];
    const cat = categoryOf(word.category);

    $('#study-category').textContent = `${cat.ko} · ${cat.en}`;
    $('#study-word').textContent = word.ko;
    $('#study-rom').textContent = word.rom;
    $('#study-say').textContent = word.say ? `pronounced [${word.say}]` : '';
    $('#study-en').textContent = word.en;
    $('#study-th').textContent = word.th;
    $('#study-jamo').textContent = Hangul.syllablesOf(word.ko).map(Hangul.spell).join('   /   ');
    $('#example-ko').textContent = word.example.ko;
    $('#example-en').textContent = word.example.en;

    player?.destroy();
    const paths = buildSyllables(word);
    player = Writer.createPlayer(paths, {
      onStep: (i, total) => {
        const status = $('#stroke-status');
        const playing = Boolean(player && player.playing);
        if (!total) status.textContent = '';
        else if (playing) status.textContent = `Drawing stroke ${Math.min(i + 1, total)} of ${total}`;
        else if (i <= 0) status.textContent = `${total} strokes`;
        else if (i >= total) status.textContent = `${total} of ${total} strokes · complete`;
        else status.textContent = `${i} of ${total} strokes drawn`;
        $('#anim-play').textContent = playing ? 'Pause' : 'Play strokes';
      },
      onEnd: () => { $('#anim-play').textContent = 'Play strokes'; }
    });
    player.setSpeed(state.speed);
    player.reset();
    $('#stroke-status').textContent = `${player.total} strokes`;

    studyPads = disposePads(studyPads);
    studyPads = buildPads($('#study-pads'), word, { guide: state.studyGuide });
    $('#study-guide').checked = state.studyGuide;

    syncLearnButton();
    if (autoplay) player.play();
  }

  function syncLearnButton() {
    const learned = state.learned.has(WORDS[state.current].ko);
    const button = $('#study-learn');
    button.setAttribute('aria-pressed', String(learned));
    button.textContent = learned ? 'Learned' : 'Mark as learned';
  }

  /* ------------------------------------------------------------- drill */
  // 'toMeaning' and 'toKorean' show the word and take a typed answer. The two
  // listening modes show nothing and play instead -- 'listening' the Korean
  // word, 'listeningEn' the English gloss -- and both are answered in Hangul.
  // 'matching' is a different shape of question altogether and lives in its own
  // panel further down.
  const drill = {
    mode: 'toMeaning',
    order: [],
    at: 0,
    score: 0,
    missed: [],
    answered: false,
    composer: null,
    shift: false
  };

  function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Loose comparison: case, spacing, articles and punctuation are ignored. */
  function normalise(value) {
    return value
      .toLowerCase()
      .normalize('NFC')
      .replace(/[.,!?'"()’]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(the|a|an)\s+/, '')
      .trim();
  }

  function acceptedAnswers(word) {
    if (drill.mode === 'toMeaning') {
      // A gloss like 'Copier / Photocopier' offers two answers, but it is also
      // what the card prints, so the whole string has to count as well.
      const fromGloss = word.en.split('/').map((part) => part.trim());
      return [word.en, ...fromGloss, ...word.accept].map(normalise).filter(Boolean);
    }
    // Hangul is the real answer; romanization is accepted so the drill still
    // works for anyone without a Korean keyboard.
    return [
      word.ko,
      word.rom,
      word.rom.replace(/\s+/g, ''),
      word.syl.join(' '),
      word.syl.join('-'),
      ...(word.say ? [word.say] : [])
    ].map(normalise).filter(Boolean);
  }

  function isCorrect(word, typed) {
    const given = normalise(typed);
    if (!given) return false;
    return acceptedAnswers(word).includes(given);
  }

  /** Reads the setup panel and hands off to whichever mode was chosen. */
  function startPractice() {
    clearTimeout(match.timer);
    const mode = $('input[name="drill-mode"]:checked').value;
    // Any number of sets can be ticked; the words are pooled and then shuffled
    // together, so a mixed selection is not asked set by set.
    const sets = new Set(selectedSets());
    const pool = WORDS.filter((word) => sets.has(word.category));
    if (!pool.length) return;

    $('#practice-setup').hidden = true;
    $('#practice-result').hidden = true;
    $('#practice-run').hidden = true;
    $('#practice-match').hidden = true;

    if (mode === 'matching') startMatch(pool);
    else startDrill(mode, pool);
  }

  function startDrill(mode, pool) {
    drill.mode = mode;
    drill.order = shuffle(pool);
    drill.at = 0;
    drill.score = 0;
    drill.missed = [];

    $('#practice-run').hidden = false;
    renderQuestion();
  }

  /** What the question's sound button plays, and in which voice. */
  function promptAudio(word) {
    return drill.mode === 'listeningEn'
      ? { text: word.en, options: { lang: 'en-US' } }
      : { text: word.ko, options: undefined };
  }

  function renderQuestion() {
    const word = drill.order[drill.at];
    const listening = drill.mode === 'listening' || drill.mode === 'listeningEn';
    // Both listening modes are answered in Hangul, so they share the composer,
    // the on-screen keyboard and the accepted-answer rules with toKorean.
    const inKorean = listening || drill.mode === 'toKorean';
    const input = $('#drill-answer');

    drill.answered = false;
    $('#drill-verdict').hidden = true;
    $('#drill-form').hidden = false;
    $('#drill-count').textContent = `Word ${drill.at + 1} of ${drill.order.length} · ${drill.score} correct`;
    $('#drill-fill').style.width = `${(drill.at / drill.order.length) * 100}%`;

    if (drill.mode === 'listeningEn') $('#drill-label').textContent = 'Listen, then write the Korean';
    else if (listening) $('#drill-label').textContent = 'Listen, then write what you heard';
    else $('#drill-label').textContent = inKorean ? 'Write this in Korean' : 'What does this mean?';

    // Nothing is written on screen in listening mode: the sound is the question.
    const prompt = $('#drill-prompt');
    prompt.hidden = listening;
    prompt.textContent = inKorean ? word.en : word.ko;
    prompt.lang = inKorean ? 'en' : 'ko';
    prompt.classList.toggle('is-ko', !inKorean);

    $('#drill-answer-label').textContent = inKorean ? 'Your answer in Hangul' : 'The meaning in English';
    if (drill.mode === 'listeningEn') {
      $('#drill-hint').textContent =
        'The meaning is read out in English. Play it as often as you like, then write the word in Hangul.';
    } else if (listening) {
      $('#drill-hint').textContent =
        'Play it as many times as you like. Type with the Korean layout, the keys below, or write the romanization.';
    } else {
      $('#drill-hint').textContent = inKorean
        ? 'Type with your own keyboard using the Korean layout, use the keys below, or write the romanization.'
        : 'Spelling is forgiving — “usa” and “United States” both count.';
    }
    input.lang = inKorean ? 'ko' : 'en';
    input.value = '';
    input.placeholder = inKorean ? '한국어' : 'English meaning';
    input.disabled = false;
    $('#drill-check').disabled = false;

    drill.composer = inKorean ? HangulInput.createComposer() : null;
    $('#drill-keyboard').hidden = !inKorean;

    const listen = $('#drill-listen');
    listen.className = listening ? 'btn btn--primary btn--audio btn--listen' : 'btn btn--ghost btn--audio';
    listen.querySelector('.btn__label').textContent = listening
      ? 'Play again'
      : (inKorean ? 'Play the sound (gives it away)' : 'Play the sound');

    drillPads = disposePads(drillPads);
    // Wherever Hangul is the answer the shape would give it away, so the guide
    // stays off until the question has been settled.
    const guide = !inKorean;
    drillPads = buildPads($('#drill-pads'), word, { guide, captions: guide });
    $('#drill-guide').checked = guide;
    $('#drill-guide').disabled = inKorean;
    $('#drill-pads-note').textContent = inKorean
      ? 'Blank until you answer — write from memory.'
      : 'Trace the word while you think.';

    input.focus();
    // The one place the deck speaks unprompted: in the listening modes the sound
    // is the question, so withholding it would leave nothing to answer.
    if (listening) {
      const cue = promptAudio(word);
      say(cue.text, cue.options);
    }
  }

  function settle(word, correct, { revealed = false } = {}) {
    drill.answered = true;
    $('#drill-form').hidden = true;
    $('#drill-verdict').hidden = false;

    const line = $('#verdict-line');
    if (revealed) {
      line.textContent = 'Answer shown — no point scored.';
      line.className = 'verdict__line is-neutral';
      drill.missed.push(word);
    } else if (correct) {
      drill.score += 1;
      line.textContent = 'Correct.';
      line.className = 'verdict__line is-correct';
    } else {
      drill.missed.push(word);
      line.textContent = 'Not quite.';
      line.className = 'verdict__line is-wrong';
    }

    $('#verdict-facts').innerHTML = `
      <div><dt>Korean</dt><dd lang="ko" class="verdict__ko">${word.ko}
        <button type="button" class="iconbtn" data-review="${word.ko}"
          aria-label="Say ${word.ko}">${icon('say', `Say ${word.ko}`)}</button></dd></div>
      <div><dt>Romanization</dt><dd class="mono">${word.rom}${word.say ? ` · [${word.say}]` : ''}</dd></div>
      <div><dt>English</dt><dd>${word.en}</dd></div>
      <div><dt>ภาษาไทย</dt><dd lang="th">${word.th}</dd></div>`;

    $('#drill-guide').disabled = false;
    $('#drill-guide').checked = true;
    drillPads.forEach((pad) => pad.setGuide(true));
    const syllables = Hangul.syllablesOf(word.ko);
    $$('#drill-pads .pad__caption').forEach((caption, i) => {
      caption.textContent = word.syl[i] || syllables[i];
    });
    $('#drill-pads-note').textContent = 'Now trace it — the shape is shown.';

    // Check and Show answer both land here, so whichever button settled the
    // question, the word is spoken. This is not the autoplay the written drills
    // avoid: the answer is on screen by now, so there is nothing left for the
    // ear to give away, and hearing it is the point at which it sticks.
    say(word.ko);

    $('#drill-next').textContent = drill.at + 1 >= drill.order.length ? 'See results' : 'Next word';
    $('#drill-next').focus();
  }

  function nextQuestion() {
    drill.at += 1;
    if (drill.at >= drill.order.length) return finishDrill();
    renderQuestion();
  }

  /** The end screen, shared by every mode. */
  function showResult(score, total, missed, cleanLine) {
    $('#practice-result').hidden = false;
    $('#result-score').textContent = `${score} / ${total}`;
    $('#result-sub').textContent = missed.length ? 'Words to go over again:' : cleanLine;
    $('#result-review').innerHTML = missed.map((word) => `
      <li class="review__item">
        <span class="review__ko" lang="ko">${word.ko}</span>
        <span class="review__rom mono">${word.rom}</span>
        <span class="review__en">${word.en}</span>
        <button type="button" class="iconbtn" data-review="${word.ko}"
          aria-label="Say ${word.ko}">${icon('say', `Say ${word.ko}`)}</button>
      </li>`).join('');

    // The run is over and this panel replaced the one that had focus, so focus
    // moves here. It also means Enter starts the next run with no key handling
    // of our own -- a focused button is activated by Enter natively.
    $('#drill-again').focus();
  }

  function finishDrill() {
    drillPads = disposePads(drillPads);
    $('#practice-run').hidden = true;
    showResult(drill.score, drill.order.length, drill.missed,
      'Every word correct. Nothing left to review.');
  }

  function endDrill() {
    clearTimeout(match.timer);
    match.busy = false;
    drillPads = disposePads(drillPads);
    Voice.stop();
    $('#practice-run').hidden = true;
    $('#practice-match').hidden = true;
    $('#practice-result').hidden = true;
    $('#practice-setup').hidden = false;
  }

  /* ----------------------------------------------------- matching board */
  // No typing here: a handful of meanings on the left, the same words in
  // Korean on the right, and you pair them up. The chosen set is worked
  // through one board at a time rather than all at once, which keeps the
  // columns readable on a phone and gives the round a rhythm.
  const match = {
    boards: [],
    pool: [],
    at: 0,
    total: 0,
    paired: 0,
    done: 0,
    slipped: new Set(),
    picked: { en: null, ko: null },
    busy: false,
    timer: null
  };

  /** Splits a pool into boards of at most `max` pairs, as evenly as it divides. */
  function buildBoards(pool, max = 4) {
    const words = shuffle(pool);
    const count = Math.max(1, Math.ceil(words.length / max));
    const boards = [];
    let at = 0;
    for (let i = 0; i < count; i += 1) {
      const size = Math.round((words.length - at) / (count - i));
      boards.push(words.slice(at, at + size));
      at += size;
    }
    return boards;
  }

  function tileMarkup(word, pair, side) {
    const ko = side === 'ko';
    return `<button type="button" class="tile${ko ? ' tile--ko' : ''}" data-side="${side}"
      data-pair="${pair}" data-word="${word.ko}"${ko ? ' lang="ko"' : ''} aria-pressed="false">
      <span class="tile__text">${ko ? word.ko : word.en}</span>
      ${ko ? `<svg class="tile__icon" viewBox="0 0 16 16" aria-hidden="true">${ICONS.say}</svg>` : ''}
    </button>`;
  }

  function renderBoard() {
    const board = match.boards[match.at];
    const slots = board.map((word, i) => i);
    const left = shuffle(slots);
    let right = shuffle(slots);
    // Columns in the same order would give the whole board away by position.
    for (let n = 0; n < 8 && board.length > 1 && right.every((v, i) => v === left[i]); n += 1) {
      right = shuffle(slots);
    }

    match.picked = { en: null, ko: null };
    match.done = 0;
    match.busy = false;

    $('#match-col-en').innerHTML = left.map((i) => tileMarkup(board[i], i, 'en')).join('');
    $('#match-col-ko').innerHTML = right.map((i) => tileMarkup(board[i], i, 'ko')).join('');
    renderMatchMeter();
  }

  function renderMatchMeter() {
    $('#match-fill').style.width = `${(match.paired / match.total) * 100}%`;
    $('#match-count').textContent =
      `Board ${match.at + 1} of ${match.boards.length} · ${match.paired} of ${match.total} pairs matched`;
  }

  function startMatch(pool) {
    match.pool = pool;
    match.boards = buildBoards(pool);
    match.at = 0;
    match.total = pool.length;
    match.paired = 0;
    match.slipped = new Set();
    $('#match-status').textContent = '';
    $('#practice-match').hidden = false;
    renderBoard();
  }

  function setPicked(tile, on) {
    tile.classList.toggle('is-picked', on);
    tile.setAttribute('aria-pressed', String(on));
  }

  function pickTile(tile) {
    const side = tile.dataset.side;
    const previous = match.picked[side];
    if (previous) setPicked(previous, false);
    if (previous === tile) {
      match.picked[side] = null;
      return;
    }
    match.picked[side] = tile;
    setPicked(tile, true);
    if (match.picked.en && match.picked.ko) resolvePair();
  }

  function resolvePair() {
    const { en, ko } = match.picked;
    match.picked = { en: null, ko: null };

    if (en.dataset.pair === ko.dataset.pair) {
      [en, ko].forEach((tile) => {
        setPicked(tile, false);
        tile.classList.add('is-matched');
        tile.disabled = true;
      });
      match.done += 1;
      match.paired += 1;
      renderMatchMeter();
      $('#match-status').textContent = `Matched: ${ko.dataset.word}, ${en.textContent.trim()}.`;
      if (match.done === match.boards[match.at].length) {
        match.busy = true;
        match.timer = setTimeout(nextBoard, 520);
      }
      return;
    }

    // A wrong pair says something about both words, so both go on the review list.
    match.slipped.add(en.dataset.word);
    match.slipped.add(ko.dataset.word);
    match.busy = true;
    $('#match-status').textContent = 'Not a pair.';
    [en, ko].forEach((tile) => tile.classList.add('is-wrong'));
    match.timer = setTimeout(() => {
      [en, ko].forEach((tile) => {
        tile.classList.remove('is-wrong');
        setPicked(tile, false);
      });
      match.busy = false;
    }, 620);
  }

  function nextBoard() {
    match.at += 1;
    if (match.at >= match.boards.length) return finishMatch();
    renderBoard();
  }

  function finishMatch() {
    const missed = match.pool.filter((word) => match.slipped.has(word.ko));
    $('#practice-match').hidden = true;
    showResult(match.total - missed.length, match.total, missed,
      'Every pair found first time.');
  }

  /* ------------------------------------------------- on-screen keyboard */
  function renderKeyboard() {
    const host = $('#keyboard-rows');
    const rows = drill.shift ? HangulInput.SHIFT_ROWS : HangulInput.ROWS;
    host.innerHTML = rows.map((row, i) => `
      <div class="keyboard__row">
        ${i === 2 ? `<button type="button" class="key key--wide${drill.shift ? ' is-on' : ''}"
            data-key-action="shift" aria-pressed="${drill.shift}">Shift</button>` : ''}
        ${row.map((jamo) => `<button type="button" class="key" data-jamo="${jamo}" lang="ko">${jamo}</button>`).join('')}
        ${i === 2 ? '<button type="button" class="key key--wide" data-key-action="backspace" aria-label="Backspace">&#9003;</button>' : ''}
      </div>`).join('') + `
      <div class="keyboard__row">
        <button type="button" class="key key--space" data-key-action="space">space</button>
        <button type="button" class="key key--wide" data-key-action="clear">Clear</button>
      </div>`;
  }

  function applyComposer(value) {
    const input = $('#drill-answer');
    input.value = value;
    input.focus();
  }

  /* ------------------------------------------------------------- events */
  function bindDeck() {
    $('#deck').addEventListener('click', (event) => {
      const tool = event.target.closest('.iconbtn');
      if (tool) {
        const index = Number(tool.dataset.index);
        if (tool.dataset.act === 'say') say(WORDS[index].ko);
        else if (tool.dataset.act === 'strokes') openStudy(index, { autoplay: true });
        else if (tool.dataset.act === 'learn') toggleLearned(index);
        return;
      }
      const open = event.target.closest('.card__open');
      if (open) openStudy(Number(open.closest('.card').dataset.index));
    });

    $('#search').addEventListener('input', (event) => {
      state.query = event.target.value;
      renderDeck();
    });

    $$('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.filter = chip.dataset.filter;
        $$('.chip').forEach((c) => {
          const on = c === chip;
          c.classList.toggle('is-selected', on);
          c.setAttribute('aria-pressed', String(on));
        });
        renderDeck();
      });
    });

    $('#progress-reset').addEventListener('click', () => {
      state.learned.clear();
      save();
      renderDeck();
      toast('Progress cleared.');
    });
  }

  function bindStudy() {
    $('#anim-play').addEventListener('click', () => {
      if (!player) return;
      if (player.playing) player.pause(); else player.play();
      $('#anim-play').textContent = player.playing ? 'Pause' : 'Play strokes';
    });
    $('#anim-reset').addEventListener('click', () => player?.reset());
    $('#anim-all').addEventListener('click', () => player?.showAll());
    $('#anim-prev').addEventListener('click', () => player?.step(-1));
    $('#anim-next').addEventListener('click', () => player?.step(1));

    $('#anim-speed').addEventListener('input', (event) => {
      state.speed = Number(event.target.value);
      $('#anim-speed-out').textContent = `${state.speed.toFixed(1)}×`;
      player?.setSpeed(state.speed);
      save();
    });

    [['#toggle-numbers', 'showNumbers'], ['#toggle-ghost', 'showGhost'], ['#toggle-grid', 'showGrid']]
      .forEach(([sel, key]) => {
        $(sel).addEventListener('change', (event) => {
          state[key] = event.target.checked;
          $$('#syllables .glyph').forEach(applyGlyphOptions);
          save();
        });
      });

    $('#study-guide').addEventListener('change', (event) => {
      state.studyGuide = event.target.checked;
      studyPads.forEach((pad) => pad.setGuide(state.studyGuide));
      save();
    });

    $('#syllables').addEventListener('click', (event) => {
      const button = event.target.closest('.syl__btn');
      if (button) say(button.dataset.char);
    });

    $('#say-word').addEventListener('click', () => say(WORDS[state.current].ko));
    $('#say-slow').addEventListener('click', () => say(WORDS[state.current].ko, { rate: 0.6 }));
    $('#say-example').addEventListener('click', () => say(WORDS[state.current].example.ko));
    $('#study-learn').addEventListener('click', () => toggleLearned(state.current));
    $('#study-prev').addEventListener('click', () => openStudy(state.current - 1));
    $('#study-next').addEventListener('click', () => openStudy(state.current + 1));

    $('#study').addEventListener('close', () => {
      // `close` is delivered on a later task, so closing the sheet and opening it
      // again on another word runs this after the new word's strokes and pads are
      // already built. Tearing them down then leaves dead, empty pads on screen.
      if ($('#study').open) return;
      Voice.stop();
      player?.destroy();
      player = null;
      studyPads = disposePads(studyPads);
      $(`.card[data-index="${state.current}"] .card__open`)?.focus();
    });

    // Covers only the case where focus has drifted off the button -- after
    // clicking a review word, say. Anything focusable handles its own Enter, so
    // this never steals the key from a control that would act on it.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || $('#practice-result').hidden) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const active = document.activeElement;
      if (active && active.closest('button, a[href], input, select, textarea, [contenteditable]')) return;
      event.preventDefault();
      $('#drill-again').click();
    });

    document.addEventListener('keydown', (event) => {
      if (!$('#study').open || !player) return;
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.metaKey || event.ctrlKey) return;
      if (event.key === ' ' && tag === 'BUTTON') return;
      if (event.target.closest('.pad')) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          if (player.playing) player.pause(); else player.play();
          $('#anim-play').textContent = player.playing ? 'Pause' : 'Play strokes';
          break;
        case 'ArrowLeft': event.preventDefault(); player.step(-1); break;
        case 'ArrowRight': event.preventDefault(); player.step(1); break;
        case '[': openStudy(state.current - 1); break;
        case ']': openStudy(state.current + 1); break;
        case 'r': case 'R': player.reset(); player.play(); break;
        case 's': case 'S': say(WORDS[state.current].ko); break;
        default: break;
      }
    });
  }

  function bindPractice() {
    $('#drill-start').addEventListener('click', startPractice);
    $('#drill-again').addEventListener('click', startPractice);
    $('#drill-settings').addEventListener('click', endDrill);
    $('#drill-quit').addEventListener('click', endDrill);
    $('#match-quit').addEventListener('click', endDrill);

    $('#match-board').addEventListener('click', (event) => {
      const tile = event.target.closest('.tile');
      if (!tile || tile.disabled) return;
      // Hearing a word is always allowed, including while a wrong pair flashes.
      if (tile.dataset.side === 'ko') say(tile.dataset.word);
      if (match.busy) return;
      pickTile(tile);
    });
    $('#drill-next').addEventListener('click', nextQuestion);
    $('#drill-listen').addEventListener('click', () => {
      const cue = promptAudio(drill.order[drill.at]);
      say(cue.text, cue.options);
    });

    $('#drill-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (drill.answered) return;
      const word = drill.order[drill.at];
      settle(word, isCorrect(word, $('#drill-answer').value));
    });

    $('#drill-reveal').addEventListener('click', () => {
      if (drill.answered) return;
      settle(drill.order[drill.at], false, { revealed: true });
    });

    $('#drill-guide').addEventListener('change', (event) => {
      drillPads.forEach((pad) => pad.setGuide(event.target.checked));
    });

    // Every play is user-initiated in the two written directions, so the ear can
    // never do the recalling for you. Listening mode is the deliberate exception.
    $('#page-practice').addEventListener('click', (event) => {
      const button = event.target.closest('[data-review]');
      if (button) say(button.dataset.review);
    });

    /* Hangul composition on a normal keyboard. */
    $('#drill-answer').addEventListener('keydown', (event) => {
      if (!drill.composer || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Backspace') {
        event.preventDefault();
        applyComposer(drill.composer.backspace());
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        applyComposer(drill.composer.literal(' '));
        return;
      }
      const jamo = HangulInput.KEYMAP[event.key];
      if (jamo) {
        event.preventDefault();
        applyComposer(drill.composer.jamo(jamo));
      }
    });

    // Pastes and real system IMEs bypass keydown handling; adopt whatever landed.
    $('#drill-answer').addEventListener('input', (event) => {
      if (drill.composer && event.target.value !== drill.composer.value) {
        drill.composer.set(event.target.value);
      }
    });

    $('#keyboard-rows').addEventListener('click', (event) => {
      const key = event.target.closest('.key');
      if (!key || !drill.composer) return;

      if (key.dataset.jamo) {
        applyComposer(drill.composer.jamo(key.dataset.jamo));
        if (drill.shift) { drill.shift = false; renderKeyboard(); }
        return;
      }
      switch (key.dataset.keyAction) {
        case 'shift': drill.shift = !drill.shift; renderKeyboard(); $('#drill-answer').focus(); break;
        case 'backspace': applyComposer(drill.composer.backspace()); break;
        case 'space': applyComposer(drill.composer.literal(' ')); break;
        case 'clear': applyComposer(drill.composer.clear()); break;
        default: break;
      }
    });
  }

  function bindPads() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pad-action]');
      if (!button) return;
      const pads = button.dataset.padScope === 'study' ? studyPads : drillPads;
      if (button.dataset.padAction === 'undo') pads.forEach((pad) => pad.undo());
      else pads.forEach((pad) => pad.clear());
    });
  }

  function bindShell() {
    $('#theme-toggle').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      save();
    });
    $('#help-open').addEventListener('click', () => $('#help').showModal());
    window.addEventListener('hashchange', () => showPage(readHash()));
  }

  /* -------------------------------------------------- category controls */
  // The deck chips and the practice set picker are both one entry per
  // category. Building them from CATEGORIES means adding a word set is a
  // data.js edit alone -- no markup or counts to keep in sync by hand.
  function countIn(id) {
    return WORDS.filter((word) => word.category === id).length;
  }

  function renderCategoryControls() {
    const learnedChip = $('.chip[data-filter="learned"]');
    CATEGORIES.forEach((cat) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.filter = cat.id;
      chip.setAttribute('aria-pressed', 'false');
      chip.innerHTML = `<span lang="ko">${cat.ko}</span> &middot; ${cat.en}`;
      learnedChip.before(chip);
    });

    $('#intro-count').textContent =
      `${WORDS.length} words in ${CATEGORIES.length} sets.`;

    // The masthead subtitle names the sets, so it is generated too rather than
    // left to be updated by hand every time a set is added.
    const names = CATEGORIES.map((cat) => cat.en);
    $('.brand__sub').textContent = names.length > 1
      ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
      : names.join('');

    const all = $('#drill-set-all-count');
    all.textContent = `all ${WORDS.length} words`;
    const fieldset = all.closest('.fieldset__options');
    CATEGORIES.forEach((cat) => {
      const label = document.createElement('label');
      label.className = 'radio';
      label.innerHTML =
        `<input type="checkbox" name="drill-set" value="${cat.id}">` +
        `<span><strong lang="ko">${cat.ko}</strong>` +
        `<small>${cat.en}, ${countIn(cat.id)} words</small></span>`;
      fieldset.append(label);
    });

    // `Every set` is a master toggle, so it is deliberately outside the
    // drill-set group -- selectedSets() reads the real sets and nothing else.
    $('#drill-set-all').addEventListener('change', (event) => {
      $$('input[name="drill-set"]').forEach((box) => { box.checked = event.target.checked; });
      syncSetPicker();
    });
    $$('input[name="drill-set"]').forEach((box) => {
      box.addEventListener('change', syncSetPicker);
    });
    syncSetPicker();
  }

  const selectedSets = () => $$('input[name="drill-set"]:checked').map((box) => box.value);

  /** Keeps the master toggle, the running count and the Start button honest. */
  function syncSetPicker() {
    const chosen = selectedSets();
    const total = $$('input[name="drill-set"]').length;
    const master = $('#drill-set-all');
    master.checked = chosen.length === total;
    master.indeterminate = chosen.length > 0 && chosen.length < total;

    const words = WORDS.filter((word) => chosen.includes(word.category)).length;
    const names = CATEGORIES.filter((cat) => chosen.includes(cat.id)).map((cat) => cat.ko);
    let summary;
    if (!chosen.length) summary = 'Tick at least one set to practise.';
    else if (chosen.length === total) summary = `Every set, all ${words} words shuffled together.`;
    else if (chosen.length === 1) summary = `${words} words from ${names[0]}.`;
    else summary = `${words} words from ${names.join(' + ')}, shuffled together.`;
    $('#drill-set-summary').textContent = summary;

    $('#drill-start').disabled = !chosen.length;
  }

  /* --------------------------------------------------------------- boot */
  function init() {
    load();
    applyTheme();
    $('#anim-speed').value = String(state.speed);
    $('#anim-speed-out').textContent = `${state.speed.toFixed(1)}×`;
    $('#toggle-numbers').checked = state.showNumbers;
    $('#toggle-ghost').checked = state.showGhost;
    $('#toggle-grid').checked = state.showGrid;
    const modes = $$('input[name="drill-mode"]').length;
    $('#setup-note').textContent =
      `Every word is recorded into the page, the English as well as the Korean, so all `
      + `${modes} modes play with or without a voice installed on this device.`;

    renderCategoryControls();
    renderDeck();
    renderKeyboard();
    bindShell();
    bindDeck();
    bindStudy();
    bindPractice();
    bindPads();
    showPage(readHash());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
