import assert from "node:assert/strict";
import { setPortraitImageSource, wirePortraitVisibility } from "../scripts/components/portrait-visibility.js";
import { buildPortraitFrameModel, renderPortraitFrameHTML } from "../scripts/components/portrait-frame.js";

function fixture({ observers = true } = {}) {
  const timers = new Map();
  let nextTimer = 0;
  let intersection, mutation;
  const doc = new EventTarget();
  doc.hidden = false;
  doc.defaultView = {
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    getComputedStyle() { return { visibility: "visible" }; },
    IntersectionObserver: observers ? class {
      constructor(callback) { intersection = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    } : undefined,
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() {}
      disconnect() {}
    }
  };
  const root = new EventTarget();
  root.ownerDocument = doc;
  root.images = [];
  root.querySelectorAll = () => root.images;
  root.contains = (image) => root.images.includes(image);
  const image = {
    attributes: new Map(), isConnected: true, hidden: false, ancestorHidden: false,
    parentElement: { parentElement: null, tagName: "SPAN" },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    hasAttribute(name) { return this.attributes.has(name); },
    closest() { return this.ancestorHidden ? {} : null; },
    matches() { return this.hasAttribute("data-gms-portrait-src"); },
    getClientRects() { return [{}]; }
  };
  root.images.push(image);
  setPortraitImageSource(image, "portraits/animated.gif");
  const controller = wirePortraitVisibility(root);
  const enter = (visible) => intersection([{ target: image, isIntersecting: visible,
    intersectionRect: { width: visible ? 80 : 0, height: visible ? 80 : 0 } }]);
  const flushTimers = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
  return { doc, root, image, controller, enter, flushTimers, timers, mutate: () => mutation([]) };
}

const html = renderPortraitFrameHTML(buildPortraitFrameModel({ src: 'portraits/a&b.gif', zoom: 175, x: 30, y: 70 }));
assert.match(html, /\ssrc="portraits\/a&amp;b.gif"/, "The public standalone renderer retains its source contract");
assert.match(html, /--gms-portrait-zoom:1.75/);

const f = fixture();
assert.equal(f.image.getAttribute("src"), null, "No eager request before the first intersection");
f.enter(true);
assert.equal(f.image.getAttribute("src"), "portraits/animated.gif");
f.enter(false);
assert.equal(f.timers.size, 1);
f.enter(true);
f.flushTimers();
assert.equal(f.image.getAttribute("src"), "portraits/animated.gif", "A quick return cancels release");
f.enter(false); f.flushTimers();
assert.equal(f.image.getAttribute("src"), null);
f.enter(true);
f.doc.hidden = true; f.doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(f.image.getAttribute("src"), null, "Background tabs release immediately");
f.doc.hidden = false; f.doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(f.image.getAttribute("src"), "portraits/animated.gif");
f.image.ancestorHidden = true; f.controller.refresh();
assert.equal(f.image.getAttribute("src"), null, "Closed sections cannot keep images active");
setPortraitImageSource(f.image, "portraits/new.gif");
f.mutate(); await Promise.resolve();
assert.equal(f.image.getAttribute("src"), null, "Changing a hidden preview does not fetch it");
f.image.ancestorHidden = false; f.enter(true);
assert.equal(f.image.getAttribute("src"), "portraits/new.gif");
setPortraitImageSource(f.image, ""); f.controller.refresh();
assert.equal(f.image.getAttribute("src"), null, "Empty selection clears the previous image");
setPortraitImageSource(f.image, "portraits/new.gif"); f.controller.refresh();
f.root.images = []; f.image.isConnected = false; f.controller.refresh();
assert.equal(f.image.getAttribute("src"), null, "Removed cards release their source");
f.enter(true);
assert.equal(f.image.getAttribute("src"), null, "Late callbacks cannot revive a removed card");
f.controller.destroy(); f.controller.destroy();

const closing = fixture();
closing.enter(true); closing.enter(false); closing.controller.destroy();
assert.equal(closing.timers.size, 0);
closing.enter(true); closing.flushTimers();
assert.equal(closing.image.getAttribute("src"), null, "Closing cleans up timers and late callbacks");
const fallback = fixture({ observers: false });
assert.equal(fallback.image.getAttribute("src"), "portraits/animated.gif", "Older adapters remain readable");
fallback.controller.destroy();
wirePortraitVisibility(null).destroy();
console.log("portrait-visibility: OK | deferred sources, scrolling, hidden tabs, edits, cleanup and fallback");
