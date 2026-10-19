# Instalação — GMS // Matriz de Reputação 2.0.0-dev.13

## Alvo

- Foundry VTT v13.
- `minimum: 13.341`.
- `verified: 13.351`.

## Instalação / atualização manual

1. Faça backup do World/diretório de dados.
2. Feche o World e pare o processo/servidor Foundry antes de substituir o módulo.
3. **Remova a pasta antiga `Data/modules/gms-reputation` inteira. Não mescle builds.**
4. Extraia a nova pasta `gms-reputation` em `Data/modules/`.
5. Confirme a existência de `Data/modules/gms-reputation/module.json`.
6. Abra o Foundry e habilite **GMS // Reputação V2**.
7. Faça hard refresh no navegador (`Ctrl+F5`).
8. Entre primeiro com um Gamemaster completo para inicialização/migração do estado mundial.

## Como abrir

Ative o **HoloSuite Core**. A Reputação oferece dois apps:

- **Reputação** (coração): abre a Matriz de Reputação dos Players, inclusive quando o GM usa esse app.
- **Gerenciar Reputação** (escudo): abre o painel de edição e fica oculto para Players. O acesso exige uma conta GM com permissão de controle.
- Os atalhos antigos não são mais adicionados aos controles de token.

O HoloSuite Core é recomendado para abrir o app. A API de Reputação também continua disponível para macros:

```js
game.modules.get("gms-reputation").api.playerDashboard.openPlayerDashboard();
game.modules.get("gms-reputation").api.masterPanel.openMasterPanel();
```

A API fica disponível em `game.modules.get("gms-reputation").api`.

## Enquadramento das mídias

O padrão “Imagem inteira” preserva a proporção original e mostra a mídia completa em 100%, deixando margens quando a proporção da imagem difere do quadro. “Preencher quadro” preserva a proporção, mas recorta as bordas para ocupar o retângulo. Ambos os modos valem para imagens e GIFs e são salvos por retrato. Zoom amplia uniformemente e não altera o modo escolhido. “Resetar enquadramento” volta à imagem inteira, centralizada em 100%. Miniaturas mostram a fonte inteira, sem achatamento.

## Carregamento dos retratos

Imagens e GIFs são solicitados apenas quando seus retratos aparecem na área visível de cada painel. Grupos, abas e seletores fechados não antecipam downloads. Cada janela permite até duas solicitações de retratos em andamento. Quando o retrato sai da área visível, sua fonte ativa é retirada; o URL persistido, o quadro e o enquadramento não mudam. GIFs podem reiniciar ao reaparecer. O navegador gerencia seus próprios caches: retirar a fonte não garante liberação imediata de toda a memória usada pela mídia.

## Verificação recomendada

As animações do Player e do Mestre são locais, sem dependência de CDN. Os Players usam animações finitas e respeitam movimento reduzido; a revisão atual está em [PLAYERS_DEV7_REFERENCE.md](PLAYERS_DEV7_REFERENCE.md).

Antes de usar em sessão, em uma cópia/backup do World:

1. abra Player e Mestre;
2. confirme perfis e retratos;
3. confirme que perfil focal e cards estão alinhados e que a Matriz do Player não mostra Pesquisa;
4. altere reputação em `+0,5`;
5. teste Vínculo/Comunhão;
6. salve, recarregue a página e confirme persistência;
7. entre como Player e confirme a sincronização;
8. teste Undo/Redo e o último backup.

## Distribuição da V2

Esta entrega é uma prévia local baseada exatamente na dev.70.13. Instale pelo ZIP. Os links `manifest` e `download` foram omitidos porque ainda não há uma release V2 publicada; o pacote não deve baixar silenciosamente a versão original.

A compatibilidade declarada foi herdada da base V13. Os testes locais e de navegador estão descritos em [V2_DASHBOARD.md](V2_DASHBOARD.md); execute a verificação dentro do seu mundo antes de usar em sessão.
