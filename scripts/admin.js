import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, serverTimestamp, orderBy, query as firestoreQuery, where, writeBatch } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyByAi0e0M0lbLiIq1h1wdrRS_E2azAKiCQ",
  authDomain: "emporiokids-bcb70.firebaseapp.com",
  projectId: "emporiokids-bcb70",
  storageBucket: "emporiokids-bcb70.firebasestorage.app",
  messagingSenderId: "782267880563",
  appId: "1:782267880563:web:38490d1c58c293dde20606",
  measurementId: "G-DVN6TTMN2X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- VARIÁVEIS GLOBAIS ---
let editingProductId = null;
let salesChartInstance = null;
let categoryChartInstance = null;

// --- ELEMENTOS DO DOM ---
const loginSection = document.getElementById('login-section');
const adminTabs = document.getElementById('admin-tabs');
const productForm = document.getElementById('product-form');
const logoutBtn = document.getElementById('logout-btn');
const productsTableBody = document.getElementById('products-table-body');
const ordersTableBody = document.getElementById('orders-table-body');
const messageArea = document.getElementById('message-area');
const sizeOptionsContainer = document.getElementById("size-options");
const sizeQuantitiesContainer = document.getElementById("size-quantities");

// --- FUNÇÕES ---

function showMessage(msg, type) {
    if (!messageArea) return;
    messageArea.textContent = msg;
    messageArea.className = `message ${type}`;
    messageArea.classList.remove('hidden');
    setTimeout(() => messageArea.classList.add('hidden'), 4000);
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.add('hidden');
    });
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.remove('hidden');
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

function calculateTotalStock(sizes) {
    if (!sizes || typeof sizes !== 'object') return 0;
    return Object.values(sizes).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
}

async function loadDashboard() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const totalStock = products.map(p => ({...p, stock: calculateTotalStock(p.sizes) }));

        document.getElementById("total-products").textContent = totalStock.length;
        document.getElementById("total-outofstock").textContent = totalStock.filter(p => p.stock === 0).length;
        
        const totalStockValue = totalStock.reduce((sum, p) => sum + (p.stock * (p.cost || 0)), 0);
        document.getElementById("total-stock-value").textContent = `R$ ${totalStockValue.toFixed(2).replace('.', ',')}`;
        
        const totalPotentialSales = totalStock.reduce((sum, p) => sum + (p.stock * (p.price || 0)), 0);
        document.getElementById("total-stock-sales").textContent = `R$ ${totalPotentialSales.toFixed(2).replace('.', ',')}`;
        
        const totalPotentialProfit = totalPotentialSales - totalStockValue;
        document.getElementById("total-stock-profit").textContent = `R$ ${totalPotentialProfit.toFixed(2).replace('.', ',')}`;

        const ordersQuery = firestoreQuery(collection(db, "orders"), where("status", "==", "finalizado"));
        const ordersSnapshot = await getDocs(ordersQuery);
        const finalizedOrders = ordersSnapshot.docs.map(doc => doc.data());

        const totalSoldValue = finalizedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        document.getElementById("total-sold-value").textContent = `R$ ${totalSoldValue.toFixed(2).replace('.', ',')}`;

        const salesByDate = finalizedOrders.reduce((acc, order) => {
            if (order.createdAt?.toDate) {
                const date = order.createdAt.toDate().toLocaleDateString('pt-BR');
                acc[date] = (acc[date] || 0) + order.total;
            }
            return acc;
        }, {});
        
        const sortedDates = Object.keys(salesByDate).sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        const salesData = sortedDates.map(date => salesByDate[date]);

        if (salesChartInstance) salesChartInstance.destroy();
        const salesCtx = document.getElementById('sales-chart')?.getContext('2d');
        if (salesCtx) {
            salesChartInstance = new Chart(salesCtx, { type: 'line', data: { labels: sortedDates, datasets: [{ label: 'Vendas Finalizadas (R$)', data: salesData, borderColor: '#28a745', fill: true }] } });
        }

        const salesByCategory = finalizedOrders.reduce((acc, order) => {
            order.items.forEach(item => {
                 // Assumindo que o produto ainda existe para buscar a categoria
                const product = products.find(p => p.id === item.productId);
                if (product && product.category) {
                   acc[product.category] = (acc[product.category] || 0) + item.quantity;
                }
            });
            return acc;
        }, {});

        if (categoryChartInstance) categoryChartInstance.destroy();
        const categoryCtx = document.getElementById('category-chart')?.getContext('2d');
        if (categoryCtx) {
            categoryChartInstance = new Chart(categoryCtx, { type: 'pie', data: { labels: Object.keys(salesByCategory), datasets: [{ data: Object.values(salesByCategory), backgroundColor: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'] }] } });
        }

    } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
        showMessage('Erro ao carregar resumo do painel.', 'error');
    }
}


async function loadProducts() {
    if (!productsTableBody) return;
    productsTableBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const snapshot = await getDocs(collection(db, "products"));
        productsTableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const product = docSnap.data();
            const id = docSnap.id;
            const totalStock = calculateTotalStock(product.sizes);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td>${product.name}</td>
                <td>R$ ${product.price.toFixed(2).replace('.', ',')}</td>
                <td>${totalStock}</td>
                <td>
                    <button class="btn btn-primary edit-btn" data-id="${id}">Editar</button>
                    <button class="btn btn-danger delete-btn" data-id="${id}">Excluir</button>
                </td>
            `;
            productsTableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Erro ao carregar produtos:", err);
        productsTableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar produtos.</td></tr>';
    }
}


// --- LÓGICA DE LOGIN E AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Apenas para simplificação, vamos assumir que qualquer usuário logado é admin.
        // Em um app real, você deve verificar a role do usuário no Firestore.
        loginSection.classList.add('hidden');
        adminTabs.classList.remove('hidden');
        showTab('dashboard');
        loadDashboard();
        loadProducts();
        // loadOrders(); // Descomente se tiver a função implementada
    } else {
        loginSection.classList.remove('hidden');
        adminTabs.classList.add('hidden');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showMessage(`Erro no login: ${error.message}`, 'error');
    }
});

logoutBtn?.addEventListener('click', () => signOut(auth));


// --- LÓGICA DE CADASTRO E EDIÇÃO DE PRODUTO ---
productForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
        const imageFile = document.getElementById('product-image').files[0];
        let imageUrl = document.querySelector('#product-form img')?.src || null; // Manter imagem existente se houver

        if (imageFile) {
            const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(storageRef);
        }

        if (!imageUrl && !editingProductId) {
            throw new Error("A imagem do produto é obrigatória para um novo cadastro.");
        }

        const sizes = {};
        document.querySelectorAll("#size-quantities input[type='number']").forEach(input => {
            const size = input.dataset.size;
            const quantity = parseInt(input.value, 10);
            if (!isNaN(quantity)) {
                sizes[size] = quantity;
            }
        });
        
        if(Object.keys(sizes).length === 0) {
            throw new Error("Você precisa especificar a quantidade para pelo menos um tamanho.");
        }

        const productData = {
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            category: document.getElementById('product-category').value,
            color: document.getElementById('product-color').value,
            cost: parseFloat(document.getElementById('product-cost').value),
            price: parseFloat(document.getElementById('product-price').value),
            oldPrice: parseFloat(document.getElementById('product-old-price').value) || 0,
            sizes: sizes, // Objeto com tamanhos e quantidades
            image: imageUrl,
        };

        if (editingProductId) {
            productData.updatedAt = serverTimestamp();
            const productRef = doc(db, "products", editingProductId);
            await updateDoc(productRef, productData);
            showMessage("Produto atualizado com sucesso!", "success");
        } else {
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, "products"), productData);
            showMessage("Produto cadastrado com sucesso!", "success");
        }

        resetForm();
        loadProducts();
        loadDashboard();
        showTab('products-panel');

    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showMessage(`Erro: ${error.message}`, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Produto';
    }
});

function resetForm() {
    productForm.reset();
    sizeQuantitiesContainer.innerHTML = '';
    editingProductId = null;
    document.getElementById('submit-btn').textContent = 'Salvar Produto';
    document.getElementById('product-image').required = true;
}

// Lógica para criar/remover campos de quantidade de tamanho
sizeOptionsContainer.addEventListener("change", (e) => {
    if (e.target.classList.contains("size-checkbox")) {
        const size = e.target.value;
        const existingInput = sizeQuantitiesContainer.querySelector(`div[data-size-wrapper="${size}"]`);

        if (e.target.checked && !existingInput) {
            const wrapper = document.createElement('div');
            wrapper.dataset.sizeWrapper = size;
            wrapper.className = 'form-group-inline';

            const label = document.createElement('label');
            label.textContent = `Qtd. ${size}:`;
            
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.placeholder = `Qtd. ${size}`;
            input.dataset.size = size;
            input.required = true;
            
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            sizeQuantitiesContainer.appendChild(wrapper);
            
        } else if (!e.target.checked && existingInput) {
            sizeQuantitiesContainer.removeChild(existingInput);
        }
    }
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.tab-btn')) {
        showTab(e.target.dataset.tab);
    }
    if (e.target.matches('.edit-btn')) {
        editProduct(e.target.dataset.id);
    }
    if (e.target.matches('.delete-btn')) {
        deleteProduct(e.target.dataset.id);
    }
});

async function editProduct(productId) {
    resetForm();
    editingProductId = productId;
    try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) {
            throw new Error("Produto não encontrado.");
        }
        const data = productSnap.data();

        // Preenche os campos do formulário
        document.getElementById('product-name').value = data.name || '';
        document.getElementById('product-description').value = data.description || '';
        document.getElementById('product-category').value = data.category || '';
        document.getElementById('product-color').value = data.color || '';
        document.getElementById('product-cost').value = data.cost || 0;
        document.getElementById('product-price').value = data.price || 0;
        document.getElementById('product-old-price').value = data.oldPrice || '';

        // Limpa e recria os campos de tamanho
        sizeQuantitiesContainer.innerHTML = '';
        document.querySelectorAll('.size-checkbox').forEach(cb => cb.checked = false);

        if (data.sizes && typeof data.sizes === 'object') {
            for (const size in data.sizes) {
                const checkbox = document.querySelector(`.size-checkbox[value="${size}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    // Dispara o evento de 'change' para criar o campo de input
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    // Preenche o valor do input criado
                    setTimeout(() => {
                         const input = sizeQuantitiesContainer.querySelector(`input[data-size="${size}"]`);
                         if(input) input.value = data.sizes[size];
                    }, 0);
                }
            }
        }
        
        document.getElementById('submit-btn').textContent = 'Salvar Alterações';
        document.getElementById('product-image').required = false; // Imagem não é obrigatória na edição
        showTab('admin-panel');

    } catch (error) {
        console.error("Erro ao carregar produto para edição:", error);
        showMessage(error.message, 'error');
        resetForm();
    }
}

async function deleteProduct(productId) {
    if (!confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showMessage("Produto excluído com sucesso.", "success");
        loadProducts();
        loadDashboard();
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        showMessage("Erro ao excluir produto.", "error");
    }
}