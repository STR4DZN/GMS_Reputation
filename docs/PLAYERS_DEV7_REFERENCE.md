# Players e efeitos visíveis — 2.0.0-dev.7

A captura original é a referência para a composição focal: uma área de imagem larga no topo e, abaixo, o rótulo Perfil focal, nome em destaque e descrição. A dev.7 substitui a composição de miniatura lateral por esse empilhamento. O quadro usa proporção 2:1, com o enquadramento salvo do retrato (imagem inteira/preencher, zoom e posição) preservado. Nome e descrição mantêm alinhamento à esquerda. Cards, corações, scores e protocolos seguem as mesmas colunas. Os nomes das faixas de reputação continuam fora dos Players.

## Pesquisa na aba de NPCs

Campo Pesquisa no topo da gaveta dos Players. A consulta considera nome focal, nome do perfil e grupo; ignora acentos e diferenças entre maiúsculas e minúsculas. Termos múltiplos podem combinar grupo e nome. Grupos com resultados se abrem durante a pesquisa; os demais são ocultados. Há contagem, botão de limpar e estado vazio. A consulta continua preenchida ao escolher um NPC. Escape no campo primeiro limpa a consulta; outro Escape recolhe a gaveta.

A pesquisa filtra somente a biblioteca de NPCs. Não altera o elenco mostrado no painel, permissões, pontuações ou dados persistidos do mundo. A filtragem não recria o painel nem interrompe a digitação. O carregador continua liberando imagens ocultadas e respeitando a fila de duas cargas por janela.

## Por que os efeitos anteriores pareciam ausentes

Os degradês anteriores eram muito próximos do preto, e os painéis do Mestre tinham superfícies opacas que cobriam o acabamento de fundo. Além disso, a animação de troca de perfil mirava um ornamento que não representava conteúdo perceptível.

A revisão reforça as cores ciano, azul e violeta em cabeçalhos, navegação selecionada e superfícies; aumenta a presença das cores semânticas nos cards e torna o brilho de hover/foco mais visível. O perfil focal e o cabeçalho do Mestre usam um único SVG vetorial com linhas, formas geométricas e detalhes inspirados na referência. O SVG permanece estático e atrás do conteúdo, sem bloquear cliques ou cobrir os pixels das imagens. As camadas antigas e o scanner continuam removidos.

A troca de perfil agora anima o bloco focal visível; a entrada continua limitada a seis alvos. O Mestre apresenta um traço luminoso de 560 ms ao navegar e feedback de interação de 220 ms. O brilho dos cards dura 900 ms e termina sem repetir. Movimento reduzido continua respeitado. Não há loop ambiente ou dependência externa.

## Validação

- 31 testes Node, incluindo normalização da pesquisa e regras/API/persistência já existentes.
- Navegador: pesquisa acentuada, nomes de grupos, vários termos, resultados em grupos diferentes, limpar, nenhum resultado, seleção por teclado, consulta preservada e Escape. Verificado que pesquisa/navegação não gravam o mundo.
- Perfil focal: proporção 2:1, imagem acima do texto e textura realmente presente nos estilos computados do HTML.
- Cores e efeitos: degradês e SVG identificados nos elementos renderizados; animação real do bloco focal ao trocar NPC; traço do Mestre visível durante a navegação e encerrado ao final.
- Players em 390, 700, 1024 e 1500 px; colunas e dimensões dos retratos dos cards preservadas, nomes longos sem sobrepor score/corações e intervalo de 6 px mantido.
- Mestre em cinco larguras, com edição direta, meios corações, protocolos, matriz, lote, rascunhos, conflitos, imagens e Undo/Redo.
- Teste de GIFs repetido no HTML final: 129 arquivos, 1.548 combinações no editor, 8 cenários de erro, 16 verificações de animação e 80 trocas de fonte; mundo com 512 personagens, 96 NPCs e 49.152 relações.

O HTML incorpora o SVG e as imagens de demonstração; a instalação usa o mesmo SVG local. O empacotador também verifica se os recursos locais referenciados pelo CSS existem. A conferência dos hashes dos fontes continua impedindo a entrega de uma prévia antiga. A implementação foi verificada no navegador; integração com HoloSuite, FilePicker do servidor e sincronização entre contas depende do Foundry V13 real.
