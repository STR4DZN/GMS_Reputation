const FallbackApplicationV2 = class {
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  constructor(options = {}) { this.options = options; this.rendered = false; this.element = null; }
  render() { this.rendered = true; return this; }
  close() { this.rendered = false; }
};

export const ApplicationV2 = globalThis.foundry?.applications?.api?.ApplicationV2 ?? FallbackApplicationV2;
export const HandlebarsApplicationMixin = globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin ?? ((Base) => Base);
export const HandlebarsApplicationV2 = HandlebarsApplicationMixin(ApplicationV2);

export function notify(level = "info", message = "") {
  const notifications = globalThis.ui?.notifications;
  const fn = notifications?.[level] ?? notifications?.info;
  if (typeof fn === "function") fn.call(notifications, String(message));
}

export function appElement(app) {
  const element = app?.element;
  if (!element) return null;
  const HTMLElementCtor = globalThis.HTMLElement;
  if (HTMLElementCtor && element instanceof HTMLElementCtor) return element;
  if (HTMLElementCtor && element?.[0] instanceof HTMLElementCtor) return element[0];
  return element?.querySelector ? element : null;
}

export function listen(listeners, node, eventName, callback, options) {
  node?.addEventListener?.(eventName, callback, options);
  listeners.push(() => node?.removeEventListener?.(eventName, callback, options));
}

export function destroyListeners(listeners = []) {
  for (const remove of listeners.splice(0)) {
    try { remove(); } catch (_error) { /* no-op */ }
  }
}

const WINDOW_GUTTER = 12;
const WINDOW_TOP_GUTTER = 36;

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Produz uma posição segura sem alterar janelas que já estão totalmente visíveis.
 * A função é pura para que o comportamento possa ser validado fora do Foundry.
 */
export function calculateSafeApplicationPosition(rect = {}, viewport = {}, {
  gutter = WINDOW_GUTTER,
  topGutter = WINDOW_TOP_GUTTER
} = {}) {
  const viewportWidth = finiteNumber(viewport.width);
  const viewportHeight = finiteNumber(viewport.height);
  if (viewportWidth < 240 || viewportHeight < 220) return null;

  const safeGutter = clamp(finiteNumber(gutter, WINDOW_GUTTER), 0, Math.floor(viewportWidth / 4));
  const safeTop = clamp(finiteNumber(topGutter, WINDOW_TOP_GUTTER), safeGutter, Math.floor(viewportHeight / 3));
  const sourceWidth = Math.max(1, finiteNumber(rect.width));
  const sourceHeight = Math.max(1, finiteNumber(rect.height));
  const maxWidth = Math.max(1, viewportWidth - (safeGutter * 2));
  const maxHeight = Math.max(1, viewportHeight - safeTop - safeGutter);
  const width = Math.min(sourceWidth, maxWidth);
  const height = Math.min(sourceHeight, maxHeight);
  const sourceLeft = finiteNumber(rect.left);
  const sourceTop = finiteNumber(rect.top, safeTop);
  const left = clamp(sourceLeft, safeGutter, viewportWidth - safeGutter - width);
  const top = clamp(sourceTop, safeTop, viewportHeight - safeGutter - height);
  const sourceRight = finiteNumber(rect.right, sourceLeft + sourceWidth);
  const sourceBottom = finiteNumber(rect.bottom, sourceTop + sourceHeight);
  const unsafe = sourceWidth > maxWidth + 0.5
    || sourceHeight > maxHeight + 0.5
    || sourceLeft < safeGutter - 0.5
    || sourceRight > viewportWidth - safeGutter + 0.5
    || sourceTop < safeTop - 0.5
    || sourceBottom > viewportHeight - safeGutter + 0.5;

  if (!unsafe) return null;
  return Object.freeze({
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height)
  });
}

function viewportSize(element) {
  const doc = element?.ownerDocument ?? globalThis.document;
  const documentElement = doc?.documentElement;
  return {
    width: finiteNumber(globalThis.innerWidth, finiteNumber(documentElement?.clientWidth)),
    height: finiteNumber(globalThis.innerHeight, finiteNumber(documentElement?.clientHeight))
  };
}

/**
 * Recupera coordenadas persistidas por builds antigas e também limita as
 * dimensões padrão quando o Foundry está aberto em uma janela menor.
 */
export function ensureApplicationOnScreen(app, options = {}) {
  const element = appElement(app);
  if (!element?.getBoundingClientRect) return false;
  const safe = calculateSafeApplicationPosition(
    element.getBoundingClientRect(),
    options.viewport ?? viewportSize(element),
    options
  );
  if (!safe) return false;

  try {
    if (typeof app?.setPosition === "function") {
      app.setPosition(safe);
    } else if (element.style) {
      element.style.left = `${safe.left}px`;
      element.style.top = `${safe.top}px`;
      element.style.width = `${safe.width}px`;
      element.style.height = `${safe.height}px`;
    }
    element.dataset.gmsWindowRecovered = "true";
    return true;
  } catch (error) {
    // Alguns adapters antigos expõem setPosition com assinatura incompatível.
    // O fallback inline mantém a janela utilizável sem tocar no estado global.
    if (element.style) {
      element.style.left = `${safe.left}px`;
      element.style.top = `${safe.top}px`;
      element.style.width = `${safe.width}px`;
      element.style.height = `${safe.height}px`;
      element.dataset.gmsWindowRecovered = "fallback";
      console.warn("GMS Reputation | A janela foi recuperada pelo fallback de posicionamento.", error);
      return true;
    }
    console.warn("GMS Reputation | Não foi possível recuperar a janela para a área visível.", error);
    return false;
  }
}

export function renderApplicationSafely(app, { label = "Application" } = {}) {
  if (!app || typeof app.render !== "function") {
    const error = new Error(`${label}: ApplicationV2 indisponível ou instância inválida.`);
    console.error("GMS Reputation | Application render unavailable.", error);
    notify("error", `${label} não pôde ser aberto. A API de Application do Foundry não está disponível.`);
    return null;
  }

  const reportFailure = (error) => {
    console.error(`GMS Reputation | Falha ao renderizar ${label}.`, error);
    notify("error", `${label} não pôde ser aberto. ${String(error?.message || error || "Erro de renderização")}`);
  };

  try {
    const renderResult = app.render({ force: true, focus: true });

    const finishRender = () => {
      if (!app.rendered || !appElement(app)) return;
      ensureApplicationOnScreen(app);
      try { app.bringToFront?.(); } catch (error) { console.warn(`GMS Reputation | ${label} renderizou, mas não pôde ser trazido à frente.`, error); }

      // Duas medições pós-layout cobrem fontes/partials e o resize final do
      // ApplicationV2. ensureApplicationOnScreen é idempotente para janelas
      // já seguras, portanto isto não reposiciona uma janela estável.
      globalThis.requestAnimationFrame?.(() => {
        ensureApplicationOnScreen(app);
        globalThis.requestAnimationFrame?.(() => ensureApplicationOnScreen(app));
      });
    };

    // ApplicationV2 pode concluir a criação do elemento de forma assíncrona.
    // bringToFront() acessa element.style internamente; chamá-lo antes do render
    // terminar produz exatamente o erro "reading 'style'" visto no Foundry real.
    // O próprio render({ focus: true }) já solicita foco/z-order, então só usamos
    // bringToFront depois que existe um elemento materializado.
    if (renderResult && typeof renderResult.then === "function") {
      Promise.resolve(renderResult)
        .then(finishRender)
        .catch(reportFailure);
    } else if (app.rendered && appElement(app)) {
      finishRender();
    }

    return app;
  } catch (error) {
    reportFailure(error);
    return null;
  }
}
