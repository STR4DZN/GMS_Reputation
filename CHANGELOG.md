# 2.0.0-dev.16 — Retorno à dev.14 com correção pontual do Mestre

Desfaz a reorganização da dev.15, restaurando a base dev.14 e mantendo integralmente o editor de imagens dessa versão. A correção limita-se à janela do Mestre: a lista de NPCs não comprime as linhas dentro da rolagem e a grade de NPCs/perfis usa duas colunas explícitas em janelas desktop, evitando que os nomes de grupos fiquem espremidos. Preserva larguras de navegação, tipografia, dossiês, corações, protocolos, Players e todos os arquivos de imagem/customização da dev.14.

# 2.0.0-dev.14 — Editor com prévias reais e preservação das imagens

Editor do Mestre com quadro real da tabela dos Players (64×80) ampliado para ajuste e prévia da ficha detalhada; perfil focal com prévia dos Players e miniatura do menu. Visualização modal do original completo, com GIF nativo e sem reenquadramento. Botão para repor o ajuste registrado. Preserva imagens/enquadramentos existentes ao abrir, navegar e salvar sem alterações; a mesma fonte não reseta posição, fit ou zoom. Novas fontes começam em Imagem inteira, centralizadas a 100%. Entradas aceitam décimos e atualizam apenas a propriedade editada. Recarregamento de falhas atende ambas as prévias. Layout e controladores originais dos Players mantidos.

# 2.0.0-dev.13 — Players originais e novo Mestre

Restaura a visão dos Players da dev.70.13, incluindo templates, rótulos, composição focal, cores, efeitos, animações, fichas de detalhes e carregamento de retratos. O único acréscimo é a pesquisa de NPCs por nome/grupo. Remove o sistema de paletas por NPC/grupo, seus controles, presets, persistência, herança e integração com histórico/undo. Campos antigos de paleta deixam de participar do modelo; histórico anterior e dados de reputação são preservados. Mantém o painel novo do Mestre: edição direta, matriz, lotes, protocolos, imagens, histórico e desfazer/refazer. Isola CSS e nomes de animação entre as duas visões. HTML offline e ZIP instalável gerados dos mesmos fontes.

# 2.0.0-dev.12 — Desktop, paletas verticais e corações preservados

Editor único com destino explícito NPC/Grupo, 1–5 cores ordenadas do topo à base, herança e prévia. Migra paletas antigas conservando suas cores; normaliza a direção para 180°. Cores da página permanecem exclusivas dos Players. Remove a pintura multicolorida por coração e toda animação das trilhas, inclusive efeitos nos seus contêineres. Corações de 24 px nas trilhas de 10 e 12 posições; gradiente de quantidade no fundo da linha e brilho suave nos scores. Protocolos passam de 156×38 para 104×60 px, antes do score. Textura de painel técnico com juntas e roteamento gravado, sem filtros sobre a mídia. Motion finito fica nos títulos e na navegação. Revisão voltada ao desktop, sem novas adaptações para celular.

# 2.0.0-dev.11 — Paletas exclusivas dos Players e gradientes completos

Remove a aplicação de paletas no painel do Mestre; somente a amostra do editor antecipa as cores dos Players. Cabeçalho, ficha, pesquisa, grupos, lista e aba de NPCs recebem as duas cores da página. Protocolos usam uma única superfície retangular, sem recortes ou molduras sobrepostas. O gradiente de reputação percorre os corações preenchidos, a ficha e o score; uma linha mede a quantidade exata, inclusive meios passos. Relevo industrial estático mais visível e feedback finito em textos, controles e corações, sem animar imagens. Scores longos, como 11,5 e -9,5, cabem na coluna original em telas pequenas. Mantém edição, herança, histórico, busca e mídia original.

# 2.0.0-dev.10 — Paletas por NPC/grupo e protocolos alinhados

Protocolos do Player ficam à direita, antes do score. Linhas recebem gradiente horizontal pela faixa e intensidade da reputação. Paletas por NPC e grupo têm herança, duas cores, intensidade, ângulo e tons adaptativos para superfícies, foco e texto. Prévia integrada a rascunhos, salvamento global, histórico, Undo/Redo e proteção de conflito. Salvamentos simultâneos são serializados para preservar a última escolha durante edição de cor. Reflexos nos cards removidos; mídia sem filtros/sobreposições e material anodizado estático nos painéis. Inclui pesquisa, auditoria e testes de cores extremas.

# 2.0.0-dev.9 — Retratos limpos e superfícies de grafite

Remove varredura, sobreposições, filtros e brilho dos quadros de imagens/GIFs dos NPCs. Enquadramento e reprodução nativa preservados; feedback de navegação focal fica no texto. Substitui os desenhos geométricos, curvas e folhagens por granulação fina de grafite, fixa e repetida em escala constante. Imagens têm fundo neutro opaco para a textura não aparecer em transparências ou margens. Estrutura, pesquisa e edição de reputação preservadas.

# 2.0.0-dev.8 — Iluminação contida nos cards

O brilho de hover e foco fica dentro do card, sem invadir o espaço sob o perfil focal. O indicador de teclado acompanha a borda interna e a varredura antiga do retrato, que vazava acima do card, foi removida. Layout, imagens, cores e pesquisa preservados.

# 2.0.0-dev.7 — referência original e pesquisa de NPCs

Restabelece o perfil focal com imagem larga 2:1 acima de nome e descrição, conforme a captura original. Acrescenta pesquisa na gaveta dos NPCs dos Players: nome focal, nome do perfil e grupo, com normalização de acentos, múltiplos termos, contagem, limpar, Escape e estado vazio. A consulta acompanha mudanças de perfil sem alterar dados do mundo ou o elenco. Recupera a textura vetorial da referência em um recurso leve e estático, aumenta a presença dos gradientes e do brilho em Player/Mestre e faz a navegação animar o conteúdo focal visível. Animações finitas e movimento reduzido preservados. HTML e ZIP gerados dos mesmos fontes, sem publicação remota.

# 2.0.0-dev.6 — nomes alinhados e HTML completo

Retira o espaço de 26 px reservado à faixa removida; nome e corações ficam separados somente pelo gap original de 6 px. Preserva colunas, quadros de retrato e protocolos. Prévia offline com retratos incorporados, versão visível, cobertura dos 40 ícones ativos e hidratação dos ícones em navegação externa e atualizações parciais. Dados da demonstração separados por versão. Build registra os fontes e recusa HTML desatualizado; empacotamento regenera e verifica a prévia. Testes de nomes longos, imagens e edição executados no HTML entregue.

# 2.0.0-dev.5 — Players originais, superfícies limpas

Mantém a geometria dos Players da dev.70.13 e remove os nomes das faixas de reputação dos cards e dos detalhes. Retira arte botânica, texturas, scanner e o runtime antigo de motion. CSS base consolidado em uma única folha, sem conservar a folha histórica. Degradês suaves, cores semânticas, brilho contido e animações finitas para mouse e teclado; preferência de movimento reduzido respeitada. Retratos, proporção, enquadramento e editor de imagens preservados. Corrigido o recorte do contêiner da prévia em telas estreitas. Layout comparado nas quatro larguras e testes de imagem repetidos. Pacote local, sem publicação remota.

# 2.0.0-dev.4 — dossiês originais, edição direta e GIFs em escala

Navegação superior e elenco em dossiês próximos à dev.70.13. Corações com teclado e meios passos, polaridade explícita, zero, comparação do valor anterior e sigilos originais nos protocolos. Matriz e lotes preservados. Editor de imagem original com calibração numérica, retry, espera de carregamento ao salvar e rascunhos por personagem/perfil. Perfil focal passa a usar o salvamento global, histórico e Undo/Redo completo. Corrigida a exibição de posição zero no histórico e a identificação de GIF incorporado. Testes: 129 GIFs, 1.548 combinações, 512 personagens, 96 NPCs e 49.152 relações. Player e CSS original preservados. Pacote local, sem publicação remota.

# 2.0.0-dev.3 — linguagem dos Players e editor original refinado

O Mestre passa a compartilhar a tipografia, as molduras, as cores de reputação e as trilhas de corações da visão dos Players. Retrato focal e miniaturas reutilizam o componente original, respeitando fit, zoom e posição. Colunas, ações e cabeçalhos alinhados. O editor de imagens recupera a estrutura da dev.70.13: prévia proporcional, link direto separado do FilePicker, enquadramento e calibração; acrescenta feedback de carregamento/erro, identificação do arquivo e centralização. Removidos o editor em duas colunas e os atalhos de fit duplicados. Edição direta, matriz, lotes e motion finito preservados. Player original permanece intacto.

# 2.0.0-dev.2 — gestão direta do Mestre

Remove Visão geral e restaura a apresentação dos Players à dev.70.13. Reputação abre com elenco editável: meios corações, score e protocolos na linha. Matriz permite comparar e ajustar vários NPCs; seleção em lote grava uma transação com backup e Undo/Redo. Rascunhos sobrevivem à navegação e conflitos não sobrescrevem dados silenciosamente. Editor de imagens reorganizado, motion finito do Mestre com preferência de movimento reduzido, formulários por área ativa e renderização limitada. Inclui pesquisa de UX, testes de carga e prévia offline atualizada.

# 2.0.0-dev.1 — Dashboard V2

Base exata: dev.70.13, commit d759e53. Visão geral com indicadores e atividade real, navegação lateral responsiva, acesso direto ao editor por relação e nova apresentação Player/Mestre. Removidos CSS 60.6/60.7/60.8 sem uso, visualizadores estáticos duplicados e comando inalcançável dos testes. Prévia HTML offline com templates e controladores reais, empacotamento reproduzível e teste de navegador. ID, schema 5, API pública e regras de domínio preservados. Pacote local, sem publicação no GitHub.

## 1.2.0-dev.70.13 — Retratos sem achatamento

- Imagens e GIFs usam a proporção original em Player, Mestre, detalhes e miniaturas.
- Enquadramento padrão mostra a imagem inteira; margens acomodam fontes verticais, quadradas ou panorâmicas.
- Editor permite escolher imagem inteira ou preenchimento com recorte, ambos sem deformação.
- Zoom deixa de trocar automaticamente o modo de encaixe ao passar de 100%.
- Enquadramento é salvo por retrato e preservado na sincronização, no histórico e em undo/redo.
- Reset retorna à imagem inteira centralizada; carregamento por visibilidade permanece ativo.

## 1.2.0-dev.70.12 — Retratos carregados por visibilidade

- Player, Mestre, navegação e detalhes carregam retratos apenas quando visíveis, com até duas solicitações em andamento por janela.
- Grupos, seletores e abas recolhidos não antecipam o carregamento de GIFs.
- Ao sair da área visível, o retrato perde sua fonte ativa; o endereço salvo e o enquadramento permanecem intactos.
- Retratos voltam a carregar ao reaparecer; GIFs podem reiniciar a animação.
- Edição de links, reset, troca de perfil e sincronização continuam usando a mídia original.
- Controladores e solicitações ativas são descartados ao fechar ou renderizar novamente a janela.

## 1.2.0-dev.70.11 — Correção dos formulários de Perfis

- Nome, grupo e disponibilidade do perfil ocupam linhas completas, sem colunas espremidas.
- Nomes dos grupos ficam visíveis por inteiro, com contagens alinhadas e rolagem própria.
- Editor focal organiza nome, descrição, imagem e controles em uma coluna legível.
- Botões de mídia se adaptam à largura do editor, sem quebra de texto letra por letra.
- Prévia para os Players fica disponível em um bloco recolhível, junto ao editor focal.
- Criação e edição de grupos seguem a mesma organização dos campos.
- Em janelas maiores, a biblioteca de grupos permanece visível e tem rolagem própria.

## 1.2.0-dev.70.10 — Motion integrado para Player e Mestre

- Entradas coordenadas e revelação progressiva de cards, perfis, personagens, histórico e limpeza.
- Navegação de NPCs, grupos, detalhes e seletores recebem transições curtas.
- Botões e teclado têm trilhos luminosos; campos indicam foco sem alterar seu tamanho.
- Mudanças de reputação animam valor e corações; protocolos e sincronização têm feedback próprio.
- Animações nativas canceláveis, com atraso limitado em listas grandes e descarte ao fechar.
- Preserva proporções do editor, encaixe das mídias e o glitch de identidade.
- Pesquisa e decisões registradas em `docs/MOTION_DESIGN.md`.

## 1.2.0-dev.70.9 — Proporções do editor e remoção do cabeçalho

- Remove a faixa “MATRIZ SOCIAL” do painel do Mestre e libera sua altura para o conteúdo.
- Restaura os editores lado a lado nas janelas maiores.
- Prévia de personagem volta a um quadro compacto quadrado; a prévia focal usa 16:9.
- Imagens e GIFs nas prévias do Mestre preservam suas proporções, sem achatamento.

## 1.2.0-dev.70.8 — Encaixe das mídias e organização do Mestre

- Imagens e GIFs ocupam o retângulo completo no enquadramento padrão, sem recortes ou faixas laterais; o zoom manual continua disponível.
- Remove o título redundante da janela Player, mantendo os controles de janela.
- Unifica tamanhos de texto, espaçamentos, campos e botões em todas as áreas do Mestre.
- Nomes longos, corações, pontuações, protocolos, listas, histórico e limpeza passam a respeitar a largura real da janela.

## 1.2.0-dev.70.7 — Apps separados para Player e GM

- O app Reputação com coração abre sempre a visão dos Players, inclusive para o GM.
- Novo app Gerenciar Reputação com escudo abre o painel de edição e fica oculto para Players.
- O acesso ao app de edição verifica a conta GM e as permissões ao clicar.

## 1.2.0-dev.70.6 — Glitch completo, retratos e app HoloSuite

- Recupera as camadas cromáticas, fragmentos e três faixas animadas do glitch original, desenhadas somente nos caracteres.
- Imagens e GIFs inteiros no enquadramento padrão; mantém o zoom manual para recortes intencionais.
- Miniaturas dos NPCs e seletores passam a mostrar a imagem inteira.
- Remove os dois atalhos dos controles de token e registra um único app Reputação com coração no HoloSuite.
- O app abre os controles para funções autorizadas e a matriz de leitura para Players, inclusive após alterações de permissão.

## 1.2.0-dev.70.5 — Alinhamento da tabela dos Players

- Alinha retratos, nomes, relações, corações, selos especiais e pontuação.
- Nomes longos passam a ocupar mais linhas sem recorte; o glitch fica nos caracteres.
- Desenha o contorno completo dos selos Vínculo, Comunhão e Duplo Sync.
- A tabela se adapta à largura real da janela, incluindo a estrutura de root part do Foundry.

## 1.2.0-dev.70.4 — Organização e legibilidade da navegação

- Painel de largura estável, com cabeçalho integrado e sem faixa vazia ao lado do conteúdo.
- Nomes maiores, contagens legíveis e setas para identificar a abertura de cada grupo.
- Remove textos repetidos e metadados minúsculos da navegação.
- A aba começa recolhida e preserva o tamanho, o visual e a rolagem da página dev.70.

## 1.2.0-dev.70.3 — Navegação externa dos Players

- Move os grupos e perfis para um painel anexado à esquerda da janela.
- Restaura a estrutura e os estilos da página dev.70, com a rolagem original.
- A navegação acompanha movimento, tamanho, foco e minimização da janela e é removida ao fechar.
- Trocar perfil mantém o painel aberto; a navegação e o dossiê rolam de forma independente.

## 1.2.0-dev.70 — Restauração da Base 60.3

- restauração completa e fiel da interface original comprovada da versão 60.3;
- preservação total do Schema v5, regras de reputação, histórico e compatibilidade com Foundry VTT v13.

## 1.2.0-dev.60.3 — Retorno ao Normal

- restauração completa da interface original e funcionalidade normal do módulo;
- atualização de compatibilidade para sincronização e atualização via Foundry VTT;
- preservação total do Schema v5 e integridade dos dados existentes.

## 1.2.0-dev.60.1 — Architecture 60 / Fase A — Compatibility First

- inicia a Architecture 60 sem alterar schema, IDs, dados persistentes, visual ou comportamento funcional da 59.10;
- congela contratos de `MODULE_ID`, schema 5, settings, hooks, socket e namespaces públicos;
- move a construção da API pública para uma facade de compatibilidade, reduzindo o acoplamento do entrypoint `main.js`;
- adiciona um `WorldStateRepository` que delega 1:1 ao WorldStore comprovado, sem trocar o backend de persistência;
- adiciona facades de Commands para Personagens, Perfis, Grupos e Relationships;
- adiciona Queries/índices puros para leitura de WorldState;
- adiciona cinco Golden WorldStates para proteger campanhas existentes durante o refactor;
- adiciona testes de Architecture 60, Golden State e Repository seam;
- integração de atualização Foundry preparada para a release/tag `v1.2.0-dev.60.1`.

## 1.2.0-dev.59.10 — Gerenciador de Limpeza

- adiciona uma página exclusiva **Limpeza** no Controle de Reputação para Gamemasters completos;
- permite apagar permanentemente Personagens, Perfis e Grupos antigos com confirmação e desbloqueio explícito;
- apagar Personagem remove suas Relationships e referências de roster de todos os Perfis;
- apagar Perfil remove somente a matriz e suas Relationships internas, preservando os Personagens;
- apagar Grupo preserva todos os Perfis e os move automaticamente para **Sem Grupo**;
- cada exclusão usa o backup automático do WorldState antes da gravação e registra um evento de auditoria não reversível por Undo/Redo;
- adiciona impacto prévio por registro (relações, rosters, perfis e eventos) e busca unificada na página de limpeza;
- integração de atualização Foundry preparada para a release/tag `v1.2.0-dev.59.10`.

## 1.2.0-dev.59.9 — Static Botanical Texture + Cyan Scan

- animações contínuas do fundo Botanical Vector desativadas; assets permanecem como textura estática;
- scan vertical preservado como única animação ambiental e recalibrado para atravessar toda a Application no Player e Mestre;
- blocos funcionais ficaram levemente mais opacos para leitura;
- canal-base rosa foi migrado para ciano, sem alterar as cores semânticas das relações;
- Vínculo, Comunhão e Duplo//Sinc reorganizados; Duplo//Sinc agora aparece como estado derivado explícito no console do Mestre;
- integração de atualização Foundry atualizada para a release/tag `v1.2.0-dev.59.9`.

## 1.2.0-dev.59.8 — Foundry update integration

- adiciona `url`, `manifest` e `download` ao `module.json`;
- habilita instalação/consulta de atualização pelo gerenciador nativo do Foundry;
- `manifest` aponta para o `module.json` público da branch `main`;
- `download` aponta para o asset versionado da release GitHub `v1.2.0-dev.59.8`;
- nenhuma alteração visual, de reputação, persistência ou permissões em relação à 59.7.

# Changelog

## 1.2.0-dev.59.7 — Player layout + explicit save reliability

- Remove completamente o sistema de pétalas/partículas e seus timers/listeners.
- Estabiliza a legenda semântica acima dos corações sem underline animado.
- Vínculo/Comunhão/Duplo//Sinc passam a ocupar coluna própria e maior; em largura estreita descem para uma linha segura.
- Score direito ampliado e geometria do card fixada.
- “Salvar mudanças” relê o formulário de reputação no clique e faz flush explícito, sem depender de um evento `input` anterior.
- Novas instalações usam salvamento Manual por padrão; modos automático/após pausa continuam opcionais.


## 1.2.0-dev.59.6 — Player semantic colors + true falling petals

- torna a cor semântica explícita no card real do Player e propaga a mesma cor para moldura, descrição, corações e score;
- fixa corações cheios/meios/vazios e cores especiais de Vínculo, Comunhão e Duplo//Sinc sem depender de herança visual ambígua;
- reorganiza o card para impedir corte dos protocolos: no desktop o protocolo fica recuado antes do score e, em janela estreita, ganha uma linha própria;
- estabiliza a animação Apelido → Nome Real para nunca alterar tamanho, line-height ou posição vertical;
- amplia a descrição da relação e o score do canto direito;
- substitui a queda principal das pétalas por WAAPI medida em pixels da própria Application, garantindo travessia completa topo → fundo com vento lateral;
- mantém fallback CSS, scanner, fundo botânico, lógica, persistência e contratos de scroll.

## 1.2.0-dev.59.5 — Maximum Detail Fidelity

- restaura cores semânticas dos corações no DOM real;
- reorganiza card do Player em quatro colunas para separar medidor, protocolo e score;
- amplia retrato e score sem sobreposição;
- pétalas passam a seguir vento coerente com rajadas curvas e troca gradual de direção, com timer gerenciado pelo controller real e limpeza integral no destroy;
- reforça scanner, circuitos, linhas vetoriais e efeitos de texto do estilo Maximum Detail;
- preserva toda a lógica, persistência e contratos de scroll da 59.4.


## 1.2.0-dev.59.4 — Botanical Vector aplicado ao DOM real

- Corrige a integração visual da 59.3 no Foundry real.
- Renomeia a autoridade CSS para `styles/gms-reputation-59.4.css`, evitando reutilização de cache da folha anterior.
- Aplica o estilo aprovado diretamente às classes reais da Matriz do Player e do Controle do Mestre.
- Torna as superfícies funcionais translúcidas de forma controlada para que a atmosfera botânico-vetorial seja realmente visível.
- Corrige o seletor/layering do scanner para o elemento externo da Application.
- Reforça corações, protocolos, cards, cabeçalhos, navegação e caixas do Mestre sem alterar lógica ou persistência.

## 1.2.0-dev.59.3 — Botanical Vector + Motion consolidado

- Aplica ao Player e ao Mestre a direção visual Botanical Vector aprovada no estudo `05_maximum_detail`, sem alterar a arquitetura funcional das duas interfaces.
- Adiciona ornamentação botânica vetorial em SVG/CSS, lattices geométricos, ribbons simétricos, molduras editoriais, selo conceitual e fragmentos luminosos como camada exclusivamente decorativa.
- Adiciona pétalas animadas com distribuição organizada e parâmetros aleatórios por ciclo (posição, tamanho, profundidade, deriva, rotação, duração e opacidade), com limpeza completa no fechamento/re-render da janela.
- Preserva o Motion System existente e reforça visualmente o scanner/feixe vertical com núcleo luminoso e halo volumétrico, mantendo boot, ambiente e sincronização.
- Redesenha os corações do Player/Mestre com silhueta mais limpa, bevel/fill, estados cheio/meio/vazio mais legíveis e tratamento específico para Comunhão e Duplo//Sinc.
- Mantém os donos de scroll, a geometria do Player/Mestre, persistência, autoridade, concorrência, permissões, histórico, Undo/Redo e sincronização inalterados.
- Acrescenta teste dedicado de atmosfera e validações de lifecycle para impedir listeners/pétalas acumulados.

## 1.2.0-dev.59.2 — Art Direction da Matriz + organização do Controle Mestre

- Corações maiores na Matriz do Player, mantendo os 10/12 slots e a semântica original.
- Vínculo, Comunhão e Duplo//Sinc ampliados e alinhados ao novo medidor.
- Nova direção visual do Player baseada em editorial técnico, geometria vetorial e diagramas lineares, sem caracteres orientais.
- Cards, perfil focal, cabeçalho e seletor de perfil reestruturados visualmente sem alterar dados ou permissões.
- Console de Reputação do Mestre reorganizado em leitura, ajuste, presets e protocolos com caixas e textos alinhados.
- Layout responsivo específico para Player e Mestre após as ampliações.


## 1.2.0-dev.59.1 — Matriz do Player sem Pesquisa e alinhada

- Remove completamente a Pesquisa da Matriz do Player (UI, controller, API e arquivos dedicados).
- Mantém a ordem manual definida pelo Mestre como única ordem exibida ao Player.
- Adiciona um trilho único de conteúdo para alinhar seletor de perfil, focal e relações.
- Padroniza geometria interna dos cards (retrato, identidade, corações, protocolo e score).
- Preserva a base auditada de schema, autoridade, concorrência, persistência e Motion.

## 1.2.0-dev.59.0 — Consolidação completa

- Substitui a cadeia de entrypoints 55–58 por `scripts/main.js` canônico.
- Consolida a cascata histórica em uma única autoridade: `styles/gms-reputation.css`.
- Unifica Player, Mestre e Detalhes em templates canônicos sem pastas versionadas.
- Remove do runtime Performance Mode e todos os vetos automáticos de Motion.
- Remove completamente favoritos, densidade e ordenação do Player da implementação ativa.
- Mantém a ordenação manual definida pelo Mestre e uma única busca instantânea no Player.
- Consolida o Motion System e mantém scanner/boot/transições ativos em qualidade integral.
- Atualiza a tela de Detalhes para geração visual 3.
- Corrige Design Tokens antigos sem definição.
- Corrige o `visual-contract` para a autoridade visual única e geração 3.
- Remove hotfixes, CSS, templates, scripts, testes e documentação histórica que não pertenciam mais ao runtime.
- Atualiza visualizador e testes para a arquitetura 59.0.
- Preserva schema, dados, migração, reputação, perfis, retratos, histórico, Undo/Redo, backup, permissões e sincronização.

A história detalhada das builds experimentais anteriores foi removida do pacote final porque seus arquivos e contratos não são mais parte da aplicação ativa.
