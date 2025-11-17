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
// Вся логика аутентификации, корзины и т.д. остается без изменений.
// ... (здесь находится весь ваш стандартный код для showToast, addToCart, login, etc. 
// Я его не меняю, так как он не является причиной проблемы)

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

// ===============================================================
// =================== ГЛАВНЫЙ СКРИПТ КАТАЛОГА ===================
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {
    
    // Находим все необходимые элементы. Если чего-то нет, скрипт остановится здесь.
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const productsGrid = document.getElementById('products-grid');
    const productsCountEl = document.querySelector('.products-count'); // Используем querySelector для большей надежности
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (!productsGrid || !loader || !mainContent || !productsCountEl || !loadMoreBtn) {
        console.error("Critical Error: One of the main page elements is missing. Script cannot continue.");
        return; // Прекращаем выполнение, если основной разметки нет
    }

    const PRODUCTS_PER_PAGE = 12;
    let lastVisible = null; // Для пагинации
    let isLoading = false;

    async function fetchAndRenderProducts(isLoadMore = false) {
        if (isLoading) return;
        isLoading = true;
        if(loadMoreBtn) loadMoreBtn.textContent = 'Loading...';

        if (!isLoadMore) {
            productsGrid.innerHTML = '';
            lastVisible = null;
        }

        try {
            // Этот запрос мы доказали рабочим в final-check.html
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
                    
                    // Упрощенная отрисовка для теста
                    card.innerHTML = `
                        <div class="product-info" style="padding: 20px;">
                            <h3 class="product-name">${prod.name || 'No Name'}</h3>
                            <div class="product-price">$${(prod.price || 0).toFixed(2)}</div>
                        </div>
                    `;
                    productsGrid.appendChild(card);
                });

                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                if (querySnapshot.size < PRODUCTS_PER_PAGE) {
                    loadMoreBtn.style.display = 'none';
                } else {
                    loadMoreBtn.style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            productsGrid.innerHTML = '<p>An error occurred while loading products. Check the console.</p>';
        } finally {
            isLoading = false;
            if(loadMoreBtn) loadMoreBtn.textContent = 'Load More';
            loader.style.display = 'none';
            mainContent.style.opacity = '1';
        }
    }

    // Запускаем загрузку товаров
    fetchAndRenderProducts();

    // Вешаем обработчик на кнопку "Загрузить еще"
    if(loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => fetchAndRenderProducts(true));
    }
});