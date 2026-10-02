import assert from "node:assert/strict";
import { wireChoreography, MOTION_TIMING } from "../scripts/motion/choreography.js";
import { wireMotionSystem } from "../scripts/motion/motion-system.js";

const panel = {
  dataset: {}, effects: [], closest: () => null, getClientRects: () => [{}],
  querySelectorAll: () => [],
  animate(frames, timing) {
    const effect = { frames, timing, cancels: 0, cancel() { this.cancels++; this.oncancel?.(); } };
    this.effects.push(effect);
    return effect;
  }
};
const listeners = new Map();
const root = {
  dataset: {},
  querySelectorAll: selector => selector === "[data-gms-motion-managed]" ? [panel] : [],
  addEventListener(event, fn) { listeners.set(event, fn); },
  removeEventListener(event, fn) { if (listeners.get(event) === fn) listeners.delete(event); }
};
const choreography = wireChoreography(root);
choreography.section(panel, 1000);
assert.equal(panel.effects[0].timing.delay, MOTION_TIMING.maxDelay, "large collections must not extend entrance delays indefinitely");
choreography.section(panel, 1);
assert.equal(panel.effects[0].cancels, 1, "new input cancels the previous effect on its target");
panel.effects[1].onfinish();
assert.equal(panel.effects[1].cancels, 1, "finished effects relinquish their styles");
choreography.section(panel);
choreography.destroy();
assert.equal(panel.effects[2].cancels, 1, "closing cancels in-flight effects");
assert.equal(listeners.size, 0, "closing removes delegated listeners");
assert.equal(panel.dataset.gmsMotionManaged, undefined);
assert.equal(root.dataset.gmsMotionEdition, undefined);
choreography.section(panel);
assert.equal(panel.effects.length, 3, "a destroyed controller cannot schedule effects");

// A previous cleanup must never remove a class from a newer transition.
const original = { setTimeout, clearTimeout, performance: globalThis.performance };
let clock = 10000;
let nextId = 0;
const timers = new Map();
const classList = () => {
  const values = new Set();
  return { add: n => values.add(n), remove: n => values.delete(n), contains: n => values.has(n), [Symbol.iterator]: () => values[Symbol.iterator]() };
};
try {
  globalThis.performance = { now: () => clock };
  globalThis.setTimeout = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, at: clock + delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  const advance = until => {
    while (true) {
      const pending = [...timers].filter(([, t]) => t.at <= until).sort((a,b) => a[1].at - b[1].at)[0];
      if (!pending) break;
      clock = pending[1].at;
      timers.delete(pending[0]);
      pending[1].fn();
    }
    clock = until;
  };
  const scanner = { dataset: {}, style: { setProperty() {} }, classList: classList(), remove() {}, offsetWidth: 10 };
  const shell = { dataset: {}, classList: classList(), querySelectorAll: () => [], querySelector: () => scanner, getBoundingClientRect: () => ({height:600}) };
  const target = { dataset: { masterSectionPanel: "characters" }, classList: classList(), style: { setProperty() {} }, querySelectorAll: () => [] };
  const controller = wireMotionSystem(shell, { boot: false });
  controller.section(target);
  advance(10300);
  controller.section(target);
  advance(10680);
  assert(target.classList.contains("is-gms-motion-section-change"), "the first cleanup must not end the second transition");
  advance(10961);
  assert(!target.classList.contains("is-gms-motion-section-change"));
  controller.section(target);
  controller.destroy();
  assert.equal(controller.section(target), false, "a closed controller cannot restart transition classes");
  assert.equal(controller.scan("sync", { force: true }), false, "a closed controller cannot restart the scanner");
  assert(!target.classList.contains("is-gms-motion-section-change"), "closing removes descendant effect classes");
  assert.equal(timers.size, 0, "closing clears scanner and cleanup timers");
} finally {
  globalThis.setTimeout = original.setTimeout;
  globalThis.clearTimeout = original.clearTimeout;
  globalThis.performance = original.performance;
}
console.log("motion-lifecycle: OK");
