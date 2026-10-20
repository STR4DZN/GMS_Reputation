# dev.16 — correção pontual na janela do Mestre

Base restaurada: pacote 2.0.0-dev.14. A reorganização da dev.15 não faz parte desta versão. Mantidos os 176/154 px da lateral, os tamanhos/tipografia dos dossiês, os controles de reputação e a apresentação dos Players. O editor de imagens da dev.14 permanece integralmente preservado, inclusive seus scripts, template e CSS.

Correção do Mestre: a lista de NPCs passa a usar linhas flexíveis que não encolhem para caber no limite de rolagem. O quadro de texto usa uma coluna com mínimo zero, nome em até duas linhas e grupo em uma linha. Nomes/grupos completos ficam disponíveis no título do item e o nome selecionado continua completo no cabeçalho. A grade de grupos/perfis usa duas colunas explícitas em janelas desktop, correspondendo às posições já existentes de seus três painéis. Toda regra nova está restrita a `#gms-reputation-master-panel.gms-reputation-master-panel-app`. Não há seletor novo para Players.

Validação desta revisão:

- 108 arquivos originais byte a byte iguais aos da dev.14, incluindo os componentes de customização de imagem e os Players.
- Scripts de produção verificados por hash antes de gerar a prévia. Mudam apenas as constantes/marcações de versão e a extensão pontual do CSS do Mestre.
- Oito combinações de estrutura de janela e tamanho: 1440, 1152 e 1024 px, mais 1440 a 125%; painel com e sem wrapper do PART, dentro de uma moldura simulada. APIs Foundry são simuladas; não equivale a uma instalação Foundry real.
- 88 linhas de NPCs e 32 títulos de grupos com nomes longos: conteúdo dentro da linha e sem coluna comprimida, com navegação funcional.
- Editor de imagem: duas prévias, abrir/fechar o original, alterar zoom local e restaurar o ajuste salvo. Zero gravações no estado mundial durante essas inspeções.
- Players: comparação de estilos e screenshot idêntica ao CSS original.

Referência de estrutura de PARTs: https://foundryvtt.com/api/v13/interfaces/foundry.HandlebarsTemplatePart.html

Os arquivos de desenvolvimento incluídos no pacote permitem reconstruir a prévia e executar esses testes. O adaptador compilado da demonstração foi preservado da entrega anterior; o gerador compara todos os scripts de produção aos seus hashes da dev.14 e recusa mudanças de lógica sem recompilação do adaptador. Templates e CSS são sempre lidos diretamente dos arquivos do módulo.

A conferência dentro de um mundo Foundry V13 real ainda está pendente.
