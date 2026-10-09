# Architecture 60 — Compatibility First

## Objetivo

Reorganizar internamente o GMS // Matriz de Reputação sem alterar os dados existentes, o comportamento de jogo, a API pública, o DOM visual ou o schema persistente durante a fase de compatibilidade.

## Contratos congelados

Durante a Architecture 60 inicial:

- `MODULE_ID` permanece `gms-reputation`;
- `DATA_SCHEMA_VERSION` permanece `5`;
- `worldState`, `worldStateBackup`, `masterSaveMode`, `masterAutoSaveDelay` e `permissions` permanecem as chaves canônicas;
- o canal socket permanece `module.gms-reputation`;
- os hooks `gmsReputationWorldStateChanged` e `gmsReputationPermissionsChanged` permanecem válidos;
- IDs de Groups, Subjects e Profiles nunca são regenerados por refactor;
- `relationships`, Vínculo, Comunhão, Duplo//Sinc, revision, backup e authority broker mantêm as semânticas atuais;
- a API `game.modules.get("gms-reputation").api` mantém os namespaces públicos da 59.10;
- a primeira fase não exige migração de WorldState.

## Fase A — concluída em 1.2.0-dev.60.1

A primeira fase adiciona arquitetura em paralelo, sem substituir o comportamento comprovado da 59.10:

- `scripts/architecture/contracts.js` formaliza contratos externos congelados;
- `scripts/compatibility/public-api.js` vira a facade de compatibilidade da API pública;
- `scripts/infrastructure/world-state-repository.js` cria o seam de Repository, delegando 1:1 ao WorldStore existente;
- `scripts/application/commands/*` cria facades de comandos que ainda delegam aos registries atuais;
- `scripts/application/queries/world-state-query.js` cria índices/read models puros sem persistência;
- `tests/fixtures/worldstate/*` cria Golden WorldStates para detectar perda de IDs/dados e regressões de normalização;
- novos testes verificam schema, settings, hooks, socket, API, repository e Golden States.

## Regra de migração interna

Nenhuma camada antiga é removida no mesmo bloco em que sua substituta nasce. O processo é:

1. criar seam/facade nova;
2. provar equivalência com testes;
3. migrar um consumidor por vez;
4. manter adapter de compatibilidade;
5. remover código antigo somente quando não houver mais consumidores e todos os testes de Golden State continuarem verdes.

## Divisão do painel do Mestre

O arquivo principal passou de 1.570 para 1.180 linhas com a primeira extração e agora tem 805 linhas após a separação dos controles (375 linhas a menos nesta segunda etapa). Templates, CSS, schema e regras permanecem iguais. A divisão é por responsabilidade:

| Arquivo | Responsabilidade |
| --- | --- |
| `scripts/apps/master/context.js` | Montar dados para os templates, seletores, histórico, permissões e status de backup |
| `scripts/apps/master/workspaces.js` | Definir áreas, painéis e aliases antigos de navegação |
| `scripts/apps/master/player-bindings.js` | Controlar abas de Sistema e eventos dos vínculos de jogadores |
| `scripts/apps/master/registry-controls.js` | Cadastro, busca, grupos, perfis, personagens, roster e ordenação individual |
| `scripts/apps/master/relationship-controls.js` | Prévia de score, meios pontos, corações e protocolos |
| `scripts/apps/master/portrait-controls.js` | Editores de retratos de personagens/focais e seus botões de salvar |
| `scripts/apps/master/bulk-controls.js` | Seleção e ações em massa, com confirmações |
| `scripts/apps/master/cleanup-controls.js` | Busca, desbloqueio e exclusão permanente dos três tipos de registro |
| `scripts/apps/master/confirmation.js` | Confirmação DialogV2/fallback e escape do conteúdo |
| `scripts/apps/master-panel.js` | Coordenar ciclo de vida, navegação, mapas de rascunhos e callbacks de salvamento |
| `scripts/apps/master/save-controller.js` | Serializar as operações de salvamento, como antes |

`buildMasterPanelContext` continua exportado de `scripts/apps/master-panel.js`, com a mesma referência da implementação em `master/context.js`. Os exports da aplicação e da API pública permanecem iguais. A montagem do contexto não grava dados nem modifica o estado recebido.

O controlador de vínculos recebe a autorização, a aba ativa, o mapa de rascunhos e callbacks de integração. O mapa continua pertencendo à aplicação para sobreviver às renderizações. O controlador remove seus próprios eventos de mouse, teclado e formulário ao ser destruído. Cada salvamento usa um snapshot; uma confirmação não elimina escolhas mais novas nem rascunhos de outro usuário. A persistência de flags continua revalidando a permissão de GM e não altera a revisão do WorldState.

Os controles de edição recebem callbacks pequenos para ler a seleção, identificar o contexto do DOM, navegar, registrar rascunhos e executar mutations. Não recebem a instância inteira da aplicação nem criam outra fila de gravação. `_runMutation`, `_saveFormDrafts`, os mapas de rascunhos e `MasterSaveController` permanecem no painel. Assim, a captura dos IDs e a limpeza por identidade do snapshot continuam protegendo edições durante uma gravação.

Cadastro, relação, bulk e limpeza removem seus próprios listeners em `destroy()`. Os controladores de retratos também destroem o editor embutido e seus botões. A aplicação descarta os controladores ao renderizar novamente e ao fechar. Seletores, confirmações, mensagens, gates de autorização e as funções de persistência são os mesmos; a exclusão permanente continua revalidando GM completo na camada de dados após a confirmação.

### Validação da extração

- Comparação de **3.234 contextos** antes/depois, com cinco Golden WorldStates, GM/Assistant/Player, IDs existentes/ausentes, áreas atuais e aliases antigos, e ambas as abas de Sistema: resultados idênticos, exports iguais e nenhuma escrita/mutação de estado.
- Teste específico do controlador: teclado, correspondência por nome, rascunhos concorrentes, falhas de gravação, permissão revogada, remoção de vínculo e limpeza de listeners.
- Teste específico dos controles: exclusão bloqueada/cancelada sem escrita, escape de nomes em DialogV2, revogação de permissão enquanto a confirmação está aberta, backup/referências, gates de leitura e destruição idempotente.
- `browser-master-controls.py`: criação via Enter, edição, busca com acentos, inclusão/remoção do roster, ordenação, focal/retrato calibrados, meios pontos, bulk, cancelamento, desbloqueio, três tipos de exclusão e backups. Controles retidos de uma renderização anterior ou do painel fechado ficam inativos; Assistant mantém edição, mas não acessa Limpeza.
- Comparação do mesmo fluxo no navegador contra `df6cfad33a1158fb00f0f9699a3de552ffca8e54`: **13 checkpoints idênticos** de WorldState, backup, seleção, notificações, visibilidade dos painéis e mapas de rascunhos. IDs são determinísticos no teste; apenas horários e o trecho temporal dos IDs de transação são normalizados na comparação.
- 28 arquivos de testes Node e as três integrações no navegador passaram. Navegação continua cobrindo rascunhos concorrentes, e retratos continuam cobrindo enquadramento e 30 personagens/25 GIFs.

Para reproduzir a comparação usando o commit imediatamente anterior à extração:

```sh
git worktree add --detach ../gms-master-baseline b9e0ed65c69ac197c44647f5dcec9b26091f0560
node tools/compare-master-context.mjs ../gms-master-baseline
```

Para comparar os controles, crie outro checkout no commit imediatamente anterior à segunda extração:

```sh
git worktree add --detach ../gms-controls-baseline df6cfad33a1158fb00f0f9699a3de552ffca8e54
```

Instale as dependências em ambos os checkouts e inicie `node visualizer/serve.mjs` em terminais separados: checkout atual em `PORT=8766`, baseline em `PORT=8767`. Com Python Playwright e Chromium instalados, execute o teste atual contra ambas as prévias (use `CHROMIUM_PATH` se necessário):

```sh
GMS_PREVIEW_URL=http://127.0.0.1:8767 GMS_CONTROL_TRACE=/tmp/gms-controls-before.json python tests/browser-master-controls.py
GMS_PREVIEW_URL=http://127.0.0.1:8766 GMS_CONTROL_TRACE=/tmp/gms-controls-after.json python tests/browser-master-controls.py
diff -u /tmp/gms-controls-before.json /tmp/gms-controls-after.json
```

A comparação de contextos usa dados e serviços simulados em um processo Node separado. A suíte normal continua sendo executada com `npm test`; a prévia não substitui a validação em um mundo Foundry.

## Próximas fases

- B: Queries por seção do Mestre e índices compartilhados;
- C: separação de contexto, áreas, vínculos, cadastro, edição, retratos, bulk e limpeza concluída; configuração, histórico e coordenação de navegação continuam no painel;
- D: Commands passam a centralizar mutations/transações;
- E: templates Mestre divididos em partials mantendo DOM equivalente;
- F: consolidar regras legadas depois da separação das fontes CSS e geração de uma única folha final, já implementadas;
- G: limpeza de legacy interno comprovadamente sem consumidores;
- H: schema 6 somente se existir necessidade funcional real e com migração explícita.
