# McLaren MP4/5 — versão sem 3D em tempo real

Abra `index.html` diretamente no navegador. Também pode executar `npm start` e abrir http://127.0.0.1:3000.

Esta versão usa seis imagens JPEG pré-renderizadas. Não carrega Three.js, modelos GLB, WebGPU, WebGL ou shaders. Não existe uma tela de carregamento bloqueando a história. Fontes externas são opcionais e têm alternativas locais.

O carro e as luminárias foram renderizados previamente em CPU, com Cycles. No dispositivo do visitante há somente HTML, CSS, imagens e um script pequeno para acompanhar a rolagem. O navegador pode usar aceleração gráfica interna para compor a página, mas a experiência não exige uma API 3D nem uma GPU dedicada.

A câmera livre e o percurso 3D contínuo foram substituídos por transições entre seis enquadramentos fixos. A narrativa, os capítulos, a navegação e as entradas dos textos permanecem. O botão de movimento reduzido troca as imagens sem transição. Sem JavaScript, a primeira imagem e o conteúdo continuam disponíveis.

Compatibilidade mais ampla não significa suporte garantido a todo aparelho ou navegador. A qualidade visual é fixa e o desempenho depende principalmente do download e da decodificação das imagens. O pacote não contém os modelos 3D pesados.

Para publicar, envie todo o conteúdo desta pasta a uma hospedagem estática. Para modificar enquadramentos, substitua as imagens em `assets/`. O CSS está em `src/styles.css` e a interação em `src/main.js`.

Verificação: seis enquadramentos inspecionados visualmente, referências locais conferidas e testes das transições, imagem indisponível e movimento reduzido aprovados. As seis imagens somam aproximadamente 373 KB. A interface completa não foi conferida no navegador integrado, que não conseguiu acessar a prévia local.

