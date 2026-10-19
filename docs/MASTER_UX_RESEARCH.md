# Pesquisa de UX/UI — gestão de reputação do Mestre

Data: 17/10/2026. Entrega: 2.0.0-dev.2, baseada na dev.70.13.

O problema principal era o custo de selecionar cada personagem de uma matriz para distribuir corações e depois repetir a operação para outros NPCs. Esta revisão organiza a interface em torno da tarefa de comparar e editar relações. A apresentação dos Players foi preservada.

## Evidências e decisões aplicadas

| Problema observado | Referência consultada | Decisão nesta versão | Como foi verificado |
| --- | --- | --- | --- |
| Troca constante de personagem | [NN/g — tarefas em tabelas](https://www.nngroup.com/articles/data-tables/) | Elenco inteiro editável por linha; comparação entre NPCs em matriz | Edição de dois membros sem abrir editor individual |
| Repetição do mesmo ajuste | [Carbon — batch actions](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Seleção de personagens e colunas; barra contextual; definir ou somar; cancelar seleção | Quatro relações, dois personagens e dois NPCs em uma gravação |
| Perda de referência em tabelas largas | [NN/g — comparação e orientação](https://www.nngroup.com/articles/data-tables/) | Cabeçalho e identificação fixos, faixas alternadas e destaque de linha | Matriz e rolagem interna em cinco larguras |
| Ações de linha e lote misturadas | [Carbon — modos de ação](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Controles individuais ficam desabilitados durante a seleção em lote; colunas fora do elenco não são editáveis | Seleção bloqueia edição individual e respeita elenco |
| Abrir muitas telas para ajustes simples | [NN/g — edição em contexto](https://www.nngroup.com/articles/data-tables/) | Corações, score e protocolos na linha; editor individual opcional | Clique/teclado, meio coração, Vínculo e limites |
| Motion custoso ou distrativo | [web.dev — animações de alto desempenho](https://web.dev/articles/animations-guide) | Efeitos por interação usando transformações e opacidade; nenhum temporizador de animação ambiente | Cancelamento, ausência de efeitos contínuos e sessão de navegador |
| Preferência por menos movimento | [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Respeitar a preferência do sistema para CSS e efeitos nativos | Teste com emulação de movimento reduzido |
| Controles de imagem dispersos | Fluxo existente do módulo e [API Foundry V13](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html) | Fonte, prévia, enquadramento e calibração agrupados; status visível | Arquivo na prévia, fit, centro, persistência e fonte inválida |

## Fluxo principal

1. Escolher um NPC ou abrir a matriz completa.
2. Ajustar valores diretamente; usar a seleção em lote quando houver repetição.
3. Conferir os valores e as marcas de edição no rascunho.
4. Salvar. Caso necessário, desfazer a distribuição inteira.

Os atalhos não substituem a leitura do resultado. A barra persistente mostra pendências, salvamento e erro. A matriz não cria membros de elenco implicitamente e não salva uma parte do lote quando outra relação entra em conflito.

## Simetria e direção visual

A estrutura usa uma escala comum de espaçamento, colunas estáveis, linhas de altura consistente, botões com medidas iguais e campos de score alinhados. Em telas estreitas, a lista de NPCs muda para um trilho e a tabela ganha rolagem própria; o conteúdo não é achatado para caber.

As referências visuais Lancer/cyberpunk foram interpretadas como console tático: marcações de canto, ciano/âmbar, linhas de aquisição de alvo, sinais discretos de edição e transições curtas. São decisões visuais do projeto; não significam validação por essas marcas. Os números e os corações permanecem legíveis durante a navegação.

As durações de 140–340 ms são escolhas desta implementação. Os efeitos são finitos, canceláveis, acionados pelo usuário e restritos a elementos relevantes. A preferência de movimento reduzido desativa esses efeitos no Mestre. O sistema de animação original dos Players não foi alterado.

## Peso e escalabilidade

A matriz mostra no máximo 24 personagens × 6 NPCs por página. As áreas de cadastro, limpeza e sistema não têm seus formulários montados enquanto a tarefa principal está ativa. A edição de uma célula atualiza apenas seus controles e o estado do rascunho.

O teste local com 40 NPCs, 300 personagens e 12.000 relações produziu 144 células e 2.272 nós no painel, sem formulários inativos. Uma execução de referência levou cerca de 147 ms para renderizar o painel no Chromium headless deste ambiente. Isso não é uma promessa de tempo em outros computadores ou com outros módulos.

Não foram adicionadas bibliotecas ao runtime do Foundry. O empacotamento da prévia usa ferramentas de desenvolvimento; elas não acompanham o módulo instalado.

## Limites da pesquisa

As fontes apoiam os padrões escolhidos. Elas não demonstram que a aplicação já foi validada com o Mestre em uma sessão real. O teste final deve confirmar vocabulário, quantidade de NPCs/membros, comportamento dos retratos e sincronização com os módulos instalados no mundo.
