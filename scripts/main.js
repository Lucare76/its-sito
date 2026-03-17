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
            heroSuccess: (reference) => `Request sent successfully (${reference}). Next step: our team checks route and timing, then sends confirmation and pickup details.`,
            contactSuccess: (reference) => `Request sent successfully (${reference}). Next step: we verify availability and contact you shortly with operational confirmation.`,
        }
        : {
            bookingUnavailable: 'Prenotazione online non disponibile su questa pagina statica. Contattaci su WhatsApp per assistenza immediata.',
            bookingSaveError: 'Si e verificato un errore durante l invio della richiesta. Riprova tra poco.',
            heroRequired: 'Compila nome, email, servizio, data e tratta prima di inviare la richiesta.',
            contactRequired: 'Compila tutti i campi obbligatori prima di inviare.',
            sending: 'Invio richiesta in corso...',
            heroSuccess: (reference) => `Richiesta inviata con successo (${reference}). Prossimo passaggio: verifichiamo tratta e orari, poi ricevi conferma operativa e dettagli pickup.`,
            contactSuccess: (reference) => `Richiesta inviata con successo (${reference}). Prossimo passaggio: controlliamo disponibilita e ti rispondiamo a breve con conferma operativa.`,
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
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 8.034.001C3.708.001.188 3.522.187 7.848A7.84 7.84 0 0 0 1.248 11.8L.004 16l4.298-1.129a7.85 7.85 0 0 0 3.731.95h.003c4.325 0 7.846-3.521 7.847-7.847a7.84 7.84 0 0 0-2.282-5.648zm-5.565 12.17h-.003a6.55 6.55 0 0 1-3.339-.913l-.24-.142-2.55.669.68-2.487-.156-.255a6.53 6.53 0 0 1-1.006-3.52c.001-3.6 2.93-6.529 6.532-6.529a6.5 6.5 0 0 1 4.637 1.92 6.5 6.5 0 0 1 1.912 4.638c-.001 3.601-2.93 6.529-6.531 6.529zm3.58-4.892c-.196-.098-1.164-.574-1.345-.639-.18-.066-.311-.098-.443.098-.131.197-.508.639-.623.771-.115.131-.229.147-.426.049-.197-.099-.832-.307-1.585-.98-.586-.523-.982-1.17-1.097-1.367-.114-.197-.012-.304.086-.402.088-.088.197-.229.295-.344.098-.115.131-.197.197-.328.065-.132.032-.246-.017-.344-.05-.099-.443-1.066-.607-1.459-.16-.386-.323-.333-.443-.339h-.377c-.131 0-.344.05-.525.246s-.688.672-.688 1.64c0 .967.705 1.902.803 2.033.098.131 1.389 2.121 3.365 2.973.47.203.837.324 1.123.415.472.15.901.129 1.241.078.379-.056 1.164-.476 1.328-.935.163-.459.163-.853.114-.934-.05-.082-.18-.131-.377-.23z"/>
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

    const syncHeroOffset = () => {
        if (!nav) {
            return;
        }

        const navHeight = Math.ceil(nav.getBoundingClientRect().height || 0);
        const extraOffset = window.innerWidth < 640 ? 18 : 24;
        const safeOffset = Math.max(96, navHeight + extraOffset);
        document.documentElement.style.setProperty('--hero-safe-offset', `${safeOffset}px`);
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

            const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 92;
            const offset = navHeight + 16;
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
    syncHeroOffset();
    syncNavState();
    window.addEventListener('scroll', syncNavState, { passive: true });
    window.addEventListener('resize', () => {
        syncHeroOffset();
        if (window.innerWidth >= 1024) {
            closeMobileMenu();
        }
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncHeroOffset, { passive: true });
    }
});
