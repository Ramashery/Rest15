// ===============================================================
// =================== FIREBASE INITIALIZATION ===================
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// ===============================================================
// =================== ГЛАВНЫЙ СКРИПТ КАТАЛОГА ===================
// ===============================================================
document.addEventListener('DOMContentLoaded', function() {

    // Находим ключевые элементы на странице
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const productsGrid = document.getElementById('products-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    // Если основной контейнер для товаров не найден, прекращаем работу
    if (!productsGrid) {
        console.error("CRITICAL ERROR: Element with id='products-grid' was not found. Script cannot continue.");
        return;
    }

    const PRODUCTS_PER_PAGE = 12;
    let lastVisible = null; // Для отслеживания последнего загруженного товара
    let isLoading = false;

    // Основная функция для загрузки и отображения товаров
    async function fetchAndRenderProducts(isLoadMore = false) {
        if (isLoading) return;
        isLoading = true;
        if (loadMoreBtn) loadMoreBtn.textContent = 'Loading...';

        if (!isLoadMore) {
            productsGrid.innerHTML = ''; // Очищаем сетку перед новым поиском
            lastVisible = null;
        }

        try {
            // Создаем запрос, который мы доказали рабочим
            let q = query(
                collection(db, "products"),
                where("isArchived", "==", false),
                orderBy("popularity", "desc"),
                limit(PRODUCTS_PER_PAGE)
            );

            // Если это "загрузка еще", добавляем курсор
            if (isLoadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty && !isLoadMore) {
                productsGrid.innerHTML = '<p>No products found.</p>';
            } else {
                // Отрисовываем каждый товар
                querySnapshot.forEach(doc => {
                    const prod = { id: doc.id, ...doc.data() };
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    
                    // Используем полную, красивую отрисовку карточки
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

                // Обновляем курсор для следующей загрузки
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

                // Прячем кнопку "Загрузить еще", если товаров больше нет
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
            if (loader) loader.style.display = 'none';
            if (mainContent) mainContent.style.opacity = '1';
        }
    }

    // Запускаем первую загрузку товаров
    fetchAndRenderProducts();

    // Вешаем обработчик на кнопку "Загрузить еще"
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => fetchAndRenderProducts(true));
    }
});