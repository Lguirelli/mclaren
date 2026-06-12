# Patch GitHub Pages — McLaren MP4/5 com GLB local otimizado

Este patch foi feito para rodar direto em um repositório no GitHub Pages.

## O que foi corrigido

- O GLB enviado tinha 104,9 MiB.
- Ele foi otimizado para 14,0 MiB.
- O modelo agora fica dentro do próprio repositório em:

```txt
assets/mclaren-mp4-5.glb
```

- O `src/main.js` foi ajustado para carregar somente esse caminho local:

```txt
./assets/mclaren-mp4-5.glb
```

- Foi adicionado `.nojekyll`, útil para evitar interferências do Jekyll no GitHub Pages.
- Foi adicionado `config/landingSections.json` para organizar o conteúdo da landing conforme o movimento da câmera.

## Como aplicar

Copie/substitua estes arquivos no seu repositório:

```txt
assets/mclaren-mp4-5.glb
config/cameraPath.json
config/landingSections.json
src/main.js
src/styles.css
index.html
.nojekyll
README.md
```

Depois faça o commit e push normalmente:

```bash
git add .
git commit -m "Fix GitHub Pages GLB loading"
git push
```

## Importante

Não use Git LFS para este GLB se o objetivo é rodar no GitHub Pages. O arquivo otimizado já está abaixo do limite normal de 100 MiB, então pode ser versionado diretamente no Git.

## Estrutura da landing alinhada ao movimento

```txt
0.00 — Hero / frente 3/4 baixa
0.18 — História / capô em plongée
0.36 — Design / close frontal
0.58 — Legado / plano aberto distante
0.80 — Performance / traseira 3/4 baixa
1.00 — Especificações / vista aérea top-down
```

## Se ainda der erro

1. Confirme se o arquivo existe no GitHub em:

```txt
assets/mclaren-mp4-5.glb
```

2. Aguarde o GitHub Pages terminar o deploy.
3. Abra o DevTools do navegador e veja se o erro é 404.
4. Confirme se o caminho publicado bate com o caminho do projeto.
