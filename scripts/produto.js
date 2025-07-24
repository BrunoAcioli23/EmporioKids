import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { app } from './firebase-config.js'; // Importando app de um arquivo centralizado

const db = getFirestore(app);

// Objeto para manter o estado dos filtros
const filtrosAtivos = {
    busca: '',
    category: [],
    gender: [],
    sizes: [],
    color: []
};

let todosOsProdutos = [];

// Função para renderizar os produtos na tela
function renderizarProdutos() {
    let produtosFiltrados = [...todosOsProdutos];

    // 1. Filtro de busca por nome
    if (filtrosAtivos.busca) {
        produtosFiltrados = produtosFiltrados.filter(p =>
            p.name.toLowerCase().includes(filtrosAtivos.busca)
        );
    }

    // 2. Filtro por categoria
    if (filtrosAtivos.category.length > 0) {
        produtosFiltrados = produtosFiltrados.filter(p =>
            filtrosAtivos.category.includes(p.category)
        );
    }

    // 3. Filtro por gênero
    if (filtrosAtivos.gender.length > 0) {
        produtosFiltrados = produtosFiltrados.filter(p =>
            filtrosAtivos.gender.includes(p.gender)
        );
    }
    
    // 4. Filtro por cor
    if (filtrosAtivos.color.length > 0) {
        produtosFiltrados = produtosFiltrados.filter(p =>
             filtrosAtivos.color.includes(p.color?.toLowerCase())
        );
    }

    // 5. Filtro por tamanho (verifica se o tamanho existe no objeto 'sizes' do produto)
    if (filtrosAtivos.sizes.length > 0) {
        produtosFiltrados = produtosFiltrados.filter(p =>
            p.sizes && filtrosAtivos.sizes.some(tamanho => p.sizes[tamanho] > 0)
        );
    }

    // Usa a função global do script.js para renderizar o grid
    // Isso garante que os botões de comprar/favoritar funcionem
    window.renderGrid("produtos-grid", produtosFiltrados);
}

// Preenche as opções de filtro de cor dinamicamente
function preencherFiltroCores() {
    const container = document.getElementById('filtro-cor-container');
    if (!container) return;
    
    // Extrai todas as cores únicas dos produtos, ignorando valores vazios
    const cores = [...new Set(todosOsProdutos.map(p => p.color?.toLowerCase()).filter(Boolean))];

    container.innerHTML = '';
    cores.forEach(cor => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="filtro-checkbox" data-filtro="color" value="${cor}"> ${cor.charAt(0).toUpperCase() + cor.slice(1)}`;
        container.appendChild(label);
    });

    // Adiciona os event listeners novamente após criar os checkboxes
    adicionarEventListenersFiltros();
}

// Adiciona os listeners para todos os checkboxes de filtro
function adicionarEventListenersFiltros() {
    document.querySelectorAll('.filtro-checkbox').forEach(input => {
        // Remove listener antigo para evitar duplicação
        input.removeEventListener('change', handleFiltroChange);
        // Adiciona o novo listener
        input.addEventListener('change', handleFiltroChange);
    });
}

// Manipulador de evento para quando um filtro é alterado
function handleFiltroChange(event) {
    const filtro = event.target.dataset.filtro; // ex: "category"
    const valor = event.target.value; // ex: "camiseta"

    // Limpa e recria o array de filtros ativos para o tipo específico
    filtrosAtivos[filtro] = Array.from(
        document.querySelectorAll(`.filtro-checkbox[data-filtro="${filtro}"]:checked`)
    ).map(input => input.value);

    renderizarProdutos();
}


// Função principal que inicializa a página
async function initPaginaProdutos() {
    try {
        const snapshot = await getDocs(collection(db, "products"));
        todosOsProdutos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Pega parâmetros da URL para pré-selecionar filtros
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => {
            if (filtrosAtivos.hasOwnProperty(key)) {
                filtrosAtivos[key] = value.split(','); // Permite múltiplos valores, ex: ?category=camiseta,calca
                
                // Marca os checkboxes correspondentes
                filtrosAtivos[key].forEach(val => {
                    const checkbox = document.querySelector(`.filtro-checkbox[data-filtro="${key}"][value="${val}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        });
        
        // Pega o termo de busca da URL
        const buscaURL = params.get("busca");
        if (buscaURL) {
            filtrosAtivos.busca = decodeURIComponent(buscaURL).toLowerCase();
            document.getElementById('search-input-header').value = decodeURIComponent(buscaURL);
        }

        // Preenche o filtro de cores e adiciona listeners
        preencherFiltroCores();
        
        // Renderiza os produtos com os filtros da URL (se houver)
        renderizarProdutos();

        // Adiciona listener para a barra de busca principal
        const searchInputHeader = document.getElementById('search-input-header');
        searchInputHeader.addEventListener('input', (e) => {
            filtrosAtivos.busca = e.target.value.toLowerCase();
            renderizarProdutos();
        });

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById("produtos-grid").innerHTML = "<p>Erro ao carregar produtos. Tente novamente mais tarde.</p>";
    }
}

// Espera o DOM carregar para iniciar
document.addEventListener('DOMContentLoaded', initPaginaProdutos);
