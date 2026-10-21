# McLaren MP4/5 — WebGL com câmera contínua

## Abrir

Extraia em uma pasta nova. Dentro de `mclaren-webgl`, execute `npm start` e abra http://127.0.0.1:3000. Não use duplo clique no HTML: os modelos 3D precisam ser carregados por HTTP. Não é necessário npm install.

## O que mudou

Esta edição usa o WebGLRenderer clássico do Three.js 0.180.0, com WebGL 2. Não é o backend WebGL do WebGPURenderer. WebGPU, TSL e materiais por nós foram removidos do pacote. O carro e as luminárias continuam sendo modelos 3D reais, com câmera contínua acompanhando a rolagem. Não há frames pré-renderizados.

Cinco luminárias foram preservadas, com uma única fonte principal projetando sombra e um plano transparente para recebê-la. As outras luzes fazem o preenchimento, sem sombras próprias. Materiais PBR convencionais preservam as texturas do modelo; não há GTAO, bloom, desfoque ou passe adicional de pós-processamento. O verniz separado foi removido para simplificar o material da carroceria.

A resolução é limitada e reduzida quando o desempenho cai. A cena pausa quando a aba fica oculta e não fica redesenhando quando câmera e interação estão paradas. A animação de entrada dos textos e o modo de movimento reduzido permanecem.

## Compatibilidade

É necessária uma GPU integrada ou dedicada e um navegador com WebGL 2 habilitado. A compatibilidade é mais ampla do que uma implementação exclusivamente WebGPU, mas não pode ser garantida em todo dispositivo. Em caso de falha gráfica, a história permanece acessível e a tela informa a etapa afetada.

## Validação

Passaram as verificações de sintaxe, montagem das cinco luminárias com materiais convencionais, limite de uma sombra, continuidade da câmera e entrega dos 23 arquivos por HTTP. Um teste com renderizador simulado confirmou a chegada ao primeiro desenho e a 100%, sem inicialização assíncrona do renderizador ou espera por compilação antecipada. Essa simulação não confirma a compilação GLSL na GPU. A renderização visual no navegador ainda não foi validada neste ambiente.

## Arquivos

`src/main.js`: carregamento e câmera. `src/materials.js`: materiais convencionais. `src/practicalLighting.js`: luminárias e iluminação. `src/scenery.js`: carro e plano de sombra. `config/cameraPath.json`: enquadramentos. Modelos e texturas estão em `assets/`, e o Three.js local em `vendor/three/`.
