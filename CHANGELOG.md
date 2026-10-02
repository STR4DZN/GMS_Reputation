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
