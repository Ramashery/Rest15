// ===============================================================
// DEBUGGING SCRIPT V5 - "FORCE VISIBILITY TEST"
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
screenLog("DEBUG SCRIPT V5 'FORCE VISIBILITY' IS RUNNING.", "success");

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
    return `<div style="border: 3px solid red; background-color: rgba(255,0,0,0.1); margin: 15px; padding: 15px; color: white; min-height: 100px;"><h2>PRODUCT: ${prod.name}</h2></div>`;
}

// --- Main Logic ---
async function runIndexPageLogic() {
    screenLog("Running Index Page Logic...");
    
    const productsSection = document.getElementById('products-section');
    const featuredProductsGrid = document.querySelector('#products-section .products-grid');

    if (!productsSection || !featuredProductsGrid) {
        screenLog("FATAL ERROR: Could not find '#products-section' or '.products-grid' inside it.", "error");
        return;
    }
    screenLog("Found both section and grid containers.", "success");

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!! THE MOST IMPORTANT PART !!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    screenLog("Forcing containers to be visible with inline styles...", "info");
    const forceVisibleStyles = `
        display: block !important; 
        visibility: visible !important; 
        opacity: 1 !important; 
        height: auto !important; 
        overflow: visible !important;
        border: 5px dashed limegreen;
    `;
    productsSection.style.cssText = forceVisibleStyles;
    featuredProductsGrid.style.cssText = forceVisibleStyles;
    screenLog("Force-visibility styles applied to both containers.", "success");
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

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
        const finalHTML = productsToDisplay.map(createRedBoxHTML).join('');
        
        screenLog("Inserting HTML into the now-visible grid...", "info");
        featuredProductsGrid.innerHTML = finalHTML;
        screenLog("INSERTION COMPLETE. LIME GREEN BOXES WITH RED BOXES INSIDE SHOULD BE VISIBLE.", "success");

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