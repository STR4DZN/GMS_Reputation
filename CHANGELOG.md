## 1.2.0-dev.73 — Retratos visíveis e interface modular

Release de desenvolvimento para atualização e validação no Foundry v13. Inclui também todas as melhorias de navegação, Motion e reputação pessoal da dev.72, que ainda não possuía ZIP publicado. Schema 5 e dados existentes preservados.

### Conclusão da organização da interface

- Mestre: navegação/seleção, salvamento, histórico, permissões e rollback separados em controladores; arquivo principal com 590 linhas, mantendo a fila e os mapas de rascunhos na aplicação.
- Template principal reduzido de 456 para 24 linhas com 12 partials pré-carregados pelo Foundry; 270 renderizações com HTML idêntico.
- Base CSS de 14.917 linhas dividida em 16 fontes contínuas; 24 fontes no total. Removidas 62 declarações repetidas, preservando fallbacks, condições, keyframes, importância e ordem da cascata.
- Backup e Undo/Redo revalidam rascunhos após confirmação; confirmação antiga de histórico não pode atingir uma transação mais nova. Superfícies descartadas revogam confirmações abertas.
- 32 arquivos de testes Node, quatro integrações de navegador, comparação de 4.854 contextos e verificações estruturais do CSS. Empacotamento reproduzível verifica dependências, partials e assets; CI do PR executa testes e gera ZIP de revisão.
- Schema/API existentes preservados. Validação numa instância Foundry v13 continua pendente; release preparada para atualização e teste no Foundry. [Reprodução e limites](docs/VALIDATION.md).

### Consultas e índices do contexto do Mestre

- Contexto dividido em cadastro, reputação/focal, navegação/histórico e Sistema; compositor público reduzido de 338 para 71 linhas, preservando as 41 propriedades e sua ordem.
- Índices de IDs, grupos e posições compartilhados dentro de cada montagem; reconstrução por snapshot preserva rascunhos na mesma revisão, fallback, arquivados, grupos ausentes e rosters legados.
- Contexto completo mantido para a troca de áreas sem renderização; nenhuma mudança de templates, CSS, schema ou API pública.
- 4.854 contextos equivalentes antes/depois, 29 arquivos de testes Node e três integrações no navegador passaram; 13 checkpoints dos fluxos de edição/limpeza continuam idênticos. [Estrutura e reprodução](docs/ARCHITECTURE_60.md).

### Controles do Mestre por responsabilidade

- Cadastro, edição de reputação, retratos/focal, operações em massa e limpeza extraídos em controladores próprios, com descarte dos eventos ao renderizar/fechar.
- Arquivo principal reduzido de 1.180 para 805 linhas; aplicação continua dona dos rascunhos, contexto e fila de salvamento.
- 13 checkpoints de fluxos reais no navegador idênticos à versão anterior; 28 arquivos de testes Node e três integrações no navegador passaram.
- Exclusões verificadas com bloqueio, cancelamento, permissão revogada durante a confirmação, remoção de referências e backup. [Estrutura e reprodução](docs/ARCHITECTURE_60.md).

### Divisão do painel do Mestre

- Contexto dos templates, definição das áreas e controles dos vínculos de jogadores extraídos para módulos próprios; arquivo principal reduzido de 1.570 para 1.180 linhas.
- API pública, rascunhos, autorização e persistência preservados; contexto comparado antes/depois em 3.234 cenários.
- Novos testes de concorrência, falhas e limpeza dos eventos de vínculos, incluindo controles antigos após renderização. [Estrutura e validação](docs/ARCHITECTURE_60.md).

### Organização dos estilos

- Fontes dos componentes recentes separadas em navegação, feedback, transições, responsividade, acessibilidade, layout, reputação pessoal e visibilidade de retratos.
- Geração determinística da única folha carregada no Foundry, inicialmente idêntica à anterior; ordem da cascata e caminhos de assets preservados.
- Verificação automática impede empacotar uma folha desatualizada em relação às fontes. [Como editar e validar](docs/STYLES.md).

### Retratos pela área visível

- Carregamento de retratos restrito à área visível em cards, seletores, perfis, detalhes, editores e avisos.
- Liberação das fontes fora da área visível, em seções ocultas e em abas do navegador em segundo plano; limpeza ao fechar e renderizar novamente.
- Enquadramento e comportamento dos renderers/editores públicos preservados; testes de rolagem, troca de fonte e salvamento com 30 personagens e 25 GIFs.
- [Implementação, comparação e validação](docs/PORTRAIT_PERFORMANCE.md).

## 1.2.0-dev.72 — Navegação, Motion e reputação pessoal

- Navegação com histórico, atalhos, menu rápido e troca de contexto no Mestre/Player.
- Layout adaptado à largura da janela, rascunhos preservados e saves serializados.
- Aba Sistema → Jogadores e perfis para associar usuários por nome, com seleção automática de personagem quando o nome é único.
- Resumo pessoal das mudanças na linha do personagem nas outras matrizes desde a última visualização, inclusive offline.
- Comparação completa, agrupamento, paginação e reabertura do último resumo; flags por usuário sem mudar WorldState ou histórico.
- Entradas escalonadas, movimento reduzido e limpeza de timers/animações ao fechar.
- Prévia interativa com templates/controladores reais e testes de concorrência, teclado e responsividade.
- Schema 5, configurações e API pública preservados; manifesto e constantes atualizados para a versão 1.2.0-dev.72.

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
