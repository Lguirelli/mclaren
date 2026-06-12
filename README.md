# McLaren MP4/5 — Cinematic Scroll Repository

Repositório estático em Three.js para apresentar o GLB com câmera guiada pelo scroll do mouse.

## Estrutura

```txt
mclaren-scroll-cinematic/
├─ assets/
│  └─ mclaren-mp4-5.glb
├─ config/
│  └─ cameraPath.json
├─ src/
│  ├─ main.js
│  └─ styles.css
├─ index.html
└─ README.md
```

## Como rodar localmente

Como o modelo é carregado por `fetch`, abra com um servidor local, não direto pelo arquivo.

Opção simples com Python:

```bash
cd mclaren-scroll-cinematic
python -m http.server 8000
```

Depois abra:

```txt
http://localhost:8000
```

## Sequência de câmera aplicada

A sequência foi atualizada para seguir as referências de enquadramento enviadas, nesta ordem:

1. frente 3/4 baixa com o carro inteiro
2. plongée próximo sobre o capô
3. close frontal na quina dianteira
4. plano aberto e distante com o carro menor no quadro
5. traseira 3/4 baixa e centralizada
6. vista aérea diagonal top-down

Esses keyframes estão em `config/cameraPath.json`.

Cada keyframe tem:

- `progress`: ponto do scroll entre `0` e `1`
- `position`: posição da câmera `[x, y, z]`
- `target`: ponto para onde a câmera olha
- `lensFocus`: distância de foco usada no efeito de profundidade
- `fov`: abertura da lente para reforçar a linguagem do plano
- `modelRotationY`: rotação do modelo durante aquele trecho

## Ajustes visuais principais

Os efeitos de renderização ficam em `src/main.js`:

- `ACESFilmicToneMapping` para visual mais cinematográfico
- `RoomEnvironment` para reflexos realistas
- `DirectionalLight`, `HemisphereLight` e `RectAreaLight` para iluminação de estúdio
- `UnrealBloomPass` para brilho suave
- `BokehPass` para profundidade de campo
- scroll suavizado com interpolação entre keyframes
- pequena oscilação de câmera pelo mouse para sensação orgânica
- interpolação de `fov` por trecho para deixar cada plano mais próximo da referência

## Observação

O GLB tem cerca de 105 MB. Para publicação real, vale gerar uma versão otimizada em `.glb` com compressão Draco ou Meshopt, mantendo uma versão original separada para edição.
