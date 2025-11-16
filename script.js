// ===============================================================
// DEBUGGING SCRIPT V4 - "THE RED BOX TEST"
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Helper function to log directly to the screen ---
function screenLog(message, type = 'info') {
    const logContainer = document.body;
    const p = document.createElement('p');
    p.style.fontFamily = 'monospace';
    p.style.padding = '5px';
    p.style.margin = '0';
    p.style.zIndex = '9999';
    p.style.position = 'relative';
    p.style.backgroundColor = '#111';
    p.style.borderBottom = '1px solid #444';
    if (type === 'success') p.style.color = '#2ecc71';
    else if (type === 'error') p.style.color = '#e74c3c';
    else p.style.color = '#3498db';
    p.innerHTML = `<strong>[${type.toUpperCase()}]</strong> ${message}`;
    logContainer.prepend(p);
}

// --- Start Execution ---
screenLog("DEBUG SCRIPT V4 'RED BOX' IS RUNNING.", "success");

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

// --- Ultra-Simple Product Card HTML Generator ---
function createRedBoxHTML(prod) {
    if (!prod || !prod.name) return '';
    const imageUrl = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls[0] : prod.imageUrl;
    return `
    <div style="border: 3px solid red; background-color: rgba(255,0,0,0.1); margin: 15px; padding: 15px; color: white; min-height: 100px;">
        <h2 style="color: red;">I AM A PRODUCT CARD</h2>
        <p>Name: ${prod.name}</p>
        <p>Price: $${prod.price}</p>
        <img src="${imageUrl}" style="width: 50px; height: 50px;">
    </div>`;
}

// --- Main Logic ---
async function runIndexPageLogic() {
    screenLog("Running Index Page Logic...");
    
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');
    if (!featuredProductsGrid) {
        screenLog("FATAL ERROR: Could not find container '#products-section .products-grid'.", "error");
        return;
    }
    screenLog("Found product grid container.", "success");

    try {
        screenLog("Fetching products from Firestore...");
        const productsQuery = query(collection(db, "products"), where("isArchived", "==", false));
        const querySnapshot = await getDocs(productsQuery);
        
        if (querySnapshot.empty) {
            screenLog("Query successful, but 'products' collection is empty.", "error");
            return;
        }

        const allProducts = querySnapshot.docs.map(doc => doc.data());
        screenLog(`Fetched ${allProducts.length} products.`, "success");

        const productsToDisplay = allProducts.slice(0, 4);
        screenLog(`Generating HTML for ${productsToDisplay.length} red boxes...`, "info");

        // Add a very obvious title before the products
        let finalHTML = '<h1 style="color: red; text-align: center; font-size: 36px;">IF YOU SEE THIS, SCROLL DOWN FOR RED BOXES</h1>';
        finalHTML += productsToDisplay.map(createRedBoxHTML).join('');
        
        screenLog("HTML generated. Inserting into the page...", "info");
        featuredProductsGrid.innerHTML = finalHTML;
        screenLog("INSERTION COMPLETE. SCROLL DOWN AND CHECK FOR RED BOXES.", "success");

    } catch (error) {
        screenLog(`ERROR during fetch/render: ${error.message}`, "error");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    screenLog("DOMContentLoaded event fired.");
    
    if (document.getElementById('hero-section')) {
        runIndexPageLogic();
    }

    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';
});