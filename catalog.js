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
// =================== SHARED UI/AUTH LOGIC ======================
// ===============================================================
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

const CART_STORAGE_KEY = 'vinoelite_cart';
const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist';
let wishlistProductIds = new Set();

async function updateHeaderCounters() {
    const user = auth.currentUser;
    let cartItemCount = 0;
    let wishlistItemCount = 0;

    if (user) {
        try {
            const cartSnapshot = await getDocs(collection(db, `users/${user.uid}/cart`));
            cartSnapshot.forEach(doc => { cartItemCount += doc.data().quantity; });
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().wishlist) {
                wishlistItemCount = userDoc.data().wishlist.length;
                wishlistProductIds = new Set(userDoc.data().wishlist);
            }
        } catch (e) { console.error("Error updating counters:", e); }
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
            if (icon) { icon.classList.remove('far'); icon.classList.add('fas'); }
        } else {
            btn.classList.remove('active');
            if (icon) { icon.classList.remove('fas'); icon.classList.add('far'); }
        }
    });
}

// ... (Остальные функции auth, cart, wishlist остаются без изменений)

// ===============================================================
// =================== ГЛАВНЫЙ СКРИПТ КАТАЛОГА ===================
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {

    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const productsGrid = document.getElementById('products-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (!productsGrid) {
        console.error("CRITICAL ERROR: Element with id='products-grid' was not found.");
        if(loader) loader.classList.add('hidden');
        return;
    }

    const PRODUCTS_PER_PAGE = 12;
    let lastVisible = null;
    let isLoading = false;

    async function fetchAndRenderProducts(isLoadMore = false) {
        if (isLoading) return;
        isLoading = true;
        if (loadMoreBtn) loadMoreBtn.textContent = 'Loading...';

        if (!isLoadMore) {
            productsGrid.innerHTML = '';
            lastVisible = null;
        }

        try {
            let q = query(
                collection(db, "products"),
                where("isArchived", "==", false),
                orderBy("popularity", "desc"),
                limit(PRODUCTS_PER_PAGE)
            );

            if (isLoadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty && !isLoadMore) {
                productsGrid.innerHTML = '<p>No products found.</p>';
            } else {
                querySnapshot.forEach(doc => {
                    const prod = { id: doc.id, ...doc.data() };
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    
                    const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
                    const slidesHTML = imageUrls.map((url, index) => `<div class="slideshow-item"><img src="${url}" alt="${prod.name || ''} view ${index + 1}"></div>`).join('');

                    card.innerHTML = `
                        <div class="slideshow-container">
                            ${slidesHTML}
                            ${prod.badge ? `<div class="product-badge">${prod.badge}</div>` : ''}
                            <button class="wishlist-toggle-btn" data-product-id="${prod.id}"><i class="far fa-heart"></i></button>
                        </div>
                        <div class="product-info">
                            <div>
                                <div class="product-subtitle">${prod.category || ''}</div>
                                <h3 class="product-name">${prod.name || 'No Name'}</h3>
                                <p class="product-description">${prod.metaDescription || ''}</p>
                            </div>
                            <div class="product-price">
                                <div class="price">$${(prod.price || 0).toFixed(2)}</div>
                                ${prod.oldPrice ? `<div class="old-price">$${prod.oldPrice.toFixed(2)}</div>` : ''}
                            </div>
                            <button class="add-to-cart-btn" data-product-id="${prod.id}"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
                        </div>
                    `;
                    productsGrid.appendChild(card);
                });

                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

                if (querySnapshot.size < PRODUCTS_PER_PAGE) {
                    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                } else {
                    if (loadMoreBtn) loadMoreBtn.style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            productsGrid.innerHTML = `<p style="color:red;">An error occurred: ${error.message}</p>`;
        } finally {
            isLoading = false;
            if (loadMoreBtn) loadMoreBtn.textContent = 'Load More';
            
            // --- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ---
            // Используем классы из вашего CSS для правильного отображения
            if (loader) loader.classList.add('hidden');
            if (mainContent) mainContent.classList.add('loaded');
            // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
        }
    }

    fetchAndRenderProducts();

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => fetchAndRenderProducts(true));
    }
    
    // Инициализируем счетчики в шапке
    updateHeaderCounters();
});