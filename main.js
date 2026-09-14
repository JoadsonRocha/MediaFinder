/**
 * ============================================================================
 * MediaFinder - Processo Principal (Electron Main Process)
 * ============================================================================
 * @description Gerencia o ciclo de vida do aplicativo, criação de janelas,
 *              integração com o sistema operacional, chamadas IPC seguras,
 *              detecção do FFmpeg e leitura/otimização de mídia local.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");

// ============================================================================
// 1. CONFIGURAÇÃO E DETECÇÃO DO FFMPEG / FFPROBE
// ============================================================================

/**
 * Variável de controle para indicar se o FFmpeg está disponível no ambiente.
 */
let ffmpegDisponivel = false;

/**
 * Verifica se um executável existe no PATH do sistema operacional (Windows/Linux/macOS).
 * @param {string} binario - Nome do binário (ex: 'ffmpeg', 'ffprobe')
 * @returns {boolean}
 */
function existeNoPath(binario) {
  try {
    const comando = process.platform === "win32" ? `where ${binario}` : `which ${binario}`;
    execSync(comando, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Configura os caminhos dos binários do FFmpeg e FFprobe.
 * Prioridade:
 *  1. Pasta extraResources empacotada (produção)
 *  2. Pasta local ./ffmpeg/bin/ (desenvolvimento local)
 *  3. PATH global do sistema operacional
 */
function inicializarFFmpeg() {
  const localExtraBinFFmpeg = path.join(process.resourcesPath, "ffmpeg", "bin", "ffmpeg.exe");
  const localExtraBinFFprobe = path.join(process.resourcesPath, "ffmpeg", "bin", "ffprobe.exe");

  const localDevBinFFmpeg = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");
  const localDevBinFFprobe = path.join(__dirname, "ffmpeg", "bin", "ffprobe.exe");

  if (app.isPackaged && fs.existsSync(localExtraBinFFmpeg)) {
    // 1. Modo produção com extraResources
    ffmpeg.setFfmpegPath(localExtraBinFFmpeg);
    if (fs.existsSync(localExtraBinFFprobe)) ffmpeg.setFfprobePath(localExtraBinFFprobe);
    ffmpegDisponivel = true;
    console.log("✅ FFmpeg configurado a partir de extraResources:", localExtraBinFFmpeg);
  } else if (fs.existsSync(localDevBinFFmpeg)) {
    // 2. Modo desenvolvimento com pasta local
    ffmpeg.setFfmpegPath(localDevBinFFmpeg);
    if (fs.existsSync(localDevBinFFprobe)) ffmpeg.setFfprobePath(localDevBinFFprobe);
    ffmpegDisponivel = true;
    console.log("✅ FFmpeg configurado a partir da pasta local:", localDevBinFFmpeg);
  } else if (existeNoPath("ffmpeg")) {
    // 3. FFmpeg encontrado no PATH do sistema
    ffmpegDisponivel = true;
    console.log("✅ FFmpeg detectado no PATH do sistema operacional.");
  } else {
    // 4. Nenhum FFmpeg disponível
    ffmpegDisponivel = false;
    console.warn("⚠️ FFmpeg não foi encontrado. Geração de thumbnails automáticas ficará desativada.");
  }
}

inicializarFFmpeg();

// ============================================================================
// 2. DIRETÓRIOS E ARMAZENAMENTO DE DADOS
// ============================================================================

// Diretório para armazenamento persistente das capas em cache
const thumbsDir = path.join(app.getPath("userData"), "thumbs");
if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Arquivo JSON onde fica salva a pasta de vídeos escolhida pelo usuário
const pastaConfigFile = path.join(app.getPath("userData"), "pasta.json");
let pastaVideos = null;

// Carrega a configuração prévia se existir
if (fs.existsSync(pastaConfigFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(pastaConfigFile, "utf8"));
    if (data.pasta && fs.existsSync(data.pasta)) {
      pastaVideos = data.pasta;
    }
  } catch (e) {
    console.error("❌ Erro ao ler pasta.json:", e);
  }
}

/**
 * Salva o diretório de vídeos no disco de forma persistente.
 * @param {string} novaPasta - Caminho absoluto da pasta
 */
function salvarPasta(novaPasta) {
  pastaVideos = novaPasta;
  try {
    fs.writeFileSync(pastaConfigFile, JSON.stringify({ pasta: novaPasta }, null, 2));
    console.log("✅ Nova pasta de vídeos salva:", novaPasta);
  } catch (err) {
    console.error("❌ Falha ao gravar pasta.json:", err);
  }
}

// ============================================================================
// 3. CRIAÇÃO DA JANELA PRINCIPAL
// ============================================================================

let mainWindow = null;

function createWindow() {
  const appPath = path.join(__dirname, "app");
  const iconePath = fs.existsSync(path.join(appPath, "mediaFinder.ico"))
    ? path.join(appPath, "mediaFinder.ico")
    : path.join(__dirname, "mediaFinder.ico");

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#0c0a18",
    show: false, // Evita flash branco antes do carregamento completo
    icon: iconePath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  // Exibe a janela suavemente assim que a página estiver renderizada
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Remove menu de topo nativo do sistema operacional
  Menu.setApplicationMenu(null);

  // Carrega a interface da pasta app/
  const htmlPath = path.join(appPath, "index.html");
  mainWindow.loadFile(htmlPath).catch(err => {
    console.error("❌ Falha ao carregar index.html:", err);
  });
}

// Inicialização do ciclo de vida do Electron
app.whenReady().then(createWindow);

// Encerramento em plataformas não-macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================================================
// 4. FUNÇÕES AUXILIARES DE MÍDIA E THUMBNAILS
// ============================================================================

// Formatos de vídeo suportados
const EXTENSOES_SUPORTADAS = [
  ".mp4", ".mkv", ".mov", ".flv", ".avi",
  ".webm", ".wmv", ".m4v", ".ts", ".3gp", ".mpg", ".mpeg"
];

/**
 * Gera um hash MD5 seguro e curto para associar cada caminho a uma thumbnail única.
 * @param {string} caminho - Caminho absoluto do arquivo
 * @returns {string} - Hash hexadecimal
 */
function gerarHashCaminho(caminho) {
  return crypto.createHash("md5").update(caminho.toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Varre a pasta de vídeos e retorna arquivos suportados.
 * @param {string} dir - Diretório base
 * @param {string} [termo] - Termo de busca opcional
 * @param {boolean} [recursivo=false] - Se deve buscar em subpastas
 * @returns {Array<{nome: string, caminho: string, tamanho: number, modificadoEm: number}>}
 */
function buscarArquivosNaPasta(dir, termo = "", recursivo = false) {
  if (!dir || !fs.existsSync(dir)) return [];

  const termoLower = termo ? termo.toLowerCase() : "";
  const resultados = [];

  function lerDiretorio(caminhoAtual) {
    try {
      const entradas = fs.readdirSync(caminhoAtual, { withFileTypes: true });

      for (const entrada of entradas) {
        const caminhoCompleto = path.join(caminhoAtual, entrada.name);

        if (entrada.isDirectory() && recursivo) {
          lerDiretorio(caminhoCompleto);
        } else if (entrada.isFile()) {
          const ext = path.extname(entrada.name).toLowerCase();
          if (EXTENSOES_SUPORTADAS.includes(ext)) {
            if (!termoLower || entrada.name.toLowerCase().includes(termoLower)) {
              let tamanho = 0;
              let modificadoEm = 0;
              try {
                const stat = fs.statSync(caminhoCompleto);
                tamanho = stat.size;
                modificadoEm = stat.mtimeMs;
              } catch (e) {
                // Se falhar o stat, continua com valores padrão
              }

              resultados.push({
                nome: entrada.name,
                caminho: caminhoCompleto,
                extensao: ext,
                tamanho,
                modificadoEm
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Erro ao ler pasta:", caminhoAtual, err);
    }
  }

  lerDiretorio(dir);
  return resultados;
}

/**
 * Gera miniatura (thumbnail) do vídeo usando o FFmpeg.
 * @param {string} caminhoVideo - Caminho do vídeo
 * @param {string} pastaDestino - Onde salvar a thumbnail
 * @param {string} nomeArquivoCapa - Nome final da imagem
 * @returns {Promise<boolean>}
 */
function gerarCapaAutomatica(caminhoVideo, pastaDestino, nomeArquivoCapa) {
  if (!ffmpegDisponivel) return Promise.resolve(false);

  return new Promise(resolve => {
    ffmpeg(caminhoVideo)
      .on("error", err => {
        console.warn("⚠️ Aviso FFmpeg ao gerar thumbnail:", path.basename(caminhoVideo), err.message || err);
        resolve(false);
      })
      .on("end", () => resolve(true))
      .screenshots({
        timestamps: ["10%"],
        filename: nomeArquivoCapa,
        folder: pastaDestino,
        size: "480x?"
      });
  });
}

/**
 * Obtém dimensões e duração exata do vídeo via FFprobe (se disponível).
 * @param {string} caminhoVideo - Caminho do vídeo
 * @param {number} fallbackTamanho - Tamanho em bytes pelo fs.stat
 * @returns {Promise<{duracao: number, largura: number, altura: number, tamanho: number}>}
 */
function obterMetadados(caminhoVideo, fallbackTamanho = 0) {
  if (!ffmpegDisponivel) {
    return Promise.resolve({ duracao: 0, largura: 0, altura: 0, tamanho: fallbackTamanho });
  }

  return new Promise(resolve => {
    ffmpeg.ffprobe(caminhoVideo, (err, data) => {
      if (err || !data) {
        return resolve({ duracao: 0, largura: 0, altura: 0, tamanho: fallbackTamanho });
      }

      const stream = data.streams?.find(s => s.width && s.height);
      resolve({
        duracao: data.format?.duration ?? 0,
        tamanho: data.format?.size ?? fallbackTamanho,
        largura: stream?.width ?? 0,
        altura: stream?.height ?? 0
      });
    });
  });
}

// ============================================================================
// 5. CANAIS IPC (COMUNICAÇÃO MAIN <-> RENDERER)
// ============================================================================

// Retorna a pasta de vídeos atualmente configurada
ipcMain.handle("get-pasta-atual", () => pastaVideos);

// Abre diálogo nativo do sistema para selecionar uma nova pasta
ipcMain.handle("escolher-pasta", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione a pasta de vídeos",
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths.length) return null;
  salvarPasta(result.filePaths[0]);
  return pastaVideos;
});

// Retorna status do sistema (FFmpeg, versão, etc.)
ipcMain.handle("obter-status-sistema", () => ({
  ffmpeg: ffmpegDisponivel,
  versao: app.getVersion(),
  pastaAtual: pastaVideos
}));

// Busca catálogo de vídeos com geração de thumbnails controlada
ipcMain.handle("buscar-midia", async (event, termo = "", recursivo = false) => {
  if (!pastaVideos) return [];

  const arquivos = buscarArquivosNaPasta(pastaVideos, termo, recursivo);
  const lista = [];

  // Limite de processamento de miniaturas por requisição para manter responsividade
  for (const item of arquivos) {
    const hash = gerarHashCaminho(item.caminho);
    const nomeCapa = `${hash}_cover.jpg`;
    const capaCompleta = path.join(thumbsDir, nomeCapa);

    let temThumbnail = fs.existsSync(capaCompleta);

    // Se a capa ainda não existe e temos FFmpeg, tenta gerar
    if (!temThumbnail && ffmpegDisponivel) {
      temThumbnail = await gerarCapaAutomatica(item.caminho, thumbsDir, nomeCapa);
    }

    // Coleta metadados
    const meta = await obterMetadados(item.caminho, item.tamanho);

    lista.push({
      ...item,
      thumbnail: temThumbnail ? capaCompleta : null,
      duracao: meta.duracao,
      largura: meta.largura,
      altura: meta.altura,
      tamanho: meta.tamanho || item.tamanho
    });
  }

  return lista;
});

// Busca informações de um único arquivo (usado para atualizar favoritos)
ipcMain.handle("buscar-midia-arquivo", async (event, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return null;

  const base = path.basename(caminho);
  const ext = path.extname(caminho).toLowerCase();
  const hash = gerarHashCaminho(caminho);
  const nomeCapa = `${hash}_cover.jpg`;
  const capaCompleta = path.join(thumbsDir, nomeCapa);

  let temThumbnail = fs.existsSync(capaCompleta);
  if (!temThumbnail && ffmpegDisponivel) {
    temThumbnail = await gerarCapaAutomatica(caminho, thumbsDir, nomeCapa);
  }

  let tamanho = 0;
  let modificadoEm = 0;
  try {
    const st = fs.statSync(caminho);
    tamanho = st.size;
    modificadoEm = st.mtimeMs;
  } catch {}

  const meta = await obterMetadados(caminho, tamanho);

  return {
    nome: base,
    caminho,
    extensao: ext,
    tamanho: meta.tamanho || tamanho,
    modificadoEm,
    thumbnail: temThumbnail ? capaCompleta : null,
    duracao: meta.duracao,
    largura: meta.largura,
    altura: meta.altura
  };
});

// Abre o arquivo de vídeo no reprodutor padrão do sistema operacional
ipcMain.handle("abrir-video-windows", (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return false;
  return shell.openPath(caminho);
});

// Revela o arquivo dentro da pasta no Windows Explorer / Gerenciador de Arquivos
ipcMain.handle("revelar-no-explorer", (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return false;
  shell.showItemInFolder(caminho);
  return true;
});

// Abre link web com segurança no navegador padrão
ipcMain.handle("open-external", (e, url) => {
  if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
    return shell.openExternal(url);
  }
  return false;
});