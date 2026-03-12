document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('site-nav');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    const heroBookingForm = document.getElementById('hero-booking-form');
    const heroBookingSubmit = document.getElementById('hero-booking-submit');
    const heroBookingFeedback = document.getElementById('hero-booking-feedback');
    const contactForm = document.getElementById('contact-form');
    const contactFeedback = document.getElementById('contact-feedback');
    const whatsappPhone = '393334372831';
    const language = document.documentElement.lang === 'en' ? 'en' : 'it';
    const whatsappMessage = language === 'en'
        ? 'Hello Ischia Transfer Service, I would like information about a private transfer from [pickup] to [destination].'
        : "Ciao Ischia Transfer Service, vorrei informazioni per un transfer privato da [partenza] a [destinazione].";

    const setFeedback = (element, message, type) => {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.remove('text-red-500', 'text-green-600', 'text-blue-100', 'text-gray-600');
        if (type === 'error') {
            element.classList.add('text-red-500');
            return;
        }
        if (type === 'success') {
            element.classList.add('text-green-600');
            return;
        }
        element.classList.add('text-gray-600');
    };

    const postBooking = async (payload) => {
        let response;

        try {
            response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            const fallbackMessage = language === 'en'
                ? 'Online booking is unavailable on this static page. Contact us on WhatsApp for immediate assistance.'
                : 'Prenotazione online non disponibile su questa pagina statica. Contattaci su WhatsApp per assistenza immediata.';
            throw new Error(fallbackMessage);
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Errore durante il salvataggio della prenotazione');
        }

        return data.booking;
    };

    const createWhatsAppFloat = () => {
        const whatsappLink = document.createElement('a');
        whatsappLink.href = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        whatsappLink.target = '_blank';
        whatsappLink.rel = 'noreferrer';
        whatsappLink.className = 'whatsapp-float';
        whatsappLink.setAttribute(
            'aria-label',
            language === 'en' ? 'Contact ITS on WhatsApp' : 'Contatta ITS su WhatsApp',
        );
        whatsappLink.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 11.5A8 8 0 006.3 5.8 8 8 0 004.7 17.7L4 21l3.5-.9A8 8 0 1020 11.5z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.5 9.2c.2-.5.4-.5.7-.5h.6c.2 0 .4 0 .6.5.2.5.7 1.7.8 1.8.1.2.1.4 0 .6l-.4.5c-.1.2-.2.3-.1.5.1.2.5.8 1.1 1.3.8.7 1.5.9 1.7 1 .2.1.4.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2-.1 1.1-.8 1.5-.6.4-1.4.5-2 .4-.5-.1-1.2-.3-2.7-1-1.8-.9-3-2.9-3.1-3-.1-.1-.7-.9-.7-1.8 0-.8.4-1.3.6-1.5z" />
            </svg>
            <span>${language === 'en' ? 'Chat Now' : 'WhatsApp'}</span>
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

    if (heroBookingForm) {
        heroBookingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(heroBookingForm);
            const service = String(formData.get('hero-service') || '').trim();
            const name = String(formData.get('hero-name') || '').trim();
            const email = String(formData.get('hero-email') || '').trim();
            const date = String(formData.get('hero-date') || '').trim();
            const time = String(formData.get('hero-time') || '').trim();
            const route = String(formData.get('hero-route') || '').trim();
            const website = String(formData.get('website') || '').trim();

            if (!service || !name || !email || !date || !route) {
                setFeedback(heroBookingFeedback, 'Compila nome, email, servizio, data e tratta per inviare la richiesta.', 'error');
                return;
            }

            setFeedback(heroBookingFeedback, 'Invio richiesta in corso...', 'info');
            if (heroBookingSubmit) {
                heroBookingSubmit.disabled = true;
            }

            try {
                const booking = await postBooking({
                    service,
                    route,
                    date,
                    time,
                    name,
                    email,
                    details: 'Richiesta rapida inviata da widget hero.',
                    source: 'PUBLIC_HERO_WIDGET',
                    website,
                });

                setFeedback(
                    heroBookingFeedback,
                    `Ecco fatto! Abbiamo ricevuto la tua richiesta (${booking.reference}). Il nostro team ti rispondera a breve per confermare il transfer.`,
                    'success',
                );
                heroBookingForm.reset();
            } catch (error) {
                setFeedback(heroBookingFeedback, error.message, 'error');
            } finally {
                if (heroBookingSubmit) {
                    heroBookingSubmit.disabled = false;
                }
            }
        });
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(contactForm);
            const payload = {
                name: String(formData.get('name') || '').trim(),
                email: String(formData.get('email') || '').trim(),
                route: String(formData.get('route') || '').trim(),
                date: String(formData.get('date') || '').trim(),
                details: String(formData.get('details') || '').trim(),
                website: String(formData.get('website') || '').trim(),
                service: 'Richiesta Transfer da Form Contatti',
                source: 'PUBLIC_CONTACT_FORM',
            };

            if (!payload.name || !payload.email || !payload.route || !payload.date) {
                setFeedback(contactFeedback, 'Compila tutti i campi obbligatori prima di inviare.', 'error');
                return;
            }

            setFeedback(contactFeedback, 'Invio richiesta in corso...', 'info');

            try {
                const booking = await postBooking(payload);
                setFeedback(
                    contactFeedback,
                    `Ecco fatto! Abbiamo ricevuto la tua richiesta (${booking.reference}). Il nostro team ti rispondera a breve per confermare il transfer.`,
                    'success',
                );
                contactForm.reset();
            } catch (error) {
                setFeedback(contactFeedback, error.message, 'error');
            }
        });
    }

    createWhatsAppFloat();
    syncNavState();
    window.addEventListener('scroll', syncNavState, { passive: true });
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            closeMobileMenu();
        }
    });
});
