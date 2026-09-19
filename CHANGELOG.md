# Changelog — GMS // Matriz de Reputação

## [1.2.0-dev.71] - 2026-09-19

### Refatoração Completa Visual, Runtime e Arquitetural (19 Gates Homologados)

#### Visual & Design System
- **CSS Bundle Unificado:** Redução drástica de ~550 KB de folhas legadas para um bundle de **71.89 KB** (`styles/gms-reputation.css`).
- **Double-Bezel Architecture:** Implementação de cascas e miolos concêntricos usinados com relevo interno especular.
- **Responsividade Cirúrgica:** Adoção de `@container` queries nos componentes e workspaces.
- **Acessibilidade:** Suporte a `:focus-visible`, navegação completa por teclado e conformidade com `prefers-reduced-motion`.

#### Runtime & Performance
- **Diff Engine & Render Queue:** Atualizações de estado emitindo diffs refinados coalescidos via microtasks.
- **Motion Engine WAAPI:** Transições e animações nativas aceleradas por hardware com 3 níveis de intensidade.
- **Zero Memory Leaks:** Eliminação de timers e listeners persistentes descontrolados.

#### Segurança & Serviços
- **Authority Broker Seguro:** Validação de autenticidade no socket impedindo personificação de Gamemaster.
- **Histórico Reversível:** Eventos de histórico tipados para todas as mutações com suporte completo a Undo e Redo.
- **Save Controller Desacoplado:** Gestão de rascunhos independente com modos Manual, Automático e Idle.
- **Public API Completa:** Fachada canônica para macros e migração legada carregada sob demanda.
