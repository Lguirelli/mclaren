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

## Onde ajustar o movimento de câmera

Edite `config/cameraPath.json`.

Cada keyframe tem:

- `progress`: ponto do scroll entre `0` e `1`.
- `position`: posição da câmera `[x, y, z]`.
- `target`: ponto para onde a câmera olha.
- `lensFocus`: distância de foco usada no efeito de profundidade.
- `modelRotationY`: rotação do modelo durante aquele trecho.

Quando você enviar as referências de movimento, o ideal é transformar cada uma em uma sequência de keyframes nesse arquivo.

## Ajustes visuais principais

Os efeitos de renderização ficam em `src/main.js`:

- `ACESFilmicToneMapping` para visual mais cinematográfico.
- `RoomEnvironment` para reflexos realistas.
- `DirectionalLight`, `HemisphereLight` e `RectAreaLight` para iluminação de estúdio.
- `UnrealBloomPass` para brilho suave.
- `BokehPass` para profundidade de campo.
- Scroll suavizado com interpolação entre keyframes.
- Pequeno movimento de câmera pelo mouse para sensação orgânica.

## Observação

O GLB tem cerca de 105 MB. Para publicação real, vale gerar uma versão otimizada em `.glb` com compressão Draco ou Meshopt, mantendo uma versão original separada para edição.

## Correção para erro ao carregar o modelo

Se aparecer `Erro ao carregar o modelo 3D`, confira estes pontos:

1. **Não abra o `index.html` direto no navegador.** Rode com servidor local:

```bash
cd mclaren-scroll-cinematic-loader-fix
python -m http.server 8000
```

Depois acesse:

```txt
http://localhost:8000
```

2. **Confirme se o GLB está nesta pasta:**

```txt
assets/mclaren-mp4-5.glb
```

3. **GitHub tem limite de 100 MB por arquivo.**  
Este GLB fica muito próximo ou acima desse limite. Para publicar no GitHub Pages, use uma destas opções:

- usar Git LFS;
- otimizar/comprimir o GLB;
- hospedar o GLB fora do GitHub e carregar por URL com:

```txt
?model=https://seudominio.com/modelo.glb
```

4. A página agora testa automaticamente estes caminhos:

```txt
./assets/mclaren-mp4-5.glb
./assets/McLaren%20MP4_5%20(blend3_6).glb
./assets/McLaren MP4_5 (blend3_6).glb
```

5. Para depurar, abra o DevTools do navegador em `F12 > Console` e veja se o erro é `404`, `CORS`, `Unexpected token`, `Failed to fetch` ou limite de arquivo.

## Estrutura da pesquisa alinhada ao movimento da câmera

A pesquisa da landing deve seguir a ordem dos keyframes do `cameraPath.json`, porque cada seção aparece enquanto o carro ocupa uma posição diferente na tela:

```txt
0.00 — Hero / frente 3/4 baixa
0.18 — História / capô em plongée
0.36 — Design / close frontal
0.58 — Legado / plano aberto distante
0.80 — Performance / traseira 3/4 baixa
1.00 — Especificações / vista aérea top-down
```
