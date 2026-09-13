# GMS // Matriz de Reputação

**Versão:** `1.2.0-dev.60.6`  
**Foundry VTT:** v13 — mínimo `13.341`, verificado para `13.351`.
**Dependência:** SocketLib `1.1.3+` (recomendado `1.1.4`).

Módulo de reputação social com interfaces separadas para Player e Mestre, perfis/matrizes, personagens, retratos, reputação em passos de 0,5, Vínculo, Comunhão, Duplo//Sinc derivado, histórico, Undo/Redo, backup, permissões, sincronização e migração da macro legada.

## 60.6 — correção estrutural de layout

A 60.6 corrige a regressão introduzida na 60.5 em que regras legadas de grid empurravam o dossiê do Player para baixo da sidebar, comprimindo cards e deixando grande área vazia. O novo reparo fixa explicitamente sidebar e conteúdo nas colunas corretas e move os breakpoints estruturais para `@container`, fazendo Player e Mestre responderem à largura real da janela do Foundry em vez do viewport inteiro.

O Schema permanece em **5** e não há migração de WorldState.

## Architecture 60 — Fase A

A versão `1.2.0-dev.60.1` inicia uma refatoração **compatibility-first**. O schema persistente continua em **5**, o `MODULE_ID` continua `gms-reputation`, as chaves do WorldState permanecem iguais e nenhuma migração de dados é necessária. A nova arquitetura nasce em paralelo através de Contracts, Compatibility Facade, Repository, Commands, Queries e Golden WorldStates. Consulte `docs/ARCHITECTURE_60.md`.

## Atualização pelo Foundry

O módulo publica os campos oficiais `url`, `manifest` e `download`. O Foundry pode instalar pelo URL do manifesto e consultar novas versões pelo gerenciador de módulos. O asset de cada release deve manter o padrão `GMS_Reputation_<versão>.zip`, usando uma tag `v<versão>`.

Manifesto público: `https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/main/module.json`

## Arquitetura 59.0

A versão 59.0 é uma consolidação estrutural. O módulo carrega:

- `scripts/main.js` como entrypoint;
- `styles/gms-reputation-59.10.css` como autoridade visual base;
- `styles/gms-reputation-60.6.css` como camada estreita de correção estrutural;
- templates canônicos em `templates/apps` e `templates/partials`;
- um único Motion System em `scripts/motion/motion-system.js`.

Não existem no runtime ativo Performance Mode, favoritos do Player, seletor de ordenação do Player, densidade compacta ou templates versionados.

## Player

A Matriz do Player é somente leitura e oferece troca de perfil/matriz, perfil focal, navegação lateral por grupos/perfis, cards compactos de relação e página detalhada. A ordem dos personagens é definida pelo Mestre. Não há busca, favoritos, filtros rápidos ou seletor de ordenação no Player.

## Mestre

O Command Deck possui seis áreas principais: **Perfil**, **Personagens**, **Reputação**, **Configuração**, **Limpeza** e **HIS**. A 60.6 preserva essa estrutura e corrige apenas comportamento responsivo e geometria de layout.

## Gerenciador de Limpeza

A página **Limpeza** fica isolada das telas de edição comuns e só aparece para Gamemasters completos. Ela permite remover Personagens, Perfis e Grupos antigos com busca, impacto prévio, desbloqueio explícito e confirmação. Cada exclusão dispara o backup automático do WorldState antes da gravação.

## Direção visual

O fundo Botanical Vector permanece como textura estática. A animação ambiental principal é o scan vertical de luz. Blocos funcionais mantêm opacidade controlada e as cores semânticas de reputação continuam independentes.

## Motion

O Motion System coordena boot, scanner, transições, mudança de relação, corações, protocolos, sincronização, acordeões e navegação contextual.

## Instalação

Consulte `docs/INSTALLATION.md`. Ao atualizar uma versão antiga, **substitua a pasta inteira do módulo; não mescle arquivos**.

## Testes

Execute:

```bash
cd tests
./run-all.sh
```

A suíte valida domínio, persistência, migração, aplicações, layout da Matriz do Player, corações semânticos, Motion/CSS, seletores do DOM real, manifesto de atualização e contratos da Architecture 60.

O visualizador local está em `visualizer/index.html`.
