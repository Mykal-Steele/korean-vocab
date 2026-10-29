/**
 * Hangul stroke-order engine.
 *
 * A Hangul syllable block is composed algorithmically from an initial consonant
 * (choseong), a vowel (jungseong) and an optional final consonant (jongseong).
 * Rather than tracing outlines from a font, this module stores each jamo as an
 * ordered list of SVG strokes in a local 100x100 box, then places those boxes
 * inside the syllable block according to the composition rules. The result is a
 * stroke sequence in correct writing order: initial -> vowel -> final, and within
 * each jamo, top-to-bottom / left-to-right.
 */
const Hangul = (() => {
  'use strict';

  const BASE = 0xac00;
  const LAST = 0xd7a3;

  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  /* ---------------------------------------------------------------- strokes */
  /* Each entry: ordered SVG path data in a 0..100 local box. */
  const STROKES = {
    /* consonants */
    'ㄱ': ['M 14 16 H 84 L 66 88'],
    'ㄴ': ['M 20 12 V 82 H 86'],
    'ㄷ': ['M 15 16 H 85', 'M 15 16 V 84 H 85'],
    'ㄹ': ['M 16 16 H 82 V 46', 'M 82 46 H 16 V 78', 'M 16 78 H 84'],
    'ㅁ': ['M 18 14 V 86', 'M 18 14 H 82 V 86', 'M 18 86 H 82'],
    'ㅂ': ['M 18 12 V 86', 'M 82 12 V 86', 'M 18 52 H 82', 'M 18 86 H 82'],
    'ㅅ': ['M 52 12 L 14 88', 'M 46 42 L 86 88'],
    'ㅇ': ['M 50 12 A 38 38 0 1 0 50 88 A 38 38 0 1 0 50 12'],
    'ㅈ': ['M 14 20 H 86', 'M 54 20 L 16 88', 'M 48 48 L 86 88'],
    'ㅊ': ['M 50 4 V 18', 'M 14 30 H 86', 'M 54 30 L 18 88', 'M 48 54 L 86 88'],
    'ㅋ': ['M 14 16 H 84 L 66 88', 'M 22 50 H 76'],
    'ㅌ': ['M 15 16 H 85', 'M 15 50 H 85', 'M 15 16 V 84 H 85'],
    'ㅍ': ['M 12 20 H 88', 'M 32 20 V 80', 'M 68 20 V 80', 'M 12 80 H 88'],
    'ㅎ': ['M 50 4 V 18', 'M 20 30 H 80', 'M 50 40 A 23 23 0 1 0 50 86 A 23 23 0 1 0 50 40'],
    /* vowels */
    'ㅏ': ['M 34 4 V 96', 'M 34 50 H 88'],
    'ㅐ': ['M 24 4 V 96', 'M 24 50 H 62', 'M 76 4 V 96'],
    'ㅑ': ['M 34 4 V 96', 'M 34 32 H 88', 'M 34 66 H 88'],
    'ㅒ': ['M 20 4 V 96', 'M 20 32 H 58', 'M 20 66 H 58', 'M 76 4 V 96'],
    'ㅓ': ['M 12 50 H 64', 'M 64 4 V 96'],
    'ㅔ': ['M 10 50 H 50', 'M 50 4 V 96', 'M 78 4 V 96'],
    'ㅕ': ['M 12 32 H 64', 'M 12 66 H 64', 'M 64 4 V 96'],
    'ㅖ': ['M 8 32 H 46', 'M 8 66 H 46', 'M 46 4 V 96', 'M 78 4 V 96'],
    'ㅗ': ['M 50 12 V 56', 'M 6 56 H 94'],
    'ㅛ': ['M 32 12 V 56', 'M 68 12 V 56', 'M 6 56 H 94'],
    'ㅜ': ['M 6 44 H 94', 'M 50 44 V 88'],
    'ㅠ': ['M 6 44 H 94', 'M 32 44 V 88', 'M 68 44 V 88'],
    'ㅡ': ['M 6 50 H 94'],
    'ㅣ': ['M 50 4 V 96']
  };

  /* Clustered jamo, expressed as sub-jamo placed inside the parent box. */
  const CLUSTERS = {
    'ㄲ': [['ㄱ', [0, 0, 47, 100]], ['ㄱ', [53, 0, 47, 100]]],
    'ㄸ': [['ㄷ', [0, 0, 47, 100]], ['ㄷ', [53, 0, 47, 100]]],
    'ㅃ': [['ㅂ', [0, 0, 47, 100]], ['ㅂ', [53, 0, 47, 100]]],
    'ㅆ': [['ㅅ', [0, 0, 47, 100]], ['ㅅ', [53, 0, 47, 100]]],
    'ㅉ': [['ㅈ', [0, 0, 47, 100]], ['ㅈ', [53, 0, 47, 100]]],
    'ㄳ': [['ㄱ', [0, 0, 47, 100]], ['ㅅ', [53, 0, 47, 100]]],
    'ㄵ': [['ㄴ', [0, 0, 47, 100]], ['ㅈ', [53, 0, 47, 100]]],
    'ㄶ': [['ㄴ', [0, 0, 47, 100]], ['ㅎ', [53, 0, 47, 100]]],
    'ㄺ': [['ㄹ', [0, 0, 47, 100]], ['ㄱ', [53, 0, 47, 100]]],
    'ㄻ': [['ㄹ', [0, 0, 47, 100]], ['ㅁ', [53, 0, 47, 100]]],
    'ㄼ': [['ㄹ', [0, 0, 47, 100]], ['ㅂ', [53, 0, 47, 100]]],
    'ㄽ': [['ㄹ', [0, 0, 47, 100]], ['ㅅ', [53, 0, 47, 100]]],
    'ㄾ': [['ㄹ', [0, 0, 47, 100]], ['ㅌ', [53, 0, 47, 100]]],
    'ㄿ': [['ㄹ', [0, 0, 47, 100]], ['ㅍ', [53, 0, 47, 100]]],
    'ㅀ': [['ㄹ', [0, 0, 47, 100]], ['ㅎ', [53, 0, 47, 100]]],
    'ㅄ': [['ㅂ', [0, 0, 47, 100]], ['ㅅ', [53, 0, 47, 100]]]
  };

  /* Vowels written under the initial consonant. */
  const HORIZONTAL = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ']);
  /* Compound vowels: [part written below, part written to the right]. */
  const COMPOUND = {
    'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'],
    'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'],
    'ㅢ': ['ㅡ', 'ㅣ']
  };

  /* ---------------------------------------------------------------- layout */
  /* Boxes are [x, y, width, height] in the 0..100 syllable block. */
  const LAYOUT = {
    /* vertical vowel, no final — e.g. 사, 미 */
    vertical:        { cho: [4, 8, 52, 84],  jung: [58, 4, 38, 92] },
    /* horizontal vowel, no final — e.g. 트, 요 */
    horizontal:      { cho: [18, 4, 64, 46], jung: [4, 54, 92, 42] },
    /* compound vowel, no final — e.g. 회, 의 */
    compound:        { cho: [8, 4, 42, 42],  jungA: [4, 50, 58, 44], jungB: [70, 4, 26, 92] },
    /* vertical vowel + final — e.g. 한, 남 */
    verticalFinal:   { cho: [6, 2, 44, 54],  jung: [54, 0, 42, 58],  jong: [14, 62, 72, 34] },
    /* horizontal vowel + final — e.g. 국, 본 */
    horizontalFinal: { cho: [22, 2, 56, 30], jung: [6, 34, 88, 28],  jong: [22, 64, 56, 34] },
    /* compound vowel + final — e.g. 원 */
    compoundFinal:   { cho: [8, 2, 36, 30],  jungA: [4, 34, 54, 28], jungB: [66, 0, 28, 62], jong: [16, 66, 68, 30] }
  };

  /* ------------------------------------------------------- path transforms */
  const ARG_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const NUMBER_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g;

  /** Bakes a box placement into path data so stroke width stays uniform. */
  function placePath(d, box) {
    const [bx, by, bw, bh] = box;
    const sx = bw / 100;
    const sy = bh / 100;
    const X = (v) => round(bx + v * sx);
    const Y = (v) => round(by + v * sy);
    const tokens = d.match(NUMBER_TOKEN) || [];
    const out = [];
    let i = 0;
    let cmd = 'M';

    while (i < tokens.length) {
      if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
      const n = ARG_COUNT[cmd.toUpperCase()] ?? 0;
      const a = tokens.slice(i, i + n).map(Number);
      i += n;

      switch (cmd) {
        case 'M': case 'L': case 'T': out.push(cmd, X(a[0]), Y(a[1])); break;
        case 'H': out.push('H', X(a[0])); break;
        case 'V': out.push('V', Y(a[0])); break;
        case 'Q': out.push('Q', X(a[0]), Y(a[1]), X(a[2]), Y(a[3])); break;
        case 'C': out.push('C', X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5])); break;
        case 'A': out.push('A', round(a[0] * sx), round(a[1] * sy), a[2], a[3], a[4], X(a[5]), Y(a[6])); break;
        case 'Z': case 'z': out.push('Z'); break;
        default: break;
      }
    }
    return out.join(' ');
  }

  function round(v) {
    return Math.round(v * 100) / 100;
  }

  function nest(outer, inner) {
    const [ox, oy, ow, oh] = outer;
    const [ix, iy, iw, ih] = inner;
    return [ox + (ix * ow) / 100, oy + (iy * oh) / 100, (iw * ow) / 100, (ih * oh) / 100];
  }

  /** Resolves a jamo (simple or clustered) to placed path data. */
  function jamoStrokes(jamo, box) {
    const cluster = CLUSTERS[jamo];
    if (cluster) {
      return cluster.flatMap(([sub, subBox]) => jamoStrokes(sub, nest(box, subBox)));
    }
    const defs = STROKES[jamo];
    if (!defs) return [];
    return defs.map((d) => ({ d: placePath(d, box), jamo }));
  }

  /* ---------------------------------------------------------------- public */

  /** Splits a precomposed syllable into its jamo, or null if not a syllable. */
  function decompose(char) {
    const code = char.codePointAt(0);
    if (code < BASE || code > LAST) return null;
    const index = code - BASE;
    return {
      cho: CHO[Math.floor(index / 588)],
      jung: JUNG[Math.floor((index % 588) / 28)],
      jong: JONG[index % 28]
    };
  }

  /** Ordered stroke list for one syllable: [{ d, jamo }, ...] */
  function strokesFor(char) {
    const parts = decompose(char);
    if (!parts) return [];

    const { cho, jung, jong } = parts;
    const compound = COMPOUND[jung];
    const horizontal = HORIZONTAL.has(jung);
    const strokes = [];

    if (compound) {
      const box = jong ? LAYOUT.compoundFinal : LAYOUT.compound;
      strokes.push(...jamoStrokes(cho, box.cho));
      strokes.push(...jamoStrokes(compound[0], box.jungA));
      strokes.push(...jamoStrokes(compound[1], box.jungB));
      if (jong) strokes.push(...jamoStrokes(jong, box.jong));
    } else if (horizontal) {
      const box = jong ? LAYOUT.horizontalFinal : LAYOUT.horizontal;
      strokes.push(...jamoStrokes(cho, box.cho));
      strokes.push(...jamoStrokes(jung, box.jung));
      if (jong) strokes.push(...jamoStrokes(jong, box.jong));
    } else {
      const box = jong ? LAYOUT.verticalFinal : LAYOUT.vertical;
      strokes.push(...jamoStrokes(cho, box.cho));
      strokes.push(...jamoStrokes(jung, box.jung));
      if (jong) strokes.push(...jamoStrokes(jong, box.jong));
    }

    return strokes;
  }

  /** Human-readable jamo breakdown, e.g. "ㄷ + ㅗ + ㄱ". */
  function spell(char) {
    const parts = decompose(char);
    if (!parts) return char;
    return [parts.cho, parts.jung, parts.jong].filter(Boolean).join(' + ');
  }

  /** The Hangul syllables in a word, in order. Spaces and brackets are left out. */
  function syllablesOf(text) {
    return [...text].filter((c) => {
      const code = c.codePointAt(0);
      return code >= 0xac00 && code <= 0xd7a3;
    });
  }

  return { decompose, strokesFor, spell, syllablesOf, SIZE: 100 };
})();

/**
 * Hangul input method.
 *
 * Lets the English -> Korean practice mode work without a Korean IME installed:
 * jamo arrive either from the 두벌식 (two-set) positions on a normal QWERTY
 * keyboard or from the on-screen keys, and are composed into syllable blocks by
 * the same automaton a system IME uses.
 */
const HangulInput = (() => {
  'use strict';

  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  const VOWELS = new Set(JUNG);

  /* Two consecutive finals that merge into one cluster, and how to undo it. */
  const JONG_PAIRS = {
    'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
    'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ'
  };
  /* Two vowels that merge into one compound vowel. */
  const JUNG_PAIRS = {
    'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ',
    'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ'
  };
  const SPLIT = Object.fromEntries(
    [...Object.entries(JONG_PAIRS), ...Object.entries(JUNG_PAIRS)].map(([pair, merged]) => [merged, [...pair]])
  );

  /* 두벌식 layout: the jamo printed on a Korean keyboard at each QWERTY position. */
  const KEYMAP = {
    q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
    a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
    z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
    Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ'
  };

  /* Rows as they appear on a Korean keyboard, for the on-screen version. */
  const ROWS = [
    ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
    ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
    ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ']
  ];
  const SHIFT_ROWS = [
    ['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','ㅛ','ㅕ','ㅑ','ㅒ','ㅖ'],
    ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
    ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ']
  ];

  function build(cho, jung, jong) {
    const c = CHO.indexOf(cho);
    const v = JUNG.indexOf(jung);
    const f = jong ? JONG.indexOf(jong) : 0;
    if (c < 0 || v < 0 || f < 0) return null;
    return String.fromCharCode(0xac00 + c * 588 + v * 28 + f);
  }

  /**
   * Creates a composer. `text` is the finished text; `pending` is the syllable
   * still being assembled. The caller renders `text + pending`.
   */
  function createComposer() {
    let text = '';
    let cho = '';
    let jung = '';
    let jong = '';

    function pending() {
      if (cho && jung) return build(cho, jung, jong) || '';
      if (cho) return cho;
      if (jung) return jung;
      return '';
    }

    function commit() {
      text += pending();
      cho = jung = jong = '';
    }

    function addConsonant(jamo) {
      if (!cho && !jung) {
        cho = CHO.includes(jamo) ? jamo : '';
        if (!cho) text += jamo;
        return;
      }
      if (cho && !jung) {
        // Two initials in a row cannot combine; start a fresh block.
        commit();
        cho = CHO.includes(jamo) ? jamo : '';
        if (!cho) text += jamo;
        return;
      }
      if (!jong) {
        if (JONG.includes(jamo)) jong = jamo;
        else {
          commit();
          cho = jamo;
        }
        return;
      }
      const merged = JONG_PAIRS[jong + jamo];
      if (merged) jong = merged;
      else {
        commit();
        cho = CHO.includes(jamo) ? jamo : '';
        if (!cho) text += jamo;
      }
    }

    function addVowel(jamo) {
      if (!cho) {
        if (jung) {
          const merged = JUNG_PAIRS[jung + jamo];
          if (merged) { jung = merged; return; }
          commit();
        }
        jung = jamo;
        return;
      }
      if (!jung) { jung = jamo; return; }
      if (!jong) {
        const merged = JUNG_PAIRS[jung + jamo];
        if (merged) jung = merged;
        else { commit(); jung = jamo; }
        return;
      }
      // A final consonant slides forward to start the next syllable: 각 + ㅏ -> 가가
      const parts = SPLIT[jong];
      const moved = parts ? parts[1] : jong;
      jong = parts ? parts[0] : '';
      const block = build(cho, jung, jong);
      text += block || '';
      cho = moved;
      jung = jamo;
      jong = '';
    }

    return {
      get value() { return text + pending(); },

      /** Feeds one jamo. Returns the new value. */
      jamo(char) {
        if (VOWELS.has(char)) addVowel(char);
        else addConsonant(char);
        return this.value;
      },

      /** Feeds a literal character such as a space. */
      literal(char) {
        commit();
        text += char;
        return this.value;
      },

      /** Removes one jamo, unwinding clusters the way a Korean IME does. */
      backspace() {
        if (jong) {
          const parts = SPLIT[jong];
          jong = parts ? parts[0] : '';
        } else if (jung) {
          const parts = SPLIT[jung];
          jung = parts ? parts[0] : '';
        } else if (cho) {
          cho = '';
        } else {
          text = [...text].slice(0, -1).join('');
        }
        return this.value;
      },

      clear() {
        text = '';
        cho = jung = jong = '';
        return '';
      },

      /** Replaces everything, e.g. after a paste or a real IME commit. */
      set(value) {
        text = value;
        cho = jung = jong = '';
        return text;
      }
    };
  }

  return { createComposer, KEYMAP, ROWS, SHIFT_ROWS, isVowel: (c) => VOWELS.has(c) };
})();
