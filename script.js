// Firebase and UI logic (no changes here)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
const firebaseConfig = { apiKey: "AIzaSyBflzOWVf3HgDpdUhha3qvyeUJf7i6dOuk", authDomain: "wine-91d0e.firebaseapp.com", projectId: "wine-91d0e", storageBucket: "wine-91d0e.firebasestorage.app", messagingSenderId: "1021620433427", appId: "1:1021620433427:web:5439252fb350c4455a85e6", measurementId: "G-TRWHY3KXK1" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
function showToast(message, type = 'info') { const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 3000); }
const CART_STORAGE_KEY = 'vinoelite_cart'; const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist'; let wishlistProductIds = new Set();
async function updateHeaderCounters() { const user = auth.currentUser; let cartItemCount = 0; let wishlistItemCount = 0; if (user) { const cartSnapshot = await getDocs(collection(db, `users/${user.uid}/cart`)); cartSnapshot.forEach(doc => { cartItemCount += doc.data().quantity; }); const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists() && userDoc.data().wishlist) { wishlistItemCount = userDoc.data().wishlist.length; wishlistProductIds = new Set(userDoc.data().wishlist); } } else { const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; localCart.forEach(item => { cartItemCount += item.quantity; }); const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; wishlistItemCount = localWishlist.length; wishlistProductIds = new Set(localWishlist); } document.querySelectorAll('.cart-count, .cart-count-badge').forEach(el => { el.textContent = cartItemCount; el.style.display = cartItemCount > 0 ? 'flex' : 'none'; }); document.querySelectorAll('.wishlist-count, .wishlist-count-badge').forEach(el => { el.textContent = wishlistItemCount; el.style.display = wishlistItemCount > 0 ? 'flex' : 'none'; }); document.querySelectorAll('.wishlist-toggle-btn').forEach(btn => { const icon = btn.querySelector('i'); if (wishlistProductIds.has(btn.dataset.productId)) { btn.classList.add('active'); icon.classList.remove('far'); icon.classList.add('fas'); } else { btn.classList.remove('active'); icon.classList.remove('fas'); icon.classList.add('far'); } }); }
async function addToCart(productId, buttonElement) { const user = auth.currentUser; if (user) { const cartItemRef = doc(db, `users/${user.uid}/cart`, productId); try { await runTransaction(db, async (transaction) => { const cartItemDoc = await transaction.get(cartItemRef); if (!cartItemDoc.exists()) { transaction.set(cartItemRef, { quantity: 1, addedAt: new Date() }); } else { const newQuantity = cartItemDoc.data().quantity + 1; transaction.update(cartItemRef, { quantity: newQuantity }); } }); } catch (e) { console.error("Transaction failed: ", e); } } else { let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; const existingItem = cart.find(item => item.productId === productId); if (existingItem) { existingItem.quantity++; } else { cart.push({ productId, quantity: 1 }); } localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } showToast('Added to cart!', 'success'); updateHeaderCounters(); if (buttonElement) { const originalText = buttonElement.innerHTML; buttonElement.innerHTML = `<i class="fas fa-check"></i> Added!`; buttonElement.disabled = true; setTimeout(() => { buttonElement.innerHTML = originalText; buttonElement.disabled = false; }, 2000); } }
async function toggleWishlist(productId) { const user = auth.currentUser; if (user) { const userDocRef = doc(db, "users", user.uid); if (wishlistProductIds.has(productId)) { await updateDoc(userDocRef, { wishlist: arrayRemove(productId) }); showToast('Removed from wishlist.', 'danger'); } else { await updateDoc(userDocRef, { wishlist: arrayUnion(productId) }); showToast('Added to wishlist!', 'success'); } } else { let localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; const itemIndex = localWishlist.indexOf(productId); if (itemIndex > -1) { localWishlist.splice(itemIndex, 1); showToast('Removed from wishlist.', 'danger'); } else { localWishlist.push(productId); showToast('Added to wishlist! Sign in to save it.', 'info'); } localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(localWishlist)); } await updateHeaderCounters(); }
async function syncCartOnAuth(user) { const localCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; if (localCart.length === 0) return; const cartCollectionRef = collection(db, `users/${user.uid}/cart`); const batch = writeBatch(db); for (const localItem of localCart) { const docRef = doc(cartCollectionRef, localItem.productId); const docSnap = await getDoc(docRef); if (docSnap.exists()) { const newQuantity = docSnap.data().quantity + localItem.quantity; batch.update(docRef, { quantity: newQuantity }); } else { batch.set(docRef, { quantity: localItem.quantity, addedAt: new Date() }); } } await batch.commit(); localStorage.removeItem(CART_STORAGE_KEY); showToast('Your cart has been synced!', 'info'); }
async function syncWishlistOnAuth(user) { const localWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || []; if (localWishlist.length === 0) return; const userDocRef = doc(db, "users", user.uid); const userDoc = await getDoc(userDocRef); const firestoreWishlist = userDoc.exists() && userDoc.data().wishlist ? userDoc.data().wishlist : []; const merged = [...new Set([...firestoreWishlist, ...localWishlist])]; await setDoc(userDocRef, { wishlist: merged }, { merge: true }); localStorage.removeItem(WISHLIST_STORAGE_KEY); }
const loginModal = document.getElementById('login-modal'); const closeModalBtn = document.querySelector('.close-modal-btn'); const desktopAuthBtn = document.getElementById('auth-button'); const mobileAuthBtn = document.getElementById('mobile-auth-button'); const authForm = document.getElementById('auth-form'); const emailInput = document.getElementById('auth-email'); const passwordInput = document.getElementById('auth-password'); const errorContainer = document.getElementById('auth-error'); const forgotPasswordLink = document.getElementById('forgot-password-link');
function openLoginModal(e) { e.preventDefault(); loginModal.style.display = 'block'; } function closeLoginModal() { loginModal.style.display = 'none'; authForm.reset(); errorContainer.textContent = ''; } const googleProvider = new GoogleAuthProvider(); document.getElementById('google-signin-btn').addEventListener('click', async () => { try { await signInWithPopup(auth, googleProvider); closeLoginModal(); } catch (error) { errorContainer.textContent = error.message; } }); authForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = emailInput.value; const password = passwordInput.value; errorContainer.textContent = ''; try { await signInWithEmailAndPassword(auth, email, password); closeLoginModal(); } catch (error) { if (error.code === 'auth/user-not-found') { try { await createUserWithEmailAndPassword(auth, email, password); closeLoginModal(); } catch (createError) { errorContainer.textContent = createError.message; } } else { errorContainer.textContent = error.message; } } }); forgotPasswordLink.addEventListener('click', async (e) => { e.preventDefault(); const email = emailInput.value; if (!email) { alert('Please enter your email in the email field to reset the password.'); return; } try { await sendPasswordResetEmail(auth, email); alert('Password reset email sent! Please check your inbox.'); } catch (error) { alert(`Error: ${error.message}`); } });
function updateUIForAuthState(user) { if (user) { const userName = user.displayName || user.email.split('@')[0]; desktopAuthBtn.href = "/profile.html"; desktopAuthBtn.innerHTML = `<i class="fas fa-user-check"></i> <span class="auth-text">${userName}</span>`; desktopAuthBtn.title = "My Account"; desktopAuthBtn.removeEventListener('click', openLoginModal); mobileAuthBtn.href = "/profile.html"; mobileAuthBtn.querySelector('span').textContent = userName; mobileAuthBtn.removeEventListener('click', openLoginModal); } else { desktopAuthBtn.href = "#"; desktopAuthBtn.innerHTML = `<i class="far fa-user"></i> <span class="auth-text">Sign In</span>`; desktopAuthBtn.title = "Sign In"; desktopAuthBtn.addEventListener('click', openLoginModal); mobileAuthBtn.href = "#"; mobileAuthBtn.querySelector('span').textContent = 'Sign In / Register'; mobileAuthBtn.addEventListener('click', openLoginModal); } }
function openLoginModalForGuests(e) { e.preventDefault(); openLoginModal(e); } function setupGuestInteractions() { const user = auth.currentUser; const wishlistLinks = document.querySelectorAll('a[href="/profile.html#wishlist"]'); wishlistLinks.forEach(link => { link.removeEventListener('click', openLoginModalForGuests); if (!user) { link.addEventListener('click', openLoginModalForGuests); } }); }
onAuthStateChanged(auth, async (user) => { updateUIForAuthState(user); setupGuestInteractions(); if (user) { await syncCartOnAuth(user); await syncWishlistOnAuth(user); } await updateHeaderCounters(); });

// ===============================================================
// =================== MAIN PAGE SCRIPT ==========================
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.getElementById('main-nav');
    const footer = document.getElementById('footer');

    // --- HEADER LOGIC ---
    mobileMenuBtn.addEventListener('click', () => {
        const isActive = navLinks.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active', isActive);
        mobileMenuBtn.innerHTML = isActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
    
    closeModalBtn.addEventListener('click', closeLoginModal);
    window.addEventListener('click', (e) => { if (e.target == loginModal) closeLoginModal(); });
    setupGuestInteractions();

    // --- ИЗМЕНЕНИЕ: Добавлена логика для модалки поиска на десктопе ---
    const desktopSearchBtn = document.querySelector('.search-btn.desktop-only');
    const searchModal = document.getElementById('search-modal');
    const closeSearchModalBtn = document.querySelector('.close-search-modal-btn');
    const desktopSearchForm = document.getElementById('desktop-search-form');
    const desktopSearchInput = document.getElementById('desktop-search-input');

    if (desktopSearchBtn && searchModal) {
        desktopSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchModal.style.display = 'block';
            desktopSearchInput.focus();
        });

        const closeSearchModal = () => {
            searchModal.style.display = 'none';
        };

        closeSearchModalBtn.addEventListener('click', closeSearchModal);

        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeSearchModal();
            }
        });

        desktopSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = desktopSearchInput.value.trim();
            if (query) {
                window.location.href = `/catalog.html?search=${encodeURIComponent(query)}`;
            }
        });
    }

    // --- ADMIN PANEL ACCESS ---
    let clickCount = 0; let clickTimer = null;
    footer.addEventListener('click', () => { clickCount++; if (clickCount === 1) { clickTimer = setTimeout(() => { clickCount = 0; }, 400); } else if (clickCount === 2) { clearTimeout(clickTimer); clickCount = 0; window.location.href = 'admin.html'; } });

    // --- ЛОГИКА ДИНАМИЧЕСКОЙ АНИМАЦИИ ПРИ СКРОЛЛЕ ---
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            } else {
                entry.target.classList.remove('is-visible');
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => animationObserver.observe(el));
    
    const observeDynamicContent = (container) => {
        if (!container) return;
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        node.querySelectorAll('.animate-on-scroll').forEach(el => animationObserver.observe(el));
                        if (node.classList.contains('animate-on-scroll')) animationObserver.observe(node);
                    }
                });
            });
        });
        mutationObserver.observe(container, { childList: true, subtree: true });
    };
    observeDynamicContent(document.getElementById('category-carousels-container'));
    observeDynamicContent(document.querySelector('#products-section .products-grid'));

    // --- CONTENT LOADING LOGIC ---
    function setupSlideshow(container) { if (!container) return; const slides = Array.from(container.querySelectorAll('.slideshow-item')); if (slides.length <= 1) { if (slides.length === 1) slides[0].classList.add('active'); return; } if (container.querySelector('.slideshow-overlay')) return; const overlay = document.createElement('div'); overlay.className = 'slideshow-overlay'; container.appendChild(overlay); let currentIndex = 0; let intervalId = setInterval(() => showSlide(currentIndex + 1), 4000); function showSlide(index) { slides[currentIndex]?.classList.remove('active'); currentIndex = (index + slides.length) % slides.length; setTimeout(() => slides[currentIndex]?.classList.add('active'), 50); } function manualSlide(direction) { clearInterval(intervalId); showSlide(currentIndex + direction); intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); } let touchStartX = 0; overlay.addEventListener('mousedown', e => { touchStartX = e.clientX; overlay.style.cursor = 'grabbing'; clearInterval(intervalId); }); overlay.addEventListener('mouseup', e => { overlay.style.cursor = 'grab'; if (e.clientX < touchStartX - 50) manualSlide(1); else if (e.clientX > touchStartX + 50) manualSlide(-1); else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }); overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; clearInterval(intervalId); }, { passive: true }); overlay.addEventListener('touchend', e => { let touchEndX = e.changedTouches[0].clientX; if (touchEndX < touchStartX - 50) manualSlide(1); else if (touchEndX > touchStartX + 50) manualSlide(-1); else intervalId = setInterval(() => showSlide(currentIndex + 1), 5000); }); showSlide(0); }
    async function fetchHeroData() { const docSnap = await getDoc(doc(db, "siteContent", "hero")); return docSnap.exists() ? docSnap.data() : null; }
    async function fetchProducts() { const querySnapshot = await getDocs(query(collection(db, "products"))); return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    function updateMetaTags(title, description) { if (title) document.title = title; let metaDesc = document.querySelector('meta[name="description"]'); if (description) metaDesc.setAttribute('content', description); }
    function renderHero(heroData) { const heroContent = document.querySelector('#hero-section .hero-content'); if (!heroData || !heroContent) return; heroContent.querySelector('.hero-subtitle').textContent = heroData.heroSubtitle; heroContent.querySelector('.hero-title').textContent = heroData.heroTitle; heroContent.querySelector('.hero-description').textContent = heroData.heroDescription; document.querySelector('#hero-section .hero-bg').style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${heroData.heroBgImage}')`; updateMetaTags(heroData.metaTitle, heroData.metaDescription); }
    const CATEGORIES_TO_DISPLAY = ['Red Wine', 'White Wine', 'Sparkling Wine', 'Rosé Wine', 'Fortified Wine', 'Dessert Wine', 'Vermouth & Aromatized Wine', 'Natural Wine', 'Orange Wine'];
    function renderCategoryCarousels(products) { const container = document.getElementById('category-carousels-container'); container.innerHTML = ''; const productsByCategory = products.reduce((acc, product) => { if (product.category && !product.isArchived) { (acc[product.category] = acc[product.category] || []).push(product); } return acc; }, {}); CATEGORIES_TO_DISPLAY.forEach(categoryName => { const categoryProducts = productsByCategory[categoryName]; if (!categoryProducts || categoryProducts.length === 0) return; const selectedProducts = categoryProducts.sort(() => 0.5 - Math.random()).slice(0, 15); const carouselId = `carousel-${categoryName.replace(/[^a-zA-Z0-9]/g, '-')}`; const categoryUrl = `/catalog.html?category=${encodeURIComponent(categoryName)}`; const carouselWrapper = document.createElement('div'); carouselWrapper.className = 'category-carousel-wrapper animate-on-scroll'; carouselWrapper.innerHTML = `<div class="carousel-header"><a href="${categoryUrl}"><h2>${categoryName}</h2></a><div class="carousel-nav"><button class="nav-arrow prev-arrow" aria-label="Previous"><i class="fas fa-chevron-left"></i></button><button class="nav-arrow next-arrow" aria-label="Next"><i class="fas fa-chevron-right"></i></button></div></div><div class="products-carousel" id="${carouselId}"></div>`; const productsCarousel = carouselWrapper.querySelector('.products-carousel'); selectedProducts.forEach(prod => { productsCarousel.innerHTML += createProductCardHTML(prod); }); container.appendChild(carouselWrapper); setupCarouselNavigation(carouselWrapper); carouselWrapper.querySelectorAll('.slideshow-container').forEach(setupSlideshow); }); }
    function createProductCardHTML(prod) { if (!prod.slug || !prod.category) return ''; const categorySlug = prod.category.toLowerCase().replace(/\s+/g, '-'); const productUrl = `/catalog/${categorySlug}/${prod.slug}`; let subtitle = [prod.category, prod.sweetness].filter(Boolean).join(' ') + (prod.region ? ` from ${[prod.region, prod.country].filter(Boolean).join(', ')}` : ''); const description = prod.metaDescription || prod.description || ''; const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl]; const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name} view ${index + 1}" loading="lazy"></div>`).join(''); return `<div class="product-card animate-on-scroll" data-url="${productUrl}"><div class="slideshow-container">${slidesHTML}${prod.badge ? `<div class="product-badge">${prod.badge}</div>` : ''}<button class="wishlist-toggle-btn" data-product-id="${prod.id}"><i class="far fa-heart"></i></button></div><div class="product-info"><div><div class="product-subtitle">${subtitle}</div><h3 class="product-name">${prod.name}</h3><p class="product-description">${description}</p></div><div><div class="product-price"><div class="price">$${prod.price.toFixed(2)}</div>${prod.oldPrice ? `<div class="old-price">$${prod.oldPrice.toFixed(2)}</div>` : ''}</div><button class="add-to-cart-btn" data-product-id="${prod.id}"><i class="fas fa-shopping-cart"></i> Add to Cart</button></div></div></div>`; }
    function setupCarouselNavigation(carouselWrapper) { const carousel = carouselWrapper.querySelector('.products-carousel'); const prevBtn = carouselWrapper.querySelector('.prev-arrow'); const nextBtn = carouselWrapper.querySelector('.next-arrow'); const updateArrows = () => { if (!carousel) return; const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth; prevBtn.disabled = carousel.scrollLeft < 10; nextBtn.disabled = carousel.scrollLeft > maxScrollLeft - 10; }; prevBtn.addEventListener('click', () => { carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' }); }); nextBtn.addEventListener('click', () => { carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' }); }); carousel.addEventListener('scroll', updateArrows, { passive: true }); new ResizeObserver(updateArrows).observe(carousel); updateArrows(); }
    function renderFeaturedProducts(products) { const grid = document.querySelector('#products-section .products-grid'); grid.innerHTML = ''; products.filter(p => !p.isArchived).slice(0, 4).forEach(prod => { grid.innerHTML += createProductCardHTML(prod); }); document.querySelectorAll('#products-section .slideshow-container').forEach(setupSlideshow); }
    document.getElementById('main-site-content').addEventListener('click', function(e) { const cartButton = e.target.closest('.add-to-cart-btn'); const wishlistButton = e.target.closest('.wishlist-toggle-btn'); if (cartButton) { e.preventDefault(); e.stopPropagation(); addToCart(cartButton.dataset.productId, cartButton); } else if (wishlistButton) { e.preventDefault(); e.stopPropagation(); toggleWishlist(wishlistButton.dataset.productId); } else { const card = e.target.closest('.product-card'); if (card && card.dataset.url) { window.location.href = card.dataset.url; } } });
    const mobileSearchForm = document.querySelector('.mobile-search .search-box'); if (mobileSearchForm) { const mobileSearchInput = mobileSearchForm.querySelector('input'); mobileSearchForm.addEventListener('submit', (e) => { e.preventDefault(); const query = mobileSearchInput.value.trim(); if (query) { window.location.href = `/catalog.html?search=${encodeURIComponent(query)}`; } }); }

    async function main() {
        try {
            await updateHeaderCounters();
            const [hero, products] = await Promise.all([fetchHeroData(), fetchProducts()]);
            renderHero(hero);
            renderCategoryCarousels(products);
            renderFeaturedProducts(products);
            updateHeaderCounters();
        } catch (error) {
            console.error("Error initializing page: ", error);
            document.body.innerHTML = `<div style="padding: 40px; text-align: center;"><h1>Error loading page data.</h1><p>${error.message}</p></div>`;
        }
    }

    main().finally(() => {
        loader.classList.add('hidden');
        mainContent.classList.add('loaded');
    });

    // --- НОВЫЕ УЛУЧШЕНИЯ UX ---
    // Плавное закрытие мобильного меню при клике на ссылку
    document.querySelectorAll('#main-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            // Только для мобильного меню
            if (navLinks.classList.contains('active')) {
                // Не прерывать клики по кнопкам внутри меню
                if (link.closest('.mobile-actions')) return;
                
                e.preventDefault();
                navLinks.style.transform = 'translateX(-100%)';
                mobileMenuBtn.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                
                setTimeout(() => {
                    navLinks.classList.remove('active');
                    navLinks.style.transform = ''; // Сброс стиля
                    window.location.href = link.href;
                }, 400); // Должно совпадать с transition в CSS
            }
        });
    });

    // Интерактивные карусели с прогресс-баром
    function enhanceCarousels() {
        document.querySelectorAll('.category-carousel-wrapper').forEach(wrapper => {
            const carousel = wrapper.querySelector('.products-carousel');
            if (!carousel) return;

            const progressBarContainer = document.createElement('div');
            progressBarContainer.className = 'carousel-progress';
            progressBarContainer.innerHTML = '<div class="carousel-progress-bar"></div>';
            wrapper.appendChild(progressBarContainer);
            
            const updateProgress = () => {
                const scrollableWidth = carousel.scrollWidth - carousel.clientWidth;
                if (scrollableWidth <= 0) {
                    progressBarContainer.style.display = 'none';
                    return;
                }
                progressBarContainer.style.display = 'block';
                const progress = (carousel.scrollLeft / scrollableWidth) * 100;
                progressBarContainer.querySelector('.carousel-progress-bar').style.width = `${progress}%`;
            };

            carousel.addEventListener('scroll', updateProgress, { passive: true });
            new ResizeObserver(updateProgress).observe(carousel);
            updateProgress(); // Initial call
        });
    }

    // Инициализация после загрузки динамического контента
    const observer = new MutationObserver((mutationsList, observer) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                enhanceCarousels();
                observer.disconnect(); // Запускаем один раз после добавления каруселей
                break;
            }
        }
    });
    observer.observe(document.getElementById('category-carousels-container'), { childList: true });
});