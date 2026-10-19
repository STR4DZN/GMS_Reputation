> Registro histórico. A dev.13 remove o sistema de paletas e restaura os Players da dev.70.13, acrescentando somente a pesquisa de NPCs. Consulte PLAYERS_DEV13_ORIGINAL.md para o comportamento atual.

# QA da dev.10

## Critérios

- Protocolos na direita, antes do score, conforme Screenshot_13(1).
- Nome, retrato, corações, score, busca e estrutura focal preservados.
- Gradientes de reputação horizontais, com intensidade derivada do score.
- Temas por NPC e grupo com herança, prévia, salvamento, descarte, Undo/Redo e conflito explícito.
- Imagens sem filtros, brilho, scanner ou textura sobreposta; fit, zoom e posição preservados.
- Material anodizado estático, sem moiré intencional ou animação ambiente.

## Evidência técnica

`test-appearance.mjs` cobre 23.850 pares de superfície/cores, cada qual com verificação de texto, texto secundário e foco; herança; gamut; intensidade por score; normalização; persistência; um backup por lote; Undo/Redo; sinalização de sync; conflitos atômicos e permissões de leitura.

`browser-appearance.mjs` cobre controles reais por grupo/NPC, rascunho ao navegar, uma gravação do lote, Undo/Redo, recarga, troca de perspectiva, oito pares extremos, aplicação ao cabeçalho, conflito, alteração durante salvamento, quatro larguras (1500/1024/700/390), protocolos ativos, mídia sem overlays e escala de 125%.

Os demais testes de navegador verificam geometria original preservada nas áreas intocadas, nomes longos, busca, estados vazios, teclado, cores/efeitos visíveis, movimento reduzido, vazamento de iluminação e pixels transparentes sem textura.

O corpus de GIFs inclui 129 arquivos válidos de proporções e tamanhos variados, fontes inválidas, calibração, reprodução efetiva, troca de fonte e carregamento limitado numa matriz grande. O resultado final da execução deve ser consultado junto à entrega; não se assume sucesso por existir o teste.

## Limitações declaradas

Validação em Chromium e prévia com adaptador Foundry; não em servidor Foundry real. Pesquisa integral de algumas galerias Behance/Pinterest bloqueada. A mira de Lapso está incorporada ao arquivo da demonstração. Não foram realizados testes com participantes externos.

## Resultado desta entrega

| Verificação | Resultado |
| --- | --- |
| Testes Node (33 arquivos) | Passou |
| Sete suítes de navegador | Passaram |
| Paletas extremas, herança, conflito e salvamento durante edição | Passaram |
| Controles de paleta do Mestre a 700/390 px | Passaram |
| Player a 1500/1024/700/390 px e 125% | Passou |
| 129 GIFs, 1.548 calibrações, 8 fontes inválidas e 16 verificações de animação | Passaram |
| Navegação em 512 personagens × 96 NPCs (49.152 relações) | Passou; 163 verificações de rolagem, pico observado de 14 retratos ativos e 2 requisições simultâneas |
| Perfil normal de desempenho, 12.000 relações | Renderização observada de 277 ms; 24 linhas/144 células montadas |
| Preview offline e recursos locais | Verificados pelo build e pelo empacotamento |
| Servidor Foundry real e testes com participantes | Não executados |

Tempos são observações deste ambiente, não uma garantia de desempenho em outras máquinas. A revisão não tem P0/P1 conhecido nas superfícies verificadas. A limitação dos detalhes já incorporados ao PNG é declarada acima.
