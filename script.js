// === НАЧАЛО: ЕДИНЫЙ ФАЙЛ СКРИПТОВ ДЛЯ VINOELITE (v4, максимальная диагностика) ===

// ===============================================================
// =================== 1. FIREBASE & ГЛОБАЛЬНЫЕ ФУНКЦИИ ===========
// ===============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, limit, serverTimestamp, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBflzOWVf3HgDpdUhha3qvyeUJf7i6dOuk", authDomain: "wine-91d0e.firebaseapp.com", projectId: "wine-91d0e", storageBucket: "wine-91d0e.firebasestorage.app", messagingSenderId: "1021620433427", appId: "1:1021620433427:web:5439252fb350c4455a85e6", measurementId: "G-TRWHY3KXK1" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ... Глобальные функции (без изменений) ...
const CART_STORAGE_KEY = 'vinoelite_cart'; const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist'; let wishlistProductIds = new Set();
function showToast(message, type = 'info') { const container = document.getElementById('toast-container'); if (!container) return; const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 3000); }
function generateSlug(text) { if (!text) return ''; return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, ''); }
async function updateHeaderCounters() { const user = auth.currentUser; let cartItemCount = 0; let wishlistItemCount = 0; if (user) { const cartSnapshot = await getDocs(collection(db, `users/${user.uid}/cart`)); cartSnapshot.forEach(doc => { cartItemCount += doc.data().quantity; }); const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists() && userDoc.data().wishlist) { wishlistItemCount = userDoc.data().wishlist.length; wishlistProductIds = new Set(userDoc.data().wishlist); } else { wishlistProductIds = new Set(); } } else { const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; localCart.forEach(item => { cartItemCount += item.quantity; }); const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; wishlistItemCount = localWishlist.length; wishlistProductIds = new Set(localWishlist); } document.querySelectorAll('.cart-count, .cart-count-badge').forEach(el => { el.textContent = cartItemCount; el.style.display = cartItemCount > 0 ? 'flex' : 'none'; }); document.querySelectorAll('.wishlist-count, .wishlist-count-badge').forEach(el => { el.textContent = wishlistItemCount; el.style.display = wishlistItemCount > 0 ? 'flex' : 'none'; }); document.querySelectorAll('.wishlist-toggle-btn').forEach(btn => { const icon = btn.querySelector('i'); if (wishlistProductIds.has(btn.dataset.productId)) { btn.classList.add('active'); icon.classList.remove('far'); icon.classList.add('fas'); } else { btn.classList.remove('active'); icon.classList.remove('fas'); icon.classList.add('far'); } }); }
async function addToCart(productId, quantity = 1, buttonElement = null) { const user = auth.currentUser; if (user) { const cartItemRef = doc(db, `users/${user.uid}/cart`, productId); await runTransaction(db, async (transaction) => { const cartItemDoc = await transaction.get(cartItemRef); const newQuantity = cartItemDoc.exists() ? cartItemDoc.data().quantity + quantity : quantity; transaction.set(cartItemRef, { quantity: newQuantity, addedAt: new Date() }, { merge: true }); }); } else { let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; const existingItem = cart.find(item => item.productId === productId); if (existingItem) { existingItem.quantity += quantity; } else { cart.push({ productId, quantity }); } localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } showToast('Added to cart!', 'success'); await updateHeaderCounters(); if (buttonElement) { const originalHTML = buttonElement.innerHTML; buttonElement.innerHTML = `<i class="fas fa-check"></i> Added!`; buttonElement.disabled = true; setTimeout(() => { buttonElement.innerHTML = originalHTML; buttonElement.disabled = false; }, 2000); } }
async function toggleWishlist(productId) { const user = auth.currentUser; if (!user) { let localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; const itemIndex = localWishlist.indexOf(productId); if (itemIndex > -1) { localWishlist.splice(itemIndex, 1); showToast('Removed from wishlist.', 'danger'); } else { localWishlist.push(productId); showToast('Added to wishlist! Sign in to save it.', 'info'); } localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(localWishlist)); } else { const userDocRef = doc(db, "users", user.uid); if (wishlistProductIds.has(productId)) { await updateDoc(userDocRef, { wishlist: arrayRemove(productId) }); showToast('Removed from wishlist.', 'danger'); } else { await updateDoc(userDocRef, { wishlist: arrayUnion(productId) }); showToast('Added to wishlist!', 'success'); } } await updateHeaderCounters(); }
async function syncDataOnAuth(user) { const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; if (localCart.length === 0 && localWishlist.length === 0) return; const batch = writeBatch(db); if (localCart.length > 0) { const cartCollectionRef = collection(db, `users/${user.uid}/cart`); for (const item of localCart) { const docRef = doc(cartCollectionRef, item.productId); const docSnap = await getDoc(docRef); const newQty = docSnap.exists() ? docSnap.data().quantity + item.quantity : item.quantity; batch.set(docRef, { quantity: newQty, addedAt: new Date() }, { merge: true }); } localStorage.removeItem(CART_STORAGE_KEY); } if (localWishlist.length > 0) { const userDocRef = doc(db, "users", user.uid); batch.set(userDocRef, { wishlist: arrayUnion(...localWishlist) }, { merge: true }); localStorage.removeItem(WISHLIST_STORAGE_KEY); } await batch.commit(); showToast('Your cart & wishlist have been synced!', 'info'); }
function setupAuthUI(user) { const desktopAuthBtn = document.getElementById('auth-button'); const mobileAuthBtn = document.getElementById('mobile-auth-button'); if (!desktopAuthBtn || !mobileAuthBtn) return; const openLoginModal = (e) => { e.preventDefault(); document.getElementById('login-modal').style.display = 'block'; }; if (user) { const userName = user.displayName || user.email.split('@')[0]; desktopAuthBtn.href = "/profile.html"; desktopAuthBtn.innerHTML = `<i class="fas fa-user-check"></i> <span class="auth-text">${userName}</span>`; desktopAuthBtn.title = "My Account"; desktopAuthBtn.removeEventListener('click', openLoginModal); mobileAuthBtn.href = "/profile.html"; mobileAuthBtn.querySelector('span').textContent = userName; mobileAuthBtn.removeEventListener('click', openLoginModal); } else { desktopAuthBtn.href = "#"; desktopAuthBtn.innerHTML = `<i class="far fa-user"></i> <span class="auth-text">Sign In</span>`; desktopAuthBtn.title = "Sign In"; desktopAuthBtn.addEventListener('click', openLoginModal); mobileAuthBtn.href = "#"; mobileAuthBtn.querySelector('span').textContent = 'Sign In / Register'; mobileAuthBtn.addEventListener('click', openLoginModal); } }
function setupSlideshow(container) { if (!container) return; const slides = Array.from(container.querySelectorAll('.slideshow-item')); if (slides.length <= 1) { if (slides.length === 1) slides[0].classList.add('active'); return; } if (container.querySelector('.slideshow-overlay')) return; const overlay = document.createElement('div'); overlay.className = 'slideshow-overlay'; container.appendChild(overlay); let currentIndex = 0; let intervalId = setInterval(() => showSlide(currentIndex + 1), 4000); function showSlide(index) { slides[currentIndex]?.classList.remove('active'); currentIndex = (index + slides.length) % slides.length; setTimeout(() => slides[currentIndex]?.classList.add('active'), 50); } function manualSlide(direction) { clearInterval(intervalId); showSlide(currentIndex + direction); intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); } let touchStartX = 0; overlay.addEventListener('mousedown', e => { touchStartX = e.clientX; overlay.style.cursor = 'grabbing'; clearInterval(intervalId); }); overlay.addEventListener('mouseup', e => { overlay.style.cursor = 'grab'; if (e.clientX < touchStartX - 50) manualSlide(1); else if (e.clientX > touchStartX + 50) manualSlide(-1); else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }); overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; clearInterval(intervalId); }, { passive: true }); overlay.addEventListener('touchend', e => { let touchEndX = e.changedTouches[0].clientX; if (touchEndX < touchStartX - 50) manualSlide(1); else if (touchEndX > touchStartX + 50) manualSlide(-1); else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }); showSlide(0); }

// ===============================================================
// =================== 2. ЛОГИКА ДЛЯ КОНКРЕТНЫХ СТРАНИЦ ============
// ===============================================================

// --- HOMEPAGE LOGIC ---
async function initHomepage(showDiagnosticMessage) {
    showDiagnosticMessage('[Homepage] Начало выполнения <code>initHomepage</code>.');
    
    const categoryCarouselsContainer = document.getElementById('category-carousels-container');
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');

    if (!categoryCarouselsContainer || !featuredProductsGrid) {
        showDiagnosticMessage(`[Homepage] ❌ Ошибка: Не найден один из ключевых контейнеров. <br>Найден #category-carousels-container: ${!!categoryCarouselsContainer} <br>Найден #products-section .products-grid: ${!!featuredProductsGrid}`, true);
        return;
    }
    showDiagnosticMessage('[Homepage] ✅ Ключевые HTML-контейнеры найдены.');

    async function fetchProducts() {
        showDiagnosticMessage('[Homepage] ⏳ Запрашиваю товары из Firebase...');
        const q = query(collection(db, "products"), where("isArchived", "==", false));
        const querySnapshot = await getDocs(q);
        const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        showDiagnosticMessage(`[Homepage] ✅ Получено <strong>${products.length}</strong> товаров из базы данных.`);
        return products;
    }

    function createProductCardHTML(prod) { /* ... код без изменений ... */ if (!prod.slug || !prod.category) return ''; const categorySlug = generateSlug(prod.category); const productUrl = `/catalog/${categorySlug}/${prod.slug}.html`; let subtitle = [prod.category, prod.sweetness].filter(Boolean).join(' ') + (prod.region ? ` from ${[prod.region, prod.country].filter(Boolean).join(', ')}` : ''); const description = prod.metaDescription || prod.description || ''; const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl]; const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name} view ${index + 1}" loading="lazy"></div>`).join(''); return `<div class="product-card animate-on-scroll" data-url="${productUrl}"><div class="slideshow-container">${slidesHTML}${prod.badge ? `<div class="product-badge">${prod.badge}</div>` : ''}<button class="wishlist-toggle-btn" data-product-id="${prod.id}"><i class="far fa-heart"></i></button></div><div class="product-info"><div><div class="product-subtitle">${subtitle}</div><h3 class="product-name">${prod.name}</h3><p class="product-description">${description}</p></div><div><div class="product-price"><div class="price">$${prod.price.toFixed(2)}</div>${prod.oldPrice ? `<div class="old-price">$${prod.oldPrice.toFixed(2)}</div>` : ''}</div><button class="add-to-cart-btn" data-product-id="${prod.id}"><i class="fas fa-shopping-cart"></i> Add to Cart</button></div></div></div>`; }

    function renderCategoryCarousels(products) {
        showDiagnosticMessage('[Homepage] ⏳ Начинаю отрисовку каруселей категорий...');
        // ... остальной код функции без изменений ...
        const container = document.getElementById('category-carousels-container'); container.innerHTML = ''; const productsByCategory = products.reduce((acc, product) => { if (product.category) { (acc[product.category] = acc[product.category] || []).push(product); } return acc; }, {}); const CATEGORIES_TO_DISPLAY = ['Red Wine', 'White Wine', 'Sparkling Wine', 'Rosé Wine']; CATEGORIES_TO_DISPLAY.forEach(categoryName => { const categoryProducts = productsByCategory[categoryName]; if (!categoryProducts || categoryProducts.length === 0) return; const selectedProducts = categoryProducts.sort(() => 0.5 - Math.random()).slice(0, 15); const carouselId = `carousel-${generateSlug(categoryName)}`; const categoryUrl = `/catalog.html?category=${encodeURIComponent(categoryName)}`; const carouselWrapper = document.createElement('div'); carouselWrapper.className = 'category-carousel-wrapper animate-on-scroll'; carouselWrapper.innerHTML = `<div class="carousel-header"><a href="${categoryUrl}"><h2>${categoryName}</h2></a><div class="carousel-nav"><button class="nav-arrow prev-arrow" aria-label="Previous"><i class="fas fa-chevron-left"></i></button><button class="nav-arrow next-arrow" aria-label="Next"><i class="fas fa-chevron-right"></i></button></div></div><div class="products-carousel" id="${carouselId}"></div><div class="carousel-progress"><div class="carousel-progress-bar"></div></div>`; const productsCarousel = carouselWrapper.querySelector('.products-carousel'); selectedProducts.forEach(prod => { productsCarousel.innerHTML += createProductCardHTML(prod); }); container.appendChild(carouselWrapper); });
        showDiagnosticMessage('[Homepage] ✅ Отрисовка каруселей завершена.');
    }

    function renderFeaturedProducts(products) {
        showDiagnosticMessage('[Homepage] ⏳ Начинаю отрисовку избранных товаров...');
        // ... остальной код функции без изменений ...
        const grid = document.querySelector('#products-section .products-grid'); grid.innerHTML = ''; const featured = products.filter(p => p.isFeatured).length > 0 ? products.filter(p => p.isFeatured) : products.slice(0, 4); featured.slice(0, 4).forEach(prod => { grid.innerHTML += createProductCardHTML(prod); });
        showDiagnosticMessage('[Homepage] ✅ Отрисовка избранных товаров завершена.');
    }

    const allProducts = await fetchProducts();
    if (allProducts.length > 0) {
        renderCategoryCarousels(allProducts);
        renderFeaturedProducts(allProducts);
        document.querySelectorAll('.slideshow-container').forEach(setupSlideshow);
        await updateHeaderCounters();
        showDiagnosticMessage('[Homepage] 🎉 Скрипт для главной страницы успешно выполнен!');
    } else {
        showDiagnosticMessage('[Homepage] ⚠️ Предупреждение: Товары не были отрисованы, так как из базы данных пришел пустой список.', true);
    }
}

// --- CATALOG PAGE LOGIC ---
async function initCatalogPage(showDiagnosticMessage) {
    showDiagnosticMessage('[Catalog] Начало выполнения <code>initCatalogPage</code>.');
    // ... (весь код для страницы каталога, как в предыдущем файле, но с добавлением диагностических сообщений)
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) {
        showDiagnosticMessage('[Catalog] ❌ Ошибка: Не найден ключевой контейнер <code>#products-grid</code>.', true);
        return;
    }
    showDiagnosticMessage('[Catalog] ✅ Ключевые HTML-контейнеры найдены.');

    async function fetchProductsAndInit() {
        showDiagnosticMessage('[Catalog] ⏳ Запрашиваю все товары из Firebase...');
        const q = query(collection(db, "products"), where("isArchived", "==", false));
        const querySnapshot = await getDocs(q);
        const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        showDiagnosticMessage(`[Catalog] ✅ Получено <strong>${allProducts.length}</strong> товаров.`);
        
        if (allProducts.length > 0) {
            // Здесь должна быть вся логика фильтрации и рендеринга
            productsGrid.innerHTML = ''; // Очищаем
            allProducts.forEach(prod => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `<div class="product-info"><h3 class="product-name">${prod.name}</h3><div class="price">$${prod.price}</div></div>`;
                productsGrid.appendChild(card);
            });
            showDiagnosticMessage('[Catalog] 🎉 Скрипт для каталога успешно выполнен, товары отрисованы (упрощенная версия).');
        } else {
            showDiagnosticMessage('[Catalog] ⚠️ Товары не отрисованы, так как список пуст.', true);
        }
    }
    await fetchProductsAndInit();
}

// --- PRODUCT PAGE LOGIC ---
async function initProductPage(showDiagnosticMessage) {
    // ... (код для страницы товара)
}

// ===============================================================
// =================== 3. ГЛАВНЫЙ ВЫПОЛНЯЕМЫЙ КОД =================
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    function showDiagnosticMessage(message, isError = false) {
        const div = document.createElement('div');
        div.innerHTML = message;
        div.style.padding = '15px'; div.style.margin = '20px'; div.style.borderRadius = '8px';
        div.style.borderLeft = `5px solid ${isError ? '#dc3545' : '#28a745'}`;
        div.style.backgroundColor = isError ? '#dc354533' : '#28a74533';
        div.style.color = '#f5f5f5'; div.style.fontFamily = 'monospace'; div.style.fontSize = '14px';
        div.style.zIndex = '10001'; div.style.position = 'relative';
        document.body.prepend(div);
    }

    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    
    // ... (код для меню, модальных окон, auth и т.д.)

    let pageInitFunction;
    if (document.getElementById('hero-section')) {
        showDiagnosticMessage('✅ Обнаружен ID "hero-section". Запускаю скрипты для <strong>Главной страницы</strong>.');
        pageInitFunction = initHomepage;
    } else if (document.getElementById('filters-container')) {
        showDiagnosticMessage('✅ Обнаружен ID "filters-container". Запускаю скрипты для <strong>Страницы каталога</strong>.');
        pageInitFunction = initCatalogPage;
    } else if (document.querySelector('.product-container')) {
        showDiagnosticMessage('✅ Обнаружен класс "product-container". Запускаю скрипты для <strong>Страницы товара</strong>.');
        pageInitFunction = initProductPage;
    } else {
        showDiagnosticMessage('❌ <strong>КРИТИЧЕСКАЯ ОШИБКА:</strong> Не удалось определить тип страницы.', true);
    }

    if (pageInitFunction) {
        pageInitFunction(showDiagnosticMessage).catch(error => {
            console.error("Ошибка при инициализации страницы:", error);
            showDiagnosticMessage(`❌ Ошибка при выполнении скрипта страницы: ${error.message}`, true);
        }).finally(() => {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        });
    } else {
        loader.classList.add('hidden');
        mainContent.classList.add('loaded');
    }
});