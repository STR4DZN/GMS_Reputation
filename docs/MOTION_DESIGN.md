# Motion da interface — 1.2.0-dev.70.10

## Direção

Console social de ficção científica: ciano para resposta e conexão, violeta para profundidade, cores de reputação para as relações. Os movimentos acompanham o trabalho do jogador e do Mestre, com deslocamento curto e confirmação clara. O glitch da identidade, o scanner e os protocolos continuam com sua linguagem própria.

As referências abaixo foram pesquisadas em 2 de outubro de 2026. São fontes para padrões, documentação e demonstrações; esta implementação é original, com CSS e Web Animations API locais. Não depende de CDN, React, bibliotecas adicionais ou assets remotos.

## Referências e decisões

| Fonte consultada | Padrão aproveitado | Aplicação no módulo |
| --- | --- | --- |
| [Motion: stagger](https://motion.dev/docs/stagger) | Revelar uma coleção em sequência | Cards, histórico, personagens e perfis entram em pequenos grupos conforme aparecem na tela. |
| [Motion: hover](https://motion.dev/docs/hover) | Resposta contextual ao apontar | Trilho luminoso em botões e controles, com o mesmo feedback no foco do teclado. |
| [Motion: performance](https://motion.dev/docs/performance) | Evitar animações de dimensões e excesso de camadas | Entradas usam opacidade e deslocamento visual de 8px; não animam altura, largura ou proporção das imagens. |
| [GSAP: staggers](https://gsap.com/resources/getting-started/Staggers/) | Distribuir o tempo entre alvos | Intervalo de 32ms com atraso total limitado a 192ms, inclusive em listas grandes. |
| [GSAP: timelines](https://gsap.com/resources/getting-started/timelines/) | Coordenar movimentos relacionados | Cabeçalho/contexto, ações, navegação e conteúdo têm uma ordem de entrada coerente. |
| [Anime.js: stagger](https://animejs.com/documentation/utilities/stagger/) | Progressão entre itens | Corações respondem em uma pequena onda ao alterar reputação. |
| [Anime.js: WAAPI](https://animejs.com/documentation/web-animation-api/) | Animações controladas pelo navegador | Efeitos nativos canceláveis e descartados ao finalizar ou fechar a aplicação. |
| [Codrops: line hover](https://tympanus.net/codrops/2021/02/10/simple-css-line-hover-animations-for-links/) | Linhas discretas de interação | Trilho ciano/violeta preso à borda inferior, sem cobrir textos. |
| [Animate.css: boas práticas](https://animate.style/#best-practices) | Entradas e ênfase com propósito | Ênfase breve para números e protocolos; a interface principal permanece legível. |
| [Carbon: motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview) | Distinguir motion produtivo e expressivo | Edição usa respostas rápidas; abertura e mudança de reputação recebem movimentos mais marcados. |
| [MDN: Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) | Ciclo de vida da animação nativa | Cancelamento, descarte de efeitos e restauração dos estilos naturais. |

Não foram adotados scroll sequestrado, parallax nos retratos, alterações animadas de tamanho, efeitos 3D amplos ou flashes sobre toda a janela. Essas escolhas não ajudariam na leitura de tabelas e formulários do Foundry.

## Cobertura

- Player: abertura do dossiê, focal, cards conforme entram na tela, navegação de NPCs/grupos, detalhes, reputação, corações, protocolos, atualização e foco.
- Mestre: contexto/ações/navegação, todas as abas, listas, histórico, limpeza, seletores, abertura dos formulários, campos, controles e estado de salvamento.
- Detalhe do personagem: entrada por etapas e resposta às mudanças de reputação.

## Tempos e limites

| Movimento | Duração |
| --- | --- |
| Feedback do controle | 160ms |
| Entrada de painel ou item | 320ms |
| Confirmação de atualização | 240ms |
| Coração | 300ms + intervalo de 18ms |
| Ênfase do valor/protocolo | 420ms |
| Sequência de entrada | 32ms por item, atraso máximo 192ms |

Curva produtiva: `cubic-bezier(.2, 0, .38, .9)`. Entrada expressiva: `cubic-bezier(0, 0, .3, 1)`.

Os itens não ficam escondidos esperando o observador. Cada item é revelado uma vez por montagem; abrir grupos ou trocar abas registra os itens recém-visíveis. Cliques e edição permanecem disponíveis durante os efeitos. Novo input cancela a animação anterior do mesmo alvo. Fechar ou remontar desconecta observadores, cancela efeitos e remove as decorações.

## Validação

Os 25 testes do repositório passaram, incluindo o teste de ciclo de vida das animações. A conferência em Chromium usou os templates e os controladores reais com um mundo sintético: 40 personagens, 17 perfis, nomes extensos, histórico e mídias de proporções diferentes. As seis abas foram verificadas em três larguras, nas duas estruturas de raiz usadas pelo Foundry, totalizando 36 combinações, sem transbordamento horizontal ou texto cortado.

As interações nativas foram verificadas nas duas estruturas: abertura, abas em sequência, hover, reputação, corações, protocolos, navegação de NPCs, atualização de salvamento, revelação ao rolar e cancelamento ao fechar. A revelação do nome real por glitch e as dimensões dos cards também foram conferidas. Essa validação usa o navegador e stubs da API de jogo; a instalação em uma sessão real do Foundry continua sendo a verificação final do ambiente.
