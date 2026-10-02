import assert from "node:assert/strict";
import { setPortraitImageSource, wireVisiblePortraits } from "../scripts/components/visible-portraits.js";

class Image extends EventTarget {
  constructor(source) {
    super();
    this.attributes = new Map([["data-gms-media-src", source]]);
    this.isConnected = true;
    this.complete = false;
    this.naturalWidth = 0;
    this.hidden = false;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name === "src") { this.complete = false; this.naturalWidth = 0; }
  }
  removeAttribute(name) { this.attributes.delete(name); }
  closest() { return this.hidden ? this : null; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  load() { this.complete = true; this.naturalWidth = 100; this.dispatchEvent(new Event("load")); }
}

const images = Array.from({ length: 40 }, (_, i) => new Image(`npc-${i}.gif`));
const doc = new EventTarget();
doc.hidden = false;
const timers = new Map();
let nextTimer = 0;
let intersection;
const view = new EventTarget();
Object.assign(view, {
  queueMicrotask,
  setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(callback) { return this.setTimeout(callback); },
  cancelAnimationFrame(id) { this.clearTimeout(id); },
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; this.observed = new Set(); intersection = this; }
    observe(image) { this.observed.add(image); }
    unobserve(image) { this.observed.delete(image); }
    disconnect() { this.observed.clear(); }
  }
});
doc.defaultView = view;
const root = new EventTarget();
Object.assign(root, { ownerDocument: doc, querySelectorAll: () => images.filter(image => image.isConnected), contains: image => images.includes(image) && image.isConnected });
const controller = wireVisiblePortraits(root);
const show = (...entries) => intersection.callback(entries.map(([target, visible]) => ({
  target, isIntersecting: visible, intersectionRect: { width: visible ? 100 : 0, height: visible ? 100 : 0 }
})));
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

assert(images.every(image => !image.hasAttribute("src")), "rendering a 40-character list must not download its GIFs");
show([images[0], true], [images[1], true], [images[2], true]);
assert.equal(images.filter(image => image.hasAttribute("src")).length, 2, "only two visible requests may begin together");
show([images[0], false]);
await flush();
assert.equal(images[0].getAttribute("src"), null, "leaving the viewport cancels an in-flight image");
assert.equal(images[2].getAttribute("src"), "npc-2.gif", "a canceled request frees the queue immediately");
images[1].load(); images[2].load(); await flush();
assert.equal(timers.size, 0, "completed loads relinquish request timeouts");
show([images[1], false], [images[2], false], [images[39], true]);
images[39].load();
assert.equal(images.filter(image => image.hasAttribute("src")).length, 1, "scrolling must not accumulate previously visible animations");
assert.equal(images[1].getAttribute("data-gms-media-src"), "npc-1.gif", "unloading does not erase the saved URL");

show([images[39], false], [images[1], true]);
setPortraitImageSource(images[1], "edited.gif");
controller.refresh();
assert.equal(images[1].getAttribute("src"), "edited.gif", "editing a visible URL replaces the live source");
images[1].load();
setPortraitImageSource(images[1], "edited.gif");
assert.equal(images[1].getAttribute("src"), "edited.gif", "framing changes with the same URL must not restart the GIF");
setPortraitImageSource(images[30], "hidden-edit.gif");controller.refresh();
assert.equal(images[30].getAttribute("src"), null, "editing an offscreen source must not bypass visibility");

doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
assert(images.every(image => !image.hasAttribute("src")), "a hidden browser tab releases active portraits");
doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(images[1].getAttribute("src"), "edited.gif", "returning to the browser tab restores visible portraits");
images[1].load();

show([images[1], false], [images[3], true], [images[4], true], [images[5], true]);
images[3].dispatchEvent(new Event("error"));await flush();
assert.equal(images[5].getAttribute("src"), "npc-5.gif", "a broken image must not block the remaining queue");
images[4].load();images[5].load();
show([images[3], false], [images[4], false], [images[5], false], [images[6], true], [images[7], true], [images[8], true]);
const timeout = [...timers.values()][0];timeout();await flush();
assert.equal(images[6].getAttribute("src"), null, "a hung request is withdrawn");
assert.equal(images[8].getAttribute("src"), "npc-8.gif", "a hung request cannot monopolize the queue");

images[7].isConnected = false;
controller.refresh();
assert(!intersection.observed.has(images[7]), "replaced cards relinquish their old observer and request");
controller.destroy();await flush();
assert(images.every(image => !image.hasAttribute("src")), "closing removes every live image source");
assert.equal(timers.size, 0, "closing cancels request timeouts");
assert.equal(intersection.observed.size, 0, "closing disconnects the viewport observer");
show([images[0], true]);
assert.equal(images[0].getAttribute("src"), null, "stale callbacks cannot resurrect closed portraits");
console.log("visible-portraits: OK | viewport, queue, cancellation, source edits, tab visibility, errors and lifecycle");
