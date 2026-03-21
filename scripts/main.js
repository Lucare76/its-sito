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
    const storageKeys = {
        utm: 'its_utm_params',
        sessionId: 'its_session_id',
        contactDraft: 'its_contact_form_draft',
        heroDraft: 'its_hero_form_draft',
        openedForms: 'its_opened_forms',
    };
    const language = document.documentElement.lang === 'en' ? 'en' : 'it';
    const whatsappMessage = language === 'en'
        ? 'Hello Ischia Transfer Service, I would like information about a private transfer from [pickup] to [destination].'
        : "Ciao Ischia Transfer Service, vorrei informazioni per un transfer privato da [partenza] a [destinazione].";
    const messages = language === 'en'
        ? {
            bookingUnavailable: 'Online booking is unavailable on this static page. Contact us on WhatsApp for immediate assistance.',
            bookingSaveError: 'An error occurred while sending your request. Please try again.',
            heroRequired: 'Please fill in name, email, service, route, date and passenger count before sending your request.',
            contactRequired: 'Please complete name, email, route, date and passenger count before sending.',
            invalidEmail: 'Please enter a valid email address.',
            sending: 'Sending your request...',
            heroSuccess: (reference) => `Request sent successfully (${reference}). Next step: our team checks route and timing, then sends confirmation and pickup details.`,
            contactSuccess: (reference) => `Request sent successfully (${reference}). Next step: we verify availability and contact you shortly with operational confirmation.`,
        }
        : {
            bookingUnavailable: 'Prenotazione online non disponibile su questa pagina statica. Contattaci su WhatsApp per assistenza immediata.',
            bookingSaveError: 'Si e verificato un errore durante l invio della richiesta. Riprova tra poco.',
            heroRequired: 'Compila nome, email, servizio, tratta, data e numero persone prima di inviare la richiesta.',
            contactRequired: 'Compila nome, email, tratta, data e numero persone prima di inviare.',
            invalidEmail: 'Inserisci un indirizzo email valido.',
            sending: 'Invio richiesta in corso...',
            heroSuccess: (reference) => `Richiesta inviata con successo (${reference}). Prossimo passaggio: verifichiamo tratta e orari, poi ricevi conferma operativa e dettagli pickup.`,
            contactSuccess: (reference) => `Richiesta inviata con successo (${reference}). Prossimo passaggio: controlliamo disponibilita e ti rispondiamo a breve con conferma operativa.`,
        };

    const safeStorage = {
        get(key) {
            try {
                return window.sessionStorage.getItem(key);
            } catch (error) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.sessionStorage.setItem(key, value);
            } catch (error) {
                // Ignore storage write failures.
            }
        },
        remove(key) {
            try {
                window.sessionStorage.removeItem(key);
            } catch (error) {
                // Ignore storage removal failures.
            }
        },
    };

    const getQueryUtm = () => {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: String(params.get('utm_source') || '').trim(),
            utm_medium: String(params.get('utm_medium') || '').trim(),
            utm_campaign: String(params.get('utm_campaign') || '').trim(),
        };
    };

    const normalizeUtm = (utm) => ({
        utm_source: String(utm.utm_source || '').trim(),
        utm_medium: String(utm.utm_medium || '').trim(),
        utm_campaign: String(utm.utm_campaign || '').trim(),
    });

    const saveUtmParams = () => {
        const current = getQueryUtm();
        if (!current.utm_source && !current.utm_medium && !current.utm_campaign) {
            return;
        }
        safeStorage.set(storageKeys.utm, JSON.stringify(current));
    };

    const getStoredUtm = () => {
        const raw = safeStorage.get(storageKeys.utm);
        if (!raw) {
            return normalizeUtm({});
        }
        try {
            return normalizeUtm(JSON.parse(raw));
        } catch (error) {
            return normalizeUtm({});
        }
    };

    const getSessionId = () => {
        const existing = safeStorage.get(storageKeys.sessionId);
        if (existing) {
            return existing;
        }
        const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        safeStorage.set(storageKeys.sessionId, generated);
        return generated;
    };

    const getDeviceType = () => {
        const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
        if (width > 0 && width < 768) {
            return 'mobile';
        }
        if (width >= 768 && width < 1024) {
            return 'tablet';
        }
        return 'desktop';
    };

    const sendTrackingPayload = (payload) => {
        const body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/analytics-events', blob);
            return;
        }

        fetch('/api/analytics-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
            keepalive: true,
        }).catch(() => {
            // Ignore analytics network failures.
        });
    };

    const trackEvent = (eventName, params = {}) => {
        const utm = getStoredUtm();
        const payload = {
            event: eventName,
            session_id: getSessionId(),
            lang: language,
            device_type: getDeviceType(),
            page_path: window.location.pathname,
            page_title: document.title,
            utm,
            ...params,
        };

        if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push(payload);
        }

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }

        sendTrackingPayload(payload);
    };

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

    const trackFormError = ({ formId, errorType, errorMessage, missingFields = [] }) => {
        trackEvent('form_error', {
            form_id: formId,
            funnel_step: 'form_submit',
            error_type: errorType,
            error_message: errorMessage,
            missing_fields: missingFields,
        });
    };

    const markFormOpened = (formId, source) => {
        const raw = safeStorage.get(storageKeys.openedForms);
        let opened = [];
        try {
            opened = raw ? JSON.parse(raw) : [];
        } catch (error) {
            opened = [];
        }

        if (opened.includes(formId)) {
            return;
        }

        opened.push(formId);
        safeStorage.set(storageKeys.openedForms, JSON.stringify(opened));
        trackEvent('form_open', {
            form_id: formId,
            source,
            funnel_step: 'form_open',
        });
    };

    const bindFormOpenTracking = (form, formId, source) => {
        if (!form) {
            return;
        }

        const markOpen = () => markFormOpened(formId, source);
        form.addEventListener('focusin', markOpen, { once: true });
        form.addEventListener('pointerdown', markOpen, { once: true });
    };

    const readDraft = (storageKey) => {
        const raw = safeStorage.get(storageKey);
        if (!raw) {
            return {};
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return {};
        }
    };

    const saveDraft = (storageKey, data) => {
        safeStorage.set(storageKey, JSON.stringify(data));
    };

    const clearDraft = (storageKey) => {
        safeStorage.remove(storageKey);
    };

    const bindDraftPersistence = (form, storageKey, fieldNames) => {
        if (!form) {
            return;
        }

        const persist = () => {
            const formData = new FormData(form);
            const draft = fieldNames.reduce((accumulator, fieldName) => {
                accumulator[fieldName] = String(formData.get(fieldName) || '').trim();
                return accumulator;
            }, {});
            saveDraft(storageKey, draft);
        };

        ['input', 'change'].forEach((eventName) => {
            form.addEventListener(eventName, (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }
                if (!target.getAttribute('name') || !fieldNames.includes(target.getAttribute('name'))) {
                    return;
                }
                persist();
            });
        });
    };

    const inferRouteFromPage = () => {
        const path = window.location.pathname || '/';
        const key = path.split('/').pop() || (path.endsWith('/en/') ? 'en-index' : 'index');
        const routeMap = {
            'index.html': 'Napoli -> Ischia',
            'en-index': 'Naples -> Ischia',
            'transfer-stazione-napoli-ischia.html': 'Napoli Stazione -> Ischia Hotel',
            'transfer-naples-train-station-ischia.html': 'Naples Station -> Ischia Hotel',
            'transfer-napoli-aeroporto.html': 'Napoli Aeroporto -> Ischia',
            'transfer-aeroporto-napoli-ischia.html': 'Napoli Aeroporto -> Ischia',
            'transfer-porto-ischia-hotel.html': 'Porto Ischia -> Hotel',
            'transfer-naples-airport-port.html': 'Naples Airport -> Naples Port',
            'naples-airport-to-ischia-transfer.html': 'Naples Airport -> Ischia',
        };

        if (routeMap[key]) {
            return routeMap[key];
        }

        const h1 = document.querySelector('h1');
        if (h1) {
            return h1.textContent.replace(/\s+/g, ' ').trim();
        }

        return language === 'en' ? 'Naples -> Ischia' : 'Napoli -> Ischia';
    };

    const enrichContactCtaLinks = () => {
        const links = document.querySelectorAll('a[href*="contatti.html"], a[href*="contacts.html"]');
        const route = inferRouteFromPage();

        links.forEach((link) => {
            link.addEventListener('click', () => {
                try {
                    const url = new URL(link.getAttribute('href'), window.location.href);
                    const destination = `${url.pathname}${url.search}`;
                    if (destination.includes('contatti.html') || destination.includes('contacts.html')) {
                        if (!url.searchParams.get('route')) {
                            url.searchParams.set('route', route);
                        }
                        if (!url.searchParams.get('people')) {
                            url.searchParams.set('people', '2');
                        }
                        link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
                    }
                } catch (error) {
                    // Keep original href if URL parsing fails.
                }
            });
        });
    };

    const prefillContactForm = () => {
        if (!contactForm) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const draft = readDraft(storageKeys.contactDraft);
        const defaults = {
            name: draft.name || '',
            route: params.get('route') || inferRouteFromPage(),
            people: draft.people || params.get('people') || '2',
            date: draft.date || params.get('date') || '',
            time: params.get('time') || '',
            details: params.get('notes') || '',
        };

        const nameField = contactForm.querySelector('[name="name"]');
        const routeField = contactForm.querySelector('[name="route"]');
        const peopleField = contactForm.querySelector('[name="people"]');
        const dateField = contactForm.querySelector('[name="date"]');
        const timeField = contactForm.querySelector('[name="time"]');
        const detailsField = contactForm.querySelector('[name="details"]');

        if (nameField && !nameField.value && defaults.name) {
            nameField.value = defaults.name;
        }
        if (routeField && !routeField.value && defaults.route) {
            routeField.value = defaults.route;
        }
        if (peopleField && !peopleField.value && defaults.people) {
            peopleField.value = defaults.people;
        }
        if (dateField && !dateField.value && defaults.date) {
            dateField.value = defaults.date;
        }
        if (timeField && !timeField.value && defaults.time) {
            timeField.value = defaults.time;
        }
        if (detailsField && !detailsField.value && defaults.details) {
            detailsField.value = defaults.details;
        }
    };

    const prefillHeroForm = () => {
        if (!heroBookingForm) {
            return;
        }

        const draft = readDraft(storageKeys.heroDraft);
        const defaults = {
            name: draft['hero-name'] || '',
            route: draft['hero-route'] || inferRouteFromPage(),
            people: draft['hero-people'] || '',
            date: draft['hero-date'] || '',
        };

        ['hero-name', 'hero-route', 'hero-people', 'hero-date'].forEach((fieldName) => {
            const field = heroBookingForm.querySelector(`[name="${fieldName}"]`);
            if (field && !field.value && defaults[fieldName.replace('hero-', '')]) {
                field.value = defaults[fieldName.replace('hero-', '')];
            }
        });
    };

    const bindTracking = () => {
        const ctaElements = document.querySelectorAll('a.btn-primary, button.btn-primary');
        ctaElements.forEach((element) => {
            element.addEventListener('click', () => {
                const label = (element.textContent || '').replace(/\s+/g, ' ').trim();
                trackEvent('cta_click', {
                    label,
                    href: element.tagName === 'A' ? element.getAttribute('href') || '' : '',
                    funnel_step: 'cta_click',
                });
            });
        });

        const whatsappLinks = document.querySelectorAll('a[href*="wa.me/"]');
        whatsappLinks.forEach((element) => {
            element.addEventListener('click', () => {
                trackEvent('whatsapp_click', {
                    href: element.getAttribute('href') || '',
                    funnel_step: 'whatsapp_click',
                });
            });
        });
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

    const generateReference = () => {
        const year = new Date().getFullYear();
        const num = String(Math.floor(Math.random() * 9000) + 1000);
        return `ITS-${year}-${num}`;
    };

    const postBookingEmailJs = async (payload) => {
        const reference = generateReference();
        const details = payload.details || 'Nessun dettaglio';
        const parts = details.split('|');
        const people = parts[0] ? parts[0].replace(/Passeggeri:|Passengers:/i, '').trim() : 'n/a';
        const notes = parts[1] ? parts[1].replace(/Note:|Notes:/i, '').trim() : '';

        await emailjs.send('service_436gahf', 'template_wmuj1zo', {
            reference,
            name: payload.name,
            email: payload.email,
            phone: payload.phone || 'Non indicato',
            service: payload.service,
            route: payload.route,
            date: payload.date,
            time: payload.time || 'Non indicato',
            people,
            details: notes,
        });

        return { reference };
    };

    const postBooking = async (payload) => {
        let response;

        try {
            response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            return postBookingEmailJs(payload);
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const rawResponse = await response.text();
        let data = null;

        if (rawResponse && contentType.includes('application/json')) {
            try {
                data = JSON.parse(rawResponse);
            } catch (error) {
                throw new Error(messages.bookingSaveError);
            }
        }

        if (!contentType.includes('application/json')) {
            return postBookingEmailJs(payload);
        }

        if (!response.ok) {
            throw new Error((data && data.error) || messages.bookingSaveError);
        }

        if (!data || !data.booking) {
            throw new Error(messages.bookingSaveError);
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
        const heroRouteField = heroBookingForm.querySelector('[name="hero-route"]');
        if (heroRouteField && !heroRouteField.value) {
            heroRouteField.value = inferRouteFromPage();
        }

        heroBookingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(heroBookingForm);
            const service = String(formData.get('hero-service') || '').trim();
            const name = String(formData.get('hero-name') || '').trim();
            const email = String(formData.get('hero-email') || '').trim();
            const phone = String(formData.get('hero-phone') || '').trim();
            const date = String(formData.get('hero-date') || '').trim();
            const time = String(formData.get('hero-time') || '').trim();
            const route = String(formData.get('hero-route') || '').trim();
            const people = String(formData.get('hero-people') || '').trim();
            const notes = String(formData.get('hero-notes') || '').trim();
            const website = String(formData.get('website') || '').trim();
            const heroPeopleField = heroBookingForm.querySelector('[name="hero-people"]');
            const requiresPeople = Boolean(heroPeopleField);
            const missingFields = [];

            if (!service) missingFields.push('hero-service');
            if (!name) missingFields.push('hero-name');
            if (!email) missingFields.push('hero-email');
            if (!date) missingFields.push('hero-date');
            if (!route) missingFields.push('hero-route');
            if (requiresPeople && !people) missingFields.push('hero-people');

            if (missingFields.length) {
                trackFormError({
                    formId: 'hero-booking-form',
                    errorType: 'missing_required',
                    errorMessage: messages.heroRequired,
                    missingFields,
                });
                setFeedback(heroBookingFeedback, messages.heroRequired, 'error');
                return;
            }

            if (!isValidEmail(email)) {
                trackFormError({
                    formId: 'hero-booking-form',
                    errorType: 'invalid_email',
                    errorMessage: messages.invalidEmail,
                });
                setFeedback(heroBookingFeedback, messages.invalidEmail, 'error');
                return;
            }

            trackEvent('form_submit', {
                form_id: 'hero-booking-form',
                source: 'PUBLIC_HERO_WIDGET',
                funnel_step: 'form_submit',
            });

            setFeedback(heroBookingFeedback, messages.sending, 'info');
            if (heroBookingSubmit) {
                heroBookingSubmit.disabled = true;
            }

            try {
                const phoneLabel = language === 'en' ? 'Phone' : 'Telefono';
                const booking = await postBooking({
                    service,
                    route,
                    date,
                    time,
                    name,
                    email,
                    phone,
                    details: `${phone ? `${phoneLabel}: ${phone} | ` : ''}${language === 'en' ? 'Passengers' : 'Passeggeri'}: ${people || 'n/a'}${notes ? ` | ${language === 'en' ? 'Notes' : 'Note'}: ${notes}` : ''}`,
                    source: 'PUBLIC_HERO_WIDGET',
                    website,
                });

                setFeedback(
                    heroBookingFeedback,
                    messages.heroSuccess(booking.reference),
                    'success',
                );
                heroBookingForm.reset();
                clearDraft(storageKeys.heroDraft);
            } catch (error) {
                trackFormError({
                    formId: 'hero-booking-form',
                    errorType: 'submit_error',
                    errorMessage: error.message,
                });
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
                time: String(formData.get('time') || '').trim(),
                website: String(formData.get('website') || '').trim(),
                service: 'Richiesta Transfer da Form Contatti',
                source: 'PUBLIC_CONTACT_FORM',
            };

            const people = String(formData.get('people') || '').trim();
            const notes = String(formData.get('details') || '').trim();
            const peopleField = contactForm.querySelector('[name="people"]');
            const requiresPeople = Boolean(peopleField);
            const missingFields = [];
            const contactPhone = String(formData.get('phone') || '').trim();
            if (contactPhone) {
                payload.phone = contactPhone;
            }
            payload.details = `${contactPhone ? `${language === 'en' ? 'Phone' : 'Telefono'}: ${contactPhone} | ` : ''}${language === 'en' ? 'Passengers' : 'Passeggeri'}: ${people || 'n/a'}${payload.time ? ` | ${language === 'en' ? 'Estimated time' : 'Orario indicativo'}: ${payload.time}` : ''}${notes ? ` | ${language === 'en' ? 'Notes' : 'Note'}: ${notes}` : ''}`;

            if (!payload.name) missingFields.push('name');
            if (!payload.email) missingFields.push('email');
            if (!payload.route) missingFields.push('route');
            if (!payload.date) missingFields.push('date');
            if (requiresPeople && !people) missingFields.push('people');

            if (missingFields.length) {
                trackFormError({
                    formId: 'contact-form',
                    errorType: 'missing_required',
                    errorMessage: messages.contactRequired,
                    missingFields,
                });
                setFeedback(contactFeedback, messages.contactRequired, 'error');
                return;
            }

            if (!isValidEmail(payload.email)) {
                trackFormError({
                    formId: 'contact-form',
                    errorType: 'invalid_email',
                    errorMessage: messages.invalidEmail,
                });
                setFeedback(contactFeedback, messages.invalidEmail, 'error');
                return;
            }

            trackEvent('form_submit', {
                form_id: 'contact-form',
                source: 'PUBLIC_CONTACT_FORM',
                funnel_step: 'form_submit',
            });

            setFeedback(contactFeedback, messages.sending, 'info');

            try {
                const booking = await postBooking(payload);
                setFeedback(
                    contactFeedback,
                    messages.contactSuccess(booking.reference),
                    'success',
                );
                contactForm.reset();
                clearDraft(storageKeys.contactDraft);
                prefillContactForm();
            } catch (error) {
                trackFormError({
                    formId: 'contact-form',
                    errorType: 'submit_error',
                    errorMessage: error.message,
                });
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

    saveUtmParams();
    enrichContactCtaLinks();
    bindFormOpenTracking(heroBookingForm, 'hero-booking-form', 'PUBLIC_HERO_WIDGET');
    bindFormOpenTracking(contactForm, 'contact-form', 'PUBLIC_CONTACT_FORM');
    bindDraftPersistence(contactForm, storageKeys.contactDraft, ['name', 'route', 'people', 'date']);
    bindDraftPersistence(heroBookingForm, storageKeys.heroDraft, ['hero-name', 'hero-route', 'hero-people', 'hero-date']);
    prefillHeroForm();
    prefillContactForm();
    createWhatsAppFloat();
    bindTracking();
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
