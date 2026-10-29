/**
 * Handwriting practice pad.
 *
 * A canvas per syllable with the target glyph shown faintly underneath, so the
 * learner traces first and then writes the same block unaided with the guide
 * turned off. Pointer events cover mouse, stylus and touch from one code path.
 */
const Draw = (() => {
  'use strict';

  const BOX = 110;      // Hangul.SIZE plus the 5-unit margin the glyphs allow.
  const ORIGIN = 5;
  const GUIDE_WIDTH = 7.5;

  function readColors(canvas) {
    const styles = getComputedStyle(canvas);
    return {
      guide: styles.getPropertyValue('--pad-guide').trim() || '#333',
      grid: styles.getPropertyValue('--pad-grid').trim() || '#444',
      ink: styles.getPropertyValue('--pad-ink').trim() || '#fff'
    };
  }

  /**
   * @param {HTMLElement} host element the canvas is appended to
   * @param {{char?: string, guide?: boolean, onChange?: (empty: boolean) => void}} options
   */
  function createPad(host, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'pad__canvas';
    canvas.setAttribute('role', 'img');
    host.append(canvas);

    const ctx = canvas.getContext('2d');
    let strokes = [];       // committed strokes, each an array of {x, y} in BOX units
    let active = null;
    let char = options.char || '';
    let guide = options.guide !== false;
    let width = 0;

    function scale() {
      return width / BOX;
    }

    function toBox(event) {
      const rect = canvas.getBoundingClientRect();
      const k = BOX / rect.width;
      return {
        x: (event.clientX - rect.left) * k - ORIGIN,
        y: (event.clientY - rect.top) * k - ORIGIN
      };
    }

    function resize() {
      const rect = host.getBoundingClientRect();
      const size = Math.max(80, Math.round(rect.width));
      if (!size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = size;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function drawGuides(colors) {
      const k = scale();
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(ORIGIN, ORIGIN);

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(0, 0, 100, 100);
      ctx.setLineDash([2.5, 3.5]);
      ctx.beginPath();
      ctx.moveTo(50, 2); ctx.lineTo(50, 98);
      ctx.moveTo(2, 50); ctx.lineTo(98, 50);
      ctx.stroke();
      ctx.setLineDash([]);

      if (guide && char) {
        ctx.strokeStyle = colors.guide;
        ctx.lineWidth = GUIDE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const stroke of Hangul.strokesFor(char)) {
          ctx.stroke(new Path2D(stroke.d));
        }
      }
      ctx.restore();
    }

    function drawStroke(points, colors) {
      if (points.length < 2) {
        if (!points.length) return;
        const k = scale();
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.arc((points[0].x + ORIGIN) * k, (points[0].y + ORIGIN) * k, (GUIDE_WIDTH / 2) * k, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const k = scale();
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(ORIGIN, ORIGIN);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = GUIDE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      // Quadratic midpoints smooth the polyline without lagging behind the pen.
      for (let i = 1; i < points.length - 1; i += 1) {
        const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
        ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }

    function redraw() {
      if (!width) return;
      const colors = readColors(canvas);
      ctx.clearRect(0, 0, width, width);
      drawGuides(colors);
      for (const stroke of strokes) drawStroke(stroke, colors);
      if (active) drawStroke(active, colors);
    }

    function announce() {
      canvas.setAttribute('aria-label', char
        ? `Handwriting pad for ${char}, ${strokes.length} strokes drawn`
        : `Handwriting pad, ${strokes.length} strokes drawn`);
      options.onChange?.(strokes.length === 0);
    }

    function onDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      active = [toBox(event)];
      redraw();
    }

    function onMove(event) {
      if (!active) return;
      event.preventDefault();
      const point = toBox(event);
      const previous = active[active.length - 1];
      // Skip jitter so the smoothing has meaningful control points.
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.6) return;
      active.push(point);
      redraw();
    }

    function onUp() {
      if (!active) return;
      strokes.push(active);
      active = null;
      redraw();
      announce();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    announce();

    return {
      get empty() { return strokes.length === 0; },
      setChar(next) { char = next; strokes = []; active = null; redraw(); announce(); },
      setGuide(on) { guide = on; redraw(); },
      undo() { strokes.pop(); redraw(); announce(); },
      clear() { strokes = []; active = null; redraw(); announce(); },
      refresh: redraw,
      destroy() {
        observer.disconnect();
        canvas.remove();
      }
    };
  }

  return { createPad };
})();
