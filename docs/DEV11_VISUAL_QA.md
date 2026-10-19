> Registro histórico. A dev.13 remove o sistema de paletas e restaura os Players da dev.70.13, acrescentando somente a pesquisa de NPCs. Consulte PLAYERS_DEV13_ORIGINAL.md para o comportamento atual.

# Validação — dev.11

Base preservada: dev.70.13. Correção das paletas e acabamento dos Players; sem publicação remota.

## Resultado

- Paletas não são mais aplicadas ao root, template ou rascunhos visuais do painel do Mestre. Só a miniatura do editor antecipa as cores. Comparação de estilos computados confirmou cabeçalho e navegação do Mestre invariantes ao editar grupo, NPC e oito pares extremos de cores.
- Dez áreas reais dos Players mudam ao alternar paleta própria/herdada: página, cabeçalho, texto focal, aba NPCs, gaveta, perfil atual, pesquisa, grupo, NPC selecionado e lista.
- Vínculo, Comunhão e Duplo Sync têm um único painel retangular, borda íntegra e nome/sigilo sem polígonos ou pseudoelementos recortados. Verificados em 1500, 1024, 700 e 390 px e a 125%.
- Gradiente semântico independente da paleta do NPC. Corações preenchidos têm cores diferentes ao longo da trilha; ficha e score recebem as mesmas cores. Linha inferior proporcional a `abs(score)/limite`. Valores fracionários continuam exibindo meio coração, inclusive 11,5/12. Scores longos recebem tipografia menor na mesma coluna. A ficha detalhada reutiliza o mesmo gradiente e corrige a largura do nome, antes anulada por uma regra antiga de `max-content`.
- Material industrial local estático em escala fixa de 128 px, com relevo de usinagem e pequenas marcas de registro. Sem ruído aleatório, filtros SVG pesados ou loops de renderização.
- Navegação anima texto e controles; mudança de reputação anima a trilha visível; hover/foco pulsa os corações uma vez. Efeitos limitados, canceláveis e desativados por movimento reduzido. Nenhuma animação é aplicada a contêineres com retratos.
- Imagens/GIFs permanecem sobre fundo neutro #05090e, inclusive transparências. Comparação de pixels confirmou ausência de filtros, textura, brilho e efeitos no hover ou na navegação.

## Verificação

33 arquivos de testes Node aprovados. Sete suítes de navegador aprovadas: edição/lotes/histórico/imagens, desempenho, geometria original, busca/motion, iluminação contida, mídia limpa e paletas. 23.850 pares de contraste derivados de cores extremas e amostragem de RGB: texto principal >=7:1, texto secundário >=4,5:1 e foco >=3:1 contra as superfícies derivadas. O gradiente colorido não substitui sinal, número, quantidade ou rótulo acessível dos corações.

Teste massivo repetido: 129 GIFs (maior ~13 MB), 1.548 combinações nos editores, oito entradas inválidas, 16 verificações de reprodução, 80 trocas de fonte e 163 verificações de rolagem. Mundo com 512 personagens, 96 NPCs e 49.152 relações: 567 ms para render, pico de 13 retratos ativos, concorrência máxima de quatro requisições; sem falhas. Teste separado do Mestre: 40 NPCs × 300 personagens, 24 linhas/144 células materializadas; 346,6 ms no ambiente de teste, com as suítes concorrentes.

As capturas desktop/mobile foram inspecionadas localmente. Testes utilizam Chromium e o adaptador offline com templates e controladores do módulo. Não havia servidor Foundry V13 disponível; FilePicker, instalação e sincronização multiusuário reais ainda dependem de validação dentro do Foundry.
