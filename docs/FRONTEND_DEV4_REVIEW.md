# Reputação V2 dev.4 — revisão de interface

Data: 19/10/2026. Referência visual: `dev.70.13`, commit `d759e53`. Implementação local; nenhuma publicação no GitHub.

## Direção e decisões

O pedido prioriza o módulo original. A referência foi renderizada a partir do commit da dev.70.13 e comparada à dev.3. A skill `frontend-design` orientou o desenho; a revisão complementar `design-taste-frontend` usou a direção **Data terminal**, seed `1020861240`, conservando paleta e fontes existentes. A composição foi adaptada à navegação superior da base e às seis áreas com rótulos, em vez de impor uma barra só de ícones.

A assinatura é o dossiê de relação do próprio módulo: retrato com enquadramento salvo, nome em Georgia, faixa semântica, corações contornados e protocolos com os sigilos originais. Segoe UI mantém controles legíveis. Cores principais: fundo `#07090e`, superfície `#0d1017`, texto `#eee8ef`, secundário `#abb0bc`, ciano `#45e7df`, dourado `#d8bd7a`. As cores de reputação continuam vindo do motor original.

| Pergunta da área | Resposta da interface |
| --- | --- |
| Como este NPC se relaciona com o elenco? | Dossiês editáveis, sem trocar de personagem a cada ajuste |
| Como comparar vários NPCs? | Matriz com cabeçalho e identificação fixos, busca e lote |
| Como a imagem ficará? | Prévia proporcional do editor original, com fit, zoom e posição |
| O que ainda falta salvar? | Barra global, indicação do valor anterior e rascunhos preservados |

## Antes e depois

| Aspecto | dev.3 | dev.4 |
| --- | --- | --- |
| Navegação | Duas barras laterais | Áreas no topo; perspectivas na lateral |
| Elenco | Tabela com colunas de controles | Dossiês próximos aos Players; matriz segue disponível |
| Sinal da reputação | Digitação no score | Positiva, negativa e zerar, além do score e dos corações |
| Teclado | Score e navegação geral | Setas/Home/End percorrem corações; Enter define; Shift+Enter define meio |
| Protocolos | Botões de texto | Sigilos originais, estado pressionado e slots especiais corretos |
| Rascunhos de imagem | Uma ação pendente de personagem; focal separado | Retratos por personagem e focal no salvamento global, preservados entre áreas |
| Fonte que não carrega | Aviso de erro | Retry da mesma URL e proteção contra gravar uma nova fonte não carregada |
| Salvar com prévia fora da tela | Sem validação de carregamento | Traz a prévia à área visível e aguarda carregamento; falha mantém o rascunho |
| Retrato focal no histórico | Sem evento reversível | Snapshot completo de nome, descrição e enquadramento com Undo/Redo |

Os arquivos do Player e o CSS original permanecem idênticos aos da base. O schema e a API pública permanecem os mesmos. Não há biblioteca nova no runtime.

## Crítica visual e verificação

A revisão no navegador compara 1440, 768 e 390 px; a suíte funcional cobre também 1500, 1280, 1024 e 700 px. Os dossiês mantêm a leitura retrato → identidade → relação → corações; a matriz conserva a comparação numérica. Controles e editores seguem o mesmo alinhamento; em telas estreitas os dossiês empilham os controles e a matriz rola dentro do próprio quadro.

O inspetor passou de **7 falhas / 2 avisos** na dev.3 para **0 falhas / 1 aviso** na dev.4. As exceções `gradient`, `button-fx`, `icon-chips` e `heavy-borders` conservam as molduras, gradientes, sigilos e corações do módulo original solicitados pelo usuário. Os corações são dados editáveis, e não cartões decorativos. O aviso restante trata da densidade: boa parte dos textos auxiliares usa 11–12 px; nomes usam 21–23 px, títulos 24–28 px e scores 24 px. Isso mantém a densidade da referência; um modo com texto ampliado não foi implementado.

Não foi criada fotografia ou ilustração externa. Todos os sigilos são do módulo original. As pessoas, os perfis e as relações da prévia são exemplos, sem efeito no mundo do Foundry.
