# McLaren MP4/5 — A precisão de uma era

## Abrir no computador

É necessário ter Node.js instalado.

1. Extraia o ZIP.
2. Abra um terminal na pasta `mclaren-cinematic`.
3. Execute `npm start`.
4. Acesse http://127.0.0.1:3000 no navegador.

Não abra o HTML por duplo clique: a cena carrega arquivos locais por HTTP.
Three.js e as fontes são carregados pela internet. O modelo 3D está incluído.
Para encerrar o servidor, pressione Ctrl+C no terminal.

## Publicar no GitHub Pages

Coloque `index.html`, `src/`, `config/` e `assets/` na raiz publicada.
Não há etapa de compilação. `server.mjs` serve apenas para a prévia local.

## O que mudou

- Narrativa em seis capítulos: máquina, forma, mudança, engenharia, protagonistas e legado.
- Barlow Condensed nos títulos; Manrope nos parágrafos e controles.
- Entrada dos textos com opacidade, deslocamento e desfoque, em sequência de 140 ms.
- Luz principal ampla, contraluz fria, luz móvel e ambiente de reflexos de estúdio.
- Acendimento progressivo das barras; aproximação inicial discreta.
- Uma luz com sombra e uma sombra de contato suave sob o carro.
- Piso acetinado; preservação das texturas originais do carro.
- Percurso de câmera Catmull–Rom, foco calculado e composição alternada por capítulo.
- Capítulos sincronizados com as posições reais do conteúdo na página.
- Enquadramento para celular, sem profundidade de campo.
- Redução automática de resolução e desativação de desfoque em desempenho baixo.
- Renderização sob demanda e pausa quando a aba fica oculta.
- Preferência do sistema por movimento reduzido e controle manual.
- A história permanece acessível pelo botão “Ler a história” se o 3D falhar.

## Ajustar

`config/cameraPath.json`: posição, alvo e campo de visão dos seis enquadramentos.
A ordem dos enquadramentos corresponde à ordem dos capítulos do HTML.
`src/main.js`: iluminação, materiais, pós-processamento e interação.
`src/styles.css`: fontes, cores, composição e entradas.
`index.html`: narrativa e navegação.

A sombra de contato é uma aproximação suave. Os reflexos vêm de um ambiente
de estúdio estático; não há reflexão planar em tempo real do carro no piso.

## Verificação

Sintaxe JavaScript, estrutura dos capítulos, referências locais e respostas HTTP
verificadas. A calibração visual no navegador ficou pendente: o navegador integrado
não conseguiu alcançar o servidor local deste ambiente.

## Referências históricas

- Honda — MP4/5, temporada de 1989:
  https://global.honda/en/F1/machine/1989_McLarenHondaMP45/
- Honda — motor RA109E:
  https://global.honda/en/POWEREDbyHONDA/1989_ra109e/

Os modelos 3D foram fornecidos no projeto original. A identidade e as marcas
foram preservadas para este estudo visual independente.

## Revisão 2

- Removido o arredondamento da câmera para capítulos inteiros no modo reduzido.
- Progresso fracionário com velocidade limitada e continuação dos quadros até a câmera chegar ao destino.
- Modo reduzido desativa entradas, paralaxe e desfoque; a navegação da câmera continua suave.
- Sombreado atrás do texto muda gradualmente ao longo do percurso.
- Títulos sem pontos finais ou frases separadas e parágrafos com narrativa mais contínua.
- Iluminação principal e de recorte mais baixas, reflexos menos intensos, barras com emissão reduzida e exposição estável.
- Brilho ambiental das rodas e metalização do piso reduzidos.
- Regressão de movimento verificada a 30, 60 e 120 quadros por segundo, incluindo reversão e retomada da aba.
- Ajustes visuais orientados pelas capturas enviadas; a nova renderização ainda precisa de conferência visual no navegador.
