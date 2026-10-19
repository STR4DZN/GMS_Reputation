# GMS // Reputação V2

`2.0.0-dev.13` · Foundry VTT V13 · Players da **dev.70.13** + novo painel do Mestre.

A visão dos Players foi restaurada a partir do commit original `d759e53cafa8d764dc8b5407cb059f3a7c69d690`: templates, cards, rótulos, perfil focal, fichas de detalhes, cores, molduras, animações e carregamento de retratos. O único acréscimo nessa visão é a **pesquisa de NPCs**, por nome ou grupo, com busca sem acentos, limpar, Escape e consulta preservada ao trocar de NPC.

O sistema de personalização de cores por NPC/grupo foi removido: não há editor, presets, herança, gravação de paletas ou alteração das cores dos Players por esses campos. Dados antigos de paleta são ignorados. Relações, scores, imagens e registros históricos permanecem preservados.

## Painel do Mestre

- Abre diretamente em **Reputação**, sem Visão geral.
- **Elenco do NPC:** todos os personagens com corações editáveis na própria linha, meios passos, valor numérico, positivo/negativo/zerar e protocolos.
- **Matriz completa:** NPCs nas colunas e personagens nas linhas, com paginação e filtros.
- **Lote:** ajuste vários personagens e NPCs antes de salvar; uma transação permite desfazer/refazer o conjunto.
- **Imagens:** caminho/link, seletor do Foundry, arrastar, centralizar, imagem inteira/preencher, zoom e feedback de erro. Retrato focal também entra no histórico.
- Rascunhos, conflitos de edição, permissões, cadastro, arquivamento, histórico, backup, migração e HoloSuite continuam disponíveis.

Os estilos do Mestre e dos Players são isolados. Os nomes de animação da base do Mestre também usam um namespace próprio, para que a janela nova não altere a aparência ou as animações originais dos Players.

## Experimentar e instalar

Abra **GMS_Reputation_V2_Preview.html** e confirme **2.0.0-dev.13** no topo. A prévia usa templates/controladores reais e dados fictícios; funciona offline. APIs e permissões do Foundry são simuladas nesse arquivo.

O pacote é local, sem publicação remota. Para atualizar, faça backup do mundo, feche o Foundry e substitua a pasta `Data/modules/gms-reputation` pela pasta do ZIP. Remova a pasta anterior antes de extrair, para não deixar arquivos de paleta antigos. Reabra e use `Ctrl+F5`. Veja [instalação](docs/INSTALLATION.md).

Com HoloSuite Core, coração abre Players e escudo abre Mestre. A API também está disponível:

```js
game.modules.get("gms-reputation").api.playerDashboard.openPlayerDashboard();
game.modules.get("gms-reputation").api.masterPanel.openMasterPanel();
```

## Desenvolvimento e validação

```bash
npm ci
npm run preview:build
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm run test:browser
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm run test:gifs
npm run package
```

[Restauro e validação da dev.13](docs/PLAYERS_DEV13_ORIGINAL.md) · [Pesquisa do Mestre](docs/MASTER_UX_RESEARCH.md).

A conferência da integração dentro de um mundo Foundry V13 real permanece pendente.
