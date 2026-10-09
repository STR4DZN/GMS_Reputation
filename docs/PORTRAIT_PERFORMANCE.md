# Retratos pela área visível

Os templates das aplicações guardam a URL em `data-gms-portrait-src`. O controlador `portrait-visibility.js` coloca essa URL em `src` somente quando a imagem intersecta a área visível, incluindo o recorte de contêineres com rolagem. Isso evita requisições antes de o controlador receber os elementos.

Cards, retratos focais, detalhes, miniaturas de perfis, seletores, editores e avisos usam o mesmo controlador. Seções ocultas, menus fechados e abas do navegador em segundo plano liberam o `src`. Ao sair pela rolagem, há uma tolerância de 120 ms para evitar reiniciar imagens em movimentos rápidos. Ao retornar, a URL é restaurada. GIFs podem reiniciar a animação; o navegador controla seu cache, suas decodificações e a conclusão de requisições já iniciadas.

A imagem suspensa mantém seu espaço com `visibility: hidden`. Zoom, posição, proporção e dados salvos não são alterados pelo controlador. Trocas de fonte no editor e seleções por teclado usam a URL desejada, mesmo quando a opção ainda não foi carregada. Atualizações parciais registram os elementos novos e liberam os removidos. Fechar ou renderizar novamente uma aplicação desconecta observadores, cancela timers e libera os retratos antigos.

Não há biblioteca nova no runtime. Sem `IntersectionObserver`, os retratos disponíveis continuam carregando, inclusive em adaptadores antigos. O renderer HTML público mantém o comportamento anterior. O editor público também mantém sua prévia imediata; o painel do Mestre opta por `deferImages: true` e assume o controle de visibilidade.

## Validação reproduzível

```sh
npm ci
npm test
npm run preview
```

Em outro terminal, com Python Playwright e Chromium disponíveis:

```sh
python tests/browser-navigation.py
python tests/browser-portraits.py
```

`CHROMIUM_PATH` pode indicar um executável existente e `GMS_PREVIEW_URL` pode indicar outra porta. O teste de retratos intercepta suas próprias URLs de imagens e cria 30 personagens: 25 GIFs animados de dois frames e cinco SVGs estáticos. Nenhuma imagem externa é necessária. `--baseline` mede somente o carregamento inicial e permite apontar a mesma massa para uma checkout anterior.

Comparação em Chromium 153, na prévia a 1280 × 900 px, antes de rolar:

| Medida | Base `708aa12` | Com controle de visibilidade |
| --- | ---: | ---: |
| Cards com `src` | 30 | 4 |
| URLs distintas de retratos requisitadas | 30 | 4 |

Essas contagens medem carregamento e associação ao DOM. Os GIFs pequenos servem para verificar o ciclo de vida; não demonstram uma porcentagem de redução de CPU ou memória com assets de campanha.

Os testes verificam rolagem em contêineres, volta das imagens, dimensões dos cards, janela oculta, documento em segundo plano, substituição de cards por sincronização, limpeza ao fechar, seletores por teclado, troca de URL, salvamento de zoom/posição e fallback sem observador. A suíte de navegação cobre rascunhos, salvamentos concorrentes e larguras de 320, 390, 768 e 1280 px. A suíte Node inclui regressões de timers, fontes vazias, troca de fonte em editor oculto e callbacks após destruição.

Antes de uma release, validar em uma instalação real do Foundry v13 com os assets do mundo: rolar uma matriz grande, minimizar/restaurar a janela, abrir detalhes e menus, editar e salvar um retrato, receber um resumo de mudanças e fechar/reabrir as janelas. A prévia usa os controladores e templates reais, mas simula o ciclo de vida do Foundry.
