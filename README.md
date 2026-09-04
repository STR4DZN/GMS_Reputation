# GMS // Matriz de Reputação

**Versão:** `1.2.0-dev.60.3`  
**Foundry VTT:** v13 — mínimo `13.341`, verificado para `13.351`.

Módulo de reputação social com interfaces separadas para Player e Mestre, perfis/matrizes, personagens, retratos, reputação em passos de 0,5, Vínculo, Comunhão, Duplo//Sinc derivado, histórico, Undo/Redo, backup, permissões, sincronização e migração da macro legada.

## Architecture 60 — Fase A

A versão `1.2.0-dev.60.1` inicia uma refatoração **compatibility-first**. O schema persistente continua em **5**, o `MODULE_ID` continua `gms-reputation`, as chaves do WorldState permanecem iguais e nenhuma migração de dados é necessária. A nova arquitetura nasce em paralelo através de Contracts, Compatibility Facade, Repository, Commands, Queries e Golden WorldStates. Consulte `docs/ARCHITECTURE_60.md`.


## Atualização pelo Foundry — 59.10

O módulo agora publica os campos oficiais `url`, `manifest` e `download`. O Foundry pode instalar pelo URL do manifesto e consultar novas versões pelo gerenciador de módulos. O asset de cada release deve manter o padrão `GMS_Reputation_<versão>.zip`, usando uma tag `v<versão>`.

Manifesto público: `https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/main/module.json`


## Arquitetura 59.0

A versão 59.0 é uma consolidação estrutural. O módulo carrega apenas:

- `scripts/main.js` como entrypoint;
- `styles/gms-reputation-59.10.css` como autoridade visual única;
- templates canônicos em `templates/apps` e `templates/partials`;
- um único Motion System em `scripts/motion/motion-system.js`.

Não existem no runtime ativo Performance Mode, favoritos do Player, seletor de ordenação do Player, densidade compacta, cache-bust por build, CSS de hotfix em cascata ou templates versionados.

## Player

A Matriz do Player é somente leitura e oferece:

- troca de perfil/matriz;
- perfil focal;
- organização alinhada em trilho único para perfil focal e relações;
- cards com retrato, identidade, relação, corações, score e estado especial;
- página detalhada da relação.

A ordem dos personagens é definida pelo Mestre. Não há busca, favoritos, filtros rápidos ou seletor de ordenação no Player.

## Mestre

O Command Deck possui seis áreas principais:

1. **Perfis** — matrizes, grupos e perfil focal;
2. **Personagens** — cadastro e retratos;
3. **Reputação** — score e protocolos;
4. **Histórico** — auditoria, Undo/Redo;
5. **Limpeza** — exclusão permanente de Personagens, Perfis e Grupos antigos, exclusiva para Gamemaster completo;
6. **Sistema** — salvamento, permissões e backup.



## Gerenciador de Limpeza — 59.10

A página **Limpeza** fica isolada das telas de edição comuns e só aparece para Gamemasters completos. Ela permite remover Personagens, Perfis e Grupos antigos com busca, impacto prévio, desbloqueio explícito e confirmação. Excluir um Personagem remove suas relações/rosters de todos os Perfis; excluir um Perfil preserva os Personagens; excluir um Grupo preserva seus Perfis e os move para **Sem Grupo**. Cada exclusão dispara o backup automático do WorldState antes da gravação.

## Direção visual 59.10 — textura estática + scan ciano

O fundo Botanical Vector permanece como textura estática: botânicos, lattices, ondas, ribbons, selo e molduras não executam animação contínua. A animação ambiental mantida é o **scan vertical de luz**, executado pelo Motion System no Player e no Mestre do topo até o final da Application. Blocos funcionais receberam opacidade um pouco maior e o canal-base rosa foi substituído por ciano; cores semânticas de reputação continuam independentes. Vínculo, Comunhão e Duplo//Sinc receberam organização dedicada no Player e no console do Mestre.

## Direção visual 59.7 — Maximum Detail Fidelity

Player e Mestre compartilham a direção **Botanical Vector** aprovada: fundo noturno em camadas, ornamentação botânica vetorial, linhas simétricas, lattices, selo conceitual e ribbons editoriais. Esses assets são SVG/CSS inline e ficam fora do fluxo de layout (`pointer-events: none`), portanto não substituem controles nem alteram os donos de scroll. O sistema de pétalas/partículas foi removido integralmente na 59.7.

Os corações, a moldura do card, a descrição da relação e o score compartilham explicitamente a mesma cor semântica. Vínculo/Comunhão/Duplo//Sinc ocupam uma coluna própria no card e, quando a janela fica estreita, descem para uma linha segura em vez de serem cortados. A legenda da relação usa métricas fixas para não oscilar nem colidir com os corações.

## Motion

As animações são executadas em qualidade integral. O Motion System coordena boot, scanner, transições, mudança de relação, corações, protocolos, sincronização, acordeões e navegação contextual. Não existe perfil automático de desempenho que desligue essas animações.

## Instalação

Consulte `docs/INSTALLATION.md`. Ao atualizar uma versão antiga, **substitua a pasta inteira do módulo; não mescle arquivos**, para não deixar hotfixes históricos no diretório.

## Testes

Execute:

```bash
cd tests
./run-all.sh
```

A suíte 59.10 valida domínio, persistência, migração, aplicações, layout da Matriz do Player, corações semânticos, fundo botânico-vetorial sem partículas, Motion/CSS, seletores do DOM real e o contrato estrutural consolidado.

O visualizador local está em `visualizer/index.html` e usa a mesma folha CSS declarada no `module.json`.
