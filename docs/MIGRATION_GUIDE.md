# Migração da macro legada — 59.0

Quando o novo banco está vazio, o módulo pode importar do Journal legado configurado:

- personagens conhecidos/descobertos;
- scores e meios-corações;
- Vínculo;
- Comunhão;
- retratos, zoom e posição;
- perfil focal e descrição;
- páginas/perfis legados detectáveis.

## Segurança

A migração automática só grava quando:

1. há um Gamemaster completo conectado;
2. o `WorldState` novo está vazio;
3. a migração ainda não foi concluída.

Se já houver dados no módulo, a rotina não mistura os bancos silenciosamente.

## Retratos conflitantes

A precedência é determinística e conflitos aparecem no relatório da migração. O Journal original não é apagado.

`DUPLO//SINC` não é persistido como terceiro boolean: ele continua derivado da coexistência de Vínculo + Comunhão. Histórico retroativo não é inventado.

Depois da migração, compare perfis, scores negativos/positivos, retratos e protocolos antes de abandonar o fluxo antigo.
