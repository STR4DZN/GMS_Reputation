# GMS // Reputação V2

`2.0.0-dev.16` · Foundry VTT V13 · Players da **dev.70.13** + novo painel do Mestre.

A visão dos Players foi restaurada a partir do commit original `d759e53cafa8d764dc8b5407cb059f3a7c69d690`: templates, cards, rótulos, perfil focal, fichas de detalhes, cores, molduras, animações e carregamento de retratos. O único acréscimo nessa visão é a **pesquisa de NPCs**, por nome ou grupo, com busca sem acentos, limpar, Escape e consulta preservada ao trocar de NPC.

O sistema de personalização de cores por NPC/grupo foi removido: não há editor, presets, herança, gravação de paletas ou alteração das cores dos Players por esses campos. Dados antigos de paleta são ignorados. Relações, scores, imagens e registros históricos permanecem preservados.

## Editor de imagens do Mestre

A dev.14 mostra o enquadramento real da tabela dos Players ao lado do quadro da ficha ampliada. No perfil focal, mostra a ficha dos Players e a miniatura inteira do menu de NPCs. As prévias atualizam juntas, sem esticar a imagem.

**Ampliar original** abre a fonte original completa, inclusive GIFs animados, sem aplicar zoom ou recorte da ficha. **Repor ajuste salvo** recupera a fonte e os valores registrados antes da edição. O encaixe “Imagem inteira” é usado por padrão apenas ao escolher uma fonte diferente.

Abrir, navegar, ampliar, recarregar a mesma fonte e salvar sem alterações não modificam os retratos registrados. Caminho/link, fit, zoom e coordenadas existentes são preservados. A calibração aceita décimos de porcentagem; alterar um controle não arredonda os outros. Não há migração de imagens nem alteração dos Players.

## Painel do Mestre

A dev.16 retorna à base dev.14 e mantém seu editor de imagens. Desfaz a reorganização da dev.15; corrige apenas a sobreposição da lista de NPCs e a coluna comprimida de grupos no Mestre. A lateral conserva as larguras da dev.14 (176/154 px), sem alterações aos dossiês ou aos Players.

- Abre diretamente em **Reputação**, sem Visão geral.
- **Elenco do NPC:** todos os personagens com corações editáveis na própria linha, meios passos, valor numérico, positivo/negativo/zerar e protocolos.
- **Matriz completa:** NPCs nas colunas e personagens nas linhas, com paginação e filtros.
- **Lote:** ajuste vários personagens e NPCs antes de salvar; uma transação permite desfazer/refazer o conjunto.
- **Imagens:** caminho/link, seletor do Foundry, arrastar, centralizar, imagem inteira/preencher, zoom e feedback de erro. Retrato focal também entra no histórico.
- Rascunhos, conflitos de edição, permissões, cadastro, arquivamento, histórico, backup, migração e HoloSuite continuam disponíveis.

Os estilos do Mestre e dos Players são isolados. Os nomes de animação da base do Mestre também usam um namespace próprio, para que a janela nova não altere a aparência ou as animações originais dos Players.

## Experimentar e instalar

Abra **GMS_Reputation_V2_Preview.html** e confirme **2.0.0-dev.16** no topo. A prévia usa templates/controladores reais e dados fictícios; funciona offline. APIs e permissões do Foundry são simuladas nesse arquivo.

O pacote é local, sem publicação remota. Para atualizar, faça backup do mundo, feche o Foundry e substitua a pasta `Data/modules/gms-reputation` pela pasta do ZIP. Remova a pasta anterior antes de extrair, para não deixar arquivos de paleta antigos. Reabra e use `Ctrl+F5`. Veja [instalação](docs/INSTALLATION.md).

Com HoloSuite Core, coração abre Players e escudo abre Mestre. A API também está disponível:

```js
game.modules.get("gms-reputation").api.playerDashboard.openPlayerDashboard();
game.modules.get("gms-reputation").api.masterPanel.openMasterPanel();
```

## Desenvolvimento e validação

```bash
npm install
npm run preview:build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm test
npm run package
```

[Correção pontual da dev.16](docs/DEV16_FIX.md) · [Restauro e validação da dev.13](docs/PLAYERS_DEV13_ORIGINAL.md) · [Pesquisa do Mestre](docs/MASTER_UX_RESEARCH.md).

A conferência da integração dentro de um mundo Foundry V13 real permanece pendente.
