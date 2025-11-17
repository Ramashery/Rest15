// ===============================================================
// =================== FIREBASE INITIALIZATION ===================
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, updateDoc, runTransaction, arrayUnion, arrayRemove, writeBatch, where, limit, orderBy, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
// =================== НОВЫЙ MAIN CATALOG SCRIPT =================
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {
    
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const PRODUCTS_PER_PAGE = 12;

    const state = {
        filters: {
            category: [], country: [], region: [], appellation: [],
            grapeVarieties: [], sweetness: [],
            price: { min: 0, max: 9999 },
            search: ''
        },
        sorting: 'popularity',
        lastVisible: null,
        isLoading: false,
        totalCount: 0,
        displayedCount: 0
    };

    const productsGrid = document.getElementById('products-grid');
    const productsCountEl = document.querySelector('.products-count');
    const filtersContainer = document.getElementById('filters-container');
    const sortSelect = document.getElementById('sort-select');
    const resetFiltersBtn = document.querySelector('.reset-filters');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const pageTitleEl = document.querySelector('.page-title');

    async function fetchAndRenderProducts(isLoadMore = false) {
        if (state.isLoading) return;
        state.isLoading = true;
        loadMoreBtn.textContent = 'Loading...';

        if (!isLoadMore) {
            productsGrid.innerHTML = '';
            state.lastVisible = null;
            state.displayedCount = 0;
        }

        try {
            let productQuery = collection(db, "products");
            let queries = [where("isArchived", "==", false)];

            Object.keys(state.filters).forEach(key => {
                const value = state.filters[key];
                if (key === 'price') {
                    queries.push(where("price", ">=", value.min));
                    queries.push(where("price", "<=", value.max));
                } else if (Array.isArray(value) && value.length > 0) {
                    queries.push(where(key, "in", value));
                }
            });
            
            let finalQuery = query(productQuery, ...queries);

            switch (state.sorting) {
                case 'price-asc': finalQuery = query(finalQuery, orderBy("price", "asc")); break;
                case 'price-desc': finalQuery = query(finalQuery, orderBy("price", "desc")); break;
                case 'name-asc': finalQuery = query(finalQuery, orderBy("name", "asc")); break;
                default: finalQuery = query(finalQuery, orderBy("popularity", "desc")); break;
            }

            if (isLoadMore && state.lastVisible) {
                finalQuery = query(finalQuery, startAfter(state.lastVisible));
            }

            finalQuery = query(finalQuery, limit(PRODUCTS_PER_PAGE));

            const querySnapshot = await getDocs(finalQuery);

            if (querySnapshot.empty && !isLoadMore) {
                productsGrid.innerHTML = '<p>No products match your criteria.</p>';
            }

            const productsToRender = [];
            querySnapshot.forEach(doc => {
                productsToRender.push({ id: doc.id, ...doc.data() });
            });
            renderProducts(productsToRender);

            if (!querySnapshot.empty) {
                state.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            }

            state.displayedCount += productsToRender.length;
            updateCountersAndButtons(querySnapshot.size < PRODUCTS_PER_PAGE);

        } catch (error) {
            console.error("Error fetching products:", error);
            productsGrid.innerHTML = '<p>Error loading products. Please check console for details.</p>';
            if (error.message.includes('indexes?create_composite=')) {
                 productsGrid.innerHTML += '<p style="color: orange;">A required index is missing. Please check the developer console (F12), find the error message, and click the link to create the Firestore index.</p>';
            }
        } finally {
            state.isLoading = false;
            loadMoreBtn.textContent = 'Load More';
        }
    }
    
    function renderProducts(products) {
        products.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card animate-on-scroll';
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
        });
        updateHeaderCounters();
    }

    function updateCountersAndButtons(isLastPage) {
        if (state.displayedCount > 0) {
            productsCountEl.textContent = `Showing ${state.displayedCount} wines`;
        } else {
            productsCountEl.textContent = 'No wines found';
        }
        
        if (isLastPage || state.displayedCount === 0) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-block';
        }
    }

    async function initializeFilters() {
        const filterValues = {
            category: new Set(), country: new Set(), region: new Set(),
            appellation: new Set(), grapeVarieties: new Set(), sweetness: new Set()
        };
        
        const snapshot = await getDocs(collection(db, "products"));
        snapshot.forEach(doc => {
            const product = doc.data();
            Object.keys(filterValues).forEach(key => {
                if (product[key]) {
                    if (key === 'grapeVarieties' && typeof product[key] === 'string') {
                        product[key].split(',').forEach(g => filterValues[key].add(g.trim()));
                    } else if (typeof product[key] === 'string') {
                        filterValues[key].add(product[key]);
                    }
                }
            });
        });

        renderFilterUI(filterValues);
    }

    function renderFilterUI(filterValues) {
        const filterDefinitions = [
            { key: 'category', title: 'Category' }, { key: 'country', title: 'Country' },
            { key: 'region', title: 'Region' }, { key: 'appellation', title: 'Appellation' },
            { key: 'grapeVarieties', title: 'Grape' }, { key: 'sweetness', title: 'Sweetness' }
        ];
        
        filtersContainer.innerHTML = '';

        filterDefinitions.forEach(({key, title}) => {
            const options = filterValues[key];
            if (options.size === 0) return;
            
            let optionsHTML = '';
            [...options].sort().forEach(option => {
                const slug = option.toString().toLowerCase().replace(/\s+/g, '-');
                optionsHTML += `<div class="filter-option"><input type="checkbox" id="filter-${key}-${slug}" value="${option}" data-key="${key}"><label for="filter-${key}-${slug}"><span>${option}</span></label></div>`;
            });

            const group = document.createElement('div');
            group.className = 'filter-group';
            group.innerHTML = `<div class="filter-title"><span>${title}</span></div><div class="filter-content">${optionsHTML}</div>`;
            filtersContainer.appendChild(group);
        });
    }

    function handleFilterChange() {
        const checkedBoxes = filtersContainer.querySelectorAll('input[type="checkbox"]:checked');
        
        Object.keys(state.filters).forEach(key => {
            if (Array.isArray(state.filters[key])) {
                state.filters[key] = [];
            }
        });

        checkedBoxes.forEach(box => {
            const key = box.dataset.key;
            const value = box.value;
            if (state.filters[key] && !state.filters[key].includes(value)) {
                state.filters[key].push(value);
            }
        });

        fetchAndRenderProducts(false);
    }

    // ИЗМЕНЕННАЯ ГЛАВНАЯ ФУНКЦИЯ
    async function main() {
        addEventListeners();

        // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
        try {
            // Попытаемся инициализировать фильтры
            await initializeFilters(); 
        } catch (error) {
            // Если не получится - не страшно. Сообщим об ошибке и продолжим.
            console.error("Non-critical error during filter initialization:", error);
            // Можно даже скрыть блок фильтров, если он пустой
            const filtersSidebar = document.querySelector('.filters-sidebar');
            if (filtersSidebar) filtersSidebar.style.display = 'none';
        }
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

        // Теперь эта строка гарантированно выполнится, даже если фильтры сломались
        await fetchAndRenderProducts(); 
        
        loader.classList.add('hidden');
        mainContent.classList.add('loaded');
    }

    function addEventListeners() {
        filtersContainer.addEventListener('change', handleFilterChange);
        sortSelect.addEventListener('change', (e) => {
            state.sorting = e.target.value;
            fetchAndRenderProducts(false);
        });
        loadMoreBtn.addEventListener('click', () => fetchAndRenderProducts(true));
        resetFiltersBtn.addEventListener('click', () => {
            filtersContainer.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
            Object.keys(state.filters).forEach(key => {
                if (Array.isArray(state.filters[key])) state.filters[key] = [];
            });
            state.sorting = 'popularity';
            sortSelect.value = 'popularity';
            
            fetchAndRenderProducts(false);
        });

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
    }

    main();
});