import { destroyListeners, listen, notify } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { wirePortraitEditor } from "../../components/portrait-editor.js";
import { updateFocalProfile } from "../../data/profile-registry.js";

/** Owns the subject editor and its explicit save button. */
export function wireMasterPortraitControls(root, context, { contextIds, getReason, queueDraft, flushPending }) {
  const listeners = [];
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.PORTRAITS)) return null;
  const editorRoot = root.querySelector("[data-master-portrait-editor] [data-portrait-editor]");
  if (!editorRoot || !context?.selection?.portraitEditor) return null;
  let draftPortrait = context.selection.portraitEditor.portrait;
  const { profileId } = contextIds();
  const { subjectId } = contextIds();
  const editor = wirePortraitEditor(editorRoot, {
    deferImages: true,
    initialPortrait: draftPortrait,
    onChange: (portrait) => {
      draftPortrait = portrait;
      const reason = getReason();
      const snapshot = { ...portrait };
      queueDraft(subjectId, snapshot, profileId, reason);
    },
    onError: (error) => notify("warn", error?.message || "Fonte de retrato inválida.")
  });
  listen(listeners, root.querySelector("[data-master-save-portrait]"), "click", async () => {
    const reason = getReason();
    const snapshot = { ...draftPortrait };
    queueDraft(subjectId, snapshot, profileId, reason);
    await flushPending("Retrato sincronizado.");
  });

  return Object.freeze({ destroy() { editor.destroy(); destroyListeners(listeners); } });
}

/** Focal portrait drafts remain in the panel across renders and in-flight saves. */
export function wireMasterFocalControls(root, context, { hasProfile, contextIds, onPortraitChange, runMutation, saveFormDrafts }) {
  const listeners = [];
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.FOCAL)) return null;
  const editorRoot = root.querySelector("[data-master-focal-editor] [data-portrait-editor]");
  if (!editorRoot || !context?.focalEditor || !hasProfile()) return null;
  let draftPortrait = context.focalEditor.portrait;
  const focalProfileId = context.profileId;
  const editor = wirePortraitEditor(editorRoot, {
    deferImages: true,
    initialPortrait: draftPortrait,
    onChange: (portrait) => { draftPortrait = portrait; onPortraitChange(focalProfileId, portrait); },
    onError: (error) => notify("warn", error?.message || "Fonte de retrato focal inválida.")
  });
  listen(listeners, root.querySelector("[data-master-save-focal]"), "click", async () => {
    const name = String(root.querySelector("[data-master-focal-name]")?.value || "").trim();
    const description = String(root.querySelector("[data-master-focal-description]")?.value || "");
    const { profileId } = contextIds();
    const portrait = { ...draftPortrait };
    await runMutation(
      saveFormDrafts("focal", profileId, () => updateFocalProfile(profileId, { name, description, portrait })),
      "Perfil focal atualizado."
    );
  });

  return Object.freeze({ destroy() { editor.destroy(); destroyListeners(listeners); } });
}
