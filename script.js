// === НАЧАЛО: ЕДИНЫЙ ФАЙЛ СКРИПТОВ ДЛЯ VINOELITE ===

// ===============================================================
// =================== 1. FIREBASE & ОБЩИЕ ФУНКЦИИ ===============
// (Этот код будет доступен на всех страницах)
// ===============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, limit, serverTimestamp, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Firebase Initialization ---
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

// --- Global Constants & State ---
const CART_STORAGE_KEY = 'vinoelite_cart';
const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist';
let wishlistProductIds = new Set();

// --- UI & Helper Functions ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
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

function generateSlug(text) {
    if (!text) return '';
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
}

function generateStars(rating) {
    let starsHTML = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>';
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>';
    return starsHTML;
}

// --- Cart & Wishlist Logic ---
async function updateHeaderCounters() {
    const user = auth.currentUser;
    let cartItemCount = 0;
    let wishlistItemCount = 0;

    if (user) {
        const cartSnapshot = await getDocs(collection(db, `users/${user.uid}/cart`));
        cartSnapshot.forEach(doc => {
            cartItemCount += doc.data().quantity;
        });
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().wishlist) {
            wishlistItemCount = userDoc.data().wishlist.length;
            wishlistProductIds = new Set(userDoc.data().wishlist);
        }
    } else {
        const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        localCart.forEach(item => {
            cartItemCount += item.quantity;
        });
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

async function addToCart(productId, quantity = 1, buttonElement = null) {
    const user = auth.currentUser;
    if (user) {
        const cartItemRef = doc(db, `users/${user.uid}/cart`, productId);
        try {
            await runTransaction(db, async (transaction) => {
                const cartItemDoc = await transaction.get(cartItemRef);
                const newQuantity = cartItemDoc.exists() ? cartItemDoc.data().quantity + quantity : quantity;
                transaction.set(cartItemRef, {
                    quantity: newQuantity,
                    addedAt: new Date()
                }, {
                    merge: true
                });
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
        }
    } else {
        let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                productId,
                quantity
            });
        }
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
    showToast('Added to cart!', 'success');
    await updateHeaderCounters();

    // Update button state if provided
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
            await updateDoc(userDocRef, {
                wishlist: arrayRemove(productId)
            });
            showToast('Removed from wishlist.', 'danger');
        } else {
            await updateDoc(userDocRef, {
                wishlist: arrayUnion(productId)
            });
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

// --- Authentication & Syncing ---
async function syncDataOnAuth(user) {
    const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
    if (localCart.length === 0 && localWishlist.length === 0) return;

    if (localCart.length > 0) {
        const cartCollectionRef = collection(db, `users/${user.uid}/cart`);
        const batch = writeBatch(db);
        for (const item of localCart) {
            const docRef = doc(cartCollectionRef, item.productId);
            const docSnap = await getDoc(docRef);
            const newQty = docSnap.exists() ? docSnap.data().quantity + item.quantity : item.quantity;
            batch.set(docRef, {
                quantity: newQty,
                addedAt: new Date()
            }, {
                merge: true
            });
        }
        await batch.commit();
        localStorage.removeItem(CART_STORAGE_KEY);
    }

    if (localWishlist.length > 0) {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            wishlist: arrayUnion(...localWishlist)
        }, {
            merge: true
        });
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
    }
    showToast('Your cart & wishlist have been synced!', 'info');
}

function setupAuthUI(user) {
    const desktopAuthBtn = document.getElementById('auth-button');
    const mobileAuthBtn = document.getElementById('mobile-auth-button');
    if (!desktopAuthBtn || !mobileAuthBtn) return;

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

function openLoginModal(e) {
    if (e) e.preventDefault();
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.style.display = 'block';
}

// --- Slideshow Logic ---
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
        slides[currentIndex] ?.classList.remove('active');
        currentIndex = (index + slides.length) % slides.length;
        setTimeout(() => slides[currentIndex] ?.classList.add('active'), 50);
    }

    function manualSlide(direction) {
        clearInterval(intervalId);
        showSlide(currentIndex + direction);
        intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
    }

    let touchStartX = 0;
    overlay.addEventListener('mousedown', e => {
        touchStartX = e.clientX;
        overlay.style.cursor = 'grabbing';
        clearInterval(intervalId);
    });
    overlay.addEventListener('mouseup', e => {
        overlay.style.cursor = 'grab';
        if (e.clientX < touchStartX - 50) manualSlide(1);
        else if (e.clientX > touchStartX + 50) manualSlide(-1);
        else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
    });
    overlay.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        clearInterval(intervalId);
    }, {
        passive: true
    });
    overlay.addEventListener('touchend', e => {
        let touchEndX = e.changedTouches[0].clientX;
        if (touchEndX < touchStartX - 50) manualSlide(1);
        else if (touchEndX > touchStartX + 50) manualSlide(-1);
        else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
    });
    showSlide(0);
}


// ===============================================================
// =================== 2. ЛОГИКА ДЛЯ КОНКРЕТНЫХ СТРАНИЦ ============
// ===============================================================

// --- HOMEPAGE LOGIC ---
async function initHomepage() {
    const categoryCarouselsContainer = document.getElementById('category-carousels-container');
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');
    if (!categoryCarouselsContainer || !featuredProductsGrid) return;

    async function fetchProducts() {
        const q = query(collection(db, "products"), where("isArchived", "==", false));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    function createProductCardHTML(prod) {
        if (!prod.slug || !prod.category) return '';
        const categorySlug = generateSlug(prod.category);
        const productUrl = `/catalog/${categorySlug}/${prod.slug}`;
        let subtitle = [prod.category, prod.sweetness].filter(Boolean).join(' ') + (prod.region ? ` from ${[prod.region, prod.country].filter(Boolean).join(', ')}` : '');
        const description = prod.metaDescription || prod.description || '';
        const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
        const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name} view ${index + 1}" loading="lazy"></div>`).join('');
        return `<div class="product-card animate-on-scroll" data-url="${productUrl}">
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
                <div>
                    <div class="product-price">
                        <div class="price">$${prod.price.toFixed(2)}</div>
                        ${prod.oldPrice ? `<div class="old-price">$${prod.oldPrice.toFixed(2)}</div>` : ''}
                    </div>
                    <button class="add-to-cart-btn" data-product-id="${prod.id}"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
                </div>
            </div>
        </div>`;
    }

    function renderCategoryCarousels(products) {
        const container = document.getElementById('category-carousels-container');
        container.innerHTML = '';
        const productsByCategory = products.reduce((acc, product) => {
            if (product.category) {
                (acc[product.category] = acc[product.category] || []).push(product);
            }
            return acc;
        }, {});

        const CATEGORIES_TO_DISPLAY = ['Red Wine', 'White Wine', 'Sparkling Wine', 'Rosé Wine'];
        CATEGORIES_TO_DISPLAY.forEach(categoryName => {
            const categoryProducts = productsByCategory[categoryName];
            if (!categoryProducts || categoryProducts.length === 0) return;

            const selectedProducts = categoryProducts.sort(() => 0.5 - Math.random()).slice(0, 15);
            const carouselId = `carousel-${generateSlug(categoryName)}`;
            const categoryUrl = `/catalog.html?category=${encodeURIComponent(categoryName)}`;
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'category-carousel-wrapper animate-on-scroll';
            carouselWrapper.innerHTML = `
                <div class="carousel-header">
                    <a href="${categoryUrl}"><h2>${categoryName}</h2></a>
                    <div class="carousel-nav">
                        <button class="nav-arrow prev-arrow" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
                        <button class="nav-arrow next-arrow" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="products-carousel" id="${carouselId}"></div>
                <div class="carousel-progress"><div class="carousel-progress-bar"></div></div>
            `;
            const productsCarousel = carouselWrapper.querySelector('.products-carousel');
            selectedProducts.forEach(prod => {
                productsCarousel.innerHTML += createProductCardHTML(prod);
            });
            container.appendChild(carouselWrapper);
        });
    }

    function renderFeaturedProducts(products) {
        const grid = document.querySelector('#products-section .products-grid');
        grid.innerHTML = '';
        products.filter(p => p.isFeatured).slice(0, 4).forEach(prod => {
            grid.innerHTML += createProductCardHTML(prod);
        });
    }

    const allProducts = await fetchProducts();
    renderCategoryCarousels(allProducts);
    renderFeaturedProducts(allProducts);
    updateHeaderCounters();
}

// --- CATALOG PAGE LOGIC ---
async function initCatalogPage() {
    const productsGrid = document.getElementById('products-grid');
    const filtersContainer = document.getElementById('filters-container');
    if (!productsGrid || !filtersContainer) return;

    // ... (Здесь будет весь JS-код из вашего catalog.html)
    // ... Я его сократил для примера, но вы должны вставить его целиком
    console.log("Catalog page logic initialized.");
    // Пример:
    // let allProducts = [];
    // async function fetchProductsAndInit() { ... }
    // fetchProductsAndInit();
}


// --- PRODUCT PAGE LOGIC ---
async function initProductPage() {
    const productContainer = document.querySelector('.product-container');
    if (!productContainer || !window.location.pathname.startsWith('/catalog/')) return;

    // ... (Здесь будет весь JS-код из вашего product.html)
    // ... Я его сократил для примера, но вы должны вставить его целиком
    console.log("Product page logic initialized.");
    // Пример:
    // function getProductSlugFromUrl() { ... }
    // async function main() { ... }
    // main();
}


// ===============================================================
// =================== 3. ГЛАВНЫЙ ВЫПОЛНЯЕМЫЙ КОД =================
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');

    // --- Global UI Initializers (для всех страниц) ---
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.getElementById('main-nav');
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            const isActive = navLinks.classList.toggle('active');
            mobileMenuBtn.innerHTML = isActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }

    const loginModal = document.getElementById('login-modal');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    if (loginModal && closeModalBtn) {
        const closeLoginModal = () => loginModal.style.display = 'none';
        closeModalBtn.addEventListener('click', closeLoginModal);
        window.addEventListener('click', (e) => {
            if (e.target == loginModal) closeLoginModal();
        });
    }

    // --- Auth Form Logic ---
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const errorContainer = document.getElementById('auth-error');
            errorContainer.textContent = '';
            try {
                await signInWithEmailAndPassword(auth, email, password);
                loginModal.style.display = 'none';
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    try {
                        await createUserWithEmailAndPassword(auth, email, password);
                        loginModal.style.display = 'none';
                    } catch (createError) {
                        errorContainer.textContent = createError.message;
                    }
                } else {
                    errorContainer.textContent = error.message;
                }
            }
        });
    }

    // --- Global Event Listeners ---
    document.body.addEventListener('click', function(e) {
        const cartButton = e.target.closest('.add-to-cart-btn');
        const wishlistButton = e.target.closest('.wishlist-toggle-btn');
        const card = e.target.closest('.product-card');

        if (cartButton) {
            e.preventDefault();
            e.stopPropagation();
            addToCart(cartButton.dataset.productId, 1, cartButton);
        } else if (wishlistButton) {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(wishlistButton.dataset.productId);
        } else if (card && card.dataset.url) {
            window.location.href = card.dataset.url;
        }
    });

    // --- Auth State Change Handler ---
    onAuthStateChanged(auth, async (user) => {
        setupAuthUI(user);
        if (user) {
            await syncDataOnAuth(user);
        }
        await updateHeaderCounters();
    });

    // --- Page-Specific Initializers ---
    // Вызываем функции для конкретных страниц
    if (document.getElementById('hero-section')) {
        initHomepage().finally(() => {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        });
    } else if (document.getElementById('filters-container')) {
        initCatalogPage().finally(() => {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        });
    } else if (document.querySelector('.product-container')) {
        initProductPage().finally(() => {
            loader.classList.add('hidden');
            mainContent.classList.add('loaded');
        });
    } else {
        // Для страниц без специальной логики
        loader.classList.add('hidden');
        mainContent.classList.add('loaded');
    }
});