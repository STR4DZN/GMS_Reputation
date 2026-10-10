# Validação e pacote de revisão

## Reproduzir os testes

Use Node 20 ou posterior e Python 3.12:

```sh
npm ci
npm test
npm run styles:check
python -m pip install -r tests/browser-requirements.txt
python -m playwright install --with-deps chromium
npm run test:browser
python tools/package-module.py
```

`test:browser` inicia uma prévia local, executa as quatro integrações e encerra o servidor. `CHROMIUM_PATH` pode indicar um Chromium já instalado; `PORT` pode mudar a porta. O runtime instalado no Foundry não precisa dessas ferramentas.

O ZIP fica em `dist/GMS_Reputation_1.2.0-dev.73.zip`, com arquivos de runtime e documentação; fontes CSS, ferramentas, testes e node_modules ficam fora. A construção tem ordem, permissões e horários fixos. A verificação abre o ZIP e confere manifesto, imports relativos de scripts, templates da aplicação, inclusões de partials e assets referenciados pelo CSS. Os workflows de pacote e release usam o mesmo construtor. O workflow de validação gera um artefato de revisão sem publicar uma release.

## Comparações com a versão anterior

```sh
git worktree add --detach ../gms-completion-baseline 5dec9033e530de2b1e4a8c70b46398f6b9969143
node tools/compare-master-context.mjs ../gms-completion-baseline
node tools/compare-styles.mjs ../gms-completion-baseline
GMS_STYLE_BASELINE=../gms-completion-baseline python tools/run-browser-tests.py tests/browser-style-equivalence.py
```

- 32 arquivos de testes Node: dados/schema/API, autorização, migrações, persistência/concorrência, rascunhos, callbacks, descarte, navegação, CSS e templates.
- 4.854 contextos iguais ao baseline: valores, ordem das propriedades, congelamento e exports; nenhum write ou alteração da entrada.
- 270 renderizações Handlebars iguais entre o template dividido e sua expansão original, usando somente os partials declarados para pré-carregamento no Foundry.
- 13 checkpoints de edição/limpeza iguais ao baseline: WorldState, backup, seleção, mensagens, painéis e rascunhos. O teste fixa IDs e normaliza horários/trecho temporal dos IDs de transação.
- Navegação: teclado, busca com acentos, rascunhos concorrentes, múltiplas entidades, todas as áreas nas larguras 320/390/768/1280, vínculos pessoais e avisos offline/replay/paginação.
- Retratos: 30 personagens/25 GIFs, quatro URLs antes da rolagem, geometria/enquadramento, áreas ocultas, sync, detalhes, feedback, troca de fonte, persistência calibrada e fallback.
- Sistema: Undo/Redo/cancelamento, bloqueio com rascunhos de formulário, restauração preservando o estado anterior no backup e preferências sem criar transação mundial. Testes Node também cobrem novos rascunhos/permissão revogada/destruição durante confirmação e mudança da transação confirmada.
- CSS: estrutura de seletores, declarações, condições e keyframes preservada, descontando as duplicações comprovadas; comparação visual no mesmo DOM, com movimento congelado.

## Validação externa pendente

Os testes de navegador usam templates e controladores reais com serviços Foundry simulados. Não executam o gerenciador de janelas, sockets ou integrações de outros módulos numa instância Foundry. Não foi fornecida uma instância acessível durante este trabalho.

Antes de usar em sessão, validar em uma cópia de World no Foundry v13:

1. Abrir Mestre/Player, redimensionar, minimizar/restaurar, fechar e reabrir; conferir seletor, editor de retrato, atalhos e áreas.
2. Conectar GM/Assistant/Player em clientes distintos; mudar permissões e reputação, conferir sincronização, avisos e autorização.
3. Salvar rascunhos manuais e automáticos, recarregar e conferir persistência; testar falha de gravação, Undo/Redo, cancelamento e backup.
4. Conferir uma cópia do World existente: IDs, rosters, grupos, flags pessoais, histórico e retratos preservados.
5. Testar o ZIP final instalado sem arquivos de desenvolvimento e com os módulos usados na campanha.

Schema 5 preservado. A versão `1.2.0-dev.73` usa manifesto, constante de runtime, tag e ZIP correspondentes. A publicação confere os arquivos baixados da release antes de torná-la pública. O manifesto de `main` mantém o URL usado para futuras atualizações, conforme `INSTALLATION.md`.
