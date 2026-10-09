# Organização dos estilos

Edite os arquivos de `src/styles/`, depois execute:

```sh
npm run styles:build
npm run styles:check
npm test
```

`npm run preview` também gera a folha antes de iniciar. Depois de editar uma fonte com a prévia já aberta, execute `npm run styles:build` e recarregue a página.

O Foundry e todos os visualizadores continuam carregando somente `styles/gms-reputation-59.10.css`. Esse arquivo é gerado e deve acompanhar as fontes no mesmo commit. O módulo instalado não precisa de Node, npm ou ferramentas de build.

## Fontes e ordem da cascata

`src/styles/order.json` define a ordem, que é a mesma da folha anterior. Cada arquivo é um trecho contínuo dela:

| Fonte | Responsabilidade |
| --- | --- |
| `legacy.css` | Base visual e sobreposições históricas, ainda preservadas |
| `navigation.css` | Navegação, contexto ativo e menu de comandos |
| `feedback.css` | Cartões, comparação, corações e paginação dos avisos |
| `transitions.css` | Entradas e transição entre áreas |
| `responsive.css` | Adaptação das áreas à largura da janela |
| `accessibility.css` | Movimento reduzido e prioridade da camada de acessibilidade |
| `workspace-layout.css` | Posicionamento, rolagem e ajustes de grids |
| `personal-reputation.css` | Vínculos de jogadores, controles de leitura e resumo pessoal |
| `portrait-visibility.css` | Preservação do espaço de retratos suspensos |

`tools/build-styles.mjs` concatena os bytes dessas fontes sem minificar, reordenar seletores, acrescentar separadores ou gerar `@import`. Assim, a ordem dos `!important`, keyframes e camadas permanece intacta, e URLs relativas continuam sendo resolvidas a partir da mesma pasta `styles/` no runtime.

Na extração inicial, o resultado tem os mesmos **574.894 bytes** e SHA-256 `01c5c4b4a424ce094f551485db34865aca1d49c8f6e3cf57f5d1533ee725c200` da folha anterior. Esse hash documenta a comparação desta etapa; não impede alterações intencionais futuras.

## Verificação e pacote

O modo `--check` é somente leitura e falha se uma fonte mudou sem regenerar a folha. O teste `test-styles-build.mjs` executa essa verificação dentro de `tests/run-all.sh`, usado pelos dois workflows de empacotamento. Também verifica ordem, Unicode, finais de linha, rejeição de fontes duplicadas e detecção de uma folha desatualizada.

`src/` e `tools/` são arquivos de desenvolvimento. Os workflows atuais incluem `styles/` no ZIP e deixam essas duas pastas fora, evitando duplicar a folha CSS no módulo instalado.

Esta etapa organiza as fontes dos componentes recentes. A base em `legacy.css` ainda tem 14.917 linhas; consolidar suas regras repetidas exige comparar cada superfície antes e depois. A extração não remove `!important`, não muda o visual e não reduz por si só o custo de renderização.
