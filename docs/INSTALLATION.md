# Instalação — GMS // Matriz de Reputação 1.2.0-dev.60.6

## Alvo

- Foundry VTT v13.
- `minimum: 13.341`.
- `verified: 13.351`.
- SocketLib `1.1.3+` obrigatório (recomendado `1.1.4`).

## Instalação / atualização manual

1. Faça backup do World/diretório de dados.
2. Feche o World e pare o processo/servidor Foundry antes de substituir o módulo.
3. **Remova a pasta antiga `Data/modules/gms-reputation` inteira. Não mescle builds.**
4. Extraia a nova pasta `gms-reputation` em `Data/modules/`.
5. Confirme a existência de `Data/modules/gms-reputation/module.json`.
6. Confirme que **SocketLib** está instalado e ativo; o manifesto o declara como dependência obrigatória.
7. Abra o Foundry e habilite **GMS // Matriz de Reputação**.
8. Faça hard refresh no navegador (`Ctrl+F5`).
9. Entre primeiro com um Gamemaster completo para inicialização/migração do estado mundial.

## Como abrir

Nos Scene Controls do Foundry:

- **Matriz de Reputação** abre a visão Player;
- **Controle de Reputação** abre o Command Deck para funções autorizadas.

A API fica disponível em `game.modules.get("gms-reputation").api`.

## Verificação recomendada — 60.6

Antes de usar em sessão, em uma cópia/backup do World:

1. abra a Matriz do Player e confirme que a sidebar fica à esquerda e o dossiê ocupa a coluna larga à direita;
2. redimensione a janela do módulo e confirme que o responsivo acompanha a largura da própria Application;
3. abra o Mestre e confirme as abas superiores, seletores e área de trabalho;
4. confirme perfis e retratos;
5. altere reputação em `+0,5`;
6. teste Vínculo/Comunhão;
7. salve, recarregue a página e confirme persistência;
8. entre como Player e confirme a sincronização;
9. teste Undo/Redo e o último backup.

## Instalação pelo manifesto / atualizações

No Foundry, use este URL de manifesto ao instalar o módulo:

`https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/main/module.json`

Depois de instalado por esse manifesto, o Foundry usa os campos `manifest` e `download` para consultar e baixar releases futuras. Ao publicar uma nova versão, atualize `version` e `download` no `module.json`, envie esse manifesto para a branch `main`, crie a tag `v<versão>` e anexe o ZIP `GMS_Reputation_<versão>.zip` à release.
