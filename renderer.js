// ============================================================
// ESTADO
// ============================================================
let midias = [];
let todasMidias = [];
let timeoutBusca = null;

const favKey = "mf_favoritos";
let favoritos = new Set(JSON.parse(localStorage.getItem(favKey) || "[]"));

function salvarFavs() {
  localStorage.setItem(favKey, JSON.stringify([...favoritos]));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ============================================================
// PRIMEIRO USO (perguntar pasta apenas 1x)
// ============================================================
const flagPerguntaKey = "mf_ja_perguntou_pasta";

async function garantirPastaEscolhidaNoPrimeiroUso() {
  const pastaAtual = await window.api?.getPastaAtual?.();
  const jaPerguntou = localStorage.getItem(flagPerguntaKey) === "1";

  if (!pastaAtual && !jaPerguntou) {
    abrirPopupPasta();
  }
}

// ============================================================
// POPUP Selecionar Pasta — FUNÇÃO DE INICIALIZAÇÃO
// ============================================================
let popup, btnSel, btnCan;

function initPopup() {
  popup = document.getElementById("popupPasta");
  btnSel = document.getElementById("popupSelecionar");
  btnCan = document.getElementById("popupCancelar");

  // Eventos do popup
  btnSel?.addEventListener("click", async () => {
    localStorage.setItem(flagPerguntaKey, "1");

    const pasta = await window.api?.escolherPasta?.();
    if (!pasta) {
      showToast("Nenhuma pasta selecionada.");
      fecharPopupPasta();
      return;
    }

    showToast("Pasta definida com sucesso!");

    const input = document.getElementById("inputBusca");
    if (input) input.value = "";

    midias = [];
    todasMidias = [];

    const grid = document.getElementById("grid");
    if (grid) {
      grid.innerHTML = `<p class="empty">🔍 Use a barra de pesquisa para encontrar seus vídeos locais.</p>`;
    }

    fecharPopupPasta();
  });

  btnCan?.addEventListener("click", () => {
    localStorage.setItem(flagPerguntaKey, "1");
    fecharPopupPasta();
  });
}

function abrirPopupPasta() {
  if (!popup) return;
  popup.hidden = false;
  popup.classList.add("show");
}

function fecharPopupPasta() {
  if (!popup) return;
  popup.classList.remove("show");
  setTimeout(() => { popup.hidden = true; }, 180);
}

// ============================================================
// BUSCA
// ============================================================
function buscarInstantaneo() {
  clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(buscar, 300);
}

async function buscar() {
  const input = document.getElementById("inputBusca");
  const termo = (input?.value || "").trim();

  const pastaAtual = await window.api?.getPastaAtual?.();
  if (!pastaAtual) {
    showToast("Selecione uma pasta no menu (📁 Selecionar Pasta).");
    return;
  }

  if (termo === "") {
    const grid = document.getElementById("grid");
    if (grid) {
      grid.innerHTML = `<p class="empty">🔍 Use a barra de pesquisa para encontrar seus vídeos locais.</p>`;
    }
    midias = [];
    return;
  }

  midias = await window.api.buscarMidia(termo);
  renderGrid();
}

function formatarDuracao(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  return (h > 0 ? `${h}:` : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// ============================================================
// GRID
// ============================================================
function renderGrid(lista = midias) {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!lista || lista.length === 0) {
    grid.innerHTML = `<p class="empty">Nenhum vídeo encontrado.</p>`;
    return;
  }

  lista.forEach(m => {
    const card = document.createElement("div");
    card.className = "card";

    const isFav = favoritos.has(m.caminho);

    card.innerHTML = `
      <div class="thumb-container">
        <img src="${m.thumbnail}" alt="${m.nome}">
      </div>

      <button class="fav-btn ${isFav ? "fav-active" : ""}" title="${isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}" aria-label="Favoritar">
        ${
          isFav
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD54A">
               <path d="M12 .587l3.668 7.431L24 9.75l-6 5.847L19.335 24
               12 19.897 4.665 24 6 15.597 0 9.75l8.332-1.732z"/>
             </svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffffaa">
               <path d="M12 .587l3.668 7.431L24 9.75l-6 5.847L19.335 24
               12 19.897 4.665 24 6 15.597 0 9.75l8.332-1.732z"/>
             </svg>`
        }
      </button>

      <div class="info">
        <h3>${m.nome}</h3>
        <p>${formatarDuracao(m.duracao)} • ${m.largura}x${m.altura}</p>
        ${typeof m.tamanho === "number" ? `<p>${(m.tamanho/(1024*1024)).toFixed(1)} MB</p>` : ""}
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
      window.api.abrirNoWindows(m.caminho);
    });

    const favBtn = card.querySelector(".fav-btn");
    favBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (favoritos.has(m.caminho)) {
        favoritos.delete(m.caminho);
        favBtn.classList.remove("fav-active");
        favBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffffaa">
            <path d="M12 .587l3.668 7.431L24 9.75l-6 5.847L19.335 24
            12 19.897 4.665 24 6 15.597 0 9.75l8.332-1.732z"/>
          </svg>`;
        showToast("Removido dos Favoritos.");
      } else {
        favoritos.add(m.caminho);
        favBtn.classList.add("fav-active");
        favBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD54A">
            <path d="M12 .587l3.668 7.431L24 9.75l-6 5.847L19.335 24
            12 19.897 4.665 24 6 15.597 0 9.75l8.332-1.732z"/>
          </svg>`;
        showToast("Adicionado aos Favoritos.");
      }
      salvarFavs();
    });

    grid.appendChild(card);
  });
}

// ============================================================
// MENU (dropdown) + AÇÕES
// ============================================================
const dropdown  = document.getElementById("menuDropdown");
const toggleBtn = document.getElementById("menuToggle");
let backdropMenu = null;

function escCloseMenu(e) {
  if (e.key === "Escape") closeMenu();
}

function openMenu() {
  if (!dropdown) return;
  dropdown.hidden = false;

  backdropMenu = document.createElement("div");
  backdropMenu.className = "menu-backdrop";
  document.body.appendChild(backdropMenu);
  backdropMenu.addEventListener("click", closeMenu);
  document.addEventListener("keydown", escCloseMenu);
}

function closeMenu() {
  if (!dropdown) return;
  dropdown.hidden = true;
  if (backdropMenu) {
    backdropMenu.removeEventListener("click", closeMenu);
    backdropMenu.remove();
    backdropMenu = null;
  }
  document.removeEventListener("keydown", escCloseMenu);
}

toggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown?.hidden ? openMenu() : closeMenu();
});

dropdown?.addEventListener("click", (e) => e.stopPropagation());

dropdown?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "all") {
    const pastaAtual = await window.api?.getPastaAtual?.();
    if (!pastaAtual) {
      showToast("Selecione uma pasta no menu (📁 Selecionar Pasta).");
      closeMenu();
      return;
    }
    todasMidias = await window.api.buscarMidia("");
    midias = todasMidias;
    renderGrid();
    closeMenu();
    return;
  }

  if (action === "fav") {
    const pastaAtual = await window.api?.getPastaAtual?.();
    if (!pastaAtual) {
      showToast("Selecione uma pasta no menu (📁 Selecionar Pasta).");
      closeMenu();
      return;
    }
    if (todasMidias.length === 0) {
      todasMidias = await window.api.buscarMidia("");
    }
    const listaFav = todasMidias.filter(v => favoritos.has(v.caminho));
    renderGrid(listaFav);
    closeMenu();
    return;
  }

  if (action === "trocar-pasta") {
    abrirPopupPasta();
    closeMenu();
    return;
  }

  if (action === "sobre") {
    showToast("MediaFinder — Organize seus vídeos locais com capas automáticas.");
    closeMenu();
    return;
  }

  if (action === "dev") {
    window.api.openExternal("https://joadsonrocha.github.io/");
    closeMenu();
    return;
  }
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
(function init() {
  const grid = document.getElementById("grid");
  if (grid) {
    grid.innerHTML = `<p class="empty">🔍 Use a barra de pesquisa para encontrar seus vídeos locais.</p>`;
  }

  // ✅ Inicializa o popup (garante que os elementos existam)
  initPopup();

  // ✅ Pergunta pasta na primeira execução
  garantirPastaEscolhidaNoPrimeiroUso();

  // expõe funções usadas inline no HTML
  window.buscar = buscar;
  window.buscarInstantaneo = buscarInstantaneo;
})();