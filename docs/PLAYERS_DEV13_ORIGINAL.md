# dev.13 — Players da dev.70.13 e novo Mestre

## Decisão aplicada

Fonte original: commit `d759e53cafa8d764dc8b5407cb059f3a7c69d690`, versão `1.2.0-dev.70.13`. A visão dos Players retorna à base original, com apenas a pesquisa na gaveta de NPCs. O novo painel do Mestre é mantido. Personalização de cores por NPC/grupo foi removida por completo.

## Preservação e isolamento

Vinte arquivos de apresentação e comportamento coincidem byte a byte com os blobs originais, incluindo o CSS completo da base, estilos de retrato, componentes de card/identidade/corações/retrato/perfil focal, aplicação de detalhes, templates, carregador de retratos, leitura rápida e controladores de animação. Os hashes estão em `tests/fixtures/player-dev70-source-hashes.json`.

As únicas diferenças no template principal e no controlador do dashboard dos Players são a marcação da pesquisa, seus índices de nome/grupo e o lifecycle de filtragem. A consulta não muda o elenco ou os dados do mundo. A navegação externa original é preservada.

O CSS original é conservado em `styles/player-original.css`. Sua versão ativa, `styles/player-original-scoped.css`, acrescenta guardas de seletor com especificidade zero, restringindo-o às janelas dos Players/detalhes e à navegação externa. O complemento de pesquisa altera apenas a pesquisa e a divisão vertical da gaveta necessária para recebê-la. Nenhuma nova camada de acabamento é aplicada às fichas.

O CSS da base do novo Mestre fica em `styles/master-foundation.css`, limitado à sua janela. Os nomes de keyframes dessa base usam prefixo próprio para não sobrescrever os keyframes dos Players. A aparência do Mestre foi comparada com a dev.12 usando a mesma interface sem controles de paleta: a captura foi idêntica.

O carregador e o editor de imagens refinados do Mestre permanecem separados do carregador original dos Players. Não há biblioteca nova no runtime.

## Remoção das paletas

Removidos: motor de paleta/gradiente configurável, registro de gravação, editor, partial, presets, controles por NPC/grupo, rascunhos de paleta, herança, sincronização específica e reversão de paletas. Grupos e perfis voltam ao schema da base; propriedades antigas de paleta são ignoradas e não voltam a ser gravadas pelo normalizador. Scores, protocolos, grupos, imagens e histórico anterior são conservados. O undo continua atendendo às ações atuais de reputação, imagens e cadastro.

Os relatórios de dev.10–12 são registros históricos, sem valor de instrução para a interface atual.

## Validação

- 33 testes locais: schema, migração, reputação, meios corações, protocolos, persistência, permissões, conflitos, backup, histórico, undo/redo, imagens, lifecycle e hashes originais.
- Comparação no Chromium com o CSS original bruto: todos os estilos medidos e a geometria visível coincidem em 1920, 1500 e 1024 px, além de 1500 px em escala de 125%. As quatro capturas dos Players coincidem byte a byte. Foram feitas 4.740 comparações de conjuntos de estilos, incluindo pseudo-elementos. Retângulos SVG têm tolerância de arredondamento de 0,01 px; elementos sem área não entram na comparação de posição.
- Ficha de detalhes também comparada ao CSS original. Abertura pelo teclado, fechar/reabrir, ausência de navegação duplicada e modo somente leitura verificados.
- Paletas antigas inseridas nos dados de teste não modificam a apresentação.
- Pesquisa: nome, grupo, acentos, termos múltiplos, nenhum resultado, limpar, Escape, seleção pelo teclado e consulta retida passaram.
- Novo Mestre: edição direta, meios corações, polaridade, protocolos, lotes entre NPCs, gravação, undo/redo, rascunhos, conflito e importação de imagem passaram no navegador.
- Carga do Mestre: 40 NPCs × 300 personagens = 12.000 relações, com 144 células montadas e nenhuma montagem dos formulários inativos. Tempo é dependente da máquina e não constitui garantia de desempenho.

- Nova rodada de GIFs no editor do Mestre: 129 arquivos e 1.548 combinações de enquadramento; 8 casos inválidos, 16 verificações de animação e 80 trocas de fonte. Carga com 512 personagens, 96 NPCs e 49.152 relações; pico de 13 retratos ativos. Os controles refinados de mídia do Mestre continuam funcionando.

A prévia usa APIs simuladas. Não foi executado um mundo Foundry V13 real. Esta revisão não contém um novo projeto para celular.
