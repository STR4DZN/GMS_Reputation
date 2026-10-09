function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export async function confirmMasterAction({ title, message, confirmLabel = "Confirmar" } = {}) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2?.confirm === "function") {
    return DialogV2.confirm({
      window: { title: String(title || "Confirmar operação"), icon: "fa-solid fa-triangle-exclamation" },
      content: `<p>${escapeHTML(message)}</p>`,
      yes: { label: String(confirmLabel || "Confirmar"), icon: "fa-solid fa-check" },
      no: { label: "Cancelar", icon: "fa-solid fa-xmark" },
      rejectClose: false,
      modal: true
    });
  }
  if (typeof globalThis.confirm === "function") return globalThis.confirm(String(message || title || "Confirmar?"));
  return true;
}
