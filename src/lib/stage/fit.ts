/* احتواء العناصر في منطقتها: تصغَّر حتى حدّ أدنى ثم تلتفّ، فلا تفيض أبدًا. نقيّ، بلا DOM. */

/** The smallest scale an element shrinks to before it wraps instead. */
export const MIN_FIT = 0.7;

export type FitPlan = { scale: number; wrap: boolean };

/**
 * `natural` is the width the content needs on one line at full size, `available` the width of its
 * region. Fits as is: scale 1. Needs less than the allowed shrink: scale down to fit exactly.
 * Needs more: stay at the minimum scale and wrap.
 */
export function planFit(natural: number, available: number, min: number = MIN_FIT): FitPlan {
  if (!(natural > 0) || !(available > 0) || natural <= available) return { scale: 1, wrap: false };
  const scale = Math.floor((available / natural) * 100) / 100; // round down, so it really fits
  if (scale >= min) return { scale, wrap: false };
  return { scale: min, wrap: true };
}

/** Prose wraps by itself; a very long run is also set a little smaller, down to the minimum. */
export function proseScale(length: number, comfortable = 160, longest = 480): number {
  if (length <= comfortable) return 1;
  if (length >= longest) return MIN_FIT;
  const t = (length - comfortable) / (longest - comfortable);
  return Math.round((1 - t * (1 - MIN_FIT)) * 100) / 100;
}
