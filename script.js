// Создаем очень заметный элемент, чтобы проверить, выполняется ли скрипт
const diagnosticDiv = document.createElement('div');
diagnosticDiv.innerHTML = '✅ ФАЙЛ SCRIPT.JS УСПЕШНО ПОДКЛЮЧЕН!';
diagnosticDiv.style.backgroundColor = '#28a745';
diagnosticDiv.style.color = 'white';
diagnosticDiv.style.padding = '30px';
diagnosticDiv.style.textAlign = 'center';
diagnosticDiv.style.fontWeight = 'bold';
diagnosticDiv.style.fontSize = '20px';
diagnosticDiv.style.position = 'fixed';
diagnosticDiv.style.top = '0';
diagnosticDiv.style.left = '0';
diagnosticDiv.style.width = '100%';
diagnosticDiv.style.zIndex = '99999';
document.body.prepend(diagnosticDiv);

console.log("--- SCRIPT.JS CONNECTION TEST EXECUTED ---");