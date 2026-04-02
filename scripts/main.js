document.addEventListener('DOMContentLoaded', () => {
    if (typeof emailjs !== 'undefined') {
        emailjs.init('kPLCj-5Q49NIzb1Co');
    }

    const nav = document.getElementById('site-nav');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    const heroBookingForm = document.getElementById('hero-booking-form');
    const heroBookingSubmit = document.getElementById('hero-booking-submit');
    const heroBookingFeedback = document.getElementById('hero-booking-feedback');
    const contactForm = document.getElementById('contact-form');
    const contactFeedback = document.getElementById('contact-feedback');
    const scrollTopButton = document.getElementById('scroll-top');
    const whatsappPhone = '390813331053';
    const storageKeys = {
        utm: 'its_utm_params',
        sessionId: 'its_session_id',
        contactDraft: 'its_contact_form_draft',
        heroDraft: 'its_hero_form_draft',
        openedForms: 'its_opened_forms',
        cookieConsent: 'its_cookie_consent',
    };
    const language = document.documentElement.lang === 'en' ? 'en' : 'it';
    const whatsappMessage = language === 'en'
        ? 'Hello Ischia Transfer Service, I would like information about a private transfer from [pickup] to [destination].'
        : "Ciao Ischia Transfer Service, vorrei informazioni per un transfer privato da [partenza] a [destinazione].";
    const messages = language === 'en'
        ? {
            bookingUnavailable: 'Online booking is not available on this page. Message us on WhatsApp for a quick reply.',
            bookingSaveError: 'There was a problem sending your request. Please try again in a moment.',
            heroRequired: 'Please complete all required fields before sending your request.',
            contactRequired: 'Please complete all required fields before sending your request.',
            invalidEmail: 'Please enter a valid email address.',
            invalidDate: 'Please enter a valid date in YYYY-MM-DD format that is not in the past.',
            invalidTime: 'Please enter a valid time in HH:MM format.',
            cookieTitle: 'Cookies and basic analytics',
            cookieBody: 'We use necessary tools and, with your consent, basic analytics to measure form submissions, CTA clicks, WhatsApp clicks and UTM sources.',
            cookieAccept: 'Accept',
            cookieReject: 'Reject',
            sending: 'Sending your request...',
            heroSuccess: (reference) => `Request sent (${reference}). We will get back to you shortly.`,
            contactSuccess: (reference) => `Request sent (${reference}). We will get back to you shortly.`,
        }
        : {
            bookingUnavailable: 'Prenotazione online non disponibile su questa pagina. Scrivici su WhatsApp per una risposta veloce.',
            bookingSaveError: "Si è verificato un problema durante l'invio della richiesta. Riprova tra poco.",
            heroRequired: 'Compila tutti i campi obbligatori prima di inviare la richiesta.',
            contactRequired: 'Compila tutti i campi obbligatori prima di inviare la richiesta.',
            invalidEmail: 'Inserisci un’email valida.',
            invalidDate: 'Inserisci una data valida nel formato GG-MM-AAAA e non nel passato.',
            invalidTime: 'Inserisci un orario valido nel formato HH:MM.',
            cookieTitle: 'Cookie e analisi di base',
            cookieBody: 'Utilizziamo strumenti necessari e, con il tuo consenso, analisi di base per misurare invii form, click sulle CTA, click WhatsApp e sorgenti UTM.',
            cookieAccept: 'Accetta',
            cookieReject: 'Rifiuta',
            sending: 'Invio richiesta in corso...',
            heroSuccess: (reference) => `Richiesta inviata (${reference}), ti rispondiamo a breve.`,
            contactSuccess: (reference) => `Richiesta inviata (${reference}), ti rispondiamo a breve.`,
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
    const safeLocalStorage = {
        get(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (error) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
            } catch (error) {
                // Ignore storage write failures.
            }
        },
        remove(key) {
            try {
                window.localStorage.removeItem(key);
            } catch (error) {
                // Ignore storage removal failures.
            }
        },
    };
    const pathname = window.location.pathname || '/';
    const isHomepage = /(?:^\/$|\/index\.html$|\/en\/$|\/en\/index\.html$)/i.test(pathname);
    const getCookieConsent = () => {
        const value = String(safeLocalStorage.get(storageKeys.cookieConsent) || '').trim().toLowerCase();
        return value === 'accepted' || value === 'rejected' ? value : '';
    };
    const hasAnalyticsConsent = () => getCookieConsent() === 'accepted';
    const clearAnalyticsStorage = () => {
        safeStorage.remove(storageKeys.utm);
        safeStorage.remove(storageKeys.sessionId);
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
        if (!hasAnalyticsConsent()) {
            return;
        }
        const current = getQueryUtm();
        if (!current.utm_source && !current.utm_medium && !current.utm_campaign) {
            return;
        }
        safeStorage.set(storageKeys.utm, JSON.stringify(current));
    };

    const getStoredUtm = () => {
        if (!hasAnalyticsConsent()) {
            return normalizeUtm({});
        }
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
        if (!hasAnalyticsConsent()) {
            return '';
        }
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
        if (!hasAnalyticsConsent()) {
            return;
        }
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
    const getTodayIso = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const normalizeDateForValidation = (value) => {
        const raw = String(value || '').trim();
        if (!raw) {
            return null;
        }
        if (language === 'it') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                return raw;
            }
            const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (!match) {
                return null;
            }
            return `${match[3]}-${match[2]}-${match[1]}`;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return null;
        }
        return raw;
    };
    const isValidDate = (value) => {
        const normalized = normalizeDateForValidation(value);
        if (!normalized) {
            return false;
        }
        const [year, month, day] = normalized.split('-').map(Number);
        const candidate = new Date(Date.UTC(year, month - 1, day));
        if (
            candidate.getUTCFullYear() !== year ||
            candidate.getUTCMonth() !== month - 1 ||
            candidate.getUTCDate() !== day
        ) {
            return false;
        }
        return normalized >= getTodayIso();
    };
    const isValidTime = (value) => {
        const raw = String(value || '').trim();
        if (!raw) {
            return true;
        }
        const match = raw.match(/^(\d{2}):(\d{2})$/);
        if (!match) {
            return false;
        }
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    };
    const applyDateTimeConstraints = () => {
        const today = getTodayIso();
        document.querySelectorAll('input[type="date"]').forEach((field) => {
            field.setAttribute('min', today);
        });
        if (language === 'it') {
            ['hero-date', 'date'].forEach((fieldName) => {
                const field = document.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    field.setAttribute('maxlength', '10');
                }
            });
        }
        document.querySelectorAll('input[type="time"]').forEach((field) => {
            field.setAttribute('step', '300');
            field.setAttribute('inputmode', 'numeric');
        });
    };
    const getCookiePolicyHref = () => 'cookie-policy.html';
    const hideCookieBanner = () => {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.remove();
        }
    };
    const setCookieConsent = (value) => {
        safeLocalStorage.set(storageKeys.cookieConsent, value);
        if (value !== 'accepted') {
            clearAnalyticsStorage();
        } else {
            saveUtmParams();
        }
        hideCookieBanner();
    };
    const renderCookieBanner = () => {
        if (getCookieConsent()) {
            return;
        }
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', language === 'en' ? 'Cookie consent' : 'Consenso cookie');
        banner.setAttribute('aria-modal', 'false');
        banner.innerHTML = `
            <div class="cookie-banner__content">
                <p class="cookie-banner__title">${messages.cookieTitle}</p>
                <p class="cookie-banner__text">${messages.cookieBody} <a href="${getCookiePolicyHref()}">${language === 'en' ? 'Read the Cookie Policy' : 'Leggi la Cookie Policy'}</a>.</p>
            </div>
            <div class="cookie-banner__actions">
                <button type="button" class="btn-secondary cookie-banner__button" data-cookie-choice="reject">${messages.cookieReject}</button>
                <button type="button" class="btn-primary cookie-banner__button" data-cookie-choice="accept">${messages.cookieAccept}</button>
            </div>
        `;
        document.body.appendChild(banner);
        banner.querySelector('[data-cookie-choice="accept"]').addEventListener('click', () => setCookieConsent('accepted'));
        banner.querySelector('[data-cookie-choice="reject"]').addEventListener('click', () => setCookieConsent('rejected'));
    };

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

    const inferEventPosition = (element) => {
        if (!(element instanceof Element)) {
            return 'unknown';
        }
        if (element.closest('#hero')) {
            return 'hero';
        }
        if (element.closest('.mobile-sticky-cta')) {
            return 'mobile_sticky';
        }
        const section = element.closest('section[id]');
        if (section instanceof HTMLElement) {
            return section.id || 'section';
        }
        if (element.closest('footer')) {
            return 'footer';
        }
        if (element.closest('header')) {
            return 'header';
        }
        return 'section';
    };

    const heroFunnelState = {
        started: false,
        step1Complete: false,
        step2Open: false,
        step2Complete: false,
        submitted: false,
        abandonTracked: false,
    };

    const markHeroFunnelEvent = (eventName, extra = {}) => {
        if (!isHomepage) {
            return;
        }
        trackEvent(eventName, {
            form_id: 'hero-booking-form',
            source: 'PUBLIC_HERO_WIDGET',
            position: 'hero',
            ...extra,
        });
    };

    const trackScrollDepth = (() => {
        const thresholds = [25, 50, 75, 100];
        const fired = new Set();

        return () => {
            if (!isHomepage) {
                return;
            }
            const scrollTop = window.scrollY || window.pageYOffset || 0;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const fullHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1);
            const progress = Math.min(100, Math.round(((scrollTop + viewportHeight) / fullHeight) * 100));

            thresholds.forEach((threshold) => {
                if (progress >= threshold && !fired.has(threshold)) {
                    fired.add(threshold);
                    trackEvent(`scroll_${threshold}`, {
                        position: 'homepage',
                        scroll_percent: threshold,
                        funnel_step: 'scroll_depth',
                    });
                }
            });
        };
    })();

    const trackHeroAbandon = () => {
        if (!isHomepage || heroFunnelState.abandonTracked || heroFunnelState.submitted || !heroFunnelState.started) {
            return;
        }

        if (!heroFunnelState.step1Complete) {
            heroFunnelState.abandonTracked = true;
            markHeroFunnelEvent('form_abandon_step1', {
                funnel_step: 'form_abandon_step1',
            });
            return;
        }

        if (heroFunnelState.step2Open && !heroFunnelState.submitted) {
            heroFunnelState.abandonTracked = true;
            markHeroFunnelEvent('form_abandon_step2', {
                funnel_step: 'form_abandon_step2',
            });
        }
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
            'transfer-porto-ischia-hotel.html': 'Porto Ischia -> Hotel',
            'transfer-naples-airport-port.html': 'Naples Airport -> Naples Port',
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
            service: draft['hero-service'] || '',
            arrival: draft['hero-arrival'] || '',
            route: draft['hero-route'] || '',
            people: draft['hero-people'] || '',
            luggage: draft['hero-luggage'] || '',
            date: draft['hero-date'] || '',
        };

        ['hero-name', 'hero-service', 'hero-arrival', 'hero-route', 'hero-people', 'hero-luggage', 'hero-date'].forEach((fieldName) => {
            const field = heroBookingForm.querySelector(`[name="${fieldName}"]`);
            if (field && !field.value && defaults[fieldName.replace('hero-', '')]) {
                field.value = defaults[fieldName.replace('hero-', '')];
            }
        });

        setHeroFormExpanded(heroAdvancedHasValues());
    };

    const bindTracking = () => {
        const ctaElements = document.querySelectorAll('a.btn-primary, button.btn-primary, a.btn-secondary, .service-link, .utility-link');
        ctaElements.forEach((element) => {
            element.addEventListener('click', () => {
                const label = (element.textContent || '').replace(/\s+/g, ' ').trim();
                const position = inferEventPosition(element);
                trackEvent('cta_click', {
                    label,
                    href: element.tagName === 'A' ? element.getAttribute('href') || '' : '',
                    position,
                    funnel_step: 'cta_click',
                });
                if (isHomepage && position === 'hero') {
                    trackEvent('hero_cta_click', {
                        label,
                        href: element.tagName === 'A' ? element.getAttribute('href') || '' : '',
                        position,
                        funnel_step: 'hero_cta_click',
                    });
                }
            });
        });

        const whatsappLinks = document.querySelectorAll('a[href*="wa.me/"]');
        whatsappLinks.forEach((element) => {
            element.addEventListener('click', () => {
                trackEvent('whatsapp_click', {
                    href: element.getAttribute('href') || '',
                    position: inferEventPosition(element),
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

    const formatBookingDateForEmail = (value) => {
        const normalized = normalizeDateForValidation(value);
        if (!normalized) {
            return String(value || '').trim();
        }
        if (language === 'it') {
            const [year, month, day] = normalized.split('-');
            return `${day}-${month}-${year}`;
        }
        return normalized;
    };

    const normalizePeopleForEmail = (value) => {
        const raw = String(value || '').trim();
        if (!raw) {
            return 'n/a';
        }
        return raw
            .replace(/\b(persone|passengers?|people)\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };

    const postBookingEmailJs = async (payload) => {
        if (typeof emailjs === 'undefined' || typeof emailjs.send !== 'function') {
            throw new Error(messages.bookingSaveError);
        }

        const reference = generateReference();
        const details = payload.details || 'Nessun dettaglio';
        const fallbackText = language === 'en' ? 'Not provided' : 'Non indicato';
        const phoneFromDetails = (details.match(/(?:Telefono|Phone):\s*([^|]+)/i) || [])[1]?.trim() || '';
        const people = normalizePeopleForEmail((details.match(/(?:Passeggeri|Passengers):\s*([^|]+)/i) || [])[1]?.trim() || 'n/a');
        const notes = (details.match(/(?:Note|Notes):\s*([^|]+)/i) || [])[1]?.trim() || '';

        await emailjs.send('service_436gahf', 'template_wmuj1zo', {
            reference,
            name: payload.name,
            email: payload.email,
            phone: payload.phone || phoneFromDetails || fallbackText,
            service: payload.service,
            route: payload.route,
            date: formatBookingDateForEmail(payload.date),
            time: payload.time || fallbackText,
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

        const wrapper = document.createElement('div');
        wrapper.setAttribute('role', 'complementary');
        wrapper.setAttribute('aria-label', language === 'en' ? 'Quick contact' : 'Contatto rapido');
        wrapper.appendChild(whatsappLink);
        document.body.appendChild(wrapper);
    };

    const syncNavState = () => {
        if (!nav) {
            return;
        }

        nav.classList.toggle('scrolled', window.scrollY > 24);
        document.body.classList.toggle('has-scrolled', window.scrollY > 180);
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

    const focusHeroForm = () => {
        if (!heroBookingForm) {
            return;
        }

        const firstField = heroBookingForm.querySelector('select, input, textarea');
        if (!firstField) {
            return;
        }

        window.setTimeout(() => {
            firstField.focus({ preventScroll: true });
        }, 420);
    };

    const heroAdvancedContainer = heroBookingForm ? heroBookingForm.querySelector('[data-hero-advanced]') : null;
    const heroProgressDots = heroBookingForm
        ? Array.from(heroBookingForm.parentElement?.querySelectorAll('.hero-form-progress-dot') || [])
        : [];
    const heroProgressiveRequiredFields = heroBookingForm
        ? Array.from(heroBookingForm.querySelectorAll('[data-progressive-required="true"]'))
        : [];

    const setHeroFormExpanded = (expanded) => {
        if (!heroBookingForm || !heroAdvancedContainer) {
            return;
        }

        heroBookingForm.dataset.expanded = expanded ? 'true' : 'false';
        heroProgressiveRequiredFields.forEach((field) => {
            if (expanded) {
                field.setAttribute('required', 'required');
                return;
            }
            field.removeAttribute('required');
        });
        heroProgressDots.forEach((dot, index) => {
            dot.classList.toggle('is-active', expanded ? index <= 1 : index === 0);
        });
    };

    const isHeroFormExpanded = () => heroBookingForm?.dataset.expanded === 'true';

    const focusFirstAdvancedHeroField = () => {
        if (!heroAdvancedContainer) {
            return;
        }

        const firstField = heroAdvancedContainer.querySelector('select, input, textarea');
        if (!firstField) {
            return;
        }

        window.setTimeout(() => {
            firstField.focus({ preventScroll: true });
        }, 180);
    };

    const heroAdvancedHasValues = () => {
        if (!heroAdvancedContainer) {
            return false;
        }

        return Array.from(heroAdvancedContainer.querySelectorAll('input, select, textarea')).some((field) => String(field.value || '').trim());
    };

    const scrollHeroAdvancedIntoView = () => {
        if (!heroAdvancedContainer) {
            return;
        }

        const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 92;
        const top = heroAdvancedContainer.getBoundingClientRect().top + window.scrollY - navHeight - 12;
        window.scrollTo({
            top,
            behavior: 'smooth',
        });
    };

    const pulseHeroAdvanced = () => {
        if (!heroAdvancedContainer) {
            return;
        }

        heroBookingForm?.classList.add('is-expanding');
        heroAdvancedContainer.classList.add('is-highlighted');
        window.setTimeout(() => {
            heroBookingForm?.classList.remove('is-expanding');
            heroAdvancedContainer.classList.remove('is-highlighted');
        }, 900);
    };

    const syncMobileOverlayState = () => {
        const activeElement = document.activeElement;
        const isFormFieldActive = Boolean(
            activeElement &&
            /^(INPUT|SELECT|TEXTAREA)$/.test(activeElement.tagName) &&
            window.innerWidth <= 768,
        );
        document.body.classList.toggle('form-input-active', isFormFieldActive);

        if (!window.visualViewport || window.innerWidth > 768) {
            document.body.classList.remove('keyboard-open');
            return;
        }

        const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
        document.body.classList.toggle('keyboard-open', keyboardHeight > 140);
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

            if (targetId === '#richiedi-transfer') {
                focusHeroForm();
            }
        });
    });

    if (scrollTopButton) {
        scrollTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        });
    }

    const syncScrollTopButton = () => {
        if (!scrollTopButton) {
            return;
        }

        scrollTopButton.classList.toggle('is-visible', window.scrollY > 400);
    };

    if (heroBookingForm) {
        const markHeroFormStart = () => {
            if (heroFunnelState.started) {
                return;
            }
            heroFunnelState.started = true;
            markHeroFunnelEvent('form_start', {
                funnel_step: 'form_start',
            });
        };

        heroBookingForm.addEventListener('focusin', markHeroFormStart, { once: true });
        heroBookingForm.addEventListener('pointerdown', markHeroFormStart, { once: true });

        heroBookingForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!isHeroFormExpanded()) {
                heroFunnelState.step1Complete = true;
                markHeroFunnelEvent('form_step1_complete', {
                    funnel_step: 'form_step1_complete',
                });
                if (heroBookingSubmit) {
                    heroBookingSubmit.classList.add('is-advancing');
                }
                window.setTimeout(() => {
                    setHeroFormExpanded(true);
                    heroFunnelState.step2Open = true;
                    markHeroFunnelEvent('form_step2_open', {
                        funnel_step: 'form_step2_open',
                    });
                    scrollHeroAdvancedIntoView();
                    pulseHeroAdvanced();
                    focusFirstAdvancedHeroField();
                    if (heroBookingSubmit) {
                        heroBookingSubmit.classList.remove('is-advancing');
                    }
                }, 150);
                return;
            }

            const formData = new FormData(heroBookingForm);
            const service = String(formData.get('hero-service') || '').trim();
            const arrivalPoint = String(formData.get('hero-arrival') || '').trim();
            const name = String(formData.get('hero-name') || '').trim();
            const email = String(formData.get('hero-email') || '').trim();
            const phone = String(formData.get('hero-phone') || '').trim();
            const date = String(formData.get('hero-date') || '').trim();
            const time = String(formData.get('hero-time') || '').trim();
            const route = String(formData.get('hero-route') || '').trim();
            const people = String(formData.get('hero-people') || '').trim();
            const luggage = String(formData.get('hero-luggage') || '').trim();
            const notes = String(formData.get('hero-notes') || '').trim();
            const website = String(formData.get('website') || '').trim();
            const heroPeopleField = heroBookingForm.querySelector('[name="hero-people"]');
            const requiresPeople = Boolean(heroPeopleField);
            const missingFields = [];

            if (!service) missingFields.push('hero-service');
            if (!name) missingFields.push('hero-name');
            if (!email) missingFields.push('hero-email');
            if (!route) missingFields.push('hero-route');
            if (!phone) missingFields.push('hero-phone');
            if (!date) missingFields.push('hero-date');
            if (!time) missingFields.push('hero-time');
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

            if (!isValidDate(date)) {
                trackFormError({
                    formId: 'hero-booking-form',
                    errorType: 'invalid_date',
                    errorMessage: messages.invalidDate,
                });
                setFeedback(heroBookingFeedback, messages.invalidDate, 'error');
                return;
            }

            if (!isValidTime(time)) {
                trackFormError({
                    formId: 'hero-booking-form',
                    errorType: 'invalid_time',
                    errorMessage: messages.invalidTime,
                });
                setFeedback(heroBookingFeedback, messages.invalidTime, 'error');
                return;
            }

            heroFunnelState.step2Complete = true;
            markHeroFunnelEvent('form_step2_complete', {
                funnel_step: 'form_step2_complete',
            });
            trackEvent('form_submit', {
                form_id: 'hero-booking-form',
                source: 'PUBLIC_HERO_WIDGET',
                position: 'hero',
                funnel_step: 'form_submit',
            });

            setFeedback(heroBookingFeedback, messages.sending, 'info');
            if (heroBookingSubmit) {
                heroBookingSubmit.disabled = true;
            }

            try {
                const phoneLabel = language === 'en' ? 'Phone' : 'Telefono';
                const luggageLabel = language === 'en' ? 'Luggage' : 'Bagagli';
                const detailsLabel = language === 'en' ? 'Final stop' : 'Destinazione finale';
                const routeLabel = language === 'en' ? 'Route' : 'Tratta';
                const arrivalLabel = language === 'en' ? 'Arrival point' : 'Punto di arrivo';
                const detailsParts = [
                    `${routeLabel}: ${service}`,
                    `${arrivalLabel}: ${arrivalPoint}`,
                    `${detailsLabel}: ${route}`,
                    `${language === 'en' ? 'Passengers' : 'Passeggeri'}: ${people || 'n/a'}`,
                    luggage ? `${luggageLabel}: ${luggage}` : '',
                    phone ? `${phoneLabel}: ${phone}` : '',
                    notes ? `${language === 'en' ? 'Notes' : 'Note'}: ${notes}` : '',
                ].filter(Boolean);
                const booking = await postBooking({
                    service,
                    route: `${service} | ${arrivalPoint} | ${route}`,
                    date,
                    time,
                    name,
                    email,
                    phone,
                    details: detailsParts.join(' | '),
                    source: 'PUBLIC_HERO_WIDGET',
                    website,
                });

                setFeedback(
                    heroBookingFeedback,
                    messages.heroSuccess(booking.reference),
                    'success',
                );
                heroFunnelState.submitted = true;
                heroBookingForm.reset();
                setHeroFormExpanded(false);
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

            if (!isValidDate(payload.date)) {
                trackFormError({
                    formId: 'contact-form',
                    errorType: 'invalid_date',
                    errorMessage: messages.invalidDate,
                });
                setFeedback(contactFeedback, messages.invalidDate, 'error');
                return;
            }

            if (!isValidTime(payload.time)) {
                trackFormError({
                    formId: 'contact-form',
                    errorType: 'invalid_time',
                    errorMessage: messages.invalidTime,
                });
                setFeedback(contactFeedback, messages.invalidTime, 'error');
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
    bindDraftPersistence(heroBookingForm, storageKeys.heroDraft, ['hero-name', 'hero-service', 'hero-arrival', 'hero-route', 'hero-people', 'hero-luggage', 'hero-date']);
    setHeroFormExpanded(false);
    prefillHeroForm();
    prefillContactForm();
    applyDateTimeConstraints();
    renderCookieBanner();
    createWhatsAppFloat();
    bindTracking();
    syncHeroOffset();
    syncNavState();
    syncScrollTopButton();
    syncMobileOverlayState();
    trackScrollDepth();
    window.addEventListener('scroll', syncNavState, { passive: true });
    window.addEventListener('scroll', syncScrollTopButton, { passive: true });
    window.addEventListener('scroll', trackScrollDepth, { passive: true });
    window.addEventListener('resize', () => {
        syncHeroOffset();
        syncMobileOverlayState();
        if (window.innerWidth >= 1024) {
            closeMobileMenu();
        }
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            syncHeroOffset();
            syncMobileOverlayState();
        }, { passive: true });
    }

    document.addEventListener('focusin', syncMobileOverlayState);
    document.addEventListener('focusout', () => {
        window.setTimeout(syncMobileOverlayState, 40);
    });
    window.addEventListener('pagehide', trackHeroAbandon);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            trackHeroAbandon();
        }
    });
});
