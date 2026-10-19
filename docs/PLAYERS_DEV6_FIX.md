# Correção da prévia e dos nomes — 2.0.0-dev.6

A captura mostrou que a remoção dos nomes de faixa deixara um espaço vazio: o acabamento da dev.5 ainda aplicava 26 px de padding ao cabeçalho do card para preservar suas medidas anteriores. Essa reserva foi retirada. Nome e corações usam agora os 6 px da grade original, sem acrescentar um elemento vazio e sem mudar colunas, ordem dos componentes ou quadros dos retratos. As alturas passam a acompanhar o conteúdo.

## HTML atualizado

- A versão **2.0.0-dev.6** aparece no topo da prévia.
- Os cinco retratos que já existiam nos arquivos da demonstração agora são incorporados ao HTML, incluindo o perfil focal. Nenhuma imagem de um mundo real é substituída.
- Os 40 ícones usados pelo módulo têm equivalente SVG local. O HTML anterior tinha cobertura parcial e usava um símbolo genérico nos demais.
- Ícones também são aplicados na navegação dos NPCs, que vive fora da janela principal, e nos elementos adicionados depois da renderização inicial.
- A demonstração abre com os dados desta versão; os dados das versões anteriores não são apagados.
- O build registra os hashes de 96 fontes, templates, estilos e recursos. A verificação falha se o HTML estiver desatualizado. O comando de empacotamento regenera e verifica a prévia.

A prévia continua usando os templates e os controladores reais: dossiês editáveis do Mestre, matriz de NPCs, meios corações, polaridade, protocolos, lotes, rascunhos, histórico, Undo/Redo, editor original de imagens e visão somente leitura dos Players. Degradês, brilho finito e movimento reduzido permanecem ativos. Texturas e nomes de faixas continuam removidos.

## Validação no arquivo entregue

- 30 testes Node passaram.
- Navegador: Mestre nas seis áreas, edição direta, matriz, lote, salvar/descartar, conflitos, Undo/Redo, importação e enquadramento de imagem, em cinco larguras.
- Players: 390, 700, 1024 e 1500 px. Colunas e dimensões dos quadros comparadas com a referência original; intervalo de 6 px entre cabeçalho e corações em todos os cards.
- Nomes longos, uma sequência de 72 caracteres sem espaços e texto com caracteres japoneses não sobrepõem corações ou score.
- Os retratos incorporados carregam offline e nenhum ícone aparece como símbolo genérico.
- Mouse, teclado, troca de perfil, detalhes e movimento reduzido passaram. Nenhuma animação permanece rodando em repouso.
- O teste de 129 GIFs foi repetido no HTML atualizado: 1.548 combinações no editor, 8 cenários de erro, 16 verificações de animação e 80 trocas de fonte; mundo com 512 personagens e 96 NPCs.

O arquivo continua sendo uma prévia offline: o FilePicker do servidor, HoloSuite e sincronização entre contas precisam ser conferidos no Foundry V13 real. Não houve publicação remota.
