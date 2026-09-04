# Guia do Mestre — 59.10

Abra **Controle de Reputação** nos Scene Controls.

## Command Deck

A navegação principal possui seis áreas:

1. **Perfis** — grupos, matrizes, membros e perfil focal;
2. **Personagens** — cadastro, identidade e retrato;
3. **Reputação** — relação, score e protocolos;
4. **Histórico** — auditoria e operações reversíveis;
5. **Limpeza** — exclusão permanente de Personagens, Perfis e Grupos antigos;
6. **Sistema** — salvamento, permissões e backup.

O contexto global de perfil + personagem acompanha as áreas relevantes para evitar editar a relação errada.

## Reputação

- faixa base: `-10` a `+10`;
- com Vínculo e/ou Comunhão: teto `+12`;
- passo: `0,5`;
- ajustes rápidos: `−1`, `−0,5`, `+0,5`, `+1`, range e presets.

Ativar um protocolo não concede score automaticamente.

## Protocolos

- `VÍNCULO` e `COMUNHÃO` são persistidos;
- `DUPLO//SINC` é derivado quando ambos estão ativos.

## Retratos

Aceita FilePicker do Foundry e URL HTTP(S), incluindo GIF quando o navegador/servidor puder exibir. O enquadramento suporta zoom e posição X/Y.

## Salvamento

Há modos manual, automático e após pausa. **Manual é o padrão em novas instalações.** O botão **Salvar mudanças** relê os controles atuais de reputação/Vínculo/Comunhão no clique antes de gravar, portanto não depende de um evento de campo anterior. O estado da barra informa alterações pendentes/sincronizadas e operações persistidas entram no histórico.

## Histórico / Undo / Redo

Mudanças persistidas registram usuário, horário, antes/depois, motivo e transactionId. Operações em massa podem ser revertidas como uma unidade lógica.

## Permissões

Gamemaster completo é a autoridade final. Capacidades delegadas são revalidadas antes de gravações mundiais.

## Backup

Use **Sistema → Backup / rollback → Restaurar último backup**. Faça também backup externo do World antes de atualizações importantes.


## Limpeza permanente

A área **Limpeza** só aparece para um Gamemaster completo. Para habilitar os botões destrutivos é necessário marcar **Desbloquear exclusões** e confirmar cada operação.

- **Personagem:** apaga o cadastro e remove a Relationship/roster correspondente de todos os Perfis.
- **Perfil:** apaga a matriz e suas Relationships internas; Personagens permanecem no World.
- **Grupo:** apaga somente o agrupador; Perfis são preservados e movidos para **Sem Grupo**.

Antes de cada exclusão o WorldStore cria automaticamente um backup do estado anterior. Exclusões permanentes não entram em Undo/Redo; em caso de erro, use a restauração do backup antes de fazer outra gravação.
