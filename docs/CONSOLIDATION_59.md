# Consolidação 59.0 — relatório técnico

## Objetivo

Transformar a sequência experimental de overhauls/hotfixes em uma aplicação canônica, preservando a lógica funcional e removendo autoridades concorrentes.

## Resultado estrutural

- 1 entrypoint: `scripts/main.js`.
- 1 folha ativa: `styles/gms-reputation-59.4.css`.
- 49 módulos JS na árvore estática do runtime.
- 3 templates de aplicação + 8 partials canônicos.
- 1 Motion System.
- 1 controlador de busca do Player.
- 0 Performance Mode ativo.
- 0 favoritos do Player ativos.
- 0 controles de densidade/ordenação do Player ativos.
- 0 imports com `?build=`.
- 0 templates/runtime versionados.

## Preservado

Schema e normalização, migração, grupos, perfis, personagens, retratos, reputação, Vínculo, Comunhão, Duplo//Sinc derivado, histórico, operações em massa, Undo/Redo, salvamento, backup, permissões, broker de autoridade, sincronização e Scene Controls.

## Visual / Motion

A cascata histórica foi consolidada sem introduzir um modo de baixa qualidade. Scanner, boot, transições, feedback de relação/corações/protocolos e sincronização permanecem disponíveis. A tela de Detalhes foi alinhada à geração visual 3.

## Bugs/resíduos removidos

- veto de animação por Performance Mode/reduced-motion/visibility;
- duas implementações concorrentes de busca;
- configurações registradas mas sem UI;
- favoritos ainda presentes no modelo interno;
- CSS de densidade compacta inalcançável;
- aliases de Design Tokens ausentes;
- contrato visual ainda preso à geração 2 e a CSS que não existiam mais;
- versões 55–58 e hotfixes expostos no runtime;
- visualizador que carregava folhas diferentes do módulo real;
- testes que exigiam recursos aposentados.

## Validação

A suíte em `tests/` cobre domínio, estados especiais, store, cadastro, histórico, Undo/Redo/save, migração, aplicações, busca, Motion/CSS e contrato estrutural. A validação de empacotamento também verifica sintaxe JS, imports, templates, manifesto e parsing CSS.

## Métricas da limpeza

Comparando o checkpoint pré-consolidação com o pacote 59.0:

- arquivos: **343 → 93**;
- tamanho lógico do diretório: **~3,30 MB → ~1,09 MB**;
- CSS declarados no manifesto: **39 → 1**;
- JavaScript empacotado: **49 arquivos, todos pertencentes à árvore estática alcançável por `scripts/main.js`**;
- templates Handlebars: **11**, todos canônicos;
- seletores CSS qualificados sem namespace GMS: **0**;
- variáveis CSS usadas sem definição/fallback: **0**;
- imports JS ausentes: **0**;
- erros de parsing CSS detectados: **0**;
- testes atuais: **10/10**.

A folha visual continua extensa porque contém o design detalhado, estados, responsividade e Motion. Ela não foi minificada agressivamente: a prioridade da consolidação é previsibilidade e manutenção, não reduzir bytes às custas de regressões.
