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
    const messages = language === 'en'
        ? {
            bookingUnavailable: 'Online booking is unavailable on this static page. Contact us on WhatsApp for immediate assistance.',
            bookingSaveError: 'An error occurred while sending your request. Please try again.',
            heroRequired: 'Please fill in name, email, service, date and route before sending your request.',
            contactRequired: 'Please complete all required fields before sending.',
            sending: 'Sending your request...',
            heroSuccess: (reference) => `Request sent successfully (${reference}). We will contact you shortly to confirm every transfer detail.`,
            contactSuccess: (reference) => `Request sent successfully (${reference}). Our team will get back to you shortly with confirmation and next steps.`,
        }
        : {
            bookingUnavailable: 'Prenotazione online non disponibile su questa pagina statica. Contattaci su WhatsApp per assistenza immediata.',
            bookingSaveError: 'Si e verificato un errore durante l invio della richiesta. Riprova tra poco.',
            heroRequired: 'Compila nome, email, servizio, data e tratta prima di inviare la richiesta.',
            contactRequired: 'Compila tutti i campi obbligatori prima di inviare.',
            sending: 'Invio richiesta in corso...',
            heroSuccess: (reference) => `Richiesta inviata con successo (${reference}). Ti contatteremo a breve per confermare ogni dettaglio del transfer.`,
            contactSuccess: (reference) => `Richiesta inviata con successo (${reference}). Il nostro team ti rispondera a breve con conferma e prossimi passaggi.`,
        };

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
            throw new Error(messages.bookingUnavailable);
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || messages.bookingSaveError);
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
        document.removeEventListener('keydown', trapMenuFocus);
    };

    const getFocusableElements = (container) => {
        if (!container) {
            return [];
        }
        return Array.from(
            container.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        );
    };

    const trapMenuFocus = (event) => {
        if (!mobileMenu || mobileMenu.classList.contains('hidden')) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeMobileMenu();
            if (menuToggle) {
                menuToggle.focus();
            }
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = getFocusableElements(mobileMenu);
        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                closeMobileMenu();
                return;
            }

            menuToggle.setAttribute('aria-expanded', 'true');
            mobileMenu.classList.remove('hidden');
            document.addEventListener('keydown', trapMenuFocus);
            const focusable = getFocusableElements(mobileMenu);
            if (focusable.length) {
                focusable[0].focus();
            }
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
                setFeedback(heroBookingFeedback, messages.heroRequired, 'error');
                return;
            }

            setFeedback(heroBookingFeedback, messages.sending, 'info');
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
                    messages.heroSuccess(booking.reference),
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
                setFeedback(contactFeedback, messages.contactRequired, 'error');
                return;
            }

            setFeedback(contactFeedback, messages.sending, 'info');

            try {
                const booking = await postBooking(payload);
                setFeedback(
                    contactFeedback,
                    messages.contactSuccess(booking.reference),
                    'success',
                );
                contactForm.reset();
            } catch (error) {
                setFeedback(contactFeedback, error.message, 'error');
            }
        });
    }

    const revealTargets = Array.from(
        document.querySelectorAll('main section:not(#hero), .booking-card, .service-card, .fleet-card, .benefit-card, .utility-card, .contact-card, .cta-banner, .site-footer'),
    );

    if (revealTargets.length) {
        revealTargets.forEach((element) => element.classList.add('reveal'));
        const observer = new IntersectionObserver((entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                entry.target.classList.add('is-visible');
                currentObserver.unobserve(entry.target);
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -8% 0px',
        });

        revealTargets.forEach((element) => observer.observe(element));
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
