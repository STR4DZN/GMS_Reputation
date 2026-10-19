# Teste massivo de GIFs — GMS Reputação 2.0.0-dev.4

Executado em 19/10/2026, Chromium headless local, com templates, CSS e controladores reais do módulo no adaptador de prévia. **Resultado: passou.**

## Conjunto

129 GIFs animados gerados deterministicamente com Pillow, seed `7013`. Dimensões: 1×1, 16×16, 32×512, 512×32, 64×64, 128×256, 256×128, 320×180, 180×320, 512×512, 768×1024, 1024×768, 1024×1024, 1920×1080, 1080×1920 e 4096×512. Variações de transparência, disposal 1/2, 3–24 frames e duração por frame de 40–240 ms. Um arquivo adicional de alta entropia tem aproximadamente 13 MB. Não são GIFs copiados de terceiros.

Também foram usados GIF corrompido, truncado, vazio e URL inexistente. O corpus é de QA; não entra no ZIP instalável nem é carregado pelo módulo em produção.

## Resultados observados

| Medida | Resultado |
| --- | ---: |
| GIFs animados distintos | 129 |
| Bytes do conjunto | 17.026.827 |
| Maior GIF | 12.992.035 bytes |
| Combinações de enquadramento | 1548 |
| Amostras com animação visível verificada | 16 |
| Casos de erro nos dois editores | 8 |
| Trocas rápidas de fonte | 80 |
| Personagens | 512 |
| NPCs | 96 |
| Relações | 49152 |
| Checagens durante rolagem/navegação | 163 |
| Pico de retratos ativos | 13 |
| Pico de requisições simultâneas | 2 |
| Requisições de mídia ao longo do teste | 1007 |
| Renderização inicial do cenário grande | 516 ms |
| Navegação no cenário grande | 36455 ms |

## O que foi verificado

- Os 129 arquivos foram carregados nos editores de personagem e focal, com dimensões naturais conferidas.
- Cada arquivo foi exercitado em `contain` e `cover`, com zoom 50%, 137% e 300%, posição X=17/Y=83 e transformação uniforme: 129 × 2 editores × 2 fits × 3 zooms = 1.548 combinações.
- Frames visíveis de 16 GIFs foram comparados em capturas do navegador, confirmando animação, além de validar o número de frames de todos os arquivos com Pillow.
- Fit, sliders e campos numéricos mantêm os mesmos valores; trocar fonte preserva o fit. A prévia continua quadrada para personagem e 16:9 para focal.
- Falhas exibem feedback e retry. Uma nova fonte que não carregou não substitui o retrato persistido. O mesmo endereço volta a funcionar após a recuperação do servidor.
- 80 mudanças consecutivas de fonte preservam a última escolha. O agendador pode coalescer trocas no mesmo ciclo; isso não significa 80 downloads paralelos.
- Salvamento, Undo e Redo preservam o GIF original e o enquadramento focal completo.
- O cenário grande possui 512 personagens e 96 NPCs, com 49.152 relações. Todas as páginas do elenco foram visitadas, com rolagens internas, trocas de NPC, alternância entre dossiês e matriz e largura de 390 px.
- O limite de carregamento simultâneo permanece em dois; imagens fora de vista perdem `src`. Fechar o painel remove todos os retratos ativos. Não houve erro JavaScript não tratado.

## Reproduzir

No checkout de desenvolvimento desta revisão (a instalação Foundry não contém os testes), os pré-requisitos são: Node, dependências de `package.json`, Python com Pillow e Chromium compatível com Playwright.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/do/chromium npm run test:gifs
```

O gerador escreve em `/tmp/gms-gif-corpus`; o relatório JSON da execução fica em `/tmp/gms-master-qa/gif-stress.json`. O teste gera seu próprio servidor HTTP local para mídia e fecha-o ao terminar. Nenhum arquivo é enviado ao Foundry.

## Limites da medição

Os tempos são desta execução local, não uma promessa de FPS, consumo de RAM ou desempenho em outros computadores. O navegador administra seus próprios caches de GIFs; retirar `src` não garante coleta imediata da memória decodificada. Não foram simulados todos os GIFs externos possíveis, latência de internet, HoloSuite ou concorrência entre clientes Foundry. O FilePicker do servidor e a integração real com Foundry V13 ainda precisam ser conferidos no mundo de destino.
