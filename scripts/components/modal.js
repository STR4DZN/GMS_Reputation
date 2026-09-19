/**
 * Central de Confirmações e Diálogos Modais (Seção 59).
 * confirm.danger(), confirm.action(), confirm.restore()
 */

export class ConfirmManager {
  static async danger({
    title = "Ação Destrutiva Permanente",
    content = "Tem certeza de que deseja prosseguir? Esta ação não pode ser desfeita.",
    confirmLabel = "Excluir Permanentemente"
  } = {}) {
    if (globalThis.foundry?.applications?.api?.DialogV2?.confirm) {
      return globalThis.foundry.applications.api.DialogV2.confirm({
        window: { title, icon: "fa-solid fa-triangle-exclamation" },
        content: `<p class="gms-dialog-danger-text">${content}</p>`,
        yes: { label: confirmLabel, icon: "fa-solid fa-trash-can" },
        no: { label: "Cancelar", icon: "fa-solid fa-xmark" },
        rejectClose: false
      });
    }
    return globalThis.confirm?.(`${title}\n\n${content}`) ?? true;
  }

  static async action({
    title = "Confirmar Ação",
    content = "Deseja aplicar as modificações?",
    confirmLabel = "Confirmar"
  } = {}) {
    if (globalThis.foundry?.applications?.api?.DialogV2?.confirm) {
      return globalThis.foundry.applications.api.DialogV2.confirm({
        window: { title, icon: "fa-solid fa-circle-question" },
        content: `<p>${content}</p>`,
        yes: { label: confirmLabel, icon: "fa-solid fa-check" },
        no: { label: "Cancelar", icon: "fa-solid fa-xmark" },
        rejectClose: false
      });
    }
    return globalThis.confirm?.(`${title}\n\n${content}`) ?? true;
  }

  static async restore({
    title = "Restaurar Backup Mundial",
    content = "O WorldState atual será substituído integralmente pelo backup. Deseja continuar?",
    confirmLabel = "Restaurar Backup"
  } = {}) {
    if (globalThis.foundry?.applications?.api?.DialogV2?.confirm) {
      return globalThis.foundry.applications.api.DialogV2.confirm({
        window: { title, icon: "fa-solid fa-clock-rotate-left" },
        content: `<p class="gms-dialog-danger-text">${content}</p>`,
        yes: { label: confirmLabel, icon: "fa-solid fa-rotate-left" },
        no: { label: "Cancelar", icon: "fa-solid fa-xmark" },
        rejectClose: false
      });
    }
    return globalThis.confirm?.(`${title}\n\n${content}`) ?? true;
  }
}

export const confirm = ConfirmManager;
