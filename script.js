// ===============================================================
// DEBUGGING SCRIPT V2
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Helper function to log directly to the screen ---
function screenLog(message, type = 'info') {
    const logContainer = document.body;
    const p = document.createElement('p');
    p.style.fontFamily = 'monospace';
    p.style.padding = '5px';
    p.style.margin = '0';
    p.style.borderBottom = '1px solid #444';
    if (type === 'success') p.style.color = '#2ecc71';
    else if (type === 'error') p.style.color = '#e74c3c';
    else p.style.color = '#3498db';
    p.innerHTML = `<strong>[${type.toUpperCase()}]</strong> ${message}`;
    logContainer.prepend(p); // Prepend to see logs at the top
}

screenLog("Script execution started.");

try {
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
    screenLog("Firebase app initialized successfully.", "success");

} catch (e) {
    screenLog(`CRITICAL: Firebase initialization failed. Error: ${e.message}`, "error");
    // Stop execution if Firebase fails
    throw new Error("Firebase init failed");
}

// --- Universal Product Card HTML Generator ---
function createProductCardHTML(prod) {
    if (!prod || !prod.slug || !prod.category) {
        screenLog(`Skipping product card generation due to missing data: ${JSON.stringify(prod)}`, "error");
        return '';
    }
    const productUrl = `/product.html?slug=${prod.slug}`;
    const imageUrls = (prod.imageUrls && Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
    
    return `
    <div class="product-card" data-url="${productUrl}" style="border: 2px solid green; margin: 10px;">
        <img src="${imageUrls[0]}" alt="${prod.name}" style="width:100%; height: 200px; object-fit: cover;">
        <div class="product-info">
            <h3 class="product-name">${prod.name}</h3>
            <div class="price">$${prod.price.toFixed(2)}</div>
        </div>
    </div>`;
}

// --- Page-Specific Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    screenLog("DOMContentLoaded event fired. Page is ready.");

    // Check if we are on the index page
    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
        screenLog("Index page detected (found #hero-section).");

        const featuredProductsGrid = document.querySelector('#products-section .products-grid');
        if (!featuredProductsGrid) {
            screenLog("Could not find the featured products grid container '#products-section .products-grid'.", "error");
            return;
        }
        screenLog("Found featured products grid container.", "success");

        try {
            screenLog("Attempting to fetch all products from Firebase...");
            const productsQuery = query(collection(db, "products"), where("isArchived", "==", false));
            const querySnapshot = await getDocs(productsQuery);
            
            if (querySnapshot.empty) {
                screenLog("Firebase query returned no products.", "error");
                featuredProductsGrid.innerHTML = "<p>No products found in the database.</p>";
                return;
            }

            const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            screenLog(`Successfully fetched ${allProducts.length} products from Firebase.`, "success");

            const featuredProducts = allProducts.filter(p => p.isFeatured).slice(0, 4);
            screenLog(`Found ${featuredProducts.length} featured products.`, "info");

            if (featuredProducts.length > 0) {
                screenLog("Generating HTML for featured products...");
                featuredProductsGrid.innerHTML = featuredProducts.map(createProductCardHTML).join('');
                screenLog("HTML for featured products has been inserted into the page.", "success");
            } else {
                screenLog("No featured products found. Displaying first 4 products instead.", "info");
                const fallbackProducts = allProducts.slice(0, 4);
                featuredProductsGrid.innerHTML = fallbackProducts.map(createProductCardHTML).join('');
                screenLog("HTML for fallback products has been inserted.", "success");
            }

        } catch (error) {
            screenLog(`An error occurred while fetching or rendering products: ${error.message}`, "error");
            if (featuredProductsGrid) {
                featuredProductsGrid.innerHTML = `<p style="color: red;">Error loading products: ${error.message}</p>`;
            }
        }
    } else {
        screenLog("Not on the index page (did not find #hero-section).");
    }

    // Hide loader
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';
});