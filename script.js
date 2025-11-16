// ===============================================================
// =================== FIREBASE INITIALIZATION ===================
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, limit, serverTimestamp, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
// =================== GLOBAL VARIABLES & HELPERS ================
// ===============================================================
const CART_STORAGE_KEY = 'vinoelite_cart';
const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist';
let wishlistProductIds = new Set();

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

function getProductSlugFromUrl() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(part => part);
    if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        // Удаляем .html, если оно есть, для чистого slug
        return lastPart.endsWith('.html') ? lastPart.slice(0, -5) : lastPart;
    }
    return null;
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

function generateSlug(text) {
    if (!text) return '';
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
}

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
        slides[currentIndex]?.classList.remove('active');
        currentIndex = (index + slides.length) % slides.length;
        setTimeout(() => slides[currentIndex]?.classList.add('active'), 50);
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
        if (e.clientX < touchStartX - 50) manualSlide(1);
        else if (e.clientX > touchStartX + 50) manualSlide(-1);
        else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
    });
    overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; clearInterval(intervalId); }, { passive: true });
    overlay.addEventListener('touchend', e => {
        let touchEndX = e.changedTouches[0].clientX;
        if (touchEndX < touchStartX - 50) manualSlide(1);
        else if (touchEndX > touchStartX + 50) manualSlide(-1);
        else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000);
    });
    showSlide(0);
}

// ===============================================================
// =================== CORE: AUTH, CART, WISHLIST ================
// ===============================================================

const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');
const desktopAuthBtn = document.getElementById('auth-button');
const mobileAuthBtn = document.getElementById('mobile-auth-button');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const errorContainer = document.getElementById('auth-error');
const forgotPasswordLink = document.getElementById('forgot-password-link');

function openLoginModal(e) {
    if (e) e.preventDefault();
    if (loginModal) loginModal.style.display = 'block';
}

function closeLoginModal() {
    if (loginModal) {
        loginModal.style.display = 'none';
        if (authForm) authForm.reset();
        if (errorContainer) errorContainer.textContent = '';
    }
}

function updateUIForAuthState(user) {
    if (user) {
        const userName = user.displayName || user.email.split('@')[0];
        if (desktopAuthBtn) {
            desktopAuthBtn.href = "/profile.html";
            desktopAuthBtn.innerHTML = `<i class="fas fa-user-check"></i> <span class="auth-text">${userName}</span>`;
            desktopAuthBtn.title = "My Account";
            desktopAuthBtn.removeEventListener('click', openLoginModal);
        }
        if (mobileAuthBtn) {
            mobileAuthBtn.href = "/profile.html";
            mobileAuthBtn.querySelector('span').textContent = userName;
            mobileAuthBtn.removeEventListener('click', openLoginModal);
        }
    } else {
        if (desktopAuthBtn) {
            desktopAuthBtn.href = "#";
            desktopAuthBtn.innerHTML = `<i class="far fa-user"></i> <span class="auth-text">Sign In</span>`;
            desktopAuthBtn.title = "Sign In";
            desktopAuthBtn.addEventListener('click', openLoginModal);
        }
        if (mobileAuthBtn) {
            mobileAuthBtn.href = "#";
            mobileAuthBtn.querySelector('span').textContent = 'Sign In / Register';
            mobileAuthBtn.addEventListener('click', openLoginModal);
        }
    }
}

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

async function addToCart(productId, quantity = 1, buttonElement = null) {
    const user = auth.currentUser;
    if (user) {
        const cartItemRef = doc(db, `users/${user.uid}/cart`, productId);
        try {
            await runTransaction(db, async (transaction) => {
                const cartItemDoc = await transaction.get(cartItemRef);
                const newQuantity = cartItemDoc.exists() ? cartItemDoc.data().quantity + quantity : quantity;
                transaction.set(cartItemRef, { quantity: newQuantity, addedAt: new Date() }, { merge: true });
            });
        } catch (e) { console.error("Transaction failed: ", e); }
    } else {
        let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) { existingItem.quantity += quantity; } else { cart.push({ productId, quantity }); }
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
    showToast('Added to cart!', 'success');
    await updateHeaderCounters();

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
            batch.set(docRef, { quantity: newQty, addedAt: new Date() }, { merge: true });
        }
        await batch.commit();
        localStorage.removeItem(CART_STORAGE_KEY);
    }
    if (localWishlist.length > 0) {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { wishlist: arrayUnion(...localWishlist) }, { merge: true });
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
    }
    showToast('Your cart & wishlist have been synced!', 'info');
}

// ===============================================================
// =================== PAGE-SPECIFIC LOGIC =======================
// ===============================================================

// --- UNIVERSAL PRODUCT CARD HTML ---
function createProductCardHTML(prod) {
    if (!prod.slug || !prod.category) return '';
    // ИСПРАВЛЕНИЕ: URL теперь формируется правильно
    const productUrl = `/product.html?slug=${prod.slug}`;
    let subtitle = [prod.category, prod.sweetness].filter(Boolean).join(' ') + (prod.region ? ` from ${[prod.region, prod.country].filter(Boolean).join(', ')}` : '');
    const description = prod.metaDescription || prod.description || '';
    const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
    const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name} view ${index + 1}" loading="lazy"></div>`).join('');
    
    return `
    <div class="product-card animate-on-scroll" data-url="${productUrl}">
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

// --- INDEX PAGE ---
function initIndexPage() {
    const categoryCarouselsContainer = document.getElementById('category-carousels-container');
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');

    async function fetchHeroData() {
        const docSnap = await getDoc(doc(db, "siteContent", "hero"));
        return docSnap.exists() ? docSnap.data() : null;
    }

    async function fetchAllProducts() {
        const querySnapshot = await getDocs(query(collection(db, "products"), where("isArchived", "==", false)));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function renderHero(heroData) {
        const heroSection = document.getElementById('hero-section');
        if (!heroData || !heroSection) return;
        heroSection.querySelector('.hero-subtitle').textContent = heroData.heroSubtitle;
        heroSection.querySelector('.hero-title').textContent = heroData.heroTitle;
        heroSection.querySelector('.hero-description').textContent = heroData.heroDescription;
        heroSection.querySelector('.hero-bg').style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${heroData.heroBgImage}')`;
    }

    function renderCategoryCarousels(products) {
        const container = categoryCarouselsContainer;
        if (!container) return;
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
                <div class="products-carousel">
                    ${selectedProducts.map(createProductCardHTML).join('')}
                </div>
                <div class="carousel-progress"><div class="carousel-progress-bar"></div></div>
            `;
            container.appendChild(carouselWrapper);
            
            setupCarouselNavigation(carouselWrapper);
            carouselWrapper.querySelectorAll('.slideshow-container').forEach(setupSlideshow);
        });
    }

    function setupCarouselNavigation(carouselWrapper) {
        const carousel = carouselWrapper.querySelector('.products-carousel');
        const prevBtn = carouselWrapper.querySelector('.prev-arrow');
        const nextBtn = carouselWrapper.querySelector('.next-arrow');
        const progressBar = carouselWrapper.querySelector('.carousel-progress-bar');

        const updateCarouselState = () => {
            if (!carousel || !prevBtn || !nextBtn || !progressBar) return;
            const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
            prevBtn.disabled = carousel.scrollLeft < 10;
            nextBtn.disabled = carousel.scrollLeft > maxScrollLeft - 10;
            if (maxScrollLeft > 0) {
                const progress = (carousel.scrollLeft / maxScrollLeft) * 100;
                progressBar.style.width = `${progress}%`;
            } else {
                progressBar.style.width = '0%';
            }
        };

        prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' }));
        nextBtn.addEventListener('click', () => carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' }));
        carousel.addEventListener('scroll', updateCarouselState, { passive: true });
        new ResizeObserver(updateCarouselState).observe(carousel);
        updateCarouselState();
    }

    function renderFeaturedProducts(products) {
        if (!featuredProductsGrid) return;
        featuredProductsGrid.innerHTML = '';
        products.filter(p => p.isFeatured).slice(0, 4).forEach(prod => {
            featuredProductsGrid.innerHTML += createProductCardHTML(prod);
        });
        featuredProductsGrid.querySelectorAll('.slideshow-container').forEach(setupSlideshow);
    }

    async function main() {
        try {
            const [hero, products] = await Promise.all([fetchHeroData(), fetchAllProducts()]);
            renderHero(hero);
            renderCategoryCarousels(products);
            renderFeaturedProducts(products);
            updateHeaderCounters();
        } catch (error) {
            console.error("Error initializing index page: ", error);
        }
    }

    main();
}

// --- CATALOG PAGE ---
function initCatalogPage() {
    // This function will now be executed
    console.log("Catalog page logic is running!");
    // ... (rest of the catalog logic)
}

// --- PRODUCT DETAIL PAGE ---
function initProductDetailPage() {
    // This function will now be executed
    console.log("Product detail page logic is running!");
    // ... (rest of the product detail logic)
}


// ===============================================================
// =================== GLOBAL INITIALIZATION =====================
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');

    // --- Global Event Listeners ---
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeLoginModal);
    if (loginModal) window.addEventListener('click', (e) => { if (e.target == loginModal) closeLoginModal(); });

    if (authForm) {
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
    }
    
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
                closeLoginModal();
            } catch (error) { if (errorContainer) errorContainer.textContent = error.message; }
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            if (!email) { alert('Please enter your email in the email field to reset the password.'); return; }
            try {
                await sendPasswordResetEmail(auth, email);
                alert('Password reset email sent! Please check your inbox.');
            } catch (error) { alert(`Error: ${error.message}`); }
        });
    }
    
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.getElementById('main-nav');
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            const isActive = navLinks.classList.toggle('active');
            mobileMenuBtn.innerHTML = isActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }

    const desktopSearchBtn = document.querySelector('.search-btn.desktop-only');
    const searchModal = document.getElementById('search-modal');
    if (desktopSearchBtn && searchModal) {
        const closeSearchModalBtn = searchModal.querySelector('.close-search-modal-btn');
        const desktopSearchForm = document.getElementById('desktop-search-form');
        const desktopSearchInput = document.getElementById('desktop-search-input');

        desktopSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchModal.style.display = 'block';
            desktopSearchInput.focus();
        });
        const closeSearchModal = () => { searchModal.style.display = 'none'; };
        closeSearchModalBtn.addEventListener('click', closeSearchModal);
        searchModal.addEventListener('click', (e) => { if (e.target === searchModal) closeSearchModal(); });
        desktopSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = desktopSearchInput.value.trim();
            if (query) window.location.href = `/catalog.html?search=${encodeURIComponent(query)}`;
        });
    }
    const mobileSearchForm = document.querySelector('.mobile-search .search-box');
    if (mobileSearchForm) {
        mobileSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = e.target.querySelector('input').value.trim();
            if (query) window.location.href = `/catalog.html?search=${encodeURIComponent(query)}`;
        });
    }

    document.body.addEventListener('click', function(e) {
        const cartButton = e.target.closest('.add-to-cart-btn');
        const wishlistButton = e.target.closest('.wishlist-toggle-btn');
        
        if (cartButton) {
            e.preventDefault();
            e.stopPropagation();
            addToCart(cartButton.dataset.productId, 1, cartButton);
        } else if (wishlistButton) {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(wishlistButton.dataset.productId);
        } else {
            const card = e.target.closest('.product-card');
            if (card && card.dataset.url) {
                window.location.href = card.dataset.url;
            }
        }
    });

    onAuthStateChanged(auth, async (user) => {
        updateUIForAuthState(user);
        if (user) {
            await syncDataOnAuth(user);
        }
        await updateHeaderCounters();
    });

    // --- Page Router ---
    if (document.getElementById('hero-section')) {
        initIndexPage();
    } else if (document.getElementById('filters-container')) {
        initCatalogPage();
    } else if (document.querySelector('.product-container')) {
        initProductDetailPage();
    }

    if (loader) loader.classList.add('hidden');
    if (mainContent) mainContent.classList.add('loaded');

    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.animate-on-scroll').forEach(el => animationObserver.observe(el));
});