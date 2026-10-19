# V2 — gestão direta do Mestre

## Origem

Base exata: `1.2.0-dev.70.13`, commit `d759e53cafa8d764dc8b5407cb059f3a7c69d690`, branch `dev70-npc-right-sidebar` do [GMS_Reputation](https://github.com/STR4DZN/GMS_Reputation). Entrega local `2.0.0-dev.11`, sem publicação remota. ID, schema 5, settings e API pública preservados. A compatibilidade declarada continua sendo Foundry V13, mínimo 13.341, base 13.351.

A estrutura dos Players usa a revisão dev.70.13. Na dev.5, são removidos os nomes das faixas de reputação e os ornamentos; retrato, identidade, corações, score, protocolos e navegação mantêm as colunas e os enquadramentos originais. A dev.6 retira a reserva vazia da faixa, aproximando nome e corações com o gap original de 6 px. O acabamento dos Players está isolado em `player-finish.css`. As regras de reputação e o enquadramento das imagens permanecem iguais. A comparação e a pesquisa estão em [PLAYERS_DEV5_REVIEW.md](PLAYERS_DEV5_REVIEW.md).

## Áreas

| Área | Função |
| --- | --- |
| Reputação | Dossiês editáveis, matriz de NPCs, seleção em lote e rascunhos |
| NPCs e perfis | Grupos, matrizes, elenco e identidade focal |
| Elenco e imagens | Cadastro, mídia e operações administrativas |
| Histórico | Eventos identificados por NPC/personagem; Undo/Redo na barra global |
| Limpeza | Exclusão, impacto, confirmação e backup; exige GM completo |
| Sistema | Salvamento, permissões e restauração |

A Visão geral, sua consulta, seu template e os indicadores adicionados na dev.1 foram removidos. Os formulários são renderizados por área ativa; o editor individual e seus presets só são montados quando abertos.

## Edição e persistência

`reputation-workbench-query.js` produz as linhas e as colunas, respeitando elenco, atividade e arquivamento. A projeção limita o DOM a 24 linhas e 6 colunas, preservando a busca e a paginação. A seleção de página abrange apenas os personagens visíveis. Na matriz, o lote usa apenas as colunas selecionadas da página atual; membros fora do elenco são ignorados.

`reputation-workbench.js` mantém rascunhos fora do DOM, na instância da aplicação. Navegar entre NPCs, modos ou áreas não descarta os valores. As mudanças visuais usam eventos delegados e atualizam as células correspondentes. Selecionar personagens para lote suspende os controles individuais.

`relationship-grid.js` valida permissões, elenco e revisão das relações e usa `mutateWorldState`. Todas as células são gravadas em uma transação, um backup e um identificador de histórico. Um erro impede a gravação do lote inteiro. Notas não editadas são preservadas. Limites e arredondamento continuam no motor original. Sem permissão de lote, o usuário pode editar apenas uma relação por rascunho.

Um conflito deixa o rascunho disponível para revisão/descartar. A V2 não substitui silenciosamente a versão salva em outra janela. O editor individual opcional não pode ser aberto sobre rascunhos da tabela; os controles da tabela ficam indisponíveis enquanto há edição individual pendente.

## Retratos

A mesma estrutura persistida `src`, `fit`, `zoom`, `x`, `y` continua em uso. A origem pode ser um caminho do Foundry ou um link. O template mantém a estrutura original da dev.70.13: prévia proporcional, link direto separado do seletor do Foundry, seleção de enquadramento e calibração. Os refinamentos acrescentam nome do arquivo, feedback de carregamento e erro e centralização, preservando arrasto, teclado, GIFs e controles originais. Não há atalhos de fit duplicados. Trocar a origem preserva o modo de enquadramento. Há calibração numérica, retry e proteção contra gravar fontes novas que falharam. Rascunhos de retrato e focal sobrevivem à navegação; focal usa o salvamento global e gera evento reversível completo.

O FilePicker de produção continua sendo o do Foundry, incluindo a importação oferecida pelo navegador de arquivos. Na prévia offline, um adaptador permite escolher uma imagem local e a incorpora somente nos dados de demonstração. A prévia não faz upload no servidor.

## Motion e apresentação

O Mestre utiliza `master-motion.js`, com efeitos finitos de navegação, confirmação, score, alvo e seleção. São animações de transformações/opacidade, canceladas quando substituídas ou ao fechar a aplicação. A configuração de movimento reduzido é respeitada. Efeitos ambientes herdados foram removidos. O Player utiliza um `motion-system.js` menor, com animações finitas de opacidade, descarte por alvo e suporte a movimento reduzido. A entrada está limitada a seis elementos.

`master-workbench.css` aproxima o Mestre do dossiê dos Players: títulos em Georgia, molduras ópticas, trilhas de corações com contorno e faixas semânticas. As miniaturas e o retrato focal reutilizam `portrait-frame.hbs`, inclusive fit, zoom e posição. A tabela mantém suas colunas alinhadas e a rolagem contida. `gms-reputation.css` reúne os estilos ativos dos componentes originais, `player-finish.css` contém o acabamento dos Players e `visible-portraits.css` mantém o ciclo de mídia. A folha histórica 59.10, a arte de fundo e o antigo runtime de scanner foram retirados fisicamente. As folhas 60.6/60.7/60.8 sem uso já removidas não retornaram.

## Prévia e ZIP

A prévia combina templates reais, CSS declarado, ícones locais e controladores do módulo. Templates são compilados no build para detectar erros. A instalação carrega apenas `scripts/main.js`; o adaptador e os dados fictícios ficam fora do ZIP.

O pacote possui a pasta raiz `gms-reputation`, usa lista explícita de arquivos, valida imports/templates/estilos e gera hash SHA-256. `manifest` e `download` continuam ausentes enquanto não houver publicação de uma release V2.

## Validação

- 31 testes Node: cobertura original, lote entre NPCs, revisão/conflitos, permissões, elenco, projeção e ciclo de motion.
- Chromium: seis áreas, seleção direta de meio coração, score, protocolos, lote em vários NPCs, gravação e Undo/Redo.
- Preservação de rascunhos entre navegações, descarte, conflito e persistência de imagens.
- Importação local da prévia, centralização, fit e rejeição de fonte inválida.
- Cinco larguras: 390, 700, 1024, 1280 e 1500 px; rolagem da tabela fica contida.
- Movimento reduzido, nenhum efeito ambiente contínuo e colunas originais dos Players, nomes longos sem sobreposição e intervalo de 6 px antes dos corações em 390, 700, 1024 e 1500 px.
- Teste de carga separado: 40 NPCs, 300 personagens, 12.000 relações; 144 células, 2.059 nós e nenhum formulário de área inativa.

O tempo da execução de referência é registrado em [MASTER_UX_RESEARCH.md](MASTER_UX_RESEARCH.md). O teste de projeção também cobre um conjunto de 60 NPCs e 500 personagens.

Não foi executado um servidor Foundry neste ambiente. O FilePicker do servidor, o HoloSuite, as permissões delegadas via socket e a sincronização entre contas devem ser conferidos no mundo de destino, além do CSS de outros módulos.

## Referências

- [Pesquisa de UX aplicada](MASTER_UX_RESEARCH.md).
- [ApplicationV2 — Foundry V13](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html).
- [HandlebarsApplicationMixin — Foundry V13](https://foundryvtt.com/api/v13/functions/foundry.applications.api.HandlebarsApplicationMixin.html).

## Revisão dev.4

Consulte [a revisão visual](FRONTEND_DEV4_REVIEW.md) e [o teste massivo de GIFs](GIF_STRESS_DEV4.md). A navegação do Mestre retorna ao topo, próxima à base, e o elenco usa dossiês em vez da tabela. A matriz permanece disponível.

## Correção dev.6

A prévia passa a mostrar a versão, os retratos incorporados e os 40 ícones ativos em SVG local, inclusive no portal de NPCs e em atualizações parciais. Os dados de demonstração são separados por versão; versões anteriores continuam armazenadas. `preview-inputs.mjs` registra os hashes dos fontes e `verify-preview.mjs` recusa HTML desatualizado. `npm run package` regenera e verifica a prévia antes de empacotar. [Validação dev.6](PLAYERS_DEV6_FIX.md).

## Referência visual dev.7

O perfil focal passa a usar a composição da captura original: visual amplo 2:1 acima do texto. A gaveta dos Players inclui pesquisa por nome ou grupo. O novo vetor `focal-vectors.svg` recupera geometria e linhas da referência com um único recurso estático, atrás do conteúdo. As superfícies do Mestre recebem gradientes mais perceptíveis. A troca de perfil agora anima o bloco focal visível, substituindo o alvo ornamental que não aparecia. A ordem e as colunas dos cards permanecem iguais. [Validação e decisões](PLAYERS_DEV7_REFERENCE.md).

## Superfícies e mídia dev.9

Os fundos usam granulação estática de grafite em tile de 64 px, com trama discreta no cabeçalho do Mestre. Não há figuras, curvas ou folhagens. Retratos, miniaturas, detalhes e GIFs recebem fundo neutro opaco e não recebem filtros, varredura, sobreposição ou brilho. O enquadramento salvo permanece igual. A navegação focal anima o bloco de texto para não mudar a opacidade da imagem.

## Paletas por NPC e grupo — dev.10

Em NPCs e perfis, o editor do perfil inclui Cores do NPC; cada grupo também possui um editor de paleta. Escolha um ponto inicial ou informe duas cores, intensidade e direção. Cores próprias do NPC têm prioridade; Herdar do grupo usa a paleta do grupo ou o padrão do módulo. A prévia acompanha a edição sem gravar até o salvamento configurado. Rascunhos sobrevivem à navegação; Salvar mudanças, Descartar, Desfazer e Refazer incluem as paletas. Conflitos entre editores não sobrescrevem cores silenciosamente. As cores dos corações continuam semânticas. Detalhes em [RESEARCH_DEV10_LANCER.md](RESEARCH_DEV10_LANCER.md) e [DEV10_VISUAL_QA.md](DEV10_VISUAL_QA.md).


## Correção da aplicação visual — dev.11

As paletas dos NPCs e grupos pertencem exclusivamente à visão dos Players. O painel do Mestre permanece com suas cores fixas; apenas a miniatura do editor mostra a paleta escolhida. A herança percorre a página, incluindo busca, gaveta, aba de NPCs, grupos, lista, cabeçalho e cópia focal. Campos de entrada mantêm superfície escura para leitura, com foco e borda derivados da paleta.

A reputação possui uma escala visual independente da cor escolhida para o NPC. As cores canônicas das faixas são interpoladas ao longo dos corações preenchidos; cores distintas formam o gradiente horizontal da ficha e do número. A linha inferior usa `abs(score) / limite`, preservando sinal, meios corações e limites 10/12. A neutralidade não mostra progresso. Não muda faixas, nomes de protocolos nem dados do sistema. Os nomes de faixa continuam ausentes dos Players.

Protocolos não usam mais polígonos nem fundos recortados sobrepostos. Conservam o lugar anterior ao score, alinhamento à direita, sigilo original e nome inteiro. O material é um SVG local estático de 128 px com canais de usinagem e marcas de registro. Pequenas animações finitas atuam em textos, corações e controles; retratos/GIFs, transparências e enquadramento permanecem sem efeitos. [Validação dev.11](DEV11_VISUAL_QA.md).
