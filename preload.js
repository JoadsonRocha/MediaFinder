const { contextBridge, ipcRenderer } = require("electron");

// Log para DEV e EXE
console.log("✅ Preload carregado com sucesso:", new Date().toISOString());

// ============================================================
// Função segura para IPC (evita travar UI no EXE)
// ============================================================
function safeInvoke(channel, ...args) {
  console.log("📨 IPC Call:", channel, args);

  return ipcRenderer.invoke(channel, ...args)
    .then(res => {
      console.log("✅ IPC Response:", channel, res);
      return res;
    })
    .catch(err => {
      console.error("❌ IPC Error on", channel, err);
      return null;
    });
}

// ============================================================
// EXPOR API PARA O FRONT
// ============================================================
contextBridge.exposeInMainWorld("api", {
  
  // ---------------------------
  // PASTA ATUAL
  // ---------------------------
  getPastaAtual: () => safeInvoke("get-pasta-atual"),

  // ---------------------------
  // ESCOLHER PASTA
  // ---------------------------
  escolherPasta: () => safeInvoke("escolher-pasta"),

  // ---------------------------
  // BUSCAR LISTA DE VÍDEOS
  // ---------------------------
  buscarMidia: (termo) => safeInvoke("buscar-midia", termo),

  // ---------------------------
  // BUSCAR APENAS UM ARQUIVO (favoritos)
  // ---------------------------
  buscarArquivo: (caminho) => safeInvoke("buscar-midia-arquivo", caminho),

  // ---------------------------
  // ABRIR NO WINDOWS
  // ---------------------------
  abrirNoWindows: (caminho) => safeInvoke("abrir-video-windows", caminho),

  // ---------------------------
  // ABRIR LINK EXTERNO
  // ---------------------------
  openExternal: (url) => safeInvoke("open-external", url)
});
