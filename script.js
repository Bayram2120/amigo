// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('amigoopt_cart')) || [];
let currentPage = 'shop';
let currentCategory = 'all';
let currentProduct = null;
let selectedRange = null;
let selectedVariant = null;

// Загрузка данных
async function loadData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        products = data.products;
        categories = data.categories;
        window.shopData = data;
        render();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
    }
}

// Сохранение корзины
function saveCart() {
    localStorage.setItem('amigoopt_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// Добавление в корзину
function addToCart(product, range, variant, price) {
    const existing = cart.find(item => 
        item.id === product.id && 
        item.selectedRange === range && 
        item.selectedVariant === variant
    );
    
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: price,
            selectedRange: range,
            selectedVariant: variant,
            quantity: 1
        });
    }
    saveCart();
    alert('✅ Товар добавлен в корзину');
    closeModal();
}

// Отправка заказа в Telegram
async function sendOrderToTelegram(orderText) {
    const data = window.shopData;
    if (!data || !data.botToken || !data.managerTgId) {
        console.error('Не настроен бот');
        return;
    }
    
    const url = `https://api.telegram.org/bot${data.botToken}/sendMessage`;
    const payload = {
        chat_id: data.managerTgId,
        text: orderText,
        parse_mode: 'HTML'
    };
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Ошибка отправки:', error);
    }
}

// Оформление заказа
function checkout() {
    if (cart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    let orderDetails = '🛍️ <b>НОВЫЙ ЗАКАЗ</b>\n\n';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        orderDetails += `📦 ${item.name}\n`;
        orderDetails += `   💰 ${item.price}₽ × ${item.quantity} = ${itemTotal}₽\n`;
        if (item.selectedRange) orderDetails += `   📊 Сумма: ${item.selectedRange}\n`;
        if (item.selectedVariant) orderDetails += `   🎨 ${item.selectedVariant}\n`;
        orderDetails += `\n`;
    });
    
    orderDetails += `━━━━━━━━━━━━━━━━\n`;
    orderDetails += `<b>ИТОГО: ${total}₽</b>\n`;
    orderDetails += `━━━━━━━━━━━━━━━━\n`;
    
    sendOrderToTelegram(orderDetails);
    
    alert('✅ Ваш заказ оформлен! Менеджер свяжется с вами.');
    cart = [];
    saveCart();
    renderCartPage();
}

// Открыть модальное окно товара
function openProductModal(product) {
    currentProduct = product;
    selectedRange = null;
    selectedVariant = null;
    
    const ranges = Object.keys(product.priceRanges);
    const rangeMap = {
        '3000-10000': '3 000 - 10 000 ₽',
        '30000-100000': '30 000 - 100 000 ₽',
        '100000-999999': '100 000+ ₽'
    };
    
    let html = `
        <div class="modal" id="productModal" style="display:flex">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${product.name}</h3>
                    <button class="close-modal" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <img src="${product.photo}" style="width:100%; border-radius:12px; margin-bottom:15px">
                    <p>${product.description}</p>
                    <h4>Выберите сумму заказа:</h4>
                    <div class="range-options">
    `;
    
    ranges.forEach(range => {
        const price = product.priceRanges[range];
        const rangeText = rangeMap[range] || range;
        html += `<button class="range-btn" data-range="${range}" data-price="${price}" onclick="selectRange('${range}', ${price})">${rangeText} — ${price}₽/шт</button>`;
    });
    
    html += `</div>`;
    
    if (product.flavors && product.flavors.length > 0) {
        html += `<h4>Выберите вкус:</h4><div class="variants-grid" id="variantsGrid">`;
        product.flavors.forEach(flavor => {
            html += `<button class="variant-option" data-variant="${flavor}" onclick="selectVariant('${flavor}')">${flavor}</button>`;
        });
        html += `</div>`;
    }
    
    if (product.colors && product.colors.length > 0) {
        html += `<h4>Выберите цвет:</h4><div class="variants-grid" id="variantsGrid">`;
        product.colors.forEach(color => {
            html += `<button class="variant-option" data-variant="${color}" onclick="selectVariant('${color}')">${color}</button>`;
        });
        html += `</div>`;
    }
    
    if (product.resistances && product.resistances.length > 0) {
        html += `<h4>Выберите сопротивление:</h4><div class="variants-grid" id="variantsGrid">`;
        product.resistances.forEach(res => {
            html += `<button class="variant-option" data-variant="${res}" onclick="selectVariant('${res}')">${res}</button>`;
        });
        html += `</div>`;
    }
    
    html += `<button class="add-to-cart-btn" onclick="addCurrentToCart()">🛒 Добавить в корзину</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

function selectRange(range, price) {
    selectedRange = range;
    selectedPrice = price;
    document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
}

function selectVariant(variant) {
    selectedVariant = variant;
    document.querySelectorAll('.variant-option').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
}

function addCurrentToCart() {
    if (!selectedRange) {
        alert('Выберите сумму заказа');
        return;
    }
    
    if ((currentProduct.flavors || currentProduct.colors || currentProduct.resistances) && !selectedVariant) {
        alert('Выберите вариант');
        return;
    }
    
    addToCart(currentProduct, selectedRange, selectedVariant, selectedPrice);
}

function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.remove();
}

// Рендер магазина
function renderShopPage() {
    let filtered = currentCategory === 'all' ? products : products.filter(p => p.category === currentCategory);
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm));
    }
    
    const popular = filtered.filter(p => p.popular);
    const other = filtered.filter(p => !p.popular);
    
    let html = `
        <div class="categories-grid">
            <div class="category-chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Все</div>
    `;
    
    categories.forEach(cat => {
        html += `<div class="category-chip ${currentCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</div>`;
    });
    
    html += `</div>`;
    
    if (popular.length > 0) {
        html += `<h2 class="section-title">⭐ Популярное</h2><div class="products-grid">`;
        popular.forEach(p => html += renderProductCard(p));
        html += `</div>`;
    }
    
    if (other.length > 0) {
        html += `<h2 class="section-title">📦 Все товары</h2><div class="products-grid">`;
        other.forEach(p => html += renderProductCard(p));
        html += `</div>`;
    }
    
    document.getElementById('mainContent').innerHTML = html;
    
    document.querySelectorAll('.category-chip').forEach(el => {
        el.addEventListener('click', () => {
            currentCategory = el.dataset.cat;
            renderShopPage();
        });
    });
}

function renderProductCard(product) {
    const price = product.sale ? product.salePrice : Object.values(product.priceRanges)[0];
    return `
        <div class="product-card" onclick="openProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
            <img src="${product.photo}" class="product-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${price}₽</div>
                ${product.sale ? '<span class="sale-badge">🔥 SALE</span>' : ''}
                <button class="open-btn">Открыть</button>
            </div>
        </div>
    `;
}

// Рендер акций
function renderSalesPage() {
    const saleProducts = products.filter(p => p.sale === true);
    let html = `<h2 class="section-title">🔥 Акции</h2><div class="products-grid">`;
    saleProducts.forEach(p => html += renderProductCard(p));
    html += `</div>`;
    document.getElementById('mainContent').innerHTML = html;
}

// Рендер корзины
function renderCartPage() {
    if (cart.length === 0) {
        document.getElementById('mainContent').innerHTML = `<div style="text-align:center; padding:50px">🛒 Корзина пуста</div>`;
        return;
    }
    
    let html = `<h2 class="section-title">🛒 Корзина</h2>`;
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${item.price}₽ × ${item.quantity} = ${itemTotal}₽</div>
                    ${item.selectedRange ? `<small>Сумма: ${item.selectedRange}</small><br>` : ''}
                    ${item.selectedVariant ? `<small>${item.selectedVariant}</small>` : ''}
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">+</button>
                    <button class="remove-item" onclick="removeCartItem(${index})">🗑️</button>
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="cart-total">
            <h3>Итого: ${total}₽</h3>
            <button class="checkout-btn" onclick="checkout()">✅ Оформить заказ</button>
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
}

function updateQuantity(index, delta) {
    const newQty = cart[index].quantity + delta;
    if (newQty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].quantity = newQty;
    }
    saveCart();
    renderCartPage();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveCart();
    renderCartPage();
}

// Рендер контактов
function renderContactsPage() {
    const data = window.shopData;
    const html = `
        <div class="contacts-page">
            <h2 class="section-title">📞 Контакты</h2>
            <div class="contact-phone">${data?.contactPhone || '+7 (999) 123-45-67'}</div>
            <p>Свяжитесь с нами любым удобным способом</p>
            <p style="margin-top:20px; color:#888">Работаем ежедневно 10:00-21:00</p>
        </div>
    `;
    document.getElementById('mainContent').innerHTML = html;
}

// Поиск
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentPage === 'shop') renderShopPage();
        });
    }
}

// Навигация
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            currentPage = page;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            switch(page) {
                case 'shop': renderShopPage(); break;
                case 'sales': renderSalesPage(); break;
                case 'cart': renderCartPage(); break;
                case 'contacts': renderContactsPage(); break;
            }
        });
    });
}

// Главный рендер
function render() {
    renderShopPage();
    setupSearch();
    setupNavigation();
    updateCartBadge();
}

// Запуск
loadData();