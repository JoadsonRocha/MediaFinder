const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

// ============================================================
// CAMINHO DO FFmpeg: extraResources (fora do ASAR)
// ============================================================
const getFFmpegPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", "bin", "ffmpeg.exe");
  } else {
    return path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");
  }
};

const getFFprobePath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", "bin", "ffprobe.exe");
  } else {
    return path.join(__dirname, "ffmpeg", "bin", "ffprobe.exe");
  }
};

ffmpeg.setFfmpegPath(getFFmpegPath());
ffmpeg.setFfprobePath(getFFprobePath());

// ============================================================
// PASTA DE THUMBNAILS
// ============================================================
const thumbsDir = path.join(app.getPath("userData"), "thumbs");
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

// ============================================================
// CONFIGURAÇÃO DA PASTA DE VÍDEOS
// ============================================================
const pastaConfigFile = path.join(app.getPath("userData"), "pasta.json");
let pastaVideos = null;

if (fs.existsSync(pastaConfigFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(pastaConfigFile, "utf8"));
    pastaVideos = data.pasta;
  } catch (e) {
    console.log("Erro lendo pasta.json:", e);
  }
}

function salvarPasta(pasta) {
  pastaVideos = pasta;
  fs.writeFileSync(pastaConfigFile, JSON.stringify({ pasta }, null, 2));
  console.log("✅ Pasta salva:", pasta);
}

// ============================================================
// JANELA PRINCIPAL — CARREGA DE app/
// ============================================================
function createWindow() {
  const appPath = path.join(__dirname, "app"); // ← pasta app/
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    icon: path.join(appPath, "mediaFinder.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: true
    }
  });

  win.loadFile(path.join(appPath, "index.html"))
    .catch(err => console.error("❌ Falha ao carregar index.html:", err));

  // win.webContents.openDevTools(); // descomente para debug
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

// ... (resto do IPC permanece igual — sem alteração)
ipcMain.handle("get-pasta-atual", () => pastaVideos);
ipcMain.handle("escolher-pasta", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths.length) return null;
  salvarPasta(result.filePaths[0]);
  return pastaVideos;
});

const EXT = [".mp4", ".mkv", ".mov", ".flv", ".avi"];

function buscarArquivosNaPasta(dir, termo) {
  if (!dir) return [];
  try {
    return fs.readdirSync(dir)
      .filter(n => EXT.includes(path.extname(n).toLowerCase()))
      .filter(n => !termo || n.toLowerCase().includes(termo.toLowerCase()))
      .map(n => ({ nome: n, caminho: path.join(dir, n) }));
  } catch (err) {
    console.log("Erro ao ler pasta:", err);
    return [];
  }
}

function gerarCapaAutomatica(caminho, destino, base) {
  return new Promise(resolve => {
    ffmpeg(caminho)
      .on("error", err => {
        console.log("❌ Erro FFmpeg:", err.message || err);
        resolve();
      })
      .on("end", () => resolve())
      .screenshots({
        timestamps: ["10%"],
        filename: `${base}_cover.jpg`,
        folder: destino,
        size: "420x?"
      });
  });
}

function obterMetadados(caminho) {
  return new Promise(resolve => {
    ffmpeg.ffprobe(caminho, (err, data) => {
      if (err) {
        console.log("❌ Erro FFprobe:", err.message || err);
        return resolve({ duracao: 0, largura: 0, altura: 0, tamanho: 0 });
      }
      const stream = data.streams.find(s => s.width && s.height);
      resolve({
        duracao: data.format.duration ?? 0,
        tamanho: data.format.size ?? 0,
        largura: stream?.width ?? 0,
        altura: stream?.height ?? 0
      });
    });
  });
}

ipcMain.handle("buscar-midia", async (event, termo) => {
  if (!pastaVideos) return [];
  const arquivos = buscarArquivosNaPasta(pastaVideos, termo);
  const lista = [];
  for (const item of arquivos) {
    const base = path.basename(item.caminho, path.extname(item.caminho));
    const capa = path.join(thumbsDir, `${base}_cover.jpg`);
    if (!fs.existsSync(capa)) await gerarCapaAutomatica(item.caminho, thumbsDir, base);
    const meta = await obterMetadados(item.caminho);
    lista.push({ ...item, thumbnail: capa, ...meta });
  }
  return lista;
});

ipcMain.handle("buscar-midia-arquivo", async (event, caminho) => {
  if (!fs.existsSync(caminho)) return null;
  const base = path.basename(caminho, path.extname(caminho));
  const capa = path.join(thumbsDir, `${base}_cover.jpg`);
  if (!fs.existsSync(capa)) await gerarCapaAutomatica(caminho, thumbsDir, base);
  const meta = await obterMetadados(caminho);
  return { nome: base, caminho, thumbnail: capa, ...meta };
});

ipcMain.handle("abrir-video-windows", (e, caminho) => shell.openPath(caminho));
ipcMain.handle("open-external", (e, url) => shell.openExternal(url));