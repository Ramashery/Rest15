// ===============================================================
// DEBUGGING SCRIPT V6 - "HELLO WORLD TEST"
// ===============================================================

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

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    screenLog("DEBUG SCRIPT V6 'HELLO WORLD' IS RUNNING.", "success");
    
    try {
        screenLog("Attempting to create and append a red H1 element to the body...", "info");

        // 1. Create a new H1 element
        const helloElement = document.createElement('h1');

        // 2. Set its content
        helloElement.textContent = "HELLO WORLD! IF YOU SEE THIS, JAVASCRIPT CAN MODIFY THE PAGE.";

        // 3. Style it to be unmissable
        helloElement.style.position = 'fixed';
        helloElement.style.top = '50%';
        helloElement.style.left = '50%';
        helloElement.style.transform = 'translate(-50%, -50%)';
        helloElement.style.padding = '20px';
        helloElement.style.backgroundColor = 'red';
        helloElement.style.color = 'white';
        helloElement.style.zIndex = '10000';
        helloElement.style.textAlign = 'center';

        // 4. Append it to the document body
        document.body.appendChild(helloElement);

        screenLog("appendChild command executed without errors. The red box should be visible.", "success");

    } catch (error) {
        screenLog(`An error occurred: ${error.message}`, "error");
    }

    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';
});