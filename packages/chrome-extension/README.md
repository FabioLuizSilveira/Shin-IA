# Shinã Marketing IA — Extensão Chrome

Captura anúncios de qualquer página para o Shinã Marketing IA:

- **Salvar no Swipe File** — clique direito em qualquer imagem → abre o app e salva no swipe file
- **Clonar anúncio** — clique direito → abre o Ad Cloner com a imagem pré-carregada

As ações abrem o app autenticado (sessão do navegador) — a extensão não
armazena tokens nem chama APIs diretamente.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique **Carregar sem compactação** e selecione esta pasta (`packages/chrome-extension`)

## Publicação na Chrome Web Store

Pendente: requer conta de desenvolvedor Google (taxa única de US$5) e revisão.
Este diretório não participa dos pipelines Turbo (sem package.json) por ser
JavaScript puro sem build.
