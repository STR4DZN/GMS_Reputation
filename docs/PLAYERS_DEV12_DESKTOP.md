> Registro histórico. A dev.13 remove o sistema de paletas e restaura os Players da dev.70.13, acrescentando somente a pesquisa de NPCs. Consulte PLAYERS_DEV13_ORIGINAL.md para o comportamento atual.

# Players — dev.12, revisão para desktop

Ajustes solicitados: remover o arco-íris dos corações, conservar suas cores originais e fixar o tamanho; colocar o gradiente proporcional à quantidade de corações no fundo de cada linha; protocolos compactos à direita antes do score; brilho discreto nos números; gradientes de página verticais com 1–5 cores; editor explícito por NPC/grupo. Sem novas adaptações para celular.

## Comportamento entregue

- Trilha com slots fixos de 24×24 px. Dez ou doze slots usam o mesmo tamanho; meios corações e polaridade são preservados.
- As cores semânticas originais continuam no coração. Slots especiais conservam os acentos do protocolo. Não há pintura por ordinal nem animações de coração, trilha ou seus contêineres no controlador dos Players.
- O gradiente de cada linha usa a faixa canônica da relação. A extensão é `abs(score)/scoreLimit`; seus tons variam com essa quantidade, inclusive em meios passos. Nenhuma nova regra de reputação é persistida.
- Vínculo, Comunhão e Duplo//Sinc ocupam 104×60 px, com sigilo acima do nome, na coluna anterior ao score.
- O score recebe brilho estático suave. Motion finito fica em títulos, texto focal e controles de navegação; respeita movimento reduzido. Nenhuma camada animada sobre as mídias.
- A textura SVG local usa juntas de painel, trilhas gravadas e marcações de serviço alinhadas. Repete a 256 px nos fundos; retratos ficam em superfície neutra, sem transparência da textura.
- Editor único em NPCs e perfis: **Aplicar paleta a → NPC/Grupo**, **Origem**, **Quantidade de cores**, cores na ordem **Topo → Base**, intensidade e amostra. O atalho do grupo abre esse mesmo editor no destino correto.
- Paletas de grupo são herdadas pelos NPCs sem paleta própria. Paletas específicas têm prioridade. O gradiente é sempre vertical e afeta apenas os Players e a amostra do editor.
- Paletas antigas de duas cores mantêm suas cores; sua direção é normalizada para vertical. Tons derivados em OKLCH mantêm superfícies escuras e texto legível. Uma cor gera dois tons do mesmo matiz; até cinco cores geram paradas igualmente espaçadas.

## Validação local

- 33 testes de código: reputação, persistência, migração, permissões, atomicidade, conflitos, backup, histórico, undo/redo e lifecycle.
- 23.850 pares de contraste para os papéis de cor e verificação adicional dos stops de 1–5 cores. Casos extremos: preto, branco, primárias e cinza.
- HTML real no Chromium: herança, dez áreas dos Players acompanhando a paleta, nenhum repaint dos controles do Mestre, salvamento durante edição, erro hexadecimal e correção pelo seletor.
- Protocolos nos quatro tamanhos de desktop: 1920, 1600, 1366 e 1024 px; escala de 125%; nomes longos e detalhes pelo teclado. Sem projeto ou critérios de aceitação para celular.
- Tamanho dos corações medido em tela para scores de -10 até 12, incluindo meios passos. Captura das animações nativas confirma feedback visível dos Players e ausência de alvo com corações ou seus ancestrais.
- Pesquisa por nome/grupo, acentos, consulta preservada, resultados vazios e teclado passaram.
- Imagens transparentes, hover, thumbnails e navegação sem filtros/sobreposições passaram.
- 129 GIFs / 1.548 combinações de enquadramento; 8 casos inválidos, 16 verificações de animação, 80 trocas de fonte. Carga: 512 personagens, 96 NPCs, 49.152 relações; pico de 13 retratos ativos. O número de requisições concorrentes observado nesta rodada foi 4. São medições locais, sem promessa de desempenho na mesa.

A revisão usa a pesquisa já registrada em RESEARCH_DEV10_LANCER.md e as orientações locais de frontend-design, UI/UX Pro Max e Foundry V13 Interfaces. Não houve nova pesquisa web nesta revisão. A integração em um mundo Foundry V13 real permanece pendente; a prévia usa APIs simuladas.
