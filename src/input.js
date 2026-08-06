import { VIEW } from './config.js';

/** Convert a mouse or touch point to logical canvas coordinates. */
function toLogical(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * VIEW.W,
    y: ((ev.clientY - r.top) / r.height) * VIEW.H
  };
}

export function createInput(canvas, handlers) {
  const state = { x: VIEW.W / 2, y: VIEW.H / 2, inside: false, touch: false };

  canvas.addEventListener('mousemove', (ev) => {
    const p = toLogical(canvas, ev);
    state.x = p.x;
    state.y = p.y;
    state.inside = true;
    // Reported on the event rather than sampled every frame, so hover only ever
    // overrides a keyboard selection when the pointer has genuinely moved.
    handlers.onMove?.(p.x, p.y);
  });

  canvas.addEventListener('mouseleave', () => { state.inside = false; });

  canvas.addEventListener('mousedown', (ev) => {
    // Prevent every button's default (middle-click autoscroll, etc.) over the
    // canvas, not just the left button's — so this runs before the button check.
    ev.preventDefault();
    if (ev.button !== 0) return;
    // Belt and braces against a synthesised click: preventDefault on touchstart stops
    // it in every browser we care about, but a stray one here would silently cost the
    // player an egg, so a device that has used touch never takes mouse clicks again.
    if (state.touch) return;
    const p = toLogical(canvas, ev);
    state.x = p.x;
    state.y = p.y;
    handlers.onClick(p.x, p.y);
  });

  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  // ---- Touch -------------------------------------------------------------------
  // A tap is an aimed throw at the point touched: there is no hover on a touchscreen,
  // so aiming and firing have to be the same gesture. Dragging moves the crosshair
  // without throwing, which is what lets a player line up a shot before lifting.
  //
  // Every handler calls preventDefault(): without it the browser scrolls the page,
  // pinch-zooms, shows the tap highlight, and — worst — synthesises a mouse click
  // ~300ms after touchend, which would throw a second egg for every tap.
  const touchPoint = (ev) => toLogical(canvas, ev.changedTouches[0]);

  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    state.touch = true;
    const p = touchPoint(ev);
    state.x = p.x;
    state.y = p.y;
    state.inside = true;
    handlers.onMove?.(p.x, p.y);
    handlers.onClick(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('touchmove', (ev) => {
    ev.preventDefault();
    const p = touchPoint(ev);
    state.x = p.x;
    state.y = p.y;
    handlers.onMove?.(p.x, p.y);
  }, { passive: false });

  // The crosshair deliberately stays where the finger left it rather than vanishing:
  // it is the only indication of where the next tap-to-throw is currently aimed, and
  // on a touchscreen there is nothing else standing in for a cursor.
  canvas.addEventListener('touchend', (ev) => ev.preventDefault(), { passive: false });
  canvas.addEventListener('touchcancel', (ev) => ev.preventDefault(), { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return; // holding a key must not fire the handler ~30x/sec
    handlers.onKey(ev.key.toLowerCase());
  });

  return state;
}
