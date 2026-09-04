import { isSupportedPortraitSource, normalizePortraitSource } from "../core/portrait.js";

export class PortraitFilePickerUnavailableError extends Error {
  constructor() {
    super("Foundry FilePicker is not available in this session.");
    this.name = "PortraitFilePickerUnavailableError";
  }
}

export function getFilePickerImplementation() {
  const FilePickerAPI = globalThis.foundry?.applications?.apps?.FilePicker;
  return FilePickerAPI?.implementation ?? FilePickerAPI ?? globalThis.FilePicker ?? null;
}

/**
 * Abre o browser de arquivos hospedados do Foundry v13.
 * Retorna a instância aberta; a seleção é entregue por onSelect.
 */
export async function openPortraitFilePicker({ current = "", onSelect = null } = {}) {
  const FilePickerClass = getFilePickerImplementation();
  if (!FilePickerClass) throw new PortraitFilePickerUnavailableError();
  const currentSource = normalizePortraitSource(current);
  const callback = typeof onSelect === "function" ? onSelect : () => {};

  const picker = new FilePickerClass({
    type: "image",
    current: /^https?:\/\//i.test(currentSource) ? "" : currentSource,
    callback: (path) => {
      const source = normalizePortraitSource(path);
      if (!source || !isSupportedPortraitSource(source)) return false;
      callback(source);
      return true;
    }
  });

  try {
    await Promise.resolve(picker.render({ force: true }));
  } catch (primaryError) {
    try {
      await Promise.resolve(picker.render(true));
    } catch (fallbackError) {
      fallbackError.cause ??= primaryError;
      throw fallbackError;
    }
  }

  try { picker.bringToFront?.(); } catch (_error) { /* implementation-dependent */ }
  globalThis.requestAnimationFrame?.(() => {
    try { picker.bringToFront?.(); } catch (_error) { /* implementation-dependent */ }
  });
  return picker;
}
