import { PALETTE as P, VIEW, STRINGS as S } from '../config.js';
import { quotaForRound } from '../rules.js';

// Dark enough that the frozen game behind the pause panel is clearly not the subject,
// light enough that the player can still see the run they are about to go back to.
const PAUSE_DIM_ALPHA = 0.62;

function text(ctx, str, x, y, { size = 8, color = P.hudText, align = 'left', bold = false } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

// Composes with whatever globalAlpha is already set rather than clobbering it,
// so a caller fading a whole overlay in or out actually fades the panel too.
function panel(ctx, x, y, w, h, alpha = 0.82) {
  const ambient = ctx.globalAlpha;
  ctx.globalAlpha = ambient * alpha;
  ctx.fillStyle = P.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = ambient;
  ctx.strokeStyle = P.hudDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHud(ctx, view) {
  const barH = VIEW.HUD_BAR_H;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = P.hudBg;
  ctx.fillRect(0, VIEW.H - barH, VIEW.W, barH);
  ctx.globalAlpha = 1;

  const y = VIEW.H - 6;
  text(ctx, `${S.round} ${view.round}`, 4, y, { size: 7 });
  text(ctx, `${S.score} ${view.score}`, 58, y, { size: 7 });
  text(ctx, `${S.best} ${view.best}`, 150, y, { size: 7, color: P.hudDim });

  // Eggs remaining.
  for (let i = 0; i < view.eggsTotal; i += 1) {
    const cx = 236 + i * 9;
    ctx.beginPath();
    ctx.arc(cx, VIEW.H - 9, 3, 0, Math.PI * 2);
    if (i < view.eggsLeft) { ctx.fillStyle = P.egg; ctx.fill(); }
    else { ctx.strokeStyle = P.hudDim; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // Hit-o-meter.
  view.pips.forEach((pip, i) => {
    const x = 276 + i * 8;
    ctx.fillStyle = pip === 'hit' ? P.good : pip === 'miss' ? P.bad : P.hudDim;
    ctx.fillRect(x, VIEW.H - 12, 6, 6);
  });
  text(ctx, `${S.quotaLabel} ${quotaForRound(view.round)}`, 364, y, { size: 7, color: P.hudDim });
  if (view.muted) text(ctx, S.muted, VIEW.W - 4, y, { size: 7, color: P.hudDim, align: 'right' });

  // The pause affordance goes in the only gap the bar has left: the quota text ends
  // near x=398 and the right-aligned HESHTUR starts near x=447. Size 6 rather than the
  // bar's usual 7 keeps ESC=PAUZË inside that window and reads as a hint, not a stat.
  const b = view.pauseBox;
  ctx.strokeStyle = P.hudDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  text(ctx, S.pauseHint, b.x + b.w / 2, b.y + 9, { size: 6, align: 'center', color: P.hudDim });
}

/** `touch` swaps the mouse/keyboard prompts for the touchscreen ones. */
export function drawMenu(ctx, best, tMs, touch = false) {
  panel(ctx, 60, 62, 360, 130, 0.9);
  text(ctx, S.title, VIEW.W / 2, 108, { size: 34, align: 'center', bold: true, color: P.yolk });
  text(ctx, S.subtitle, VIEW.W / 2, 126, { size: 9, align: 'center', color: P.flamingo });
  if (Math.floor(tMs / 500) % 2 === 0) {
    text(ctx, touch ? S.startTouch : S.start, VIEW.W / 2, 154, { size: 9, align: 'center' });
  }
  text(ctx, touch ? S.controlsTouch : S.controls, VIEW.W / 2, 172,
    { size: 7, align: 'center', color: P.hudDim });
  text(ctx, `${S.best} ${best}`, VIEW.W / 2, 184, { size: 7, align: 'center', color: P.hudDim });
}

export function drawRoundIntro(ctx, round, tMs) {
  const pulse = 1 + Math.sin(tMs * 0.008) * 0.06;
  ctx.save();
  ctx.translate(VIEW.W / 2, 110);
  ctx.scale(pulse, pulse);
  text(ctx, `${S.roundIntro} ${round}`, 0, 0, { size: 22, align: 'center', bold: true });
  ctx.restore();
  text(ctx, `${S.quotaLabel} ${quotaForRound(round)} ${S.hits}`, VIEW.W / 2, 136,
    { size: 9, align: 'center', color: P.hudDim });
}

export function drawRoundClear(ctx, round, hits, tMs) {
  panel(ctx, 110, 84, 260, 62);
  text(ctx, S.roundClear, VIEW.W / 2, 108, { size: 14, align: 'center', bold: true, color: P.good });
  text(ctx, `${hits} ${S.hits}`, VIEW.W / 2, 128, { size: 9, align: 'center' });
}

export function drawGameOver(ctx, score, best, round) {
  panel(ctx, 90, 70, 300, 110, 0.92);
  text(ctx, S.gameOver, VIEW.W / 2, 100, { size: 20, align: 'center', bold: true, color: P.bad });
  text(ctx, `${S.round} ${round}`, VIEW.W / 2, 120, { size: 9, align: 'center', color: P.hudDim });
  text(ctx, `${S.score} ${score}`, VIEW.W / 2, 138, { size: 11, align: 'center' });
  text(ctx, `${S.best} ${best}`, VIEW.W / 2, 152, { size: 9, align: 'center', color: P.yolk });
  text(ctx, S.restart, VIEW.W / 2, 170, { size: 8, align: 'center', color: P.hudDim });
}

/**
 * The pause overlay. Every rectangle it draws comes from `view`, which state.js built
 * from the same numbers it hit-tests clicks against, so the highlight can never sit
 * somewhere other than the thing the mouse actually activates.
 */
export function drawPauseMenu(ctx, view) {
  // Dim the frozen frame first so the panel reads as being on top of a stopped game.
  ctx.globalAlpha = PAUSE_DIM_ALPHA;
  ctx.fillStyle = P.hudBg;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.globalAlpha = 1;

  const box = view.panel;
  const cx = box.x + box.w / 2;
  panel(ctx, box.x, box.y, box.w, box.h, 0.92);
  text(ctx, S.paused, cx, box.y + 24, { size: 16, align: 'center', bold: true, color: P.yolk });
  text(ctx, `${S.round} ${view.round}   ${S.score} ${view.score}`, cx, box.y + 40,
    { size: 8, align: 'center' });
  text(ctx, `${S.best} ${view.best}`, cx, box.y + 51, { size: 7, align: 'center', color: P.hudDim });

  view.items.forEach((item, i) => {
    const b = item.box;
    const on = i === view.selected;
    if (on) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = P.hudDim;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.yolk;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }
    text(ctx, item.label, cx, b.y + 13,
      { size: 9, align: 'center', bold: on, color: on ? P.yolk : P.hudText });
  });

  text(ctx, S.pauseKeys, cx, box.y + box.h - 8, { size: 6, align: 'center', color: P.hudDim });
}

export function drawToast(ctx, str, color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.globalAlpha = a;
  panel(ctx, 40, 30, 400, 22, 0.85);
  text(ctx, str, VIEW.W / 2, 45, { size: 10, align: 'center', bold: true, color });
  ctx.globalAlpha = 1;
}

export function drawFlash(ctx, alpha, color = P.bad) {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(0.5, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.globalAlpha = 1;
}
