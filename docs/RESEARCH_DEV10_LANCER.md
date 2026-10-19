> Registro histórico. A dev.13 remove o sistema de paletas e restaura os Players da dev.70.13, acrescentando somente a pesquisa de NPCs. Consulte PLAYERS_DEV13_ORIGINAL.md para o comportamento atual.

# Paletas, materialidade e protocolos — dev.10

Pesquisa e implementação em 19/10/2026. Base do módulo: dev.70.13; revisão anterior: dev.9. As duas capturas enviadas pelo usuário são a referência de posição e preservação.

## Pergunta e limites

Como permitir que o Mestre atribua uma identidade de cor completa a cada NPC ou grupo, mantendo a leitura imediata da reputação e as mídias intactas? O público é a mesa de Lancer: Mestre edita; Players consultam nomes, corações, score e protocolos. A interface é uma aplicação Foundry V13 com templates Handlebars, CSS e controladores próprios, além de uma prévia offline com APIs simuladas.

Não houve entrevistas nem teste com usuários externos. As decisões abaixo são hipóteses de projeto validadas por testes técnicos e inspeção visual, não uma comprovação de usabilidade em sessão de RPG.

## Referências e qualidade da evidência

| Fonte | O que foi consultado | Aplicação e limite |
| --- | --- | --- |
| [COMP/CON, Massif Press](https://massif-press.itch.io/compcon) | Página oficial do conjunto de ferramentas de Lancer, listas e distinção Player/Mestre | Referência operacional do domínio. Interpreta-se a menção a Comic-Con como COMP/CON. Não se copiam recursos gráficos ou layouts de outra aplicação. |
| [FUI Design, Behance](https://www.behance.net/gallery/76830263/FUI-Design) | Projeto identificado nos resultados indexados | Inspiração de linguagem de interface. A abertura integral retornou 403; não se afirma inspeção completa das pranchas. |
| [Sci-fi game UI, Behance](https://www.behance.net/gallery/119207563/Sci-fi-game-UI) | Projeto identificado nos resultados indexados | Referência complementar de domínio. Galeria também bloqueou a abertura integral. Não é evidência de eficácia de UX. |
| [Future UI, Pinterest](https://www.pinterest.com/weidner_art/future-ui/) e [Sci-fi UI](https://pt.pinterest.com/paranoid_humanoid/sci-fi-ui/) | Coleções identificadas nos resultados indexados | Organização de referências de painéis sci-fi. Conteúdo integral indisponível neste ambiente; pesquisa visual adicional não retornou imagens. Nenhum asset foi copiado. |
| [Material: papéis de cor](https://material-web.dev/theming/color/) | Documentação de tematização por papéis | Separa cor de origem, superfície, conteúdo e acento. Aqui os papéis são próprios do módulo, não uma adoção dos componentes Material. |
| [W3C: contraste mínimo](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) | Relação entre luminância de primeiro plano/fundo e contexto de texto | Contraste medido nos tons gerados; não se toma uma cor HEX arbitrária como fundo puro de textos. |
| [MDN: OKLCH](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch) e [interpolação de cor](https://developer.mozilla.org/en-US/docs/Web/CSS/color-interpolation-method) | Espaço perceptual e escolha da interpolação | Derivação de tons em OKLab/OKLCH e interpolação CSS em OKLab com fallback para sRGB. |
| [NN/g: finalidade do movimento](https://www.nngroup.com/articles/animation-purpose-ux/) | Feedback e orientação versus distração | Movimento curto acompanha entrada, seleção e confirmação. Não há iluminação animada sobre personagens. |
| [W3C: animação por interação](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Possibilidade de reduzir movimento não essencial | Preferência do sistema interrompe animações; estados e ferramentas permanecem disponíveis. |
| [GSAP: matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/) | Condições e limpeza de animações | Referência de lifecycle, sem incluir GSAP no runtime. A skill gsap-timelines não foi encontrada; os controladores nativos existentes atendem às transições necessárias. |
| [Foundry: ApplicationV2 V13](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html) | Renderização e lifecycle da janela | Integração no controlador real, com destruição dos listeners antes de nova renderização. Não foi executado um servidor Foundry real. |

A preferência por Behance/Pinterest foi seguida na busca. Os bloqueios são uma limitação da pesquisa visual, não uma validação implícita das galerias. As decisões técnicas se apoiam em fontes abertas de documentação e nas capturas do próprio módulo.

## Direção única: console industrial de Lancer

Substrato: alumínio anodizado escuro. Microestrutura: pequenos sulcos horizontais quase invisíveis, em SVG local de 128 × 128 px, repetido sem ampliar. Borda: iluminação fina de superfície e recortes já presentes no módulo. Não há ruído estelar, folhagens, grades decorativas soltas, alvos ou partículas novas.

A identidade permanece nos retratos reais, na trilha de corações e nos protocolos Vínculo, Comunhão e Duplo//Sinc. Tipografia e estrutura do Player são preservadas; apenas os protocolos mudam de posição, conforme a anotação. O nome continua acima dos corações, com o intervalo de 6 px. Em largura suficiente o protocolo ocupa a coluna à direita antes do score. Em telas estreitas fica abaixo dos corações, alinhado à direita e ainda antes da coluna do score.

Faça: usar luz localizada, material na escala de uso e cores com papéis claros. Evite: empilhar efeitos, tratar o retrato como display holográfico ou usar a cor da página como substituto do score.

## Decisões comparadas

| Decisão | Vantagem | Custo e risco | Escolha |
| --- | --- | --- | --- |
| Aplicar a cor escolhida diretamente a todos os fundos | Correspondência literal com o seletor | Branco, amarelo e verde podem tornar textos ilegíveis | Rejeitada |
| Derivar superfícies e acentos a partir de duas cores | Identidade consistente com legibilidade controlada | Exige conversão e testes de gamut/contraste | Adotada |
| Misturar a paleta da página com a cor dos corações | Aparência uniforme | Um NPC vermelho faria reputação positiva parecer hostil | Rejeitada |
| Separar ambiente e semântica da reputação | Preserva o significado de cada linha | Exige limite de saturação para evitar competição | Adotada |
| Sobrescrever todos os NPCs ao editar um grupo | Implementação superficial simples | Destrói personalização individual | Rejeitada |
| Herança de grupo, com exceção explícita por NPC | Mudança consistente sem perder identidades próprias | Requer origem da paleta e reset claros | Adotada |
| Salvar a cada evento do seletor sem rascunho | Imediato | Muitas gravações e risco durante arrasto | Rascunho integrado ao salvamento existente |
| Acrescentar shader/partículas | Atmosfera marcante | Custo e interferência com imagens | Rejeitada |

## Sistema de cores

Seis pontos iniciais editáveis:

| Paleta | Cor inicial | Cor final |
| --- | --- | --- |
| União | #45d9df | #8271cd |
| Carmesim | #ed435b | #9a2757 |
| Solar | #f4ba56 | #cf683c |
| Esmeralda | #70dd9f | #217878 |
| Orquídea | #c284ed | #5f74dc |
| Titânio | #afbfcb | #587686 |

Essas cores são sementes. Elas geram fundos, painéis, campos, contornos, foco e acentos próprios. O algoritmo converte sRGB para OKLab, mantém a matiz, limita luminosidade/croma por papel e reduz croma para manter o resultado no gamut sRGB. Entradas aceitam HEX; valores são normalizados e não entram como CSS arbitrário. Intensidade e ângulo são limitados a intervalos conhecidos.

Prioridade: paleta própria do NPC → paleta própria do grupo → padrão do módulo. O Mestre vê a origem e uma prévia no editor. A opção de herança retorna ao grupo sem alterar a paleta desse grupo. Mudar um NPC não afeta outros; mudar o grupo alcança os NPCs que herdam.

Os gradientes das linhas percorrem a esquerda para a direita. A faixa semântica canônica determina a matiz e o valor absoluto do score relativo ao limite determina a intensidade, inclusive entre dois valores da mesma faixa. O score numérico, sinal, corações e protocolos permanecem como sinais redundantes. A paleta do ambiente não muda a reputação nem recolore os corações.

## Movimento e mídia

| Elemento | Gatilho | Duração existente/alvo | Movimento reduzido |
| --- | --- | --- | --- |
| Navegação de perfil | Seleção de NPC | 360 ms, opacidade no texto focal | Estado final direto |
| Área do Mestre | Mudança de área | 200 ms, deslocamento e opacidade | Estado final direto |
| Confirmação do Mestre | Ação explícita | 220 ms em controle; trace de até 560 ms | Sem trace ou deslocamento |
| Linha do Player | Hover/foco | Apenas contorno; sem reflexo atravessando o card | Foco estático |
| Retratos/GIFs | Entrada/hover | Sem scanner, glow, filtro ou textura aplicada à mídia | Reprodução original preservada |
| Seletor de cor | Input | Atualização direta para acompanhar a escolha | Mesmo comportamento |

O PNG de Lapso incluído na demonstração já contém uma mira e linhas. Esses pixels pertencem ao arquivo, não a um efeito do módulo. O código não retoca artes fornecidas; imagens transparentes recebem fundo neutro opaco para a textura do painel não atravessar a mídia.

## Hipóteses e roteiro de aceite

1. Protocolos junto ao score reduzem o deslocamento visual: localizar Vínculo e Duplo//Sinc nos mesmos pontos em vários NPCs.
2. Uma origem de paleta explícita evita surpresa na herança: editar o grupo, criar exceção em Lapso, verificar que os outros perfis continuam herdando.
3. Cor da página independente da reputação evita ambiguidade: manter os mesmos scores enquanto se alterna entre vermelho, azul e amarelo.
4. Prévia com salvamento global reduz gravações acidentais: editar, navegar, descartar; depois editar, salvar e desfazer/refazer.
5. Tons derivados preservam leitura: testar preto, branco, cores primárias, complementares, cinza e intensidade máxima em 100%/125% e quatro larguras.

Testes automatizados executados têm seus resultados nos logs da revisão e no relatório de QA. O teste de usabilidade com uma mesa real permanece uma validação futura; não foi simulado nem contado como concluído.
