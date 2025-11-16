// ===============================================================
// DEBUGGING SCRIPT V3 - FINAL ATTEMPT
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
    p.style.zIndex = '9999';
    p.style.position = 'relative';
    p.style.borderBottom = '1px solid #444';
    if (type === 'success') p.style.color = '#2ecc71';
    else if (type === 'error') p.style.color = '#e74c3c';
    else p.style.color = '#3498db';
    p.innerHTML = `<strong>[${type.toUpperCase()}]</strong> ${message}`;
    logContainer.prepend(p);
}

// --- Start Execution ---
screenLog("DEBUG SCRIPT V3 IS RUNNING. If you see this, the cache is clear.", "success");

let db;

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
    db = getFirestore(app);
    screenLog("Firebase app initialized successfully.", "success");

} catch (e) {
    screenLog(`CRITICAL: Firebase initialization failed. Error: ${e.message}`, "error");
    throw new Error("Firebase init failed");
}

// --- Simplified Product Card HTML Generator ---
function createSimpleProductCardHTML(prod) {
    if (!prod || !prod.name) return '';
    const imageUrls = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls : [prod.imageUrl];
    return `
    <div style="border: 2px solid #2ecc71; margin: 10px; padding: 10px; color: white;">
        <img src="${imageUrls[0]}" alt="${prod.name}" style="width:100px; height: 100px; object-fit: cover;">
        <p>${prod.name}</p>
        <p>$${prod.price}</p>
    </div>`;
}

// --- Main Logic ---
async function runIndexPageLogic() {
    screenLog("Running Index Page Logic...");
    
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');
    if (!featuredProductsGrid) {
        screenLog("FATAL ERROR: Could not find container '#products-section .products-grid'. Check your index.html.", "error");
        return;
    }
    screenLog("Found product grid container.", "success");

    try {
        screenLog("Fetching products from Firestore...");
        const productsQuery = query(collection(db, "products"), where("isArchived", "==", false));
        const querySnapshot = await getDocs(productsQuery);
        
        if (querySnapshot.empty) {
            screenLog("Query successful, but 'products' collection is empty.", "error");
            featuredProductsGrid.innerHTML = "<p>No products found.</p>";
            return;
        }

        const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        screenLog(`Fetched ${allProducts.length} products.`, "success");

        const featuredProducts = allProducts.filter(p => p.isFeatured).slice(0, 4);
        screenLog(`Found ${featuredProducts.length} featured products. Generating HTML...`, "info");

        let finalHTML = '';
        if (featuredProducts.length > 0) {
            finalHTML = featuredProducts.map(createSimpleProductCardHTML).join('');
        } else {
            screenLog("No featured products. Using first 4 products as fallback.", "info");
            finalHTML = allProducts.slice(0, 4).map(createSimpleProductCardHTML).join('');
        }
        
        if (finalHTML.length > 0) {
            screenLog("HTML generated. Inserting into the page...", "info");
            featuredProductsGrid.innerHTML = finalHTML;
            screenLog("CONTENT SHOULD BE VISIBLE NOW!", "success");
        } else {
            screenLog("Generated HTML is empty. No products to display.", "error");
        }

    } catch (error) {
        screenLog(`ERROR during fetch/render: ${error.message}`, "error");
        if (featuredProductsGrid) {
            featuredProductsGrid.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    screenLog("DOMContentLoaded event fired.");
    
    if (document.getElementById('hero-section')) {
        runIndexPageLogic();
    } else {
        screenLog("Not on index page.");
    }

    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';
});