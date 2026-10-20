# Editor do Mestre — dev.14

## Escopo

Apenas o editor de imagens do Mestre foi reformulado. O schema de retratos e os arquivos originais de apresentação dos Players não mudam. Não há migração nem processamento/regravação de imagens.

## Prévia fiel ao uso

Para personagens, o quadro principal modela o retrato de 64×80 px da tabela, com borda de 1 px e área interna de 62×78 px. Ele é ampliado uniformemente em 3× para facilitar o ajuste. A segunda prévia modela o quadro quadrado da ficha detalhada (132×132 px, área interna de 130×130 px). As duas compartilham a mesma fonte, modo, zoom, posição e origem de transformação.

No perfil focal, o quadro principal modela o retrato dos Players de 92×94 px, ampliado em 2,5×. A segunda prévia representa a miniatura de 34×34 px do menu de NPCs, ampliada em 2×. Conforme o comportamento original, essa miniatura mostra a fonte inteira, centralizada, independentemente do recorte focal.

O botão **Ampliar original** abre um diálogo nativo dentro da janela do Mestre. A imagem completa é ajustada à janela com proporção preservada; o mesmo URL é usado, sem conversão em canvas, extração de frames ou alteração do recurso. GIFs continuam nativos. Fechar/Escape devolve o foco ao botão e não fecha o Mestre.

## Preservação

- Inicialização não emite alteração nem cria rascunho.
- Reutilizar o mesmo caminho/link não reinicia fit, zoom ou coordenadas; somente recarrega a prévia.
- Fonte nova começa com contain, zoom 100 e posição 50/50. Esse padrão não é aplicado aos retratos já cadastrados.
- Entradas numéricas/ranges aceitam passos de 0,1. Mudar zoom não relê ou arredonda X/Y; cada controle altera somente sua propriedade.
- **Repor ajuste salvo** usa uma cópia do retrato persistido, inclusive sua fonte. Nenhuma propriedade de objeto recebido é modificada diretamente.
- O Mestre remove rascunhos que voltaram ao valor persistido, desde que não haja uma gravação em andamento. Durante gravações, a última alteração continua na fila.
- Nenhuma alteração no normalizador/schema, retratos dos Players ou carregador original dos Players.
- O diálogo original não chama callbacks de edição, registradores ou gravações.

## Verificação

O teste de preservação abre cinco personagens e quatro perfis com valores não triviais de fit, zoom e coordenadas decimais, incluindo extremos. Captura o estado mundial completo e conta gravações. Abrir editores, ampliar/fechar, navegar, reaplicar a mesma fonte e salvar sem mudanças conservam o estado inteiro e produzem zero gravações. Também cobre modos manual, automático e por inatividade.

São verificados ajustes precisos, restauração, padrão de fonte nova, salvamento intencional, desfazer/refazer e preservação dos demais retratos. O editor é conferido em janelas desktop de 1920, 1366 e 1024 px. A comparação visual dos Players com o CSS original da dev.70.13 continua cobrindo três larguras e escala de 125%, além dos hashes de vinte arquivos originais.

As APIs da prévia são simuladas. A integração em um mundo Foundry V13 real ainda exige conferência após a instalação.
