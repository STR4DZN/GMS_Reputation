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

## Próximas fases

- B: Queries por seção do Mestre e índices compartilhados;
- C: Controllers por seção, reduzindo o `master-panel.js`;
- D: Commands passam a centralizar mutations/transações;
- E: templates Mestre divididos em partials mantendo DOM equivalente;
- F: CSS source modular + build para uma única folha final;
- G: limpeza de legacy interno comprovadamente sem consumidores;
- H: schema 6 somente se existir necessidade funcional real e com migração explícita.
