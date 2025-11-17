// Это финальный, окончательный тест.
// Его единственная цель - доказать, что скрипт может правильно управлять прелоадером.

document.addEventListener('DOMContentLoaded', function() {
    
    // Находим три самых важных элемента на странице
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-site-content');
    const pageTitle = document.querySelector('.page-title');

    if (loader && mainContent && pageTitle) {
        // Если все три элемента найдены...

        // 1. Меняем заголовок, чтобы подтвердить, что скрипт работает
        pageTitle.textContent = "ТЕСТ УСПЕШЕН: СТРАНИЦА ГОТОВА";
        pageTitle.style.color = "lime"; // Делаем текст ярко-зеленым

        // 2. Правильно выключаем прелоадер и показываем контент, используя классы из вашего CSS
        loader.classList.add('hidden');
        mainContent.classList.add('loaded');

    } else {
        // Этот alert сработает, только если HTML-файл снова будет поврежден
        alert("КРИТИЧЕСКАЯ ОШИБКА: Не найден loader, main-site-content или .page-title.");
    }
});