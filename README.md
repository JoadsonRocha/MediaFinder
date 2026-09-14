<div align="center">

# 🎬 MediaFinder

### Organizador e Reprodutor Inteligente de Vídeos Locais

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](./LICENSE.md)
[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/)
[![Version](https://img.shields.io/badge/Version-2.1.0-6C63FF?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README_EN.md)**

<p align="center">
  O <strong>MediaFinder</strong> é uma aplicação desktop desenvolvida para transformar a forma como você organiza, pesquisa e assiste seus vídeos armazenados localmente. Com geração automática de miniaturas via FFmpeg, player integrado em modal e busca instantânea, sua coleção de mídia ganha vida em uma interface moderna e com tema Dark Glassmorphism.
</p>

</div>

---

## 📸 Demonstração Visual

<div align="center">

| 🏠 Tela Inicial | 🎞 Catálogo & Miniaturas | ⚙ Configurações & Pastas |
| :---: | :---: | :---: |
| <img src="./Telainicial.png" width="300" alt="Tela Inicial" /> | <img src="./Telavideos.png" width="300" alt="Catálogo de Vídeos" /> | <img src="./Telaconfig.png" width="300" alt="Configurações de Pasta" /> |

</div>

---

## ✨ Principais Funcionalidades

- ⚡ **Busca Instantânea em Tempo Real**: Filtre centenas de vídeos enquanto digita com resposta de alto desempenho (*debounce* de 250ms).
- 🖼️ **Miniaturas Automáticas Inteligentes**: Extração de capas reais dos vídeos usando FFmpeg, indexadas por hash MD5 único para máxima velocidade e sem conflito de nomes.
- 🎬 **Player de Vídeo Embutido**: Assista diretamente pelo modal integrado com atalhos de teclado (`Espaço` para play/pause, `ESC` para fechar).
- 🚀 **Integração com o Windows**:
  - *Reprodutor Externo*: Abra rapidamente qualquer arquivo no reprodutor padrão do seu sistema operacional.
  - *Mostrar na Pasta*: Destaque e selecione o arquivo diretamente no Explorador de Arquivos com apenas um clique.
- ⭐ **Sistema de Favoritos**: Salve seus vídeos preferidos com persistência local e acesse-os instantaneamente pela aba de favoritos.
- 🔀 **Ordenação Avançada**: Ordene sua coleção por:
  - 🔤 Nome (A - Z e Z - A)
  - 📅 Data de Modificação (Mais recentes)
  - 💾 Tamanho do Arquivo (Maior para menor)
  - ⏱️ Duração do Vídeo (Maior para menor)
- 📂 **Suporte a Múltiplos Formatos e Subpastas**:
  - Compatível com `.mp4`, `.mkv`, `.avi`, `.webm`, `.mov`, `.wmv`, `.m4v`, `.flv`, `.ts`, `.3gp`, `.mpg`, `.mpeg`.
  - Opção de busca recursiva ativável no menu para incluir todas as subpastas.
- 🛡️ **100% Privado e Offline**: Seus arquivos nunca saem da sua máquina. Não há telemetria, anúncios nem necessidade de login ou internet.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído com foco em leveza, performance e design:

- **[Electron](https://www.electronjs.org/)** — Framework para criação de aplicativos desktop multiplataforma com tecnologias web.
- **[Node.js](https://nodejs.org/)** — Processamento em segundo plano, acesso ao sistema de arquivos e gerenciamento de processos.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/pt-BR/docs/Web/CSS)** — Interface limpa, responsiva, com Glassmorphism, animações fluidas e Dark Mode.
- **[JavaScript (ES6+)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)** — Lógica reativa, manipulação eficiente do DOM e controle de estado.
- **[Fluent-FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)** — Integração com o FFmpeg/FFprobe para geração de miniaturas e metadados.

---

## 📁 Estrutura do Projeto

```text
MediaFinder/
├── app/                      # Interface e Processo de Renderização (Frontend)
│   ├── index.html            # Estrutura semântica e acessível da interface
│   ├── renderer.js           # Gerenciamento de estado, player modal e filtros
│   ├── style.css             # Design system completo com dark mode e animações
│   └── mediaFinder.ico       # Ícone oficial do aplicativo
├── main.js                   # Processo principal (Electron Main Process)
├── preload.js                # Ponte IPC segura com ContextBridge
├── package.json              # Configurações de dependências e scripts de build
├── .gitignore                # Regras de exclusão para versionamento Git
├── LICENSE.md                # Licença GNU General Public License v3.0
├── README.md                 # Documentação oficial (Português)
└── README_EN.md              # Official documentation (English)
```

---

## 🚀 Instalação e Execução

### Pré-requisitos
Certifique-se de ter instalado em seu computador:
- **[Node.js](https://nodejs.org/)** (versão 18 ou superior recomendada)
- **Git** instalado

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/JoadsonRocha/MediaFinder.git
   cd MediaFinder
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o aplicativo em modo de desenvolvimento:**
   ```bash
   npm start
   ```

4. **Gerar executável de produção para Windows:**
   ```bash
   npm run dist
   ```
   *O instalador `.exe` e versão portátil serão gerados automaticamente na pasta `dist/`.*

---

## ⚙️ Configuração do FFmpeg

O **MediaFinder** possui detecção inteligente do FFmpeg:
- Se você já tiver o FFmpeg instalado e configurado no `PATH` do Windows, o aplicativo o reconhecerá automaticamente.
- Caso o FFmpeg não seja detectado, o aplicativo **continuará funcionando normalmente**: listando, filtrando, reproduzindo e organizando os vídeos, exibindo capas elegantes em SVG como fallback.

> [!TIP]
> **Como instalar o FFmpeg no Windows rapidamente:**
> Abra o PowerShell como Administrador e execute:
> ```powershell
> winget install Gyan.FFmpeg
> ```
> Ou baixe os binários em [ffmpeg.org](https://ffmpeg.org/download.html) e coloque os executáveis (`ffmpeg.exe` e `ffprobe.exe`) na pasta `ffmpeg/bin/` na raiz do projeto.

---

## 📄 Licença

Este projeto está sob a licença **GNU General Public License v3.0 (GNU GPLv3)**. Consulte o arquivo [LICENSE.md](./LICENSE.md) para obter mais detalhes sobre seus direitos de uso, modificação e distribuição de código aberto.

---

## 👨‍💻 Autor

<div align="center">

**Joadson Rocha**  
*Desenvolvedor Full Stack & Desktop*

[![Website](https://img.shields.io/badge/Portf%C3%B3lio-joadsonrocha.github.io-6C63FF?style=for-the-badge&logo=google-chrome&logoColor=white)](https://joadsonrocha.github.io)
[![GitHub](https://img.shields.io/badge/GitHub-JoadsonRocha-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JoadsonRocha)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Joadson_Rocha-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/joadsonrocha/)

</div>
