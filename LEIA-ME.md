# McLaren MP4/5 — edição WebGPU com luminárias

## Executar

Extraia o ZIP em uma pasta nova, abra um terminal dentro de `mclaren-webgpu` e execute `npm start`. Abra http://127.0.0.1:3000 no navegador. Node.js é necessário; npm install não é necessário. Não abra o HTML por duplo clique.

O carro, as luminárias, suas texturas e o Three.js 0.180.0 estão incluídos. As fontes Barlow Condensed e Manrope usam Google Fonts com alternativas locais. Para publicar, envie o conteúdo completo da pasta a um serviço de hospedagem estática.

## Direção de iluminação

O cenário contém o carro, um único plano transparente que recebe sombras e os dois assets fornecidos. O piso texturizado, a estrutura e as barras luminosas do cenário original continuam excluídos.

- A luminária suspensa fornece luz superior neutra, com aproximadamente três metros de comprimento e base a 3,5 metros. Seus cabos originais continuam visíveis e terminam acima da peça, sem teto modelado.
- O tripé industrial fica na lateral traseira, com altura aproximada de 1,66 metro. Dois focos levemente quentes acompanham os centros e as direções reais das lentes.
- A luz ampla superior e a fonte que projeta sua sombra compartilham a mesma origem. É uma aproximação de área com sombra em tempo real, não uma simulação fotométrica da luminária.
- O ambiente de reflexos usa cartões nas posições e orientações dessas luminárias, com preenchimento ambiente discreto. Foram retiradas as luzes anteriores sem uma luminária correspondente.
- A emissão das lâmpadas é contida e estável, sem pulsação ou aumento de intensidade durante a entrada. O brilho superficial da lâmpada e a luz que ilumina a carroceria são calculados separadamente pelo renderizador.
- O plano de sombra não tem textura, reflexo de piso nem sombra pintada. O contraste da sombra é discreto sobre o fundo escuro.

## Preparação dos assets

`industrial-work-light.zip` continha um FBX com referências antigas de textura, dois materiais e mapas de cor, normal, metalização e rugosidade. As referências foram reconstruídas e o material das duas lentes foi preservado separadamente. O resultado tem 18.998 triângulos e aproximadamente 5,21 MB.

`hanging-light.zip` continha um ZIP interno com COLLADA, oito peças e mapas PBR, incluindo emissão. As transformações do COLLADA foram preservadas e a escala corrigida para uma peça base de 1,5 metro, ampliada na cena para três metros. O resultado tem 6.544 triângulos e aproximadamente 2,19 MB.

Os dois assets foram convertidos para GLB com texturas de 1024 pixels incorporadas. Cor e emissão usam sRGB; mapas físicos usam dados lineares. O mapa de oclusão separado não foi incorporado, evitando escurecimento adicional sobre o GTAO existente. Os arquivos originais permanecem intactos.

## Renderização e movimento

WebGPURenderer com inicialização assíncrona e fallback nativo para WebGL 2, materiais físicos, AgX e exposição estável. A câmera percorre uma curva contínua com limite de velocidade. Narrativa, fontes e entrada dos textos foram preservadas.

O desktop usa GTAO discreto, bloom leve e profundidade de campo suave no perfil WebGPU completo. Celulares e dispositivos lentos usam um perfil mais leve. O movimento reduzido desativa introdução, paralaxe e entradas dos textos, mantendo a câmera suave.

Para solicitar WebGL 2 explicitamente, abra http://127.0.0.1:3000/?renderer=webgl.

## Ajustes

- `src/practicalLighting.js`: posições das luminárias, fontes de luz, sombras e ambiente de reflexos.
- `src/scenery.js`: isolamento do carro e plano de sombra.
- `src/materials.js`: materiais do carro.
- `src/main.js`: carregamento, câmera e interação.
- `src/postprocessing.js`: efeitos e perfis de qualidade.
- `config/cameraPath.json`: enquadramentos.

## Verificações e limites

A geometria dos três GLBs foi decodificada em testes. Foram verificados os materiais PBR incorporados, a emissão das lentes, a conversão para materiais WebGPU, a escala, a preservação das transformações do carro e o plano de sombra. Sintaxe e regressão da câmera também foram verificadas.

As duas luminárias foram inspecionadas em imagens renderizadas no Blender. Essas imagens serviram para conferir geometria e materiais; não representam uma validação visual da cena no WebGPU. A conferência HTTP local foi bloqueada pelo ambiente na revisão anterior. A aparência final, a compilação dos shaders e o fallback automático precisam de conferência no navegador.

Os modelos e marcas foram fornecidos pelo usuário. Não foi incluída uma licença adicional dos assets nos arquivos enviados. Mantenha os créditos e condições de uso dos respectivos autores ao publicar.
