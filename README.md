# GMS // Matriz de Reputação

**Versão:** `1.2.0-dev.71`  
**Foundry VTT:** v13 — mínimo `13.341`, verificado para `13.351`.  
**Arquitetura:** Refatoração Visual, Runtime e UX Completa (19 Gates Homologados).

Módulo de reputação social para Foundry VTT v13 com dashboards separados para Jogador e Mestre, matrizes/perfis, personagens, retratos usinados, reputação em passos de 0,5, protocolos especiais (**Vínculo**, **Comunhão** e **Duplo//Sinc**), histórico reversível, Undo/Redo, backup instantâneo, autoridade de rede segura e alta performance nativa.

---

## 1. Destaques da Geração 1.2.0-dev.71

- **CSS Unificado de Alta Performance:** Substituição de ~550 KB de folhas legadas acumuladas por um bundle otimizado de **71.89 KB** (`styles/gms-reputation.css`). Zero `!important` desnecessários.
- **Design System Double-Bezel (Doppelrand):** Cards e painéis usinados em dupla camada com bordas concêntricas e realce de luz interior (`inset 0 1px 1px rgba(255, 255, 255, 0.04)`).
- **Zero Imagens por IA:** Apresentação 100% autêntica baseada em sigilos vetoriais SVG oficiais e geometria botânica procedural.
- **Motion Engine WAAPI:** Motor de animações acelerado por hardware usando Web Animations API nativa, com 3 perfis (`FULL`, `STANDARD`, `MINIMAL`) e respeito estrito a `prefers-reduced-motion`.
- **Domínio Puro & Zero Migração:** Persistência congelada no **Schema v5** (`DATA_SCHEMA_VERSION = 5`). Seus dados anteriores são carregados perfeitamente sem necessidade de migração forçada.
- **Segurança Reforçada no Authority Broker:** Transporte autenticado que impede falsificação de identidade de Gamemaster (`senderId` spoofing), com suporte nativo a SocketLib e fallback seguro.
- **Diff Engine & Render Queue Coalescida:** Mutações agrupadas em microtasks/rAF, eliminando re-renders completos e flickering.

---

## 2. Instalação e Atualização no Foundry VTT

No Foundry VTT, vá para **Add-on Modules** > **Install Module** e cole o URL do manifesto:

```text
https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/main/module.json
```

O Foundry baixará automaticamente o pacote oficial da release:
`GMS_Reputation_1.2.0-dev.71.zip`

---

## 3. Workspaces do Mestre

O Painel do Mestre (`MasterShellApplication`) é organizado em 6 estações de trabalho especializadas:

1. **Perfis (Matrizes):** Biblioteca de perfis, organização de grupos e perfil focal.
2. **Personagens (Cadastro):** Roster de personagens, editor de retratos com zoom/pan e disponibilidade.
3. **Reputação (Relações):** Console central com Heart Track responsivo, botões de passo rápido (`[-1] [-0.5] [+0.5] [+1]`), ativação de protocolos e ações em lote (Bulk).
4. **Histórico (Auditoria):** Timeline auditável com filtros por tipo de evento e gatilho de Undo/Redo com alvo contextual.
5. **Limpeza (Manutenção):** Área isolada para expurgo permanente com pré-visualização de impacto.
6. **Sistema (Controle):** Modo de salvamento (Manual, Automático, Idle), matriz granular de permissões por papéis, backup e diagnósticos.

---

## 4. Testes e Validação

Para compilar o CSS, auditar a integridade e executar os 32 testes automatizados:

```bash
# Instalar ferramentas locais se necessário
npm install

# Compilar folha CSS unificada
npm run build:css

# Auditar dead code e integridade de imports/templates
npm run audit

# Executar suíte de testes unitários e de integração (32 testes)
npm test

# Pipeline completa
npm run build
```

---

## 5. Licença

Distribuído sob licença MIT. Desenvolvido para a comunidade Foundry VTT.
