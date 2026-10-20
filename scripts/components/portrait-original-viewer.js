import {normalizePortraitSource} from "../core/portrait.js";

/** Read-only native view. Never touches a Portrait or any persistence callback. */
export function openPortraitOriginal(root, {source = "", label = "Imagem original", returnFocus = null} = {}) {
  const src = normalizePortraitSource(source);
  if (!src || !root?.ownerDocument) return null;
  const doc = root.ownerDocument, host = root.closest?.("#gms-reputation-master-panel") ?? root;
  const dialog = doc.createElement("dialog"), header = doc.createElement("header"),
    title = doc.createElement("strong"), close = doc.createElement("button"),
    stage = doc.createElement("div"), image = doc.createElement("img"), status = doc.createElement("p");
  dialog.className = "gms-portrait-original";
  dialog.dataset.portraitOriginal = "true";
  dialog.setAttribute("aria-label", label);
  title.textContent = "Imagem original";
  close.type = "button"; close.textContent = "Fechar"; close.autofocus = true;
  close.dataset.portraitOriginalClose = "true";
  stage.className = "gms-portrait-original__stage";
  image.className = "gms-portrait-original__image";
  image.alt = label; image.draggable = false;
  status.textContent = "Carregando o original…";
  status.setAttribute("role", "status");
  const cleanup = () => {
    dialog.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  };
  const dismiss = () => { if (dialog.open) dialog.close(); else cleanup(); };
  close.addEventListener("click", dismiss);
  dialog.addEventListener("close", cleanup, {once:true});
  dialog.addEventListener("cancel", (event) => {event.preventDefault(); dismiss();});
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") event.stopPropagation(); });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if(event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
  });
  image.addEventListener("load", () => {status.textContent = `${image.naturalWidth} × ${image.naturalHeight} px · imagem completa, sem o enquadramento da ficha`;});
  image.addEventListener("error", () => {status.textContent = "Não foi possível abrir o original. O retrato salvo permanece intacto.";});
  header.append(title,close); stage.append(image); dialog.append(header,stage,status);host.append(dialog);
  image.src = src;
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  return {destroy() { if(dialog.open) dialog.close(); else cleanup(); }};
}
