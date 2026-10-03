# Instalação — GMS // Matriz de Reputação 1.2.0-dev.70.13

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

As animações do Player e do Mestre são locais, sem dependência de CDN. A pesquisa, as referências e a cobertura estão em [MOTION_DESIGN.md](MOTION_DESIGN.md).

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
