// ===============================================================
// =================== FIREBASE INITIALIZATION ===================
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
// =================== COPIED FROM INDEX.HTML ====================
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
// =================== MAIN CATALOG SCRIPT =======================
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {
    
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');

    let allProducts = [];
    let filteredProducts = [];
    let displayedProductsCount = 0;
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

    async function fetchProductsAndInit() {
        try {
            const q = query(collection(db, "products"), where("isArchived", "==", false));
            const querySnapshot = await getDocs(q);
            allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await main();
        } catch (error) {
            console.error("Error fetching products: ", error);
            productsGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
        } finally {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        }
    }

    function createGeoMaps() {
        allProducts.forEach(p => {
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

    function processSearchQueryAsFilter(searchQuery) {
        const query = searchQuery.toLowerCase();
        const newParams = new URLSearchParams();

        const filterTypes = ['category', 'country', 'region', 'appellation', 'grapeVarieties'];
        for (const type of filterTypes) {
            const values = getUniqueValues(type, allProducts);
            for (const value of values) {
                if (value.toLowerCase() === query) {
                    if (type === 'appellation') {
                        const region = appellationToRegionMap[value];
                        const country = region ? regionToCountryMap[region] : null;
                        if (country) newParams.set('country', country);
                        if (region) newParams.set('region', region);
                        newParams.set('appellation', value);
                    } else if (type === 'region') {
                        const country = regionToCountryMap[value];
                        if (country) newParams.set('country', country);
                        newParams.set('region', value);
                    } else {
                        newParams.set(type, value);
                    }
                    
                    window.location.replace(`${window.location.pathname}?${newParams.toString()}`);
                    return true;
                }
            }
        }
        return false;
    }

    async function main() {
        createGeoMaps(); 
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');

        if (searchQuery) {
            const wasRedirected = processSearchQueryAsFilter(searchQuery);
            if (wasRedirected) return;
        }

        parseUrlParams();
        renderFilters();
        addEventListeners();
        validateAndCleanFilters();
        runFilterAndSort();
        
        document.querySelectorAll('.animate-on-scroll').forEach(el => animationObserver.observe(el));
    }

    function runFilterAndSort() {
        applyFilters();
        applySorting();
        updateURL();
        renderAll();
        updateDependentFilters();
    }

    function applyFilters() {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search')?.toLowerCase().trim();

        if (searchQuery) {
            pageTitleEl.textContent = `Search Results for: "${urlParams.get('search')}"`;
        } else {
            pageTitleEl.textContent = 'Wine Catalog';
        }

        filteredProducts = allProducts.filter(product => {
            if (searchQuery) {
                const name = (product.name || '').toLowerCase();
                const category = (product.category || '').toLowerCase();
                const country = (product.country || '').toLowerCase();
                const region = (product.region || '').toLowerCase();
                const sweetness = (product.sweetness || '').toLowerCase();
                const year = String(product.year || '');
                const description = (product.description || product.metaDescription || '').toLowerCase();
                const badge = (product.badge || '').toLowerCase();
                const grape = (product.grapeVarieties || '').toLowerCase();

                const isMatch = name.includes(searchQuery) || category.includes(searchQuery) ||
                                country.includes(searchQuery) || region.includes(searchQuery) ||
                                sweetness.includes(searchQuery) || year.includes(searchQuery) ||
                                description.includes(searchQuery) || badge.includes(searchQuery) ||
                                grape.includes(searchQuery);
                
                if (!isMatch) return false;
            }

            if (product.price < state.filters.price.min || product.price > state.filters.price.max) {
                return false;
            }
            return Object.keys(state.filters).every(filterKey => {
                if (filterKey === 'price') return true;
                const selectedValues = state.filters[filterKey];
                if (selectedValues.length === 0) return true;
                const productValue = product[filterKey];
                if (!productValue) return false;
                if (filterKey === 'grapeVarieties') {
                    const productGrapes = productValue.split(',').map(g => g.trim());
                    return selectedValues.some(v => productGrapes.includes(v));
                }
                return selectedValues.includes(String(productValue));
            });
        });
    }

    function applySorting() {
        state.sorting = sortSelect.value;
        switch (state.sorting) {
            case 'price-asc': filteredProducts.sort((a, b) => a.price - b.price); break;
            case 'price-desc': filteredProducts.sort((a, b) => b.price - a.price); break;
            case 'name-asc': filteredProducts.sort((a, b) => a.name.localeCompare(b.name)); break;
        }
    }
    
    function validateAndCleanFilters() {
        const { country, region, appellation } = state.filters;
        if (country.length > 0 && region.length > 0) {
            const validRegionsForSelectedCountries = new Set(allProducts.filter(p => country.includes(p.country) && p.region).map(p => p.region));
            const originalRegions = [...region];
            state.filters.region = region.filter(r => validRegionsForSelectedCountries.has(r));
            originalRegions.filter(r => !state.filters.region.includes(r)).forEach(r => {
                const checkbox = document.getElementById(`filter-region-${generateSlug(r)}`);
                if (checkbox) checkbox.checked = false;
            });
        }
        if (appellation.length > 0) {
            let relevantProducts = allProducts;
            if (state.filters.region.length > 0) {
                relevantProducts = relevantProducts.filter(p => state.filters.region.includes(p.region));
            } else if (country.length > 0) {
                relevantProducts = relevantProducts.filter(p => country.includes(p.country));
            }
            const validAppellations = new Set(relevantProducts.filter(p => p.appellation).map(p => p.appellation));
            const originalAppellations = [...appellation];
            state.filters.appellation = appellation.filter(a => validAppellations.has(a));
            originalAppellations.filter(a => !state.filters.appellation.includes(a)).forEach(a => {
                const checkbox = document.getElementById(`filter-appellation-${generateSlug(a)}`);
                if (checkbox) checkbox.checked = false;
            });
        }
    }

    function renderAll() {
        renderBreadcrumbs();
        renderActiveFilters();
        renderProducts(true);
    }

    function renderProducts(reset = false) {
        if (reset) {
            productsGrid.innerHTML = '';
            displayedProductsCount = 0;
        }

        const productsToRender = filteredProducts.slice(displayedProductsCount, displayedProductsCount + PRODUCTS_PER_PAGE);

        if (productsToRender.length === 0 && reset) {
            productsGrid.innerHTML = '<p>No products match your criteria.</p>';
        }

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
        productsCountEl.textContent = `Showing ${displayedProductsCount} of ${filteredProducts.length} wines`;
        loadMoreBtn.style.display = displayedProductsCount < filteredProducts.length ? 'inline-block' : 'none';
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
        const regionsToShow = new Set(state.filters.region);
        const appellationsToShow = new Set(state.filters.appellation);
        if (countriesToShow.size > 0) {
            const value = [...countriesToShow].sort().join(', ');
            tempFilters.country = state.filters.country.join(',');
            html += ` / <a href="/catalog.html?${new URLSearchParams(tempFilters)}">${value}</a>`;
        }
        if (regionsToShow.size > 0) {
            const value = [...regionsToShow].sort().join(', ');
            if (state.filters.region.length > 0) tempFilters.region = state.filters.region.join(',');
            html += ` / <a href="/catalog.html?${new URLSearchParams(tempFilters)}">${value}</a>`;
        }
        if (appellationsToShow.size > 0) {
            const value = [...appellationsToShow].sort().join(', ');
             if (state.filters.appellation.length > 0) tempFilters.appellation = state.filters.appellation.join(',');
            html += ` / <a href="/catalog.html?${new URLSearchParams(tempFilters)}">${value}</a>`;
        }
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
        const selectedCategories = state.filters.category;
        let relevantSweetnessOptions;
        if (selectedCategories.length === 0) { relevantSweetnessOptions = stillWineSweetnessOptions; } 
        else {
            const hasSparkling = selectedCategories.some(cat => cat.toLowerCase().includes('sparkling'));
            const hasStill = selectedCategories.some(cat => !cat.toLowerCase().includes('sparkling'));
            if (hasSparkling && !hasStill) { relevantSweetnessOptions = sparklingWineSweetnessOptions; } 
            else if (hasStill && !hasSparkling) { relevantSweetnessOptions = stillWineSweetnessOptions; } 
            else { relevantSweetnessOptions = [...new Set([...stillWineSweetnessOptions, ...sparklingWineSweetnessOptions])]; }
        }
        const allSweetnessValuesInCatalog = getUniqueValues('sweetness', allProducts);
        const optionsToRender = relevantSweetnessOptions.filter(opt => allSweetnessValuesInCatalog.has(opt));
        const container = document.querySelector('#sweetness-filter-group .filter-content');
        if (!container) return;
        let optionsHTML = '';
        optionsToRender.forEach(option => {
            const isChecked = state.filters.sweetness.includes(option);
            optionsHTML += `<div class="filter-option"><input type="checkbox" id="filter-sweetness-${generateSlug(option)}" value="${option}" data-key="sweetness" ${isChecked ? 'checked' : ''}><label for="filter-sweetness-${generateSlug(option)}"><span>${option}</span></label></div>`;
        });
        container.innerHTML = optionsHTML;
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
                const group = document.createElement('div');
                group.className = 'filter-group';
                group.dataset.filterGroup = 'sweetness';
                group.id = 'sweetness-filter-group';
                group.innerHTML = `<div class="filter-title"><span>${title}</span></div><div class="filter-content"></div>`;
                filtersContainer.appendChild(group);
            } else {
                const options = getUniqueValues(key, allProducts);
                if (options.size === 0) return;
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
        const prices = allProducts.map(p => p.price);
        const minPrice = Math.floor(Math.min(...prices));
        const maxPrice = Math.ceil(Math.max(...prices));
        state.filters.price.min = minPrice;
        state.filters.price.max = maxPrice;
        const group = document.createElement('div');
        group.className = 'filter-group';
        group.innerHTML = `<div class="filter-title"><span>Price</span></div><div class="filter-content"><div class="price-filter-inputs"><span id="price-min-label">$${minPrice}</span><span>-</span><span id="price-max-label">$${maxPrice}</span></div><div class="price-slider-container"><div class="price-slider-range"></div><input type="range" id="price-slider-min" min="${minPrice}" max="${maxPrice}" value="${minPrice}"><input type="range" id="price-slider-max" min="${minPrice}" max="${maxPrice}" value="${maxPrice}"></div></div>`;
        filtersContainer.appendChild(group);
    }
    
    function updateDependentFilters() {
        let availableProducts = allProducts.filter(product => {
            return Object.keys(state.filters).every(filterKey => {
                if (['region', 'appellation'].includes(filterKey)) return true;
                if (filterKey === 'price') return product.price >= state.filters.price.min && product.price <= state.filters.price.max;
                const selectedValues = state.filters[filterKey];
                if (selectedValues.length === 0) return true;
                const productValue = product[filterKey];
                if (!productValue) return false;
                if (filterKey === 'grapeVarieties') {
                    return selectedValues.some(v => product.grapeVarieties.split(',').map(g=>g.trim()).includes(v));
                }
                return selectedValues.includes(String(productValue));
            });
        });
        const selectedCountries = state.filters.country;
        let regionProducts = selectedCountries.length > 0 ? availableProducts.filter(p => selectedCountries.includes(p.country)) : availableProducts;
        const availableRegions = getUniqueValues('region', regionProducts);
        updateOptionsVisibility('region', availableRegions);
        const selectedRegions = state.filters.region;
        let appellationProducts = selectedRegions.length > 0 ? regionProducts.filter(p => selectedRegions.includes(p.region)) : regionProducts;
        const availableAppellations = getUniqueValues('appellation', appellationProducts);
        updateOptionsVisibility('appellation', availableAppellations);
    }

    function updateOptionsVisibility(filterKey, availableOptions) {
        const filterGroup = document.querySelector(`[data-filter-group="${filterKey}"]`);
        if (!filterGroup) return;
        const optionElements = filterGroup.querySelectorAll('.filter-option');
        optionElements.forEach(opt => {
            const input = opt.querySelector('input');
            if (availableOptions.has(input.value)) { opt.classList.remove('disabled'); } 
            else { opt.classList.add('disabled'); }
        });
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
        if (!text) return '';
        return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    }

    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => {
            if (state.filters[key] !== undefined && key !== 'price' && key !== 'search') {
                state.filters[key] = value.split(',');
            }
        });
    }

    function updateURL() {
        const params = new URLSearchParams();
        const currentParams = new URLSearchParams(window.location.search);
        if (currentParams.has('search')) {
            params.set('search', currentParams.get('search'));
        }
        Object.keys(state.filters).forEach(key => {
            if (key !== 'price' && state.filters[key].length > 0) {
                params.set(key, state.filters[key].join(','));
            } else {
                if (key !== 'search') params.delete(key);
            }
        });
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({}, '', newUrl);
    }

    function updateCheckboxesFromState() {
        const allCheckboxes = filtersContainer.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(cb => {
            const key = cb.dataset.key;
            const value = cb.value;
            cb.checked = state.filters[key]?.includes(value) ?? false;
        });
    }

    function addEventListeners() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.getElementById('main-nav');
        mobileMenuBtn.addEventListener('click', () => {
            const isActive = navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active', isActive);
            mobileMenuBtn.innerHTML = isActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (navLinks.classList.contains('active')) {
                    if (link.closest('.mobile-actions')) return;
                    e.preventDefault();
                    navLinks.style.transform = 'translateX(-100%)';
                    mobileMenuBtn.classList.remove('active');
                    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                    setTimeout(() => {
                        navLinks.classList.remove('active');
                        navLinks.style.transform = '';
                        window.location.href = link.href;
                    }, 400);
                }
            });
        });

        closeModalBtn.addEventListener('click', closeLoginModal);
        window.addEventListener('click', (e) => { if (e.target == loginModal) closeLoginModal(); });
        setupGuestInteractions();
        const mobileSearchForm = document.querySelector('.mobile-search .search-box');
        if (mobileSearchForm) {
            const mobileSearchInput = mobileSearchForm.querySelector('input');
            mobileSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const query = mobileSearchInput.value.trim();
                if (query) { window.location.href = `/catalog.html?search=${encodeURIComponent(query)}`; }
            });
        }

        productsGrid.addEventListener('click', function(e) {
            const cartButton = e.target.closest('.add-to-cart-btn');
            const wishlistButton = e.target.closest('.wishlist-toggle-btn');
            if (cartButton) {
                e.preventDefault(); e.stopPropagation();
                addToCart(cartButton.dataset.productId, cartButton);
            } else if (wishlistButton) {
                e.preventDefault(); e.stopPropagation();
                toggleWishlist(wishlistButton.dataset.productId);
            } else {
                const card = e.target.closest('.product-card');
                if (card && card.dataset.url) { window.location.href = card.dataset.url; }
            }
        });

        filtersContainer.addEventListener('change', e => {
            if (e.target.type !== 'checkbox') return;
            const key = e.target.dataset.key;
            const value = e.target.value;
            const isChecked = e.target.checked;
            if (isChecked) {
                if (!state.filters[key].includes(value)) state.filters[key].push(value);
            } else {
                state.filters[key] = state.filters[key].filter(v => v !== value);
            }
            if (isChecked) {
                if (key === 'appellation') {
                    const region = appellationToRegionMap[value];
                    if (region && !state.filters.region.includes(region)) {
                        state.filters.region.push(region);
                        const country = regionToCountryMap[region];
                        if (country && !state.filters.country.includes(country)) { state.filters.country.push(country); }
                    }
                } else if (key === 'region') {
                    const country = regionToCountryMap[value];
                    if (country && !state.filters.country.includes(country)) { state.filters.country.push(country); }
                }
            } else {
                if (key === 'country') {
                    const regionsToClear = countryToRegionsMap[value] || [];
                    regionsToClear.forEach(region => {
                        const appellationsToClear = regionToAppellationsMap[region] || [];
                        appellationsToClear.forEach(appellation => { state.filters.appellation = state.filters.appellation.filter(a => a !== appellation); });
                        state.filters.region = state.filters.region.filter(r => r !== region);
                    });
                } else if (key === 'region') {
                    const appellationsToClear = regionToAppellationsMap[value] || [];
                    appellationsToClear.forEach(appellation => { state.filters.appellation = state.filters.appellation.filter(a => a !== appellation); });
                }
            }
            updateCheckboxesFromState();
            if (key === 'category') { renderSweetnessFilter(); }
            runFilterAndSort();
        });
        
        filtersContainer.addEventListener('input', e => {
            if (e.target.id === 'price-slider-min' || e.target.id === 'price-slider-max') {
                const minSlider = document.getElementById('price-slider-min');
                const maxSlider = document.getElementById('price-slider-max');
                let minVal = parseInt(minSlider.value);
                let maxVal = parseInt(maxSlider.value);
                if (maxVal < minVal) { [minVal, maxVal] = [maxVal, minVal]; minSlider.value = minVal; maxSlider.value = maxVal; }
                state.filters.price.min = minVal;
                state.filters.price.max = maxVal;
                document.getElementById('price-min-label').textContent = `$${minVal}`;
                document.getElementById('price-max-label').textContent = `$${maxVal}`;
                const range = maxSlider.max - maxSlider.min;
                const minPercent = ((minVal - minSlider.min) / range) * 100;
                const maxPercent = ((maxVal - minSlider.min) / range) * 100;
                document.querySelector('.price-slider-range').style.left = `${minPercent}%`;
                document.querySelector('.price-slider-range').style.width = `${maxPercent - minPercent}%`;
            }
        });

        filtersContainer.addEventListener('change', e => {
             if (e.target.id === 'price-slider-min' || e.target.id === 'price-slider-max') { runFilterAndSort(); }
        });

        activeFiltersContainer.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                const key = e.target.dataset.key;
                const value = e.target.dataset.value;
                const checkbox = document.getElementById(`filter-${key}-${generateSlug(value)}`);
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        sortSelect.addEventListener('change', runFilterAndSort);

        resetFiltersBtn.addEventListener('click', () => {
            Object.keys(state.filters).forEach(key => {
                if (key !== 'price') { state.filters[key] = []; }
            });
            const minSlider = document.getElementById('price-slider-min');
            const maxSlider = document.getElementById('price-slider-max');
            if (minSlider && maxSlider) {
                const minPrice = parseInt(minSlider.min);
                const maxPrice = parseInt(maxSlider.max);
                state.filters.price.min = minPrice;
                state.filters.price.max = maxPrice;
                minSlider.value = minPrice;
                maxSlider.value = maxPrice;
                document.getElementById('price-min-label').textContent = `$${minPrice}`;
                document.getElementById('price-max-label').textContent = `$${maxPrice}`;
                document.querySelector('.price-slider-range').style.left = `0%`;
                document.querySelector('.price-slider-range').style.width = `100%`;
            }
            updateCheckboxesFromState();
            renderSweetnessFilter();
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.delete('search');
            history.pushState({}, '', currentUrl);
            runFilterAndSort();
        });

        document.getElementById('grid-view-btn').addEventListener('click', () => {
            productsGrid.classList.remove('list-view');
            productsGrid.classList.add('grid-view');
            document.getElementById('grid-view-btn').classList.add('active');
            document.getElementById('list-view-btn').classList.remove('active');
        });
        document.getElementById('list-view-btn').addEventListener('click', () => {
            productsGrid.classList.remove('grid-view');
            productsGrid.classList.add('list-view');
            document.getElementById('list-view-btn').classList.add('active');
            document.getElementById('grid-view-btn').classList.remove('active');
        });

        loadMoreBtn.addEventListener('click', () => renderProducts(false));

        document.querySelector('.mobile-filters-btn').addEventListener('click', () => {
            const sidebar = document.querySelector('.filters-sidebar');
            sidebar.classList.toggle('active');
            const btnText = sidebar.classList.contains('active') ? 'Hide Filters' : 'Show Filters';
            document.querySelector('.mobile-filters-btn span').textContent = btnText;
        });
    }

    fetchProductsAndInit();
});