# Instalação — GMS // Matriz de Reputação 1.2.0-dev.70.6

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
6. Abra o Foundry e habilite **GMS // Matriz de Reputação**.
7. Faça hard refresh no navegador (`Ctrl+F5`).
8. Entre primeiro com um Gamemaster completo para inicialização/migração do estado mundial.

## Como abrir

Ative o **HoloSuite Core** e abra o app **Reputação**, identificado pelo coração.

- Funções com permissão de controle abrem o painel de edição.
- Players abrem a Matriz de Reputação somente para leitura.
- Os atalhos antigos não são mais adicionados aos controles de token.

O HoloSuite Core é recomendado para abrir o app. A API de Reputação também continua disponível para macros:

```js
game.modules.get("gms-reputation").api.playerDashboard.openPlayerDashboard();
game.modules.get("gms-reputation").api.masterPanel.openMasterPanel();
```

A API fica disponível em `game.modules.get("gms-reputation").api`.

## Verificação recomendada

Antes de usar em sessão, em uma cópia/backup do World:

1. abra Player e Mestre;
2. confirme perfis e retratos;
3. confirme que perfil focal e cards estão alinhados e que a Matriz do Player não mostra Pesquisa;
4. altere reputação em `+0,5`;
5. teste Vínculo/Comunhão;
6. salve, recarregue a página e confirme persistência;
7. entre como Player e confirme a sincronização;
8. teste Undo/Redo e o último backup.

## Instalação pelo manifesto / atualizações

No Foundry, use este URL de manifesto ao instalar o módulo:

`https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/dev70-npc-right-sidebar/module.json`

Depois de instalado por esse manifesto, o Foundry usa os campos `manifest` e `download` para consultar e baixar as atualizações desta branch de teste.
