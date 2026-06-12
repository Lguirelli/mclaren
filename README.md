# Patch de correção v2 — conteúdo, iluminação e câmera

Este patch corrige quatro pontos do repositório publicado no GitHub Pages:

1. substitui o hero genérico pelo texto baseado na pesquisa do carro;
2. reduz a iluminação estourada;
3. remove a dependência de qualquer plano de palco visível na base da cena;
4. corrige a passagem para a traseira 3/4, priorizando movimento de câmera em volta do carro, sem girar o modelo de forma artificial.

## Arquivos do patch

```txt
index.html
src/main.js
src/styles.css
config/cameraPath.json
README.md
```

## O que mudou tecnicamente

- o `main.js` agora extrai apenas o modelo principal `McLaren mp4.5` do GLB;
- luzes e câmeras embutidas no GLB são removidas antes de inserir o carro na cena;
- exposição, bloom e intensidade das luzes foram reduzidos;
- o palco inferior visível foi removido da composição;
- a sequência de keyframes foi reescrita para entregar um plano traseiro 3/4 de verdade.

## Como aplicar

Substitua no repositório estes arquivos:

```txt
index.html
src/main.js
src/styles.css
config/cameraPath.json
```

Depois faça commit e push.
