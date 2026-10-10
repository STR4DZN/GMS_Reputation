import { destroyListeners, listen } from "../application-compat.js";
import { wireSmartSelector } from "../../components/smart-selector.js";
import { adjacentId, wireNavigationPalette } from "../../ui/navigation.js";
import { openPlayerDashboard } from "../player-dashboard.js";
import { SECTIONS, WORKSPACE_PANELS, normalizeWorkspace } from "./workspaces.js";

export function setMasterWorkspace(root, sectionId, { animate = true, scrollPositions, getSelection, onSectionChange, getMotionController, trail }) {
  const workspace = normalizeWorkspace(sectionId);
  const visiblePanels = new Set(WORKSPACE_PANELS[workspace]);
  const content = root.querySelector(".gms-master-panel__content");
  if (content && animate) scrollPositions.set(getSelection().activeSection, content.scrollTop);
  onSectionChange(workspace);
  root.dataset.masterActiveSection = workspace;
  for (const button of root.querySelectorAll("[data-master-section-choice]")) {
    const active = button.dataset.masterSectionChoice === workspace;
    button.dataset.active = String(active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active) button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  if (content) content.scrollTop = scrollPositions.get(workspace) ?? 0;
  const location = root.querySelector("[data-navigation-location]");
  if (location) location.textContent = SECTIONS.find(([id]) => id === workspace)?.[1] ?? "Perfis";
  updateMasterNavigationState(root, trail);
  const panels = [...root.querySelectorAll("[data-master-section-panel]")];
  for (const panel of panels) {
    const visible = visiblePanels.has(String(panel.dataset.masterSectionPanel || ""));
    panel.hidden = !visible;
    panel.dataset.workspaceVisible = String(visible);
  }
  if (animate) {
    panels
      .filter((panel) => !panel.hidden)
      .forEach((panel, order) => getMotionController()?.section?.(panel, order));
  }
}

export function updateMasterNavigationState(root, trail) {
  const back = root?.querySelector?.("[data-navigation-back]");
  const forward = root?.querySelector?.("[data-navigation-forward]");
  if (back) back.disabled = !trail.canBack;
  if (forward) forward.disabled = !trail.canForward;
}

export function wireMasterNavigation(root, context, { navigate, trail, getSelection, captureDrafts }) {
  const listeners = [];
  const palette = wireNavigationPalette(root, {
    items: [
      ...context.sections.map((section) => ({ label: section.label, description: section.kicker, group: "ÁREAS", target: { activeSection: section.id } })),
      ...context.profiles.map((profile) => ({ label: profile.name, description: profile.groupName, group: "PERFIS", target: { profileId: profile.id } })),
      ...context.subjects.map((subject) => ({ label: subject.alias, description: subject.realName, group: "PERSONAGENS", target: { subjectId: subject.id, activeSection: "relationship" } }))
    ], onNavigate: (target) => navigate(target)
  });
  const travel = (direction) => {
    if (!(direction < 0 ? trail.canBack : trail.canForward)) return;
    return navigate(direction < 0 ? trail.back() : trail.forward(), { record: false });
  };
  listen(listeners, root.querySelector("[data-navigation-back]"), "click", () => travel(-1));
  listen(listeners, root.querySelector("[data-navigation-forward]"), "click", () => travel(1));
  listen(listeners, root, "keydown", (event) => {
    if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); travel(event.key === "ArrowLeft" ? -1 : 1); }
  });
  listen(listeners, root, "input", () => captureDrafts());
  listen(listeners, root, "change", () => captureDrafts());
  for (const button of root.querySelectorAll("[data-navigation-subject-step]")) listen(listeners, button, "click", () => {
    const id = adjacentId(context.subjects, getSelection().subjectId, Number(button.dataset.navigationSubjectStep));
    if (id) return navigate({ subjectId: id });
  });
  listen(listeners, root.querySelector("[data-master-open-player]"), "click", () => openPlayerDashboard({ profileId: getSelection().profileId }));
  updateMasterNavigationState(root, trail);
  return Object.freeze({ destroy() { palette.destroy(); destroyListeners(listeners); } });
}

export function wireMasterSelectionControls(root, { navigate }) {
  const listeners = [];
  const profileSelector = root.querySelector('[data-smart-selector="master-profile"]');
  const subjectSelector = root.querySelector('[data-smart-selector="master-subject"]');
  const profile = wireSmartSelector(profileSelector, {
    onSelect: (value) => navigate({ profileId: String(value || "") })
  });
  const subject = wireSmartSelector(subjectSelector, {
    onSelect: (value) => navigate({ subjectId: String(value || "") })
  });
  for (const button of root.querySelectorAll("[data-master-subject-choice]")) {
    listen(listeners, button, "click", async () => {
      await navigate({ subjectId: String(button.dataset.masterSubjectChoice || "") });
    });
  }
  for (const button of root.querySelectorAll("[data-master-section-choice]")) listen(listeners, button, "click", () => navigate({ activeSection: button.dataset.masterSectionChoice }));

  return Object.freeze({ destroy() { profile.destroy(); subject.destroy(); destroyListeners(listeners); } });
}
