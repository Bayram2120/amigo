// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
let products = [];
let categories = [];
let shopConfig = {};
let cart = [];
let currentPage = 'shop';
let currentCategory = 'all';

// Переменные для модального окна
let currentProduct = null;
let selectedRange = null;
let selectedPrice = null;
let selectedVariant = null;

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadData() {
    try {
        const response = await fetch('./data.json');
        const data = await response.json();
        
        products = data.products;
        categories = data.categories;
        shopConfig = {
            shopName: data.shopName,
            contactPhone: data.contactPhone,
            managerTgId: data.managerTgId,
            botToken: data.botToken
        };
        
        // Загружаем корзину
        const savedCart = localStorage.getItem('amigoopt_cart');
        if (savedCart) cart = JSON.parse(savedCart);
        
        // Инициализация Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.expand();
        }
        
        // Запускаем приложение
        initApp();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center;padding:50px;color:red;">Ошибка загрузки данных. Проверьте файл data.json</div>';
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
function initApp() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentPage === 'shop') renderShopPage();
        });
    }
    
    // Стартовая страница
    switchPage('shop');
    updateCartBadge();
}

// ============ НАВИГАЦИЯ ============
function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    if (page === 'shop') renderShopPage();
    else if (page === 'sales') renderSalesPage();
    else if (page === 'cart') renderCartPage();
    else if (page === 'contacts') renderContactsPage();
    
    updateCartBadge();
}

// ============ КОРЗИНА ============
function saveCart() {
    localStorage.setItem('amigoopt_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
}

function getProductPrice(product, rangeKey) {
    if (product.sale && product.salePrice) return product.salePrice;
    return product.priceRanges[rangeKey] || Object.values(product.priceRanges)[0];
}

function getVariantType(product) {
    if (product.flavors && product.flavors.length) return { type: 'flavors', label: 'Выберите вкус', items: product.flavors };
    if (product.colors && product.colors.length) return { type: 'colors', label: 'Выберите цвет', items: product.colors };
    if (product.resistances && product.resistances.length) return { type: 'resistances', label: 'Выберите сопротивление', items: product.resistances };
    return null;
}

// ============ ОТПРАВКА В TELEGRAM ============
async function sendOrderToTelegram(orderText) {
    if (!shopConfig.botToken || shopConfig.botToken === "8629659554:AAH8jhO69OYbr0tnSQXuHKMdA3p3To7Ws7Q") {
        console.log('Демо-режим: заказ не отправлен (настройте бота в data.json)');
        return;
    }
    try {
        await fetch(`https://api.telegram.org/bot${shopConfig.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: shopConfig.managerTgId, 
                text: orderText, 
                parse_mode: 'HTML' 
            })
        });
    } catch(e) { console.error(e); }
}

function checkout() {
    if (cart.length === 0) { 
        alert('Корзина пуста'); 
        return; 
    }
    
    let order = '🛍️ <b>НОВЫЙ ЗАКАЗ</b>\n\n';
    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        order += `📦 ${item.name}\n   💰 ${item.price}₽ × ${item.quantity} = ${itemTotal}₽\n`;
        if (item.selectedRange) order += `   📊 ${item.selectedRange}\n`;
        if (item.selectedVariant) order += `   🎨 ${item.selectedVariant}\n`;
        order += `\n`;
    });
    order += `━━━━━━━━━━━━━━━━\n<b>ИТОГО: ${total}₽</b>`;
    
    sendOrderToTelegram(order);
    alert('✅ Заказ оформлен! Менеджер свяжется с вами.');
    cart = [];
    saveCart();
    if (currentPage === 'cart') renderCartPage();
    updateCartBadge();
}

// ============ МОДАЛЬНОЕ ОКНО (ПОСЛЕДОВАТЕЛЬНЫЙ ВЫБОР) ============
function openProductModal(product) {
    currentProduct = product;
    selectedRange = null;
    selectedPrice = null;
    selectedVariant = null;
    
    const variantInfo = getVariantType(product);
    const rangeMap = { 
        '3000-10000': '3 000 - 10 000 ₽', 
        '30000-100000': '30 000 - 100 000 ₽', 
        '100000-999999': '100 000+ ₽' 
    };
    
    let rangesHtml = '<div class="range-options">';
    for (const [range, price] of Object.entries(product.priceRanges)) {
        rangesHtml += `<button class="range-btn" data-range="${range}" data-price="${price}">${rangeMap[range] || range} — ${price}₽/шт</button>`;
    }
    rangesHtml += '</div>';
    
    let variantsHtml = '';
    if (variantInfo) {
        variantsHtml = `<div id="step2Container" style="display:none;">
            <div class="step-title"><span class="step-number">2</span> ${variantInfo.label}</div>
            <div class="variants-grid" id="variantsGrid">
                ${variantInfo.items.map(v => `<button class="variant-option" data-variant="${v}">${v}</button>`).join('')}
            </div>
        </div>`;
    }
    
    const modal = document.getElementById('modalOverlay');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${product.name}</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <img src="${product.photo}" class="modal-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
                <p style="color:#666; margin-bottom:10px;">${product.description}</p>
                <div id="step1Container">
                    <div class="step-title"><span class="step-number">1</span> Выберите сумму заказа</div>
                    ${rangesHtml}
                </div>
                ${variantsHtml}
                <button class="add-to-cart-btn disabled" id="addToCartBtn">⬅️ Сначала выберите сумму</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
    
    // Шаг 1: выбор суммы
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedRange = btn.dataset.range;
            selectedPrice = parseInt(btn.dataset.price);
            
            const variantInfo2 = getVariantType(product);
            if (variantInfo2) {
                // Переход к шагу 2
                document.getElementById('step1Container').style.opacity = '0.5';
                const step2Container = document.getElementById('step2Container');
                if (step2Container) step2Container.style.display = 'block';
                step2Container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('addToCartBtn').textContent = '⬅️ Выберите вариант';
                document.getElementById('addToCartBtn').classList.add('disabled');
            } else {
                // Нет вариантов - сразу можно добавлять
                document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                document.getElementById('addToCartBtn').classList.remove('disabled');
            }
        });
    });
    
    // Шаг 2: выбор варианта
    if (variantInfo) {
        setTimeout(() => {
            document.querySelectorAll('.variant-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.variant-option').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedVariant = btn.dataset.variant;
                    document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                    document.getElementById('addToCartBtn').classList.remove('disabled');
                });
            });
        }, 50);
    }
    
    const addBtn = document.getElementById('addToCartBtn');
    addBtn.onclick = () => {
        if (!selectedRange) { 
            alert('Сначала выберите сумму заказа'); 
            return; 
        }
        const variantInfo3 = getVariantType(product);
        if (variantInfo3 && !selectedVariant) { 
            alert('Выберите вариант'); 
            return; 
        }
        
        cart.push({
            id: product.id,
            name: product.name,
            price: selectedPrice,
            selectedRange: selectedRange,
            selectedVariant: selectedVariant || null,
            quantity: 1
        });
        saveCart();
        closeModal();
        alert('✅ Товар добавлен в корзину');
        if (currentPage === 'cart') renderCartPage();
        updateCartBadge();
    };
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('modalOverlay').innerHTML = '';
}

// ============ РЕНДЕР СТРАНИЦ ============
function renderProductCard(product) {
    const displayPrice = product.sale ? product.salePrice : Object.values(product.priceRanges)[0];
    // Экранируем product для передачи в onclick
    const productJson = JSON.stringify(product).replace(/'/g, "&#39;");
    return `
        <div class="product-card" onclick='openProductModal(${productJson})'>
            <img src="${product.photo}" class="product-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
            <div class="product-info">
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price">${displayPrice}₽</div>
                ${product.sale ? '<span class="sale-badge">🔥 SALE</span>' : ''}
                <button class="open-btn">Открыть</button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderShopPage() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    let filtered = currentCategory === 'all' ? products : products.filter(p => p.category === currentCategory);
    if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm));
    
    const popular = filtered.filter(p => p.popular);
    const other = filtered.filter(p => !p.popular);
    
    let html = `<div class="categories-grid"><div class="category-chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Все</div>`;
    categories.forEach(cat => { 
        html += `<div class="category-chip ${currentCategory === cat ? 'active' : ''}" data-cat="${cat}">${escapeHtml(cat)}</div>`; 
    });
    html += `</div>`;
    
    if (popular.length) html += `<h2 class="section-title">⭐ Популярное</h2><div class="products-grid">${popular.map(p => renderProductCard(p)).join('')}</div>`;
    if (other.length) html += `<h2 class="section-title">📦 Все товары</h2><div class="products-grid">${other.map(p => renderProductCard(p)).join('')}</div>`;
    if (!filtered.length) html = `<div style="text-align:center;padding:50px">🔍 Ничего не найдено</div>`;
    
    document.getElementById('mainContent').innerHTML = html;
    
    document.querySelectorAll('.category-chip').forEach(el => {
        el.addEventListener('click', () => { 
            currentCategory = el.dataset.cat; 
            renderShopPage(); 
        });
    });
}

function renderSalesPage() {
    const saleProducts = products.filter(p => p.sale === true);
    let html = `<h2 class="section-title">🔥 Акции</h2><div class="products-grid">${saleProducts.length ? saleProducts.map(p => renderProductCard(p)).join('') : '<div style="text-align:center;padding:50px">Нет товаров по акции</div>'}</div>`;
    document.getElementById('mainContent').innerHTML = html;
}

function renderCartPage() {
    if (!cart.length) { 
        document.getElementById('mainContent').innerHTML = '<div class="empty-cart">🛒 Корзина пуста</div>'; 
        return; 
    }
    
    let html = `<h2 class="section-title">🛒 Корзина</h2><div class="cart-items-list">`;
    let total = 0;
    cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${item.price}₽ × ${item.quantity} = ${itemTotal}₽</div>
                    <div class="cart-item-details">${item.selectedRange ? `Сумма: ${item.selectedRange}` : ''}${item.selectedVariant ? ` | ${escapeHtml(item.selectedVariant)}` : ''}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" data-idx="${idx}" data-delta="-1">−</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" data-idx="${idx}" data-delta="1">+</button>
                    <button class="remove-item" data-idx="${idx}">🗑️</button>
                </div>
            </div>
        `;
    });
    html += `</div><div class="cart-total"><h3>Итого: ${total}₽</h3><button class="checkout-btn" id="checkoutBtn">✅ Оформить заказ</button></div>`;
   