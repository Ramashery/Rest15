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
// =================== GLOBAL STATE & CONSTANTS ==================
// ===============================================================
const CART_STORAGE_KEY = 'vinoelite_cart';
const WISHLIST_STORAGE_KEY = 'vinoelite_wishlist';
let wishlistProductIds = new Set();

// ===============================================================
// =================== COMMON UI FUNCTIONS =======================
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
// =================== AUTHENTICATION LOGIC ======================
// ===============================================================

function initializeAuth() {
    const loginModal = document.getElementById('login-modal');
    const closeModalBtn = loginModal.querySelector('.close-modal-btn');
    const desktopAuthBtn = document.getElementById('auth-button');
    const mobileAuthBtn = document.getElementById('mobile-auth-button');
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const errorContainer = document.getElementById('auth-error');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const googleSigninBtn = document.getElementById('google-signin-btn');

    function openLoginModal(e) {
        if (e) e.preventDefault();
        loginModal.style.display = 'block';
    }

    function closeLoginModal() {
        loginModal.style.display = 'none';
        authForm.reset();
        errorContainer.textContent = '';
    }

    desktopAuthBtn.addEventListener('click', openLoginModal);
    mobileAuthBtn.addEventListener('click', openLoginModal);
    closeModalBtn.addEventListener('click', closeLoginModal);
    window.addEventListener('click', (e) => { if (e.target == loginModal) closeLoginModal(); });

    googleSigninBtn.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            closeLoginModal();
        } catch (error) {
            errorContainer.textContent = error.message;
        }
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
                } catch (createError) {
                    errorContainer.textContent = createError.message;
                }
            } else {
                errorContainer.textContent = error.message;
            }
        }
    });
    
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        if (!email) {
            alert('Please enter your email in the email field to reset the password.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent! Please check your inbox.');
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    onAuthStateChanged(auth, async (user) => {
        updateUIForAuthState(user);
        if (user) {
            await syncDataOnAuth(user);
        }
        await updateHeaderCounters();
    });
}

function updateUIForAuthState(user) {
    const desktopAuthBtn = document.getElementById('auth-button');
    const mobileAuthBtn = document.getElementById('mobile-auth-button');
    if (user) {
        const userName = user.displayName || user.email.split('@')[0];
        desktopAuthBtn.href = "/profile.html";
        desktopAuthBtn.innerHTML = `<i class="fas fa-user-check"></i> <span class="auth-text">${userName}</span>`;
        desktopAuthBtn.title = "My Account";
        mobileAuthBtn.href = "/profile.html";
        mobileAuthBtn.querySelector('span').textContent = userName;
    } else {
        desktopAuthBtn.href = "#";
        desktopAuthBtn.innerHTML = `<i class="far fa-user"></i> <span class="auth-text">Sign In</span>`;
        desktopAuthBtn.title = "Sign In";
        mobileAuthBtn.href = "#";
        mobileAuthBtn.querySelector('span').textContent = 'Sign In / Register';
    }
}

// ===============================================================
// =================== CART & WISHLIST LOGIC =====================
// ===============================================================

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

async function addToCart(productId, quantity = 1, buttonElement) {
    const user = auth.currentUser;
    if (user) {
        const cartItemRef = doc(db, `users/${user.uid}/cart`, productId);
        await runTransaction(db, async (transaction) => {
            const cartItemDoc = await transaction.get(cartItemRef);
            const newQuantity = cartItemDoc.exists() ? cartItemDoc.data().quantity + quantity : quantity;
            transaction.set(cartItemRef, { quantity: newQuantity, addedAt: new Date() }, { merge: true });
        });
    } else {
        let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ productId, quantity });
        }
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

// --- Homepage Logic ---
function initHomePage() {
    console.log("Initializing Homepage");
    // ... logic for hero, carousels, featured products
}

// --- Catalog Page Logic ---
function initCatalogPage() {
    console.log("Initializing Catalog Page");
    // ... all the complex filtering and sorting logic from catalog.html
}

// --- Product Detail Page Logic ---
function initProductDetailPage() {
    console.log("Initializing Product Detail Page");
    // ... logic for fetching single product, gallery, tabs, reviews
}


// ===============================================================
// =================== MAIN INITIALIZATION =======================
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');

    // Initialize components common to all pages
    initializeAuth();
    updateHeaderCounters();

    // Page-specific initializations
    if (document.getElementById('hero-section')) {
        initHomePage();
    }
    if (document.querySelector('.catalog-layout')) {
        initCatalogPage();
    }
    if (document.querySelector('.product-container')) {
        initProductDetailPage();
    }

    // General event listeners
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
        }
    });

    // Hide loader and show content
    loader.classList.add('hidden');
    mainContent.classList.add('loaded');
});