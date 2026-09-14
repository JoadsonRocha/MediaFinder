/**
 * ============================================================================
 * MediaFinder - Preload Script (Ponte Segura IPC)
 * ============================================================================
 * @description Expõe com segurança APIs limitadas do processo principal (Node.js)
 *              para o processo de renderização (Frontend/DOM) usando contextBridge.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Invoca um canal IPC de forma segura com tratamento centralizado de erros.
 * @param {string} canal - Nome do canal IPC no processo principal
 * @param  {...any} args - Argumentos a serem passados
 * @returns {Promise<any>}
 */
function safeInvoke(canal, ...args) {
  return ipcRenderer.invoke(canal, ...args).catch(err => {
    console.error(`❌ Erro na chamada IPC [${canal}]:`, err);
    return null;
  });
}

// ============================================================================
// EXPOSIÇÃO DA API PARA O FRONTEND (window.api)
// ============================================================================
contextBridge.exposeInMainWorld("api", {
  /**
   * Obtém a pasta de vídeos atualmente configurada no sistema.
   * @returns {Promise<string|null>}
   */
  getPastaAtual: () => safeInvoke("get-pasta-atual"),

  /**
   * Abre a caixa de diálogo do sistema para que o usuário escolha uma pasta.
   * @returns {Promise<string|null>}
   */
  escolherPasta: () => safeInvoke("escolher-pasta"),

  /**
   * Retorna o status do sistema (presença do FFmpeg, versão, pasta ativa).
   * @returns {Promise<{ffmpeg: boolean, versao: string, pastaAtual: string|null}>}
   */
  obterStatusSistema: () => safeInvoke("obter-status-sistema"),

  /**
   * Busca e lista os arquivos de vídeo na pasta configurada.
   * @param {string} [termo=""] - Termo de filtro textual
   * @param {boolean} [recursivo=false] - Se deve incluir subpastas
   * @returns {Promise<Array<object>>}
   */
  buscarMidia: (termo = "", recursivo = false) => safeInvoke("buscar-midia", termo, recursivo),

  /**
   * Busca os dados completos de um único arquivo de vídeo pelo caminho (favoritos).
   * @param {string} caminho - Caminho absoluto do arquivo
   * @returns {Promise<object|null>}
   */
  buscarArquivo: (caminho) => safeInvoke("buscar-midia-arquivo", caminho),

  /**
   * Abre o arquivo no reprodutor de vídeo padrão do Windows.
   * @param {string} caminho - Caminho absoluto do arquivo
   * @returns {Promise<string>}
   */
  abrirNoWindows: (caminho) => safeInvoke("abrir-video-windows", caminho),

  /**
   * Destaca e seleciona o arquivo diretamente no Explorador de Arquivos do Windows.
   * @param {string} caminho - Caminho absoluto do arquivo
   * @returns {Promise<boolean>}
   */
  revelarNoExplorer: (caminho) => safeInvoke("revelar-no-explorer", caminho),

  /**
   * Abre um link externo (como portfólio ou GitHub) no navegador padrão do usuário.
   * @param {string} url - Link HTTP/HTTPS
   * @returns {Promise<void>}
   */
  openExternal: (url) => safeInvoke("open-external", url)
});
