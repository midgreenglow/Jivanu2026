
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger-menu');
    const mobileMenu = document.getElementById('mobile-menu-overlay');
    const root = document.documentElement;
    
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu) {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
            }
        });
    }

    const themeToggles = document.querySelectorAll('[data-theme-toggle]');
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    root.setAttribute('data-theme', initialTheme);

    themeToggles.forEach((toggle) => {
        toggle.checked = initialTheme === 'dark';
        toggle.addEventListener('change', () => {
            const nextTheme = toggle.checked ? 'dark' : 'light';
            root.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
            themeToggles.forEach((otherToggle) => {
                if (otherToggle !== toggle) {
                    otherToggle.checked = toggle.checked;
                }
            });
        });
    });
});
