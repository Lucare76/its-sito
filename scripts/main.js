document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('site-nav');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    const whatsappPhone = '393334372831';
    const whatsappMessage = "Ciao Ischia Transfer Service, vorrei informazioni per un transfer dal Porto di Ischia a [destinazione].";

    const createWhatsAppFloat = () => {
        const whatsappLink = document.createElement('a');
        whatsappLink.href = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        whatsappLink.target = '_blank';
        whatsappLink.rel = 'noreferrer';
        whatsappLink.className = 'whatsapp-float';
        whatsappLink.setAttribute('aria-label', 'Contatta ITS su WhatsApp');
        whatsappLink.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 11.5A8 8 0 006.3 5.8 8 8 0 004.7 17.7L4 21l3.5-.9A8 8 0 1020 11.5z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.5 9.2c.2-.5.4-.5.7-.5h.6c.2 0 .4 0 .6.5.2.5.7 1.7.8 1.8.1.2.1.4 0 .6l-.4.5c-.1.2-.2.3-.1.5.1.2.5.8 1.1 1.3.8.7 1.5.9 1.7 1 .2.1.4.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2-.1 1.1-.8 1.5-.6.4-1.4.5-2 .4-.5-.1-1.2-.3-2.7-1-1.8-.9-3-2.9-3.1-3-.1-.1-.7-.9-.7-1.8 0-.8.4-1.3.6-1.5z" />
            </svg>
            <span>WhatsApp</span>
        `;

        document.body.appendChild(whatsappLink);
    };

    const syncNavState = () => {
        if (!nav) {
            return;
        }

        nav.classList.toggle('scrolled', window.scrollY > 24);
    };

    const closeMobileMenu = () => {
        if (!menuToggle || !mobileMenu) {
            return;
        }

        mobileMenu.classList.add('hidden');
        menuToggle.setAttribute('aria-expanded', 'false');
    };

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', String(!isExpanded));
            mobileMenu.classList.toggle('hidden', isExpanded);
        });
    }

    anchorLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            const targetId = link.getAttribute('href');
            const targetElement = targetId ? document.querySelector(targetId) : null;

            if (!targetElement) {
                return;
            }

            event.preventDefault();

            const offset = 110;
            const position = targetElement.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({
                top: position,
                behavior: 'smooth',
            });

            closeMobileMenu();
        });
    });

    createWhatsAppFloat();
    syncNavState();
    window.addEventListener('scroll', syncNavState, { passive: true });
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            closeMobileMenu();
        }
    });
});
