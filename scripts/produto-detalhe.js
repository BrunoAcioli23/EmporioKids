import { app } from './firebase-config.js';
import { getFirestore, doc, getDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const db = getFirestore(app);
let currentProduct = null;
let selectedSize = null;

/**
 * Renderiza as opções de tamanho baseadas no produto carregado.
 * @param {object} product - O objeto do produto.
 */
function renderSizeSelector(product) {
    const container = document.getElementById('size-options-container');
    if (!container || !product.sizes) {
        container.innerHTML = "<p>Tamanhos indisponíveis.</p>";
        return;
    }

    container.innerHTML = '';
    const sortedSizes = Object.keys(product.sizes).sort((a, b) => {
        const order = ['PP', 'P', 'M', 'G', 'GG', 'U'];
        return order.indexOf(a) - order.indexOf(b);
    });

    sortedSizes.forEach(size => {
        const hasStock = product.sizes[size] > 0;
        const button = document.createElement('button');
        button.className = 'size-btn';
        button.textContent = size;
        button.dataset.size = size;
        button.disabled = !hasStock; // Desabilita o botão se não houver estoque

        button.addEventListener('click', () => {
            // Remove a classe 'selected' de todos os botões
            document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));
            // Adiciona a classe 'selected' ao botão clicado
            button.classList.add('selected');
            selectedSize = size;
            // Esconde a mensagem de erro ao selecionar um tamanho
            document.getElementById('size-error').classList.add('hidden');
        });

        container.appendChild(button);
    });
}

/**
 * Renderiza a descrição do produto com detalhes de roupa.
 * @param {object} product - O objeto do produto.
 */
function renderDescription(product) {
    const container = document.getElementById('product-description');
    
    const generalDescription = product.description || `Uma peça essencial para o guarda-roupa dos pequenos, combinando conforto e estilo para todas as aventuras.`;

    let detailsHTML = '<ul>';
    if (product.fabric) detailsHTML += `<li><strong>Tecido:</strong> ${product.fabric}</li>`;
    if (product.composition) detailsHTML += `<li><strong>Composição:</strong> ${product.composition}</li>`;
    if (product.care) detailsHTML += `<li><strong>Cuidados:</strong> ${product.care}</li>`;
    detailsHTML += '</ul>';

    const extraInfo = `<p class="extra-info">As cores podem variar ligeiramente devido à iluminação da foto e à tela do dispositivo.</p>`;
    
    container.innerHTML = `
        <div class="general-text"><p>${generalDescription}</p></div>
        <div class="technical-details">${detailsHTML}</div>
        ${extraInfo}
    `;
}

/**
 * Carrega produtos relacionados com base na categoria do produto atual.
 * @param {object} product - O produto principal.
 */
async function loadRelatedProducts(product) {
    // ... (A função de carregar produtos relacionados pode ser mantida como está)
}

/**
 * Carrega os detalhes do produto com base no ID da URL e preenche a página.
 */
async function loadProductDetails() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        document.getElementById('product-detail-content').innerHTML = "<h1>Produto não encontrado.</h1>";
        return;
    }

    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        currentProduct = { id: docSnap.id, ...docSnap.data() };
        
        document.title = currentProduct.name;
        document.getElementById('main-product-image').src = currentProduct.image;
        document.getElementById('main-product-image').alt = currentProduct.name;
        document.getElementById('breadcrumbs').textContent = `Início / ${currentProduct.category} / ${currentProduct.name}`;
        document.getElementById('product-name').textContent = currentProduct.name;
        document.getElementById('product-price').textContent = `R$ ${currentProduct.price.toFixed(2).replace('.', ',')}`;
        
        // Renderiza as novas seções
        renderSizeSelector(currentProduct);
        renderDescription(currentProduct);
        
        const addToCartBtn = document.getElementById('add-to-cart-detail-btn');
        if (window.addToCart) {
            addToCartBtn.addEventListener('click', () => {
                if (!selectedSize) {
                    document.getElementById('size-error').classList.remove('hidden');
                    return;
                }
                const productToAdd = { ...currentProduct, size: selectedSize, id: `${currentProduct.id}_${selectedSize}` };
                window.addToCart(productToAdd);
            });
        }
        
        // ... (resto da função, como o botão de favoritos e loadRelatedProducts)

    } else {
        document.getElementById('product-detail-content').innerHTML = "<h1>Produto não encontrado ou indisponível.</h1>";
    }
}

document.addEventListener('DOMContentLoaded', loadProductDetails);