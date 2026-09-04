# Backup e rollback — 59.0

## Proteções

1. backup externo do World/Foundry antes de atualizar;
2. `worldStateBackup` automático antes de gravações;
3. Undo/Redo para operações registradas;
4. Journal legado preservado pela migração.

## Restaurar o último snapshot

No Command Deck: **Sistema → Backup / rollback → Restaurar último backup**.

Requisitos:

- Gamemaster completo;
- nenhum buffer local pendente;
- snapshot disponível.

Antes da restauração, o estado atual é preservado como próximo backup.

## Rollback total

Se precisar abandonar a instalação:

1. desative `gms-reputation` no World;
2. restaure o backup externo do diretório de dados/World, se necessário;
3. mantenha o Journal legado intacto até validar definitivamente a migração.
