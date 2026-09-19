/**
 * Central de Notificações Toast do GMS Reputation (Seção 58).
 * Apresentação de alto nível com fallback seguro para Foundry ui.notifications.
 */

export class ToastManager {
  static _notify(type, message, { duration = 3000 } = {}) {
    const text = String(message ?? "");
    // Fallback prioritário para a interface do Foundry se presente
    if (globalThis.ui?.notifications) {
      if (type === "error") globalThis.ui.notifications.error(text);
      else if (type === "warning") globalThis.ui.notifications.warn(text);
      else if (type === "info") globalThis.ui.notifications.info(text);
      else globalThis.ui.notifications.info(text);
    }

    // Disparo no DOM local se houver container ativo
    const container = document.querySelector(".gms-toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `gms-toast gms-toast--${type}`;
    el.innerHTML = `
      <span class="gms-toast__icon"></span>
      <span class="gms-toast__message">${text}</span>
    `;
    container.appendChild(el);

    el.animate?.(
      [
        { opacity: 0, transform: "translateY(12px) scale(0.96)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );

    setTimeout(() => {
      const anim = el.animate?.(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0.95)" }
        ],
        { duration: 160, easing: "ease-in" }
      );
      if (anim) anim.finished.then(() => el.remove());
      else el.remove();
    }, duration);
  }

  static success(msg, options) {
    this._notify("success", msg, options);
  }

  static info(msg, options) {
    this._notify("info", msg, options);
  }

  static warning(msg, options) {
    this._notify("warning", msg, options);
  }

  static error(msg, options) {
    this._notify("error", msg, options);
  }
}

export const toast = ToastManager;
