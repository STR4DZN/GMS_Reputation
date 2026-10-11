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
| `legacy-foundation.css` | Tokens, componentes fundamentais e apresentação inicial |
| `legacy-master-layout.css` | Estrutura inicial do Mestre e seus controles |
| `legacy-library-and-profiles.css` | Bibliotecas, grupos e perfis |
| `legacy-reputation-console.css` | Consoles e apresentação da reputação |
| `legacy-motion-and-controls.css` | Feedback de movimento e controles compartilhados |
| `legacy-surface-theme.css` | Superfícies, inputs e cores comuns |
| `legacy-generation-layout.css` | Layout da geração visual atual |
| `legacy-foundry-layout.css` | Ajustes para os seletores das janelas Foundry |
| `detail-dossier.css`, `player-matrix.css` | Ajustes finais de Detalhes e Player |
| `botanical-art.css`, `motion-feedback.css` | Arte vetorial e feedback de movimento |
| `player-readability.css`, `player-card-stability.css` | Legibilidade e geometria dos cards |
| `control-theme.css`, `cleanup.css` | Linguagem de controles e Gerenciador de Limpeza |
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

A base de 14.917 linhas foi dividida em 16 trechos contínuos, totalizando 24 fontes. Foram removidas 62 declarações antigas quando a mesma propriedade, valor e importância aparecem depois sob o seletor raiz exato. Valores diferentes continuam presentes para preservar fallbacks; blocos condicionais, keyframes e regras mantêm sua ordem. At-rules desconhecidas são barreiras conservadoras. A ferramenta `style-contracts.mjs` é somente de desenvolvimento.

O bundle passou de 574.894 para **573.185 bytes**; SHA-256 `cc1f36022dfb9ca912c3e2e728d708989f703d4c9713220b08cc03265dd4e1d8`. `test-style-contracts.mjs` mantém uma assinatura da estrutura revisada; mudanças visuais intencionais devem atualizar essa assinatura depois de verificar o resultado. A comparação com um checkout anterior usa `node tools/compare-styles.mjs /caminho/do/baseline`.

O teste `browser-style-equivalence.py` compara todas as propriedades calculadas, pseudo-elementos, retângulos e pixels do mesmo DOM com a folha anterior e a atual, em quatro larguras. A organização e essa pequena remoção de redundância não demonstram redução de CPU/RAM. Sobreposições necessárias para o visual atual continuam preservadas.
