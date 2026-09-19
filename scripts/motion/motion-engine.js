import { MOTION_INTENSITY } from "../constants.js";

const EASING_ENTER = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASING_PULSE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EASING_EXIT = "cubic-bezier(0.4, 0, 1, 1)";

export class MotionEngine {
  constructor({ intensity = MOTION_INTENSITY.FULL } = {}) {
    this.intensity = intensity;
  }

  setIntensity(intensity) {
    if (Object.values(MOTION_INTENSITY).includes(intensity)) {
      this.intensity = intensity;
    }
  }

  _isReduced() {
    if (this.intensity === MOTION_INTENSITY.MINIMAL) return true;
    if (globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    return false;
  }

  boot(root) {
    if (!root?.animate || this._isReduced()) return;
    const scanner = root.querySelector?.(".gms-scanner-line");
    if (scanner && this.intensity === MOTION_INTENSITY.FULL) {
      scanner.animate(
        [
          { opacity: 0, transform: "translateY(0)" },
          { opacity: 1, transform: "translateY(120px)" },
          { opacity: 0, transform: "translateY(400px)" }
        ],
        { duration: 800, easing: "ease-out" }
      );
    }
  }

  enter(element, { staggerIndex = 0 } = {}) {
    if (!element?.animate || this._isReduced()) return null;
    const delay = Math.min(staggerIndex * 35, 350);
    return element.animate(
      [
        { opacity: 0, transform: "translateY(8px) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      {
        duration: 240,
        delay,
        easing: EASING_ENTER,
        fill: "backwards"
      }
    );
  }

  exit(element) {
    if (!element?.animate || this._isReduced()) {
      element?.remove?.();
      return Promise.resolve();
    }
    const animation = element.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.96)" }
      ],
      {
        duration: 160,
        easing: EASING_EXIT,
        fill: "forwards"
      }
    );
    return animation.finished.then(() => element.remove());
  }

  score(element) {
    if (!element?.animate || this._isReduced()) return null;
    return element.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" }
      ],
      {
        duration: 280,
        easing: EASING_PULSE
      }
    );
  }

  relationship(element) {
    if (!element?.animate || this._isReduced()) return null;
    return element.animate(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.4)" },
        { filter: "brightness(1)" }
      ],
      {
        duration: 320,
        easing: EASING_ENTER
      }
    );
  }

  protocol(element) {
    if (!element?.animate || this._isReduced()) return null;
    return element.animate(
      [
        { opacity: 0.5, transform: "scale(0.92)" },
        { opacity: 1, transform: "scale(1.05)" },
        { opacity: 1, transform: "scale(1)" }
      ],
      {
        duration: 360,
        easing: EASING_PULSE
      }
    );
  }

  sync(element) {
    if (!element?.animate || this._isReduced()) return null;
    return element.animate(
      [
        { opacity: 0.7 },
        { opacity: 1 }
      ],
      {
        duration: 400,
        easing: "ease-out"
      }
    );
  }

  error(element) {
    if (!element?.animate || this._isReduced()) return null;
    return element.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" }
      ],
      {
        duration: 260,
        easing: "ease-in-out"
      }
    );
  }

  pulse(element) {
    return this.score(element);
  }

  modalEnter(element) {
    return this.enter(element);
  }

  fade(element, direction = "in", duration = 180) {
    if (!element?.animate || this._isReduced()) {
      return { finished: Promise.resolve() };
    }
    const isOut = direction === "out";
    const anim = element.animate(
      [
        { opacity: isOut ? 1 : 0 },
        { opacity: isOut ? 0 : 1 }
      ],
      {
        duration,
        easing: isOut ? EASING_EXIT : EASING_ENTER,
        fill: "forwards"
      }
    );
    return anim;
  }

  scannerLine(element) {
    if (!element?.animate || this._isReduced()) return null;
    const scanner = element.querySelector?.(".gms-player-focal__scanner") ?? element;
    return scanner.animate(
      [
        { opacity: 0, transform: "translateY(0)" },
        { opacity: 1, transform: "translateY(40px)" },
        { opacity: 0, transform: "translateY(90px)" }
      ],
      { duration: 600, easing: "ease-out" }
    );
  }

  staggerList(elements) {
    if (!elements) return;
    const list = Array.from(elements);
    list.forEach((el, index) => {
      this.enter(el, { staggerIndex: index });
    });
  }
}

export const motion = new MotionEngine();
export const motionEngine = motion;
