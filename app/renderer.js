/**
 * ============================================================================
 * MediaFinder - Processo de Renderização (Frontend / DOM)
 * ============================================================================
 * @description Gerencia a interface gráfica, exibição do catálogo de vídeos,
 *              player modal embutido, filtros, busca instantânea e favoritos.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

// ============================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// ============================================================================
const state = {
  pastaAtual: null,
  todosVideos: [],       // Lista bruta de vídeos retornada do backend
  videosFiltrados: [],   // Lista após busca e abas
  abaAtiva: "todos",     // "todos" | "favoritos"
  termoBusca: "",
  ordenacaoAtual: "nome-asc",
  buscaRecursiva: false,
  statusSistema: null,
  favoritos: new Set(JSON.parse(localStorage.getItem("mf_favoritos") || "[]")),
  videoEmReproducao: null
};

// ============================================================================
// 2. UTILITÁRIOS E HELPERS
// ============================================================================

/**
 * Exibe notificação flutuante temporária (Toast) na tela.
 * @param {string} mensagem - Texto da notificação
 * @param {number} [duracao=3000] - Tempo em milissegundos
 */
function showToast(mensagem, duracao = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = mensagem;
  toast.classList.add("show");

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, duracao);
}

/**
 * Salva a lista de favoritos no LocalStorage do navegador.
 */
function salvarFavoritos() {
  localStorage.setItem("mf_favoritos", JSON.stringify([...state.favoritos]));
  atualizarContadoresAbas();
}

/**
 * Converte segundos em formato de tempo legível (HH:MM:SS ou MM:SS).
 * @param {number} segundos
 * @returns {string}
 */
function formatarDuracao(segundos) {
  if (!segundos || isNaN(segundos) || segundos <= 0) return "--:--";
  const s = Math.floor(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/**
 * Converte bytes em tamanho legível (KB, MB, GB).
 * @param {number} bytes
 * @returns {string}
 */
function formatarTamanho(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Trunca nomes de caminhos longos para exibição amigável no cabeçalho.
 * @param {string} caminho - Caminho absoluto
 * @returns {string}
 */
function truncarCaminho(caminho, maxChars = 42) {
  if (!caminho) return "Nenhuma pasta selecionada";
  if (caminho.length <= maxChars) return caminho;
  return "..." + caminho.slice(caminho.length - maxChars);
}

// ============================================================================
// 3. CARREGAMENTO E ATUALIZAÇÃO DO CATÁLOGO DE VÍDEOS
// ============================================================================

/**
 * Carrega ou recarrega a lista de vídeos a partir do processo principal.
 */
async function carregarCatalogo() {
  const grid = document.getElementById("grid");
  const resultsCount = document.getElementById("resultsCount");

  // Renderiza placeholders (skeletons) para resposta visual instantânea
  if (grid) {
    grid.innerHTML = Array(8)
      .fill(0)
      .map(() => `
        <div class="skeleton-card">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-text"></div>
        </div>
      `)
      .join("");
  }

  if (resultsCount) resultsCount.textContent = "Carregando vídeos locais...";

  try {
    // Consulta status do sistema e pasta ativa
    const status = await window.api?.obterStatusSistema?.();
    state.statusSistema = status;
    state.pastaAtual = status?.pastaAtual || null;

    atualizarIndicadorPasta();
    verificarAvisoFFmpeg();

    if (!state.pastaAtual) {
      renderizarEstadoSemPasta();
      return;
    }

    // Busca todos os arquivos da pasta atual
    const videos = await window.api?.buscarMidia?.("", state.buscaRecursiva);
    state.todosVideos = Array.isArray(videos) ? videos : [];

    // Aplica filtros, busca e ordenação
    aplicarFiltrosEOrdenacao();
  } catch (err) {
    console.error("❌ Erro ao carregar catálogo:", err);
    showToast("Erro ao carregar coleção de vídeos.");
  }
}

/**
 * Atualiza o texto do caminho da pasta no cabeçalho da aplicação.
 */
function atualizarIndicadorPasta() {
  const lblPasta = document.getElementById("lblPastaAtual");
  const boxPasta = document.getElementById("currentPathInfo");
  if (lblPasta) {
    lblPasta.textContent = state.pastaAtual ? truncarCaminho(state.pastaAtual) : "Nenhuma pasta selecionada";
  }
  if (boxPasta && state.pastaAtual) {
    boxPasta.title = `Pasta ativa: ${state.pastaAtual} (Clique para alterar)`;
  }
}

/**
 * Verifica se o FFmpeg está ausente e exibe banner informativo amigável.
 */
function verificarAvisoFFmpeg() {
  const banner = document.getElementById("bannerStatus");
  if (!banner) return;

  if (state.statusSistema && state.statusSistema.ffmpeg === false) {
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

// ============================================================================
// 4. FILTROS, ORDENAÇÃO E RENDERIZAÇÃO DA GRADE (GRID)
// ============================================================================

/**
 * Filtra e ordena a coleção e chama a renderização.
 */
function aplicarFiltrosEOrdenacao() {
  let lista = [...state.todosVideos];

  // 1. Filtro por Aba (Todos ou Favoritos)
  if (state.abaAtiva === "favoritos") {
    lista = lista.filter(v => state.favoritos.has(v.caminho));
  }

  // 2. Filtro por Termo de Busca
  const termo = state.termoBusca.trim().toLowerCase();
  if (termo) {
    lista = lista.filter(v => v.nome.toLowerCase().includes(termo));
  }

  // 3. Ordenação
  lista.sort((a, b) => {
    switch (state.ordenacaoAtual) {
      case "nome-desc":
        return b.nome.localeCompare(a.nome, undefined, { numeric: true, sensitivity: "base" });
      case "data-desc":
        return (b.modificadoEm || 0) - (a.modificadoEm || 0);
      case "tamanho-desc":
        return (b.tamanho || 0) - (a.tamanho || 0);
      case "duracao-desc":
        return (b.duracao || 0) - (a.duracao || 0);
      case "nome-asc":
      default:
        return a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: "base" });
    }
  });

  state.videosFiltrados = lista;
  renderizarGrade(lista);
  atualizarContadoresAbas();
}

/**
 * Atualiza os números nos badges das abas e menu.
 */
function atualizarContadoresAbas() {
  const countTodos = state.todosVideos.length;
  const countFav = state.todosVideos.filter(v => state.favoritos.has(v.caminho)).length;

  const tabCountTodos = document.getElementById("tabCountTodos");
  const tabCountFav = document.getElementById("tabCountFav");
  const countAllBadge = document.getElementById("countAllBadge");
  const countFavBadge = document.getElementById("countFavBadge");

  if (tabCountTodos) tabCountTodos.textContent = countTodos;
  if (tabCountFav) tabCountFav.textContent = countFav;
  if (countAllBadge) countAllBadge.textContent = countTodos;
  if (countFavBadge) countFavBadge.textContent = countFav;

  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) {
    const totalBytes = state.videosFiltrados.reduce((acc, v) => acc + (v.tamanho || 0), 0);
    const labelVideos = state.videosFiltrados.length === 1 ? "vídeo encontrado" : "vídeos encontrados";
    resultsCount.textContent = `${state.videosFiltrados.length} ${labelVideos} • ${formatarTamanho(totalBytes)}`;
  }
}

/**
 * Renderiza os cards de vídeos no DOM.
 * @param {Array<object>} lista
 */
function renderizarGrade(lista) {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";

  // Caso não encontre nenhum vídeo no filtro atual
  if (!lista || lista.length === 0) {
    if (state.abaAtiva === "favoritos") {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <h3 class="empty-title">Nenhum vídeo favoritado</h3>
          <p class="empty-desc">Clique no ícone de estrela em qualquer card para adicionar vídeos aos seus favoritos para acesso rápido.</p>
          <button class="btn-empty-action" onclick="alternarAba('todos')">Ver Todos os Vídeos</button>
        </div>
      `;
    } else if (state.termoBusca) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">Nenhum resultado para "${state.termoBusca}"</h3>
          <p class="empty-desc">Verifique a ortografia ou tente pesquisar por uma palavra-chave diferente.</p>
          <button class="btn-empty-action" onclick="limparBusca()">Limpar Pesquisa</button>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3 class="empty-title">Nenhum vídeo encontrado nesta pasta</h3>
          <p class="empty-desc">A pasta selecionada não contém arquivos nos formatos suportados (.mp4, .mkv, .avi, .webm, .mov, etc.).</p>
          <button class="btn-empty-action" onclick="abrirPopupPasta()">Selecionar Outra Pasta</button>
        </div>
      `;
    }
    return;
  }

  // Constrói os cards para cada vídeo
  lista.forEach(video => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.caminho = video.caminho;

    const isFav = state.favoritos.has(video.caminho);
    const extensaoLimpa = (video.extensao || "").replace(".", "").toUpperCase();
    const duracaoTexto = formatarDuracao(video.duracao);
    const tamanhoTexto = formatarTamanho(video.tamanho);
    const resolucaoTexto = video.largura && video.altura ? `${video.largura}x${video.altura}` : "";

    // Conteúdo visual da miniatura
    const conteudoThumb = video.thumbnail
      ? `<img class="thumb-image" src="${video.thumbnail}" alt="${video.nome}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'thumb-fallback\\'><div class=\\'fallback-icon\\'>🎬</div><span class=\\'fallback-ext\\'>${extensaoLimpa}</span></div>';" />`
      : `
        <div class="thumb-fallback">
          <svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="2" y1="7" x2="7" y2="7"></line>
            <line x1="2" y1="17" x2="7" y2="17"></line>
            <line x1="17" y1="17" x2="22" y2="17"></line>
            <line x1="17" y1="7" x2="22" y2="7"></line>
          </svg>
          <span class="fallback-ext">${extensaoLimpa}</span>
        </div>
      `;

    card.innerHTML = `
      <div class="thumb-wrapper">
        ${conteudoThumb}
        <span class="badge-ext">${extensaoLimpa}</span>
        ${duracaoTexto !== "--:--" ? `<span class="badge-duration">${duracaoTexto}</span>` : ""}

        <!-- Overlay com Play Rápido -->
        <div class="thumb-overlay">
          <div class="play-button-icon" title="Reproduzir no player interno">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </div>

        <!-- Botão Favoritar -->
        <button class="fav-btn ${isFav ? "active" : ""}" title="${isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}" aria-label="Favoritar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? "#FFD54A" : "rgba(255,255,255,0.7)"}">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </div>

      <div class="card-body">
        <h3 class="card-title" title="${video.nome}">${video.nome}</h3>
        <div class="card-meta">
          <span>${tamanhoTexto}</span>
          ${resolucaoTexto ? `<span>${resolucaoTexto}</span>` : ""}
        </div>

        <!-- Ações Rápidas -->
        <div class="card-quick-actions">
          <button class="btn-card-action btn-open-external" title="Abrir no Reprodutor Padrão do Windows">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Windows
          </button>
          <button class="btn-card-action btn-show-folder" title="Mostrar arquivo na pasta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            Pasta
          </button>
        </div>
      </div>
    `;

    // Clique no Card: Abre o reprodutor modal interno
    card.addEventListener("click", (e) => {
      // Ignora se o clique for nos botões de ação do card
      if (e.target.closest(".fav-btn") || e.target.closest(".btn-open-external") || e.target.closest(".btn-show-folder")) {
        return;
      }
      abrirPlayerModal(video);
    });

    // Ação: Favoritar / Desfavoritar
    const btnFav = card.querySelector(".fav-btn");
    btnFav?.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarFavorito(video.caminho, btnFav);
    });

    // Ação: Abrir no Windows
    const btnExt = card.querySelector(".btn-open-external");
    btnExt?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.abrirNoWindows?.(video.caminho);
      showToast(`Abrindo "${video.nome}" no Windows...`);
    });

    // Ação: Revelar na Pasta
    const btnFolder = card.querySelector(".btn-show-folder");
    btnFolder?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.revelarNoExplorer?.(video.caminho);
      showToast("Localizando arquivo no Explorador...");
    });

    grid.appendChild(card);
  });
}

/**
 * Renderiza estado quando nenhuma pasta foi definida ainda.
 */
function renderizarEstadoSemPasta() {
  const grid = document.getElementById("grid");
  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) resultsCount.textContent = "Nenhuma pasta configurada";
  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📁</div>
      <h3 class="empty-title">Nenhuma pasta selecionada</h3>
      <p class="empty-desc">Para visualizar e reproduzir sua coleção de vídeos, clique no botão abaixo e aponte para o diretório no seu computador.</p>
      <button class="btn-empty-action" onclick="abrirPopupPasta()">Selecionar Pasta Agora</button>
    </div>
  `;
}

// ============================================================================
// 5. REPRODUTOR DE VÍDEO MODAL INTEGRADO
// ============================================================================

/**
 * Abre o player de vídeo em modal com o arquivo selecionado.
 * @param {object} video
 */
function abrirPlayerModal(video) {
  const modal = document.getElementById("modalPlayer");
  const videoElem = document.getElementById("videoPlayerElement");
  const tituloElem = document.getElementById("playerTituloVideo");
  const metaElem = document.getElementById("playerMetaInfo");

  if (!modal || !videoElem) return;

  state.videoEmReproducao = video;

  // Atualiza título e metadados
  if (tituloElem) tituloElem.textContent = video.nome;
  if (metaElem) {
    const duracao = formatarDuracao(video.duracao);
    const tamanho = formatarTamanho(video.tamanho);
    const resolucao = video.largura && video.altura ? ` • ${video.largura}x${video.altura}` : "";
    metaElem.textContent = `${duracao} • ${tamanho}${resolucao}`;
  }

  // Define fonte do arquivo local
  videoElem.src = `file://${video.caminho}`;
  videoElem.play().catch(err => {
    console.warn("Autoplay bloqueado ou formato não suportado diretamente pelo Chromium:", err);
  });

  modal.hidden = false;
  document.addEventListener("keydown", lidarTeclasPlayer);
}

/**
 * Fecha o player modal e interrompe a reprodução.
 */
function fecharPlayerModal() {
  const modal = document.getElementById("modalPlayer");
  const videoElem = document.getElementById("videoPlayerElement");

  if (videoElem) {
    videoElem.pause();
    videoElem.removeAttribute("src");
    videoElem.load();
  }

  if (modal) modal.hidden = true;
  state.videoEmReproducao = null;
  document.removeEventListener("keydown", lidarTeclasPlayer);
}

/**
 * Trata atalhos de teclado enquanto o player está ativo.
 */
function lidarTeclasPlayer(e) {
  if (e.key === "Escape") {
    fecharPlayerModal();
  } else if (e.key === " " && e.target.tagName !== "INPUT") {
    e.preventDefault();
    const videoElem = document.getElementById("videoPlayerElement");
    if (videoElem) {
      videoElem.paused ? videoElem.play() : videoElem.pause();
    }
  }
}

// ============================================================================
// 6. GERENCIAMENTO DE FAVORITOS E BUSCA
// ============================================================================

/**
 * Alterna estado de favorito de um arquivo de vídeo.
 * @param {string} caminho - Caminho absoluto
 * @param {HTMLElement} btn - Botão de favorito
 */
function alternarFavorito(caminho, btn) {
  if (state.favoritos.has(caminho)) {
    state.favoritos.delete(caminho);
    btn?.classList.remove("active");
    if (btn) {
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      `;
    }
    showToast("Removido dos Favoritos.");
  } else {
    state.favoritos.add(caminho);
    btn?.classList.add("active");
    if (btn) {
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD54A">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      `;
    }
    showToast("Adicionado aos Favoritos!");
  }

  salvarFavoritos();

  // Se estiver na aba de favoritos, re-aplica filtro para remover o card da visão
  if (state.abaAtiva === "favoritos") {
    aplicarFiltrosEOrdenacao();
  }
}

/**
 * Limpa o input de busca e redefine a listagem.
 */
function limparBusca() {
  const input = document.getElementById("inputBusca");
  const btnLimpar = document.getElementById("btnLimparBusca");
  if (input) input.value = "";
  if (btnLimpar) btnLimpar.hidden = true;
  state.termoBusca = "";
  aplicarFiltrosEOrdenacao();
}

/**
 * Alterna entre abas ("todos" e "favoritos").
 * @param {"todos"|"favoritos"} aba
 */
function alternarAba(aba) {
  state.abaAtiva = aba;

  const tabTodos = document.getElementById("tabTodos");
  const tabFav = document.getElementById("tabFavoritos");
  const menuItemAll = document.getElementById("menuItemAll");
  const menuItemFav = document.getElementById("menuItemFav");

  if (aba === "todos") {
    tabTodos?.classList.add("active");
    tabFav?.classList.remove("active");
    menuItemAll?.classList.add("active");
    menuItemFav?.classList.remove("active");
  } else {
    tabFav?.classList.add("active");
    tabTodos?.classList.remove("active");
    menuItemFav?.classList.add("active");
    menuItemAll?.classList.remove("active");
  }

  aplicarFiltrosEOrdenacao();
}

// ============================================================================
// 7. MENU DROPDOWN E POPUP DE PASTA
// ============================================================================

let backdropMenu = null;

function abrirMenu() {
  const dropdown = document.getElementById("menuDropdown");
  const toggleBtn = document.getElementById("menuToggle");
  if (!dropdown) return;

  dropdown.hidden = false;
  toggleBtn?.setAttribute("aria-expanded", "true");

  backdropMenu = document.createElement("div");
  backdropMenu.className = "menu-backdrop";
  document.body.appendChild(backdropMenu);

  backdropMenu.addEventListener("click", fecharMenu);
  document.addEventListener("keydown", lidarEscMenu);
}

function fecharMenu() {
  const dropdown = document.getElementById("menuDropdown");
  const toggleBtn = document.getElementById("menuToggle");
  if (!dropdown) return;

  dropdown.hidden = true;
  toggleBtn?.setAttribute("aria-expanded", "false");

  if (backdropMenu) {
    backdropMenu.removeEventListener("click", fecharMenu);
    backdropMenu.remove();
    backdropMenu = null;
  }
  document.removeEventListener("keydown", lidarEscMenu);
}

function lidarEscMenu(e) {
  if (e.key === "Escape") fecharMenu();
}

function abrirPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = false;
}

function fecharPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = true;
}

// ============================================================================
// 8. INICIALIZAÇÃO DE EVENTOS E CICLO DE VIDA
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Input de Busca com Debounce de 250ms
  const inputBusca = document.getElementById("inputBusca");
  const btnLimparBusca = document.getElementById("btnLimparBusca");
  let timerBusca = null;

  inputBusca?.addEventListener("input", (e) => {
    const valor = e.target.value;
    if (btnLimparBusca) btnLimparBusca.hidden = !valor;

    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
      state.termoBusca = valor;
      aplicarFiltrosEOrdenacao();
    }, 250);
  });

  btnLimparBusca?.addEventListener("click", limparBusca);

  // Abas de Navegação
  document.getElementById("tabTodos")?.addEventListener("click", () => alternarAba("todos"));
  document.getElementById("tabFavoritos")?.addEventListener("click", () => alternarAba("favoritos"));

  // Seletor de Ordenação
  const selectOrdenacao = document.getElementById("selectOrdenacao");
  selectOrdenacao?.addEventListener("change", (e) => {
    state.ordenacaoAtual = e.target.value;
    aplicarFiltrosEOrdenacao();
  });

  // Botões para Trocar Pasta
  const acaoTrocarPasta = async () => {
    fecharMenu();
    fecharPopupPasta();
    const novaPasta = await window.api?.escolherPasta?.();
    if (novaPasta) {
      state.pastaAtual = novaPasta;
      showToast("Pasta selecionada com sucesso!");
      carregarCatalogo();
    }
  };

  document.getElementById("btnTrocarPastaHeader")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("currentPathInfo")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("popupSelecionar")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("popupCancelar")?.addEventListener("click", fecharPopupPasta);

  // Botão do Menu Dropdown
  const menuToggle = document.getElementById("menuToggle");
  menuToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("menuDropdown");
    if (dropdown?.hidden) {
      abrirMenu();
    } else {
      fecharMenu();
    }
  });

  // Itens do Menu Dropdown
  document.getElementById("menuDropdown")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "all") {
      alternarAba("todos");
      fecharMenu();
    } else if (action === "fav") {
      alternarAba("favoritos");
      fecharMenu();
    } else if (action === "trocar-pasta") {
      acaoTrocarPasta();
    } else if (action === "recarregar") {
      fecharMenu();
      carregarCatalogo();
      showToast("Catálogo atualizado!");
    } else if (action === "toggle-recursivo") {
      state.buscaRecursiva = !state.buscaRecursiva;
      const lbl = document.getElementById("lblRecursivo");
      if (lbl) lbl.textContent = state.buscaRecursiva ? "Ativado" : "Desativado";
      showToast(state.buscaRecursiva ? "Subpastas ativadas." : "Subpastas desativadas.");
      carregarCatalogo();
    } else if (action === "sobre") {
      fecharMenu();
      showToast("MediaFinder v2.1 — Organizador de vídeos com licença GNU GPLv3.");
    } else if (action === "dev") {
      fecharMenu();
      window.api?.openExternal?.("https://joadsonrocha.github.io/");
    }
  });

  // Fechar Player Modal
  document.getElementById("btnFecharPlayer")?.addEventListener("click", fecharPlayerModal);
  document.getElementById("modalPlayer")?.addEventListener("click", (e) => {
    if (e.target.id === "modalPlayer") fecharPlayerModal();
  });

  // Ações do Rodapé do Player Modal
  document.getElementById("btnPlayerAbrirWindows")?.addEventListener("click", () => {
    if (state.videoEmReproducao?.caminho) {
      window.api?.abrirNoWindows?.(state.videoEmReproducao.caminho);
      showToast("Abrindo no reprodutor externo...");
    }
  });

  document.getElementById("btnPlayerRevelarExplorer")?.addEventListener("click", () => {
    if (state.videoEmReproducao?.caminho) {
      window.api?.revelarNoExplorer?.(state.videoEmReproducao.caminho);
      showToast("Arquivo revelado na pasta.");
    }
  });

  // Fechar banner de status
  document.getElementById("btnFecharBanner")?.addEventListener("click", () => {
    const banner = document.getElementById("bannerStatus");
    if (banner) banner.hidden = true;
  });

  // Link do Autor no Rodapé
  document.getElementById("linkAutor")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.api?.openExternal?.("https://joadsonrocha.github.io/");
  });

  // Atalhos Globais
  document.addEventListener("keydown", (e) => {
    // Ctrl+F para focar na pesquisa
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      inputBusca?.focus();
      inputBusca?.select();
    }
  });

  // Expõe funções auxiliares para chamadas inline seguras se necessário
  window.alternarAba = alternarAba;
  window.limparBusca = limparBusca;
  window.abrirPopupPasta = abrirPopupPasta;

  // Carrega a coleção automaticamente na inicialização
  carregarCatalogo();
});
