import { destroyListeners, listen, notify } from "../application-compat.js";
import { wireTablistKeyboard } from "../../utils/accessibility.js";
import { campaignUsers, getPersonalBinding, setUserPersonalBinding } from "../../persistence/personal-reputation.js";

/** Owns settings-tab and player-binding listeners; drafts remain application-owned. */
export function wireMasterPlayerBindings(root, {
  isFullGM = false,
  selectedTab = "general",
  drafts = new Map(),
  onTabChange = null,
  onSaved = null
} = {}) {
  const listeners = [];
  const tabs = root.querySelector("[data-master-settings-tabs]");
  const selectTab = (tab) => {
    const activeTab = tab === "players" ? "players" : "general";
    onTabChange?.(activeTab);
    for (const button of tabs?.querySelectorAll?.("[data-master-settings-tab]") ?? []) {
      const active = button.dataset.masterSettingsTab === activeTab;
      button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
    }
    for (const panel of root.querySelectorAll("[data-master-settings-pane]")) panel.hidden = panel.dataset.masterSettingsPane !== activeTab;
  };
  for (const button of tabs?.querySelectorAll?.("[data-master-settings-tab]") ?? []) {
    listen(listeners, button, "click", () => selectTab(button.dataset.masterSettingsTab));
  }
  const keyboard = wireTablistKeyboard(tabs);
  selectTab(selectedTab);

  if (isFullGM) for (const row of root.querySelectorAll("[data-player-binding-user]")) {
    const profile = row.querySelector("[data-player-binding-profile]");
    const subject = row.querySelector("[data-player-binding-subject]");
    const button = row.querySelector("[data-player-binding-save]");
    const capture = () => {
      const target = { profileId: String(profile.value || ""), subjectId: profile.value ? String(subject.value || "") : "" };
      const user = campaignUsers().find(entry => String(entry.id) === row.dataset.playerBindingUser);
      const current = getPersonalBinding(user);
      const changed = current.profileId !== target.profileId || current.subjectId !== target.subjectId;
      if (changed) drafts.set(row.dataset.playerBindingUser, target); else drafts.delete(row.dataset.playerBindingUser);
      const hint = row.querySelector("[data-player-binding-hint]");
      if (hint) hint.textContent = changed ? "Escolha pendente. Clique em Salvar vínculo para confirmar." : target.profileId ? "Vínculo configurado. A leitura é individual para esse usuário." : "Sem vínculo: esse usuário não recebe avisos pessoais.";
    };
    listen(listeners, subject, "change", capture);
    listen(listeners, profile, "change", () => {
      const match = profile.selectedOptions?.[0]?.dataset?.profileSubject || "";
      subject.value = match;
      capture();
      const hint = row.querySelector("[data-player-binding-hint]");
      if (hint) hint.textContent = !profile.value ? "Sem vínculo: esse usuário não recebe avisos pessoais." : match ? "Personagem encontrado pelo nome. Confira antes de salvar." : "Escolha o personagem que representa esse perfil nas outras matrizes.";
    });
    listen(listeners, button, "click", async () => {
      const target = { profileId: String(profile.value || ""), subjectId: profile.value ? String(subject.value || "") : "" };
      button.disabled = true;
      try {
        await setUserPersonalBinding(row.dataset.playerBindingUser, target);
        const pending = drafts.get(row.dataset.playerBindingUser);
        if (pending?.profileId === target.profileId && pending?.subjectId === target.subjectId) drafts.delete(row.dataset.playerBindingUser);
        notify("info", target.profileId ? "Vínculo do jogador salvo." : "Vínculo do jogador removido.");
        await onSaved?.();
      } catch (error) { notify("error", error?.message || "Não foi possível salvar o vínculo do jogador."); }
      finally { if (button.isConnected) button.disabled = false; }
    });
  }

  return Object.freeze({
    destroy() {
      keyboard.destroy();
      destroyListeners(listeners);
    }
  });
}
