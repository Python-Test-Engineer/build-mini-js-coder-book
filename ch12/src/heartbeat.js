/**
 * heartbeat.js - a small "still working" timer.
 *
 * Model calls can take a while. This prints a dim waiting line every few
 * seconds so the program does not look frozen. The timer is unref'd so it never
 * keeps the Node process alive, and stop() is always called in a finally-style
 * path by the caller.
 */

import { ui } from './ui.js';


/**
 * Start a timer that prints a waiting message every everyMs milliseconds. Returns { stop } and unrefs the timer so it cannot keep the process alive.
 */
export function heartbeat(log, everyMs = 5000) {
  const started = Date.now();
  const timer = setInterval(() => {
    const seconds = Math.round((Date.now() - started) / 1000);
    log(ui.waiting(`  … still waiting for the model (${seconds}s)`));
  }, everyMs);
  timer.unref?.();
  return {
    stop: () => clearInterval(timer),
  };
}

export default heartbeat;
