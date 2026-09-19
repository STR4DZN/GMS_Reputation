/**
 * Retorna a classe base apropriada para ApplicationV2 com suporte nativo a Handlebars.
 * No Foundry VTT v12 e v13: aplica HandlebarsApplicationMixin(ApplicationV2).
 * Fora do Foundry (ex: testes em Node.js): retorna uma classe Standalone compatível.
 */
export function getApplicationV2Base() {
  const api = globalThis.foundry?.applications?.api;
  if (typeof api?.HandlebarsApplicationMixin === "function" && typeof api?.ApplicationV2 === "function") {
    return api.HandlebarsApplicationMixin(api.ApplicationV2);
  }
  if (api?.HandlebarsApplicationV2) {
    return api.HandlebarsApplicationV2;
  }
  if (api?.ApplicationV2) {
    return api.ApplicationV2;
  }
  if (globalThis.Application) {
    return globalThis.Application;
  }
  return class StandaloneApplication {
    constructor(options = {}) {
      this.options = options;
      this.rendered = false;
      this.element = null;
    }
    async render(options = {}) {
      this.rendered = true;
      return this;
    }
    async close(options = {}) {
      this.rendered = false;
      return this;
    }
    bringToTop() {}
  };
}
