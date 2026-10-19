# Players — revisão 2.0.0-dev.5

Base: `1.2.0-dev.70.13`, commit `d759e53cafa8d764dc8b5407cb059f3a7c69d690`. Revisão em 19/10/2026.

## Estrutura preservada

Título e perfil focal no topo; cada card mantém retrato à esquerda, identidade e corações no centro, protocolo e score nos espaços originais. Navegação de NPCs, abertura dos detalhes, nome real e estados de Vínculo/Comunhão/Duplo//Sinc continuam disponíveis. Os Players permanecem somente leitura.

Foram removidos “Grande amizade”, “Confiança” e os demais nomes de faixas dos cards e dos detalhes. As cores, a quantidade de corações, o sinal e o score continuam derivados do motor original. Os nomes dos protocolos especiais permanecem.

O espaço antes ocupado pela faixa passa a ser espaçamento do cabeçalho. Isso preserva alturas, colunas e coordenadas dos elementos; não adiciona um elemento vazio ao DOM. As condições e os breakpoints originais continuam em uso. A prévia corrige apenas seu contêiner externo para não recortar a janela em telas estreitas.

## Pesquisa aplicada

| Referência | Aplicação nesta revisão |
| --- | --- |
| [Massif Press — Lancer](https://massifpress.com/lancer) e [COMP/CON oficial](https://github.com/massif-press/compcon) | Referências de contexto e linguagem visual. Nossa interpretação usa molduras técnicas, superfícies escuras, sigilos existentes e luz contida. Não são um guia oficial de cores ou tipografia, nem foi copiado conteúdo gráfico. |
| [NN/g — Cards](https://www.nngroup.com/articles/cards-component/) | Cada relação continua agrupada em uma unidade legível, com informações resumidas e acesso aos detalhes. A referência não justifica substituir a lista existente por uma grade nova. |
| [NN/g — Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/) | Movimento breve para feedback de interação, navegação e atualização; remover movimento decorativo recorrente que compete com a leitura. |

Foram considerados fundos com padrões geométricos, linhas e pontos já presentes no módulo. A decisão final segue o pedido de retirar texturas: profundidade por degradês suaves e contraste de superfície, sem padrões repetidos ou novas imagens de fundo.

O acabamento mantém as cores semânticas originais da reputação e acrescenta ciano suave, dourado dos protocolos e brilho localizado. Não muda fontes, dimensões ou o formato dos cards. O brilho acompanha hover e foco por teclado; a faixa de luz dura 640 ms e não atravessa os retratos. Entradas e atualizações usam efeitos nativos de opacidade, com no máximo seis alvos na entrada. Não há scanner ou temporizador ambiente. Movimento reduzido desativa animações e transições, inclusive ao mudar a preferência durante o uso.

## Limpeza real de código

| Medida do CSS base | Antes | Depois |
| --- | ---: | ---: |
| Bytes | 605.190 | 448.089 |
| Regras | 3.122 | 2.408 |
| Declarações | 10.001 | 7.775 |

Redução de 26% no CSS base, antes de compressão. O acabamento separado ocupa 6.474 bytes. A consolidação removeu 793 alternativas de seletores aposentados, 447 declarações substituídas no mesmo contexto, 198 variáveis não referenciadas, 64 definições de keyframes obsoletas e 22 camadas de textura repetida. Condições e ordem da cascata remanescente foram preservadas.

Arquivos retirados do pacote: `gms-reputation-59.10.css`, `background-art.hbs` e `choreography.js`. Seus imports e referências de templates também foram retirados. `motion-system.js` foi substituído pelo controlador finito. Não foram adicionadas dependências de produção, fontes ou CDNs.

## Validação

- 29 testes Node: regras de reputação, API/schema, migração, permissões, persistência, lotes, histórico, imagens e lifecycle dos efeitos.
- Navegador: geometria de todos os cards, retratos, identidades, trilhas, scores e protocolos comparada com a referência original nas larguras 390, 700, 1024 e 1500 px. Resultados iguais. Os templates do Player/card e o CSS de referência do commit anterior foram conferidos como idênticos à dev.70.13 antes desta revisão.
- Mouse e teclado: detalhes, troca de perfil, feedback de foco/hover; zero animações em execução após o feedback e com movimento reduzido.
- Mestre: seis áreas, corações e meios passos, polaridade, score, protocolos, matriz, lote, rascunhos, conflitos, salvar/descartar e Undo/Redo. Cinco larguras, incluindo 1280 px.
- Carga do Mestre: 40 NPCs × 300 personagens = 12.000 relações; 24 linhas, 144 células, 2.140 nós e zero formulários inativos montados. Render de referência: 170,5 ms neste ambiente.
- GIFs: 129 arquivos válidos, 1.548 combinações no editor, 8 casos de erro, 16 verificações de animação e 80 trocas de fonte. Formatos verticais, quadrados, panorâmicos e extremos; maior arquivo de 12.992.035 bytes.
- Mundo massivo: 512 personagens × 96 NPCs = 49.152 relações; 163 verificações de rolagem e pico de 13 retratos com fonte ativa. Cada controlador respeitou o limite de 2 carregamentos; o servidor observou pico agregado de 3 solicitações, incluindo sobreposição durante cancelamentos/trocas. Teste concluído sem erros de JavaScript.

Os arquivos de imagem e seu enquadramento não foram alterados. Imagem inteira/preencher, zoom e posição continuam preservando proporção; fontes inválidas não substituem silenciosamente o rascunho salvo. GIFs podem reiniciar ao reaparecer por causa do descarregamento fora da área visível, comportamento original.

## Reprodução

```bash
npm ci
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm run test:browser
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm run test:gifs
npm run package
```

A suíte de geometria usa `tests/fixtures/player-original-layout.json`; não depende de rede ou screenshot externo. O teste de GIFs gera arquivos locais determinísticos.

Não foi executado um servidor Foundry V13 neste ambiente. FilePicker real, CSS de outros módulos, HoloSuite e sincronização entre contas continuam dependendo da validação no mundo de destino. A entrega é local, sem publicação no GitHub.
