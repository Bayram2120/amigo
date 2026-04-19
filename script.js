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
let selectedQuantity = 1;

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadData() {
    try {
        console.log('Загрузка data.json...');
        const response = await fetch('./data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Данные загружены');
        
        products = data.products;
        categories = data.categories;
        shopConfig = {
            shopName: data.shopName,
            contactPhone: data.contactPhone,
            managerTgId: data.managerTgId,
            botToken: data.botToken
        };
        
        const savedCart = localStorage.getItem('amigoopt_cart');
        if (savedCart) cart = JSON.parse(savedCart);
        
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.expand();
        }
        
        initApp();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('mainContent').innerHTML = `
            <div style="text-align:center; padding:50px; color:red;">
                ❌ Ошибка загрузки данных<br>
                <small style="color:#888">${error.message}</small><br><br>
                <button onclick="location.reload()" style="padding:10px 20px; background:#1a1a2e; color:white; border:none; border-radius:10px;">↻ Перезагрузить</button>
            </div>
        `;
    }
}

function initApp() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentPage === 'shop') renderShopPage();
        });
    }
    
    switchPage('shop');
    updateCartBadge();
}

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

function getVariantType(product) {
    if (product.flavors && product.flavors.length) return { type: 'flavors', label: 'Выберите вкус', items: product.flavors };
    if (product.colors && product.colors.length) return { type: 'colors', label: 'Выберите цвет', items: product.colors };
    if (product.resistances && product.resistances.length) return { type: 'resistances', label: 'Выберите сопротивление', items: product.resistances };
    return null;
}

async function sendOrderToTelegram(orderText) {
    if (!shopConfig.botToken || shopConfig.botToken === "ВАШ_ТОКЕН_БОТА") {
        console.log('Бот не настроен');
        alert('⚠️ Заказ создан, но бот не настроен. Сообщите менеджеру.');
        return;
    }
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${shopConfig.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: shopConfig.managerTgId, 
                text: orderText, 
                parse_mode: 'HTML' 
            })
        });
        
        const result = await response.json();
        if (result.ok) {
            console.log('Заказ отправлен');
        } else {
            console.error('Ошибка:', result.description);
        }
    } catch(error) {
        console.error('Ошибка:', error);
    }
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

function openProductModal(product) {
    currentProduct = product;
    selectedRange = null;
    selectedPrice = null;
    selectedVariant = null;
    selectedQuantity = 1;
    
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
                <div id="quantityContainer" style="display:none;">
                    <div class="step-title"><span class="step-number">3</span> Выберите количество</div>
                    <div class="quantity-selector">
                        <label>Количество:</label>
                        <div class="quantity-controls">
                            <button class="quantity-btn-modal" id="decreaseQty">−</button>
                            <span class="quantity-value" id="quantityValue">1</span>
                            <button class="quantity-btn-modal" id="increaseQty">+</button>
                        </div>
                    </div>
                </div>
                <button class="add-to-cart-btn disabled" id="addToCartBtn">⬅️ Сначала выберите сумму</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
    
    function resetVariantSelection() {
        selectedVariant = null;
        const variantBtns = document.querySelectorAll('.variant-option');
        variantBtns.forEach(btn => btn.classList.remove('selected'));
        
        const addBtn = document.getElementById('addToCartBtn');
        addBtn.textContent = '⬅️ Сначала выберите сумму';
        addBtn.classList.add('disabled');
        
        const quantityContainer = document.getElementById('quantityContainer');
        if (quantityContainer) quantityContainer.style.display = 'none';
        
        const step2Container = document.getElementById('step2Container');
        if (step2Container && step2Container.style.display === 'block') {
            addBtn.textContent = '⬅️ Выберите вариант';
        }
    }
    
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            const newRange = btn.dataset.range;
            const newPrice = parseInt(btn.dataset.price);
            
            if (selectedRange !== newRange) {
                selectedRange = newRange;
                selectedPrice = newPrice;
                resetVariantSelection();
            } else {
                selectedRange = newRange;
                selectedPrice = newPrice;
            }
            
            const variantInfo2 = getVariantType(product);
            if (variantInfo2) {
                document.getElementById('step1Container').style.opacity = '0.5';
                const step2Container = document.getElementById('step2Container');
                if (step2Container) {
                    step2Container.style.display = 'block';
                    step2Container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                document.getElementById('addToCartBtn').textContent = '⬅️ Выберите вариант';
                document.getElementById('addToCartBtn').classList.add('disabled');
            } else {
                document.getElementById('step1Container').style.opacity = '0.5';
                const quantityContainer = document.getElementById('quantityContainer');
                if (quantityContainer) quantityContainer.style.display = 'block';
                document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                document.getElementById('addToCartBtn').classList.remove('disabled');
                setupQuantityButtons();
            }
        });
    });
    
    if (variantInfo) {
        setTimeout(() => {
            document.querySelectorAll('.variant-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.variant-option').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedVariant = btn.dataset.variant;
                    
                    const quantityContainer = document.getElementById('quantityContainer');
                    if (quantityContainer) quantityContainer.style.display = 'block';
                    
                    document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                    document.getElementById('addToCartBtn').classList.remove('disabled');
                    setupQuantityButtons();
                });
            });
        }, 50);
    }
    
    function setupQuantityButtons() {
        const decreaseBtn = document.getElementById('decreaseQty');
        const increaseBtn = document.getElementById('increaseQty');
        const quantitySpan = document.getElementById('quantityValue');
        
        if (decreaseBtn && increaseBtn && quantitySpan) {
            decreaseBtn.onclick = () => {
                if (selectedQuantity > 1) {
                    selectedQuantity--;
                    quantitySpan.textContent = selectedQuantity;
                }
            };
            increaseBtn.onclick = () => {
                selectedQuantity++;
                quantitySpan.textContent = selectedQuantity;
            };
        }
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
            quantity: selectedQuantity
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderProductCard(product) {
    const displayPrice = product.sale ? product.salePrice : Object.values(product.priceRanges)[0];
    const productJson = JSON.stringify(product).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    
    const rightContent = product.sale 
        ? '<span class="sale-badge">🔥 SALE</span>' 
        : '<span class="sale-placeholder"></span>';
    
    return `
        <div class="product-card" onclick='openProductModal(${productJson})'>
            <img src="${product.photo}" class="product-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
            <div class="product-info">
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price-wrapper">
                    <span class="product-price">${displayPrice}₽</span>
                    ${rightContent}
                </div>
                <button class="open-btn">Открыть</button>
            </div>
        </div>
    `;
}

function renderShopPage() {
    if (!products.length) {
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center; padding:50px">Загрузка товаров...</div>';
        return;
    }
    
    const searchTerm = document.getElementById('searchInput
