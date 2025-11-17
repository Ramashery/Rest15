// ===============================================================
// =================== FIREBASE INITIALIZATION ===================
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, where, limit, startAfter, orderBy, getCountFromServer } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBflzOWVf3HgDpdUhha3qvyeUJf7i6dOuk",
  authDomain: "wine-91d0e.firebaseapp.com",
  projectId: "wine-91d0e",
  storageBucket: "wine-91d0e.firebasestorage.app",
  messagingSenderId: "1021620433427",
  appId: "1:1021620433427:web:5439252fb350c4455a85e6",
  measurementId: "G-TRWHY3KXK1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===============================================================
// =================== SHARED UI/AUTH LOGIC (Без изменений) ======
// ===============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

const CART_STORAGE_KEY = 'vinoelite_cart';
const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist';
let wishlistProductIds = new Set();

async function updateHeaderCounters() {
    const user = auth.currentUser;
    let cartItemCount = 0;
    let wishlistItemCount = 0;

    if (user) {
        const cartSnapshot = await getDocs(collection(db, `users/${user.uid}/cart`));
        cartSnapshot.forEach(doc => { cartItemCount += doc.data().quantity; });
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().wishlist) {
            wishlistItemCount = userDoc.data().wishlist.length;
            wishlistProductIds = new Set(userDoc.data().wishlist);
        }
    } else {
        const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        localCart.forEach(item => { cartItemCount += item.quantity; });
        const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
        wishlistItemCount = localWishlist.length;
        wishlistProductIds = new Set(localWishlist);
    }

    document.querySelectorAll('.cart-count, .cart-count-badge').forEach(el => {
        el.textContent = cartItemCount;
        el.style.display = cartItemCount > 0 ? 'flex' : 'none';
    });
    document.querySelectorAll('.wishlist-count, .wishlist-count-badge').forEach(el => {
        el.textContent = wishlistItemCount;
        el.style.display = wishlistItemCount > 0 ? 'flex' : 'none';
    });

    document.querySelectorAll('.wishlist-toggle-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (wishlistProductIds.has(btn.dataset.productId)) {
            btn.classList.add('active');
            icon.classList.remove('far');
            icon.classList.add('fas');
        } else {
            btn.classList.remove('active');
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    });
}

async function addToCart(productId, buttonElement) {
    const user = auth.currentUser;
    if (user) {
        const cartItemRef = doc(db, `users/${user.uid}/cart`, productId);
        try {
            await runTransaction(db, async (transaction) => {
                const cartItemDoc = await transaction.get(cartItemRef);
                if (!cartItemDoc.exists()) {
                    transaction.set(cartItemRef, { quantity: 1, addedAt: new Date() });
                } else {
                    const newQuantity = cartItemDoc.data().quantity + 1;
                    transaction.update(cartItemRef, { quantity: newQuantity });
                }
            });
        } catch (e) { console.error("Transaction failed: ", e); }
    } else {
        let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) { existingItem.quantity++; } else { cart.push({ productId, quantity: 1 }); }
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
    showToast('Added to cart!', 'success');
    updateHeaderCounters();

    if (buttonElement) {
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fas fa-check"></i> Added!`;
        buttonElement.disabled = true;
        setTimeout(() => {
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
        }, 2000);
    }
}

async function toggleWishlist(productId) {
    const user = auth.currentUser;
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        if (wishlistProductIds.has(productId)) {
            await updateDoc(userDocRef, { wishlist: arrayRemove(productId) });
            showToast('Removed from wishlist.', 'danger');
        } else {
            await updateDoc(userDocRef, { wishlist: arrayUnion(productId) });
            showToast('Added to wishlist!', 'success');
        }
    } else {
        let localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
        const itemIndex = localWishlist.indexOf(productId);
        if (itemIndex > -1) {
            localWishlist.splice(itemIndex, 1);
            showToast('Removed from wishlist.', 'danger');
        } else {
            localWishlist.push(productId);
            showToast('Added to wishlist! Sign in to save it.', 'info');
        }
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(localWishlist));
    }
    await updateHeaderCounters();
}

async function syncCartOnAuth(user) {
    const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    if (localCart.length === 0) return;
    const cartCollectionRef = collection(db, `users/${user.uid}/cart`);
    const batch = writeBatch(db);
    for (const localItem of localCart) {
        const docRef = doc(cartCollectionRef, localItem.productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const newQuantity = docSnap.data().quantity + localItem.quantity;
            batch.update(docRef, { quantity: newQuantity });
        } else {
            batch.set(docRef, { quantity: localItem.quantity, addedAt: new Date() });
        }
    }
    await batch.commit();
    localStorage.removeItem(CART_STORAGE_KEY);
    showToast('Your cart has been synced!', 'info');
}

async function syncWishlistOnAuth(user) {
    const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
    if (localWishlist.length === 0) return;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    const firestoreWishlist = userDoc.exists() && userDoc.data().wishlist ? userDoc.data().wishlist : [];
    const merged = [...new Set([...firestoreWishlist, ...localWishlist])];
    await setDoc(userDocRef, { wishlist: merged }, { merge: true });
    localStorage.removeItem(WISHLIST_STORAGE_KEY);
}

const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');
const desktopAuthBtn = document.getElementById('auth-button');
const mobileAuthBtn = document.getElementById('mobile-auth-button');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const errorContainer = document.getElementById('auth-error');
const forgotPasswordLink = document.getElementById('forgot-password-link');

function openLoginModal(e) { e.preventDefault(); loginModal.style.display = 'block'; }
function closeLoginModal() {
    loginModal.style.display = 'none';
    authForm.reset();
    errorContainer.textContent = '';
}

const googleProvider = new GoogleAuthProvider();
document.getElementById('google-signin-btn').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, googleProvider);
        closeLoginModal();
    } catch (error) { errorContainer.textContent = error.message; }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    errorContainer.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeLoginModal();
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                closeLoginModal();
            } catch (createError) { errorContainer.textContent = createError.message; }
        } else { errorContainer.textContent = error.message; }
    }
});

forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    if (!email) { alert('Please enter your email in the email field to reset the password.'); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent! Please check your inbox.');
    } catch (error) { alert(`Error: ${error.message}`); }
});

function updateUIForAuthState(user) {
    if (user) {
        const userName = user.displayName || user.email.split('@')[0];
        desktopAuthBtn.href = "/profile.html";
        desktopAuthBtn.innerHTML = `<i class="fas fa-user-check"></i> <span class="auth-text">${userName}</span>`;
        desktopAuthBtn.title = "My Account";
        desktopAuthBtn.removeEventListener('click', openLoginModal);
        mobileAuthBtn.href = "/profile.html";
        mobileAuthBtn.querySelector('span').textContent = userName;
        mobileAuthBtn.removeEventListener('click', openLoginModal);
    } else {
        desktopAuthBtn.href = "#";
        desktopAuthBtn.innerHTML = `<i class="far fa-user"></i> <span class="auth-text">Sign In</span>`;
        desktopAuthBtn.title = "Sign In";
        desktopAuthBtn.addEventListener('click', openLoginModal);
        mobileAuthBtn.href = "#";
        mobileAuthBtn.querySelector('span').textContent = 'Sign In / Register';
        mobileAuthBtn.addEventListener('click', openLoginModal);
    }
}

function openLoginModalForGuests(e) { e.preventDefault(); openLoginModal(e); }

function setupGuestInteractions() {
    const user = auth.currentUser;
    const wishlistLinks = document.querySelectorAll('a[href="/profile.html#wishlist"]');
    wishlistLinks.forEach(link => {
        link.removeEventListener('click', openLoginModalForGuests);
        if (!user) { link.addEventListener('click', openLoginModalForGuests); }
    });
}

onAuthStateChanged(auth, async (user) => {
    updateUIForAuthState(user);
    setupGuestInteractions();
    if (user) {
        await syncCartOnAuth(user);
        await syncWishlistOnAuth(user);
    }
    await updateHeaderCounters();
});

// ===============================================================
// =================== MAIN CATALOG SCRIPT (ПЕРЕПИСАН) ===========
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {
    
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');

    // ИЗМЕНЕНИЕ: Переменные для пагинации
    let allProductsMetadata = []; // Для построения фильтров
    let lastVisibleProduct = null; // Последний загруженный документ для пагинации
    let displayedProductsCount = 0;
    let totalProductsCount = 0;
    let isFetching = false; // Флаг для предотвращения двойной загрузки
    const PRODUCTS_PER_PAGE = 12;

    const stillWineSweetnessOptions = ['Dry', 'Semi-Dry', 'Semi-Sweet', 'Sweet'];
    const sparklingWineSweetnessOptions = ['Brut Nature', 'Extra Brut', 'Brut', 'Extra-Dry', 'Dry / Sec', 'Demi-Sec', 'Doux'];

    let regionToCountryMap = {};
    let appellationToRegionMap = {};
    let countryToRegionsMap = {};
    let regionToAppellationsMap = {};

    const state = {
        filters: {
            category: [], country: [], region: [], appellation: [],
            grapeVarieties: [], sweetness: [], volume: [], year: [],
            price: { min: 0, max: 9999 }
        },
        sorting: 'popularity'
    };

    // DOM Elements
    const productsGrid = document.getElementById('products-grid');
    const productsCountEl = document.querySelector('.products-count');
    const filtersContainer = document.getElementById('filters-container');
    const sortSelect = document.getElementById('sort-select');
    const resetFiltersBtn = document.querySelector('.reset-filters');
    const breadcrumbContainer = document.getElementById('breadcrumb-container');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const pageTitleEl = document.querySelector('.page-title');

    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    function setupSlideshow(container) {
        if (!container) return;
        const slides = Array.from(container.querySelectorAll('.slideshow-item'));
        if (slides.length <= 1) {
            if (slides.length === 1) slides[0].classList.add('active');
            return;
        }
        if (container.querySelector('.slideshow-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'slideshow-overlay';
        container.appendChild(overlay);

        let currentIndex = 0;
        let intervalId = setInterval(() => showSlide(currentIndex + 1), 4000);

        function showSlide(index) {
            const oldSlide = slides[currentIndex];
            if (oldSlide) oldSlide.classList.remove('active');
            currentIndex = (index + slides.length) % slides.length;
            const newSlide = slides[currentIndex];
            if (newSlide) setTimeout(() => newSlide.classList.add('active'), 50);
        }

        function manualSlide(direction) {
            clearInterval(intervalId);
            showSlide(currentIndex + direction);
            intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
        }

        let touchStartX = 0;
        overlay.addEventListener('mousedown', e => { touchStartX = e.clientX; overlay.style.cursor = 'grabbing'; clearInterval(intervalId); });
        overlay.addEventListener('mouseup', e => {
            overlay.style.cursor = 'grab';
            if (e.clientX < touchStartX - 50) { manualSlide(1); } 
            else if (e.clientX > touchStartX + 50) { manualSlide(-1); } 
            else { intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }
        });
        overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; clearInterval(intervalId); }, { passive: true });
        overlay.addEventListener('touchend', e => {
            let touchEndX = e.changedTouches[0].clientX;
            if (touchEndX < touchStartX - 50) { manualSlide(1); } 
            else if (touchEndX > touchStartX + 50) { manualSlide(-1); } 
            else { intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }
        });
        showSlide(0);
    }

    // ИЗМЕНЕНИЕ: Функция для получения метаданных для фильтров
    async function fetchMetadataAndInit() {
        try {
            // Загружаем все продукты один раз, но только необходимые для фильтров поля
            const metaQuery = query(collection(db, "products"), where("isArchived", "==", false));
            const querySnapshot = await getDocs(metaQuery);
            allProductsMetadata = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            await main();
        } catch (error) {
            console.error("Error fetching metadata: ", error);
            productsGrid.innerHTML = '<p>Error loading filters. Please try again later.</p>';
        } finally {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        }
    }

    function createGeoMaps() {
        allProductsMetadata.forEach(p => {
            if (p.region && p.country) {
                regionToCountryMap[p.region] = p.country;
                if (!countryToRegionsMap[p.country]) countryToRegionsMap[p.country] = new Set();
                countryToRegionsMap[p.country].add(p.region);
            }
            if (p.appellation && p.region) {
                appellationToRegionMap[p.appellation] = p.region;
                if (!regionToAppellationsMap[p.region]) regionToAppellationsMap[p.region] = new Set();
                regionToAppellationsMap[p.region].add(p.appellation);
            }
        });
    }

    async function main() {
        createGeoMaps(); 
        
        parseUrlParams();
        renderFilters();
        addEventListeners();
        validateAndCleanFilters();
        
        // ИЗМЕНЕНИЕ: Запускаем первую загрузку продуктов
        await fetchAndRenderProducts(true);
        
        document.querySelectorAll('.animate-on-scroll').forEach(el => animationObserver.observe(el));
    }

    // ИЗМЕНЕНИЕ: Основная функция для запроса и отрисовки продуктов
    async function fetchAndRenderProducts(isNewQuery = false) {
        if (isFetching) return;
        isFetching = true;
        loadMoreBtn.textContent = 'Loading...';

        if (isNewQuery) {
            productsGrid.innerHTML = '';
            displayedProductsCount = 0;
            lastVisibleProduct = null;
        }

        try {
            // 1. Строим запрос к Firebase
            let productQuery = buildFirestoreQuery();

            // 2. Получаем общее количество товаров по этому запросу (только при первом запросе)
            if (isNewQuery) {
                const countSnapshot = await getCountFromServer(productQuery);
                totalProductsCount = countSnapshot.data().count;
            }
            
            // 3. Добавляем сортировку и пагинацию
            productQuery = applySortingAndPaginationToQuery(productQuery);

            // 4. Выполняем запрос
            const documentSnapshots = await getDocs(productQuery);
            
            // 5. Обрабатываем и рендерим результаты
            const productsToRender = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (productsToRender.length > 0) {
                lastVisibleProduct = documentSnapshots.docs[documentSnapshots.docs.length - 1];
                renderProducts(productsToRender);
            } else if (isNewQuery) {
                productsGrid.innerHTML = '<p>No products match your criteria.</p>';
            }

        } catch (error) {
            console.error("Error fetching products:", error);
            productsGrid.innerHTML = '<p>Error loading products. Please try again.</p>';
        } finally {
            isFetching = false;
            loadMoreBtn.textContent = 'Load More';
            updateUIState();
        }
    }

    // ИЗМЕНЕНИЕ: Функция для построения запроса на основе фильтров
    function buildFirestoreQuery() {
        let q = query(collection(db, "products"), where("isArchived", "==", false));

        // Применяем фильтры
        Object.keys(state.filters).forEach(key => {
            const values = state.filters[key];
            if (Array.isArray(values) && values.length > 0) {
                q = query(q, where(key, 'in', values));
            }
        });
        
        // Фильтр по цене
        q = query(q, where('price', '>=', state.filters.price.min));
        q = query(q, where('price', '<=', state.filters.price.max));

        return q;
    }

    // ИЗМЕНЕНИЕ: Функция для добавления сортировки и пагинации
    function applySortingAndPaginationToQuery(q) {
        // Сортировка
        switch (state.sorting) {
            case 'price-asc': q = query(q, orderBy('price', 'asc')); break;
            case 'price-desc': q = query(q, orderBy('price', 'desc')); break;
            case 'name-asc': q = query(q, orderBy('name', 'asc')); break;
            // 'popularity' может требовать отдельного поля, пока используем сортировку по умолчанию
            default: q = query(q, orderBy('name')); // Firestore требует orderBy для startAfter
        }

        // Пагинация
        if (lastVisibleProduct) {
            q = query(q, startAfter(lastVisibleProduct));
        }
        
        q = query(q, limit(PRODUCTS_PER_PAGE));
        return q;
    }

    function runFilterAndSort() {
        updateURL();
        fetchAndRenderProducts(true); // Запускаем новый поиск
        renderBreadcrumbs();
        renderActiveFilters();
        updateDependentFilters();
    }
    
    function validateAndCleanFilters() {
        const { country, region, appellation } = state.filters;
        if (country.length > 0 && region.length > 0) {
            const validRegionsForSelectedCountries = new Set(allProductsMetadata.filter(p => country.includes(p.country) && p.region).map(p => p.region));
            state.filters.region = region.filter(r => validRegionsForSelectedCountries.has(r));
        }
        if (appellation.length > 0) {
            let relevantProducts = allProductsMetadata;
            if (state.filters.region.length > 0) {
                relevantProducts = relevantProducts.filter(p => state.filters.region.includes(p.region));
            } else if (country.length > 0) {
                relevantProducts = relevantProducts.filter(p => country.includes(p.country));
            }
            const validAppellations = new Set(relevantProducts.filter(p => p.appellation).map(p => p.appellation));
            state.filters.appellation = appellation.filter(a => validAppellations.has(a));
        }
    }

    function renderProducts(productsToRender) {
        productsToRender.forEach(prod => {
            const categorySlug = generateSlug(prod.category);
            const productUrl = `/catalog/${categorySlug}/${prod.slug}`;
            const card = document.createElement('div');
            card.className = 'product-card animate-on-scroll';
            card.dataset.url = productUrl;

            let subtitle = '';
            const mainInfo = [prod.category, prod.sweetness].filter(Boolean).join(' ');
            const originInfo = [prod.region, prod.country].filter(Boolean).join(', ');
            if (mainInfo) subtitle += mainInfo;
            if (originInfo) subtitle += (subtitle ? ' from ' : '') + originInfo;
            const description = prod.metaDescription || prod.description || '';

            const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
            const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name} view ${index + 1}"></div>`).join('');

            card.innerHTML = `
                <div class="slideshow-container">
                    ${slidesHTML}
                    ${prod.badge ? `<div class="product-badge">${prod.badge}</div>` : ''}
                    <button class="wishlist-toggle-btn" data-product-id="${prod.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <div>
                        <div class="product-subtitle">${subtitle}</div>
                        <h3 class="product-name">${prod.name}</h3>
                        <p class="product-description">${description}</p>
                    </div>
                    <div class="product-price">
                        <div class="price">$${prod.price.toFixed(2)}</div>
                        ${prod.oldPrice ? `<div class="old-price">$${prod.oldPrice.toFixed(2)}</div>` : ''}
                    </div>
                    <button class="add-to-cart-btn" data-product-id="${prod.id}"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
                </div>
            `;
            productsGrid.appendChild(card);
            animationObserver.observe(card);
        });

        productsGrid.querySelectorAll('.slideshow-container').forEach(setupSlideshow);
        updateHeaderCounters();
        displayedProductsCount += productsToRender.length;
    }

    // ИЗМЕНЕНИЕ: Обновление UI после загрузки
    function updateUIState() {
        productsCountEl.textContent = `Showing ${displayedProductsCount} of ${totalProductsCount} wines`;
        loadMoreBtn.style.display = displayedProductsCount < totalProductsCount ? 'inline-block' : 'none';
    }

    function renderBreadcrumbs() {
        let html = `<a href="/index.html">Home</a> / <a href="/catalog.html">Catalog</a>`;
        let tempFilters = {};
        if (state.filters.category.length > 0) {
            const value = state.filters.category.join(', ');
            tempFilters.category = state.filters.category.join(',');
            html += ` / <a href="/catalog.html?${new URLSearchParams(tempFilters)}">${value}</a>`;
        }
        const countriesToShow = new Set(state.filters.country);
        if (countriesToShow.size > 0) {
            const value = [...countriesToShow].sort().join(', ');
            tempFilters.country = state.filters.country.join(',');
            html += ` / <a href="/catalog.html?${new URLSearchParams(tempFilters)}">${value}</a>`;
        }
        // ... (остальная логика без изменений)
        breadcrumbContainer.innerHTML = html;
    }

    function renderActiveFilters() {
        activeFiltersContainer.innerHTML = '';
        Object.keys(state.filters).forEach(key => {
            if (key === 'price') return;
            state.filters[key].forEach(value => {
                const pill = document.createElement('div');
                pill.className = 'filter-pill';
                pill.innerHTML = `<span>${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}</span><button data-key="${key}" data-value="${value}">&times;</button>`;
                activeFiltersContainer.appendChild(pill);
            });
        });
    }
    
    function renderSweetnessFilter() {
        // ... (логика без изменений)
    }

    function renderFilters() {
        const filterDefinitions = [
            { key: 'category', title: 'Category' }, { key: 'country', title: 'Country' },
            { key: 'region', title: 'Region' }, { key: 'appellation', title: 'Appellation' },
            { key: 'grapeVarieties', title: 'Grape' }, { key: 'sweetness', title: 'Sweetness' },
            { key: 'volume', title: 'Volume' }, { key: 'year', title: 'Year' }
        ];
        filtersContainer.innerHTML = '';
        renderPriceFilter();
        filterDefinitions.forEach(({key, title}) => {
            if (key === 'sweetness') {
                // ...
            } else {
                const options = getUniqueValues(key, allProductsMetadata); // Используем метаданные
                if (options.size === 0) return;
                // ... (остальная логика без изменений)
                const group = document.createElement('div');
                group.className = 'filter-group';
                group.dataset.filterGroup = key;
                let optionsHTML = '';
                [...options].sort().forEach(option => {
                    const isChecked = state.filters[key] && state.filters[key].includes(option);
                    optionsHTML += `<div class="filter-option"><input type="checkbox" id="filter-${key}-${generateSlug(option)}" value="${option}" data-key="${key}" ${isChecked ? 'checked' : ''}><label for="filter-${key}-${generateSlug(option)}"><span>${option}</span></label></div>`;
                });
                group.innerHTML = `<div class="filter-title"><span>${title}</span></div><div class="filter-content">${optionsHTML}</div>`;
                filtersContainer.appendChild(group);
            }
        });
        renderSweetnessFilter();
    }

    function renderPriceFilter() {
        const prices = allProductsMetadata.map(p => p.price); // Используем метаданные
        // ... (остальная логика без изменений)
    }
    
    function updateDependentFilters() {
        // ... (логика без изменений, использует allProductsMetadata)
    }

    function updateOptionsVisibility(filterKey, availableOptions) {
        // ... (логика без изменений)
    }

    function getUniqueValues(key, productList) {
        const values = new Set();
        productList.forEach(product => {
            if (product[key]) {
                if (key === 'grapeVarieties') {
                    product[key].split(',').forEach(grape => values.add(grape.trim()));
                } else { values.add(String(product[key])); }
            }
        });
        return values;
    }

    function generateSlug(text) {
        // ... (логика без изменений)
    }

    function parseUrlParams() {
        // ... (логика без изменений)
    }

    function updateURL() {
        // ... (логика без изменений)
    }

    function updateCheckboxesFromState() {
        // ... (логика без изменений)
    }

    function addEventListeners() {
        // ... (вся логика мобильного меню, модальных окон, поиска - без изменений)

        // --- PRODUCT GRID INTERACTIONS ---
        productsGrid.addEventListener('click', function(e) {
            // ... (логика без изменений)
        });

        // --- FILTERS LOGIC ---
        filtersContainer.addEventListener('change', e => {
            if (e.target.type !== 'checkbox' && e.target.type !== 'range') return;
            
            if (e.target.type === 'checkbox') {
                // ... (старая логика обработки чекбоксов)
            }
            
            if (e.target.id.startsWith('price-slider')) {
                // ... (старая логика обработки слайдера цены)
            }
            
            // Запускаем новый поиск при любом изменении фильтра
            runFilterAndSort();
        });

        activeFiltersContainer.addEventListener('click', e => {
            // ... (логика без изменений)
        });

        sortSelect.addEventListener('change', () => {
            state.sorting = sortSelect.value;
            runFilterAndSort();
        });

        resetFiltersBtn.addEventListener('click', () => {
            // ... (старая логика сброса)
            runFilterAndSort();
        });

        // --- VIEW TOGGLE ---
        // ... (логика без изменений)

        // --- LOAD MORE & MOBILE FILTERS ---
        loadMoreBtn.addEventListener('click', () => fetchAndRenderProducts(false)); // false - не новый запрос, а дозагрузка

        document.querySelector('.mobile-filters-btn').addEventListener('click', () => {
            // ... (логика без изменений)
        });
    }

    fetchMetadataAndInit(); // ИЗМЕНЕНИЕ: Запускаем новую стартовую функцию
});