# McLaren MP4/5 — edição WebGPU

## Executar

1. Extraia o ZIP em uma pasta nova.
2. Abra um terminal dentro de `mclaren-webgpu`.
3. Execute `npm start` com Node.js instalado.
4. Abra http://127.0.0.1:3000 em um navegador atualizado.

Não abra o HTML por duplo clique. A cena precisa ser servida por HTTP local ou HTTPS.
O modelo e o Three.js estão incluídos. Não é necessário executar npm install.
As fontes Barlow Condensed e Manrope são solicitadas ao Google Fonts, com fontes alternativas se a conexão falhar.

## Publicar

Publique o conteúdo da pasta, incluindo `vendor/`, em um serviço estático como GitHub Pages.
Não há compilação. `server.mjs` é apenas o servidor de desenvolvimento local.

## Renderização

- Three.js 0.180.0 fixo, incluído em `vendor/three` com a licença original.
- WebGPURenderer com inicialização assíncrona e fallback nativo para WebGL 2.
- Pós-processamento TSL em lugar de EffectComposer, BokehPass e UnrealBloomPass.
- AgX para transições suaves nas altas luzes e exposição estável.
- Pintura não metálica com verniz discreto e rugosidade mínima.
- Rugosidade das rodas modulada pelo mapa original de metalização para diferenciar borracha e aros.
- Luzes amplas e ambiente de reflexos com posições correspondentes, sem varredura de luz artificial.
- Sombra PCF, sombra de contato aproximada e GTAO discreto no desktop.
- Profundidade de campo suave no perfil WebGPU completo e bloom discreto.
- No celular ou em desempenho baixo, os efeitos de tela são removidos para reduzir o custo.
- WebGL 2 mantém oclusão e bloom no desktop, sem profundidade de campo.
- Câmera fracionária contínua com limite de velocidade, inclusive com efeitos reduzidos.
- Narrativa revisada, fontes e animações de entrada preservadas.

O modo de movimento reduzido retira a introdução, a paralaxe e as entradas dos textos.
A câmera continua acompanhando a navegação suavemente, sem saltar entre capítulos.

## Conferir o fallback

Abra http://127.0.0.1:3000/?renderer=webgl para solicitar explicitamente o backend WebGL 2.
No endereço normal, WebGPU tem preferência. O backend ativo fica no atributo `data-renderer`
do elemento HTML, para inspeção técnica, sem aparecer na interface do visitante.

## Arquivos de ajuste

- `src/main.js`: cena, iluminação, carregamento e movimento.
- `src/materials.js`: materiais físicos e tratamento de rugosidade.
- `src/postprocessing.js`: efeitos TSL e perfis de qualidade.
- `src/cameraMotion.js`: suavização e limite de velocidade.
- `config/cameraPath.json`: seis enquadramentos em ordem dos capítulos.
- `index.html` e `src/styles.css`: narrativa e apresentação.

## Verificações e limites

Passaram os testes de sintaxe, resolução dos módulos locais, construção do renderizador,
seleção explícita do backend WebGL, conversão dos oito materiais com preservação de texturas,
construção dos grafos de pós-processamento, inicialização do decodificador Meshopt e regressão
_da lógica_ de movimento a 30, 60 e 120 quadros por segundo.

Esses testes não confirmam a compilação dos shaders na GPU nem a aparência final.
O navegador integrado não conseguiu acessar a prévia local neste ambiente. A renderização real,
a aparência do modelo e o fallback automático em diferentes dispositivos ainda exigem teste no navegador.

A iluminação usa aproximações em tempo real. O ambiente de reflexos é estático, a sombra
complementar de contato é uma textura suave e não há path tracing nem reflexo planar do carro no piso.

## Referências

- https://threejs.org/manual/pages/webgpurenderer
- https://github.com/mrdoob/three.js/tree/r180
- https://global.honda/en/F1/machine/1989_McLarenHondaMP45/
- https://global.honda/en/POWEREDbyHONDA/1989_ra109e/

Os modelos e as marcas vieram do projeto original. Estudo visual independente.
