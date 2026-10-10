# Navegação, feedback e Motion

Esta melhoria mantém o WorldState no schema 5, as cinco configurações existentes, a API pública e os cálculos de reputação. A versão do manifesto é `1.2.0-dev.73`, com ZIP e tag próprios para atualização pelo Foundry.

## Uso

- Mestre: seis áreas com contagens, voltar/avançar, personagem anterior/próximo e abertura do perfil na visão Player.
- Player: troca anterior/próximo de perfil, atalhos para perfil focal e relações, biblioteca de perfis existente preservada.
- `Ctrl + K` ou `⌘ + K`, com foco na janela, abre a navegação rápida. Digite um nome; use setas e Enter para abrir, Escape para fechar. A busca aceita palavras sem acentos. No Mestre, `Alt + ←/→` percorre os contextos visitados.
- As abas usam setas, Home e End. Em janelas estreitas, o trilho de áreas rola horizontalmente e o conteúdo tem sua própria rolagem vertical.

Rascunhos de relação e retrato são identificados pelo personagem/perfil. Campos dos cadastros e do focal permanecem em memória ao trocar de contexto; continuam usando seus próprios botões de salvar. A barra de salvar mantém o comportamento existente para relações e retratos. Saves executam em sequência, preservando novas edições recebidas enquanto um save está em andamento. Fechar com rascunhos pede confirmação e aguarda operações em andamento.

## Avisos de reputação

No painel do Mestre, abra **Sistema → Jogadores e perfis**. Escolha o usuário pelo nome, seu perfil e o personagem que o representa nas outras matrizes; clique em **Salvar vínculo**. Quando há um único personagem com o mesmo nome do focal/perfil, ele é selecionado automaticamente. Nomes diferentes ou ambíguos exigem a escolha do personagem pela lista. Não é necessário copiar ou digitar IDs. **Sem perfil vinculado** remove o vínculo. As escolhas pendentes são preservadas ao navegar ou salvar o vínculo de outro usuário. Somente um Gamemaster completo pode alterar as associações; o Mestre também pode vincular o próprio usuário.

Exemplo: Mari está vinculada ao perfil Mari e ao personagem Mari. Quando o Mestre edita Mari dentro da matriz do Corvo, o aviso para Mari diz **“Sua reputação aumentou com Corvo”**. São consideradas somente as linhas do personagem vinculado nas matrizes dos outros, independentemente do perfil que Mari estiver navegando. Mudanças em outros personagens e na própria matriz dela não geram avisos pessoais. Perfis/personagens inativos ou arquivados e relações fora do roster são ignorados.

A comparação é com a **última visualização**, não com o último login. O usuário pode ficar offline: ao reabrir Mestre ou Player, recebe um único resumo das diferenças acumuladas, com aumentos e quedas. O primeiro acesso após um novo vínculo estabelece o ponto de partida, sem notificar todo o histórico antigo. Novas matrizes também estabelecem uma referência inicial. Alterações apenas em textos não geram avisos; Vínculo/Comunhão geram feedback próprio mesmo sem mudar o score. O resumo apresenta o saldo entre as visualizações, não um registro de cada edição intermediária.

O cartão mostra o retrato e nome de cada contraparte, variação, score/faixa anterior e atual, corações e protocolos. Em lote, duas relações aparecem inicialmente; **Ver todas** apresenta até seis por página, mantendo acesso à lista completa sem criar centenas de elementos simultaneamente. O resumo é independente da janela, não abre modal nem bloqueia navegação e permanece até fechamento manual. **Suas atualizações**, no Player, ou **Meu resumo**, no Mestre vinculado, permite rever o último resumo mesmo após fechar/reabrir a janela. **Ver relação** abre os detalhes no Player ou o editor no Mestre.

Cada usuário guarda seu próprio vínculo e referência de leitura em flags do documento User do Foundry (`personalReputationBinding` e `personalReputationView`). Nenhum ID precisa ser informado manualmente: identificadores internos continuam necessários para associações estáveis. Essas flags não alteram o WorldState, schema, revisão, histórico, backup ou permissões existentes. Dois usuários ligados ao mesmo personagem têm leituras independentes. A referência avança quando o resumo pode ser apresentado em uma janela visível; uma aba em segundo plano não consome mudanças. Gravações são serializadas, com tratamento de falhas; uma falha de persistência é informada e pode fazer o resumo reaparecer na sessão seguinte.

## Pesquisa e escolhas de Motion

Referências consultadas em 01/10/2026:

| Referência | Princípio consultado | Aplicação no módulo |
| --- | --- | --- |
| [Motion.dev — Performance](https://motion.dev/docs/performance) | Composição com `transform` e `opacity`; custo de layout/paint e de camadas | Entradas de 8–14 px com opacidade; animações via CSS e Web Animations API; nenhum loop JavaScript por frame nos efeitos novos |
| [Motion.dev — Accessibility](https://motion.dev/docs/react-accessibility) | Respeitar `prefers-reduced-motion`; substituir movimento amplo por efeitos discretos | Preferência do sistema desativa movimentos decorativos; o feedback textual e os controles continuam disponíveis |
| [web.dev — Animations guide](https://web.dev/articles/animations-guide) | Evitar animar tamanho/posicionamento que exige layout; usar `will-change` com parcimônia | As novas entradas não animam `height`, `width`, `left` ou `top`; sem promoção permanente de todos os cartões para camadas |
| [Material Design — Duration & easing](https://m1.material.io/motion/duration-easing.html) | Duração proporcional à distância; aceleração/desaceleração natural; interação desktop rápida | Estados de botão de 140–180 ms, menu de 180 ms, áreas/avisos de 240 ms e cartões de 260 ms com easing de desaceleração |
| [Awwwards — Animation websites](https://www.awwwards.com/websites/animation/) | Catálogo editorial para encontrar experiências com animação | Pesquisa de referências, incluindo a [seleção de Wonder Vision](https://www.awwwards.com/sites/wonder-vision-3); a direção do módulo usa apresentação progressiva discreta e mantém o acesso imediato aos controles |
| [W3C — Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Oferecer controle sobre movimento não essencial | Preferência de movimento reduzido aplicada também à decoração legada; atalhos, foco visível e avisos concisos para leitores de tela |

A página Material 1 está arquivada e não é tratada como especificação atual: foram aproveitados os princípios de duração e easing. As referências são fontes oficiais e uma seleção editorial de design; não foi feita uma pesquisa estatística de recomendações da comunidade.

O módulo usa JavaScript/Handlebars, então as ideias da documentação Motion foram implementadas com APIs nativas. Não há dependência React/Motion no runtime. As entradas do Player são limitadas aos primeiros 12 cartões, com atraso de 24 ms entre eles. Timers e animações são cancelados ao destruir a janela; abas em segundo plano não disparam efeitos. A camada CSS de acessibilidade prevalece sobre os `!important` da folha antiga para permitir movimento reduzido sem alterar os valores de zoom dos retratos.

## Prévia e validação

```sh
npm ci
npm test
npm run preview
```

Abra `http://127.0.0.1:8766`. A prévia utiliza templates e controladores reais, com adaptador Foundry e armazenamento local isolado no navegador. Não carrega dados do seu mundo. O seletor superior alterna Mestre, Mari e João; os botões trocam a superfície e simulam mudanças confirmadas de reputação. Mari está vinculada a Corvo e João a Fio Rubro na massa de demonstração. `?reset=1` limpa somente esses dados de prévia. Para abrir Mari diretamente: `http://127.0.0.1:8766/?view=player&user=mari`. Handlebars é uma dependência apenas de desenvolvimento; o ZIP do módulo continua incluindo apenas seus arquivos de runtime e documentação.

Com Python Playwright e Chromium disponíveis:

```sh
python tests/browser-navigation.py
```

O teste cobre teclado, histórico de navegação, rascunhos em contextos distintos, navegação rápida em sequência, novas edições durante um save lento, cancelamento de fechamento, atualização/foco do Player, vínculos por nome sem mudar a revisão mundial, avisos pessoais em outras matrizes, exclusão de mudanças de outros personagens, catchup offline, persistência e reabertura do resumo, paginação de nove alterações e movimento reduzido. As seis áreas e a aba de vínculos são verificadas em 320, 390, 768 e 1280 px. Os 24 arquivos de teste Node passaram, assim como o teste de integração no Chromium. A suíte Node inclui os contratos anteriores e testes de usuários independentes, ambiguidades, permissões, janela oculta, falhas e concorrência das flags.

A prévia não substitui uma sessão real no Foundry v13: a validação final de posicionamento de janelas, permissões em clientes distintos, socket e assets de um mundo deve ser feita nessa instalação antes de publicar a release.

## Capturas da prévia

- [Mestre em desktop](previews/master-desktop.png) e [mobile](previews/master-mobile.png).
- [Player em desktop](previews/player-desktop.png) e [mobile](previews/player-mobile.png).
- [Vínculos em desktop](previews/bindings-desktop.png) e [mobile](previews/bindings-mobile.png).
- [Navegação rápida](previews/navigation-mobile.png), [resumo pessoal em desktop](previews/feedback-desktop.png) e [mobile](previews/feedback-mobile.png).

As imagens são da prévia com Foundry simulado, usando os assets já existentes no projeto.
