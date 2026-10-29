/**
 * Stroke-order renderer and player.
 *
 * Builds one SVG per syllable, then animates every stroke of the word as a
 * single ordered sequence using the dash-offset technique. Stroke duration is
 * proportional to path length so short ticks do not linger and long sweeps do
 * not race.
 */
const Writer = (() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const MS_PER_UNIT = 8.5;
  const MIN_MS = 260;
  const MAX_MS = 900;
  const GAP_MS = 150;

  function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  /** Renders the practice grid, the faint target glyph and the animated strokes. */
  function renderSyllable(char, index) {
    const strokes = Hangul.strokesFor(char);
    const svg = el('svg', {
      // Padded viewBox so round stroke caps never clip at the block edges.
      viewBox: `-5 -5 ${Hangul.SIZE + 10} ${Hangul.SIZE + 10}`,
      class: 'glyph',
      role: 'img',
      'aria-label': `Stroke order for ${char}`,
      focusable: 'false'
    });

    const guides = el('g', { class: 'glyph__guides', 'aria-hidden': 'true' });
    guides.append(
      el('rect', { x: 0, y: 0, width: 100, height: 100, rx: 3, class: 'glyph__frame' }),
      el('line', { x1: 50, y1: 2, x2: 50, y2: 98, class: 'glyph__guide' }),
      el('line', { x1: 2, y1: 50, x2: 98, y2: 50, class: 'glyph__guide' })
    );
    svg.append(guides);

    const ghost = el('g', { class: 'glyph__ghost', 'aria-hidden': 'true' });
    const live = el('g', { class: 'glyph__strokes' });
    const marks = el('g', { class: 'glyph__marks', 'aria-hidden': 'true' });

    strokes.forEach((stroke, i) => {
      ghost.append(el('path', { d: stroke.d, class: 'ghost' }));
      const path = el('path', { d: stroke.d, class: 'stroke' });
      path.dataset.syllable = String(index);
      path.dataset.jamo = stroke.jamo;
      path.dataset.order = String(i + 1);
      live.append(path);
    });

    svg.append(ghost, live, marks);
    return { svg, live, marks, count: strokes.length };
  }

  /** Places numbered dots at each stroke's starting point. */
  function renderMarks(svgParts) {
    const { live, marks } = svgParts;
    marks.textContent = '';
    [...live.querySelectorAll('.stroke')].forEach((path, i) => {
      let point;
      try {
        point = path.getPointAtLength(0);
      } catch {
        return;
      }
      const group = el('g', { class: 'mark', 'data-index': String(i) });
      group.append(
        el('circle', { cx: point.x, cy: point.y, r: 5.8, class: 'mark__dot' }),
        Object.assign(el('text', { x: point.x, y: point.y + 2.4, class: 'mark__label' }), {
          textContent: String(i + 1)
        })
      );
      marks.append(group);
    });
  }

  /**
   * Creates a player over an ordered list of stroke paths.
   * @param {SVGPathElement[]} paths
   * @param {{onStep?: (i: number, total: number) => void, onEnd?: () => void}} hooks
   */
  function createPlayer(paths, hooks = {}) {
    const strokes = paths.map((path) => {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        length = 60;
      }
      // The gap is deliberately longer than the path: with an equal-length gap,
      // a fully-offset stroke still paints a round line cap at the path end.
      path.style.strokeDasharray = `${length} ${length + 2}`;
      return { path, length };
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let playing = false;
    let frame = null;
    let timer = null;
    let speed = 1;

    function paint(i, progress) {
      strokes.forEach((stroke, n) => {
        const { path, length } = stroke;
        let offset;
        if (n < i) offset = 0;
        else if (n === i) offset = length * (1 - progress);
        else offset = length;
        path.style.strokeDashoffset = `${offset}`;
        path.classList.toggle('is-active', n === i && progress < 1);
        path.classList.toggle('is-done', n < i || (n === i && progress >= 1));
      });
    }

    function clearTimers() {
      if (frame) cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      frame = null;
      timer = null;
    }

    function announce() {
      hooks.onStep?.(index, strokes.length);
    }

    function runStroke() {
      if (index >= strokes.length) {
        playing = false;
        paint(strokes.length, 1);
        announce();
        hooks.onEnd?.();
        return;
      }

      announce();
      const { length } = strokes[index];
      const duration = reduceMotion
        ? 0
        : Math.min(MAX_MS, Math.max(MIN_MS, length * MS_PER_UNIT)) / speed;

      if (duration === 0) {
        paint(index, 1);
        index += 1;
        timer = setTimeout(runStroke, 240);
        return;
      }

      const start = performance.now();
      const tick = (now) => {
        if (!playing) return;
        const t = Math.min(1, (now - start) / duration);
        paint(index, easeOut(t));
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          index += 1;
          timer = setTimeout(runStroke, GAP_MS / speed);
        }
      };
      frame = requestAnimationFrame(tick);
    }

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 2);
    }

    return {
      get playing() { return playing; },
      get index() { return index; },
      get total() { return strokes.length; },
      setSpeed(value) { speed = value; },
      play() {
        if (playing) return;
        if (index >= strokes.length) index = 0;
        playing = true;
        clearTimers();
        runStroke();
      },
      pause() {
        playing = false;
        clearTimers();
        paint(index, 0);
        announce();
      },
      reset() {
        clearTimers();
        playing = false;
        index = 0;
        paint(0, 0);
        announce();
      },
      showAll() {
        clearTimers();
        playing = false;
        index = strokes.length;
        paint(strokes.length, 1);
        announce();
      },
      step(delta) {
        clearTimers();
        playing = false;
        index = Math.min(strokes.length, Math.max(0, index + delta));
        paint(index, 0);
        announce();
      },
      destroy() {
        clearTimers();
        playing = false;
      }
    };
  }

  return { renderSyllable, renderMarks, createPlayer };
})();
