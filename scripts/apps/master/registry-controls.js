import { destroyListeners, listen, notify } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { normalizeUiSearch } from "./context.js";
import { createNewSubject, updateSubject, moveSubjectOneStep } from "../../data/subject-registry.js";
import { createNewProfile, setProfileSubjectIncluded, updateProfile, moveProfileOneStep } from "../../data/profile-registry.js";
import { createNewGroup, renameGroup, moveGroup } from "../../data/group-registry.js";

/** Owns registry DOM events; selection, drafts and mutations remain application-owned. */
export function wireMasterRegistryControls(root, {
  getSelection, contextIds, navigate, runMutation, saveFormDrafts,
  onProfileChange, onNewProfileGroupChange, isRendered, render
}) {
  const listeners = [];
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) return null;

  const profileListSearch = root.querySelector("[data-master-profile-list-search]");
  listen(listeners, profileListSearch, "input", () => {
    const query = normalizeUiSearch(profileListSearch?.value);
    for (const group of root.querySelectorAll(".gms-master-profile-group")) {
      const groupLabel = normalizeUiSearch(group.querySelector(".gms-master-profile-group__summary-copy")?.textContent || "");
      let visible = 0;
      for (const entry of group.querySelectorAll("[data-master-profile-choice]")) {
        const match = !query || groupLabel.includes(query) || normalizeUiSearch(entry.textContent).includes(query);
        entry.hidden = !match;
        if (match) visible += 1;
      }
      group.hidden = Boolean(query) && visible === 0;
      if (query && visible > 0) group.open = true;
    }
  });

  const characterListSearch = root.querySelector("[data-master-character-list-search]");
  listen(listeners, characterListSearch, "input", () => {
    const query = normalizeUiSearch(characterListSearch?.value);
    for (const row of root.querySelectorAll(".gms-master-subject-registry__list > article")) {
      row.hidden = Boolean(query) && !normalizeUiSearch(row.textContent).includes(query);
    }
  });

  const groupName = root.querySelector("[data-master-new-group-name]");
  const createGroupButton = root.querySelector("[data-master-create-group]");
  const createGroupAction = async () => {
    const name = String(groupName?.value || "").trim();
    if (!name) { notify("warn", "Informe o nome do novo grupo de perfis."); return; }
    const result = await runMutation(() => createNewGroup({ name }), `Grupo de perfis “${name}” criado.`);
    const created = Object.values(result?.groups ?? {}).find((entry) => String(entry.name || "").localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
    if (created?.id) { onNewProfileGroupChange(created.id); if (isRendered()) await render({ force: true }); }
  };
  listen(listeners, createGroupButton, "click", createGroupAction);
  listen(listeners, groupName, "keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); createGroupAction(); } });

  const profileNameInput = root.querySelector("[data-master-new-profile-name]");
  const focalNameInput = root.querySelector("[data-master-new-profile-focal-name]");
  const createProfileButton = root.querySelector("[data-master-create-profile]");
  const createProfileAction = async () => {
    const name = String(profileNameInput?.value || "").trim();
    const focalName = String(focalNameInput?.value || "").trim();
    if (!name) { notify("warn", "Informe o nome do novo perfil de reputação."); return; }
    const groupId = getSelection().newProfileGroupId === "__ungrouped__" ? null : getSelection().newProfileGroupId;
    const result = await runMutation(() => createNewProfile({ name, focalName: focalName || name, groupId }), `Perfil “${name}” criado.`);
    const created = Object.values(result?.profiles ?? {}).find((entry) => String(entry.name || "").localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
    if (created?.id) { onProfileChange(created.id); if (isRendered()) await render({ force: true }); }
  };
  listen(listeners, createProfileButton, "click", createProfileAction);

  const aliasInput = root.querySelector("[data-master-new-subject-alias]");
  const realNameInput = root.querySelector("[data-master-new-subject-real-name]");
  const createSubjectButton = root.querySelector("[data-master-create-subject]");
  const createSubjectAction = async () => {
    const alias = String(aliasInput?.value || "").trim();
    const realName = String(realNameInput?.value || "").trim();
    if (!alias && !realName) { notify("warn", "Informe ao menos o apelido ou o nome real do personagem."); return; }
    await runMutation(() => createNewSubject({ alias, realName }), `Personagem “${alias || realName}” criado.`);
  };
  listen(listeners, createSubjectButton, "click", createSubjectAction);

  const profileEditorGroupButtons = [...root.querySelectorAll("[data-master-profile-editor-group-choice]")];
  for (const button of profileEditorGroupButtons) {
    listen(listeners, button, "click", () => {
      for (const peer of profileEditorGroupButtons) {
        const active = peer === button;
        peer.dataset.active = String(active);
        peer.setAttribute("aria-pressed", String(active));
      }
    });
  }

  listen(listeners, root.querySelector("[data-master-save-profile-editor]"), "click", async () => {
    if (!getSelection().profileId) return;
    const name = String(root.querySelector("[data-master-profile-editor-name]")?.value || "").trim();
    const active = Boolean(root.querySelector("[data-master-profile-editor-active]")?.checked);
    const archived = Boolean(root.querySelector("[data-master-profile-editor-archived]")?.checked);
    const selectedGroup = profileEditorGroupButtons.find((button) => button.getAttribute("aria-pressed") === "true");
    const groupId = String(selectedGroup?.dataset.masterProfileEditorGroupChoice || "__ungrouped__");
    if (!name) { notify("warn", "Informe o nome da matriz."); return; }
    const { profileId } = contextIds();
    await runMutation(
      saveFormDrafts("profile-editor", profileId, () => updateProfile(profileId, { name, groupId, active, archived })),
      "Perfil atualizado."
    );
  });

  for (const button of root.querySelectorAll("[data-master-profile-move]")) {
    listen(listeners, button, "click", async () => {
      if (!getSelection().profileId) return;
      const { profileId } = contextIds();
      await runMutation(
        () => moveProfileOneStep(profileId, button.dataset.masterProfileMove),
        "Ordem do perfil atualizada."
      );
    });
  }

  for (const button of root.querySelectorAll("[data-master-new-profile-group-choice]")) {
    listen(listeners, button, "click", () => {
      onNewProfileGroupChange(String(button.dataset.masterNewProfileGroupChoice || "__ungrouped__"));
      for (const peer of root.querySelectorAll("[data-master-new-profile-group-choice]")) {
        const active = String(peer.dataset.masterNewProfileGroupChoice || "") === getSelection().newProfileGroupId;
        peer.dataset.active = String(active);
        peer.setAttribute("aria-pressed", String(active));
      }
    });
  }

  for (const button of root.querySelectorAll("[data-master-profile-roster-toggle]")) {
    listen(listeners, button, "click", async (event) => {
      event.stopPropagation?.();
      if (!getSelection().profileId) return;
      const subjectId = String(button.dataset.masterProfileRosterToggle || "");
      const included = String(button.dataset.inProfile) !== "true";
      const { profileId } = contextIds();
      await runMutation(
        () => setProfileSubjectIncluded(profileId, subjectId, included),
        included ? "Personagem adicionado ao perfil." : "Personagem removido do perfil."
      );
    });
  }

  for (const button of root.querySelectorAll("[data-master-group-save]")) {
    listen(listeners, button, "click", async () => {
      const row = button.closest("[data-master-group]");
      const id = String(row?.dataset.masterGroup || "");
      const input = row?.querySelector?.("[data-master-group-name]");
      await runMutation(() => renameGroup(id, input?.value), "Nome do grupo de perfis atualizado.");
    });
  }
  for (const button of root.querySelectorAll("[data-master-group-move]")) {
    listen(listeners, button, "click", async () => {
      const row = button.closest("[data-master-group]");
      await runMutation(() => moveGroup(row?.dataset.masterGroup, button.dataset.masterGroupMove), "Ordem dos grupos de perfis atualizada.");
    });
  }
  for (const button of root.querySelectorAll("[data-master-profile-choice]")) {
    listen(listeners, button, "click", async () => {
      const id = String(button.dataset.masterProfileChoice || "");
      if (!id || id === getSelection().profileId) return;
      await navigate({ profileId: id });
    });
  }

  listen(listeners, root.querySelector("[data-master-save-subject]"), "click", async () => {
    if (!getSelection().subjectId) return;
    const alias = String(root.querySelector("[data-master-subject-alias]")?.value || "").trim();
    const realName = String(root.querySelector("[data-master-subject-real-name]")?.value || "").trim();
    const description = String(root.querySelector("[data-master-subject-description]")?.value || "");
    const tags = String(root.querySelector("[data-master-subject-tags]")?.value || "")
      .split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean);
    const active = Boolean(root.querySelector("[data-master-subject-active]")?.checked);
    const archived = Boolean(root.querySelector("[data-master-subject-archived]")?.checked);
    if (!alias && !realName) { notify("warn", "Informe ao menos o apelido ou o nome real do personagem."); return; }
    const { subjectId } = contextIds();
    await runMutation(
      saveFormDrafts("subject", subjectId, () => updateSubject(subjectId, { alias, realName, description, active, archived, metadata: { tags } }, { reason: "Cadastro editado no Command Deck" })),
      "Cadastro do personagem atualizado."
    );
  });

  for (const button of root.querySelectorAll("[data-master-subject-move]")) {
    listen(listeners, button, "click", async () => {
      if (!getSelection().subjectId) return;
      const { subjectId } = contextIds();
      await runMutation(
        () => moveSubjectOneStep(subjectId, button.dataset.masterSubjectMove),
        "Ordem dos personagens atualizada."
      );
    });
  }

  return Object.freeze({ destroy() { destroyListeners(listeners); } });
}
