(function () {
  var ORDER = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
  var DAY_IT_TO_EN = null; // set by EN page

  function getLocalizedField(item, field, lang) {
    var value = item ? item[field] : '';
    if (value && typeof value === 'object') {
      if (lang === 'en' && value.en) {
        return value.en;
      }
      if (value.it) {
        return value.it;
      }
      return value.en || '';
    }
    return value || '';
  }

  function buildRichContent(item, lang) {
    var richHtml = getLocalizedField(item, 'detailsHtml', lang);
    if (richHtml) {
      return richHtml;
    }

    var description = getLocalizedField(item, 'description', lang);
    if (!description) {
      return '<div class="exc-rich-copy"><p>' +
        (lang === 'en' ? 'Contact us on WhatsApp for the full excursion details.' : 'Contattaci su WhatsApp per ricevere i dettagli completi dell\'escursione.') +
        '</p></div>';
    }

    return '<div class="exc-rich-copy"><p>' + description + '</p></div>';
  }

  function getNumericPrice(item) {
    if (typeof item.price === 'number' && !isNaN(item.price)) {
      return item.price;
    }
    if (typeof item.price === 'string' && item.price.trim()) {
      var parsed = Number(item.price.replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  function updateOverviewStats(items, lang) {
    var countEl = document.getElementById('exc-stat-count');
    var daysEl = document.getElementById('exc-stat-days');
    var priceEl = document.getElementById('exc-stat-price');
    var uniqueDays = [];
    var minPrice = null;

    items.forEach(function (item) {
      (item.days || []).forEach(function (day) {
        if (uniqueDays.indexOf(day) === -1) {
          uniqueDays.push(day);
        }
      });

      var numericPrice = getNumericPrice(item);
      if (numericPrice !== null && (minPrice === null || numericPrice < minPrice)) {
        minPrice = numericPrice;
      }
    });

    if (countEl) {
      countEl.textContent = String(items.length);
    }
    if (daysEl) {
      daysEl.textContent = String(uniqueDays.length);
    }
    if (priceEl) {
      priceEl.textContent = minPrice !== null
        ? ((lang === 'en' ? 'From ' : 'Da ') + '\u20AC' + Number(minPrice).toFixed(0))
        : '--';
    }
  }

  function bindAccordion(grid) {
    var cards = grid.querySelectorAll('.exc-card');
    cards.forEach(function (card) {
      var toggle = card.querySelector('.exc-toggle');
      if (!toggle) {
        return;
      }

      toggle.addEventListener('click', function () {
        var isOpen = card.classList.contains('is-open');

        cards.forEach(function (otherCard) {
          otherCard.classList.remove('is-open');
          var otherToggle = otherCard.querySelector('.exc-toggle');
          if (otherToggle) {
            otherToggle.setAttribute('aria-expanded', 'false');
          }
        });

        if (!isOpen) {
          card.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function renderExcursions(data, lang) {
    var grid = document.getElementById('exc-grid');
    var subtitle = document.getElementById('exc-subtitle');
    var noteEl = document.getElementById('exc-note');

    if (data.validFrom) {
      var parts = data.validFrom.split('-');
      subtitle.textContent = (lang === 'en' ? 'In effect from ' : 'In vigore dal ') + parts[2] + '/' + parts[1] + '/' + parts[0];
    } else {
      subtitle.textContent = '';
    }

    var note = data.note || '';
    if (lang === 'en') {
      note = note
        .replace('Le escursioni si effettuano al raggiungimento di un minimo di 20 partecipanti.', 'Excursions take place when a minimum of 20 participants is reached.')
        .replace('Prenotazioni:', 'Bookings:');
    }
    noteEl.textContent = note;

    var items = (data.items || []).filter(function (i) { return i.visible !== false; });
    if (!items.length) {
      updateOverviewStats([], lang);
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-full text-center py-10">' +
        (lang === 'en' ? 'No excursions available at the moment.' : 'Nessuna escursione disponibile al momento.') + '</p>';
      return;
    }

    items.sort(function (a, b) {
      var daysA = a.days || [];
      var daysB = b.days || [];
      var ia = daysA.length ? Math.min.apply(null, daysA.map(function (d) { return ORDER.indexOf(d); }).filter(function (n) { return n >= 0; })) : 999;
      var ib = daysB.length ? Math.min.apply(null, daysB.map(function (d) { return ORDER.indexOf(d); }).filter(function (n) { return n >= 0; })) : 999;
      return ia - ib;
    });

    var dayMap = lang === 'en' ? {
      'Lunedì': 'Monday', 'Martedì': 'Tuesday', 'Mercoledì': 'Wednesday',
      'Giovedì': 'Thursday', 'Venerdì': 'Friday', 'Sabato': 'Saturday', 'Domenica': 'Sunday'
    } : null;

    updateOverviewStats(items, lang);

    grid.innerHTML = items.map(function (item) {
      var name = getLocalizedField(item, 'name', lang);
      var includes = getLocalizedField(item, 'includes', lang);
      var notes = getLocalizedField(item, 'notes', lang);
      var description = getLocalizedField(item, 'description', lang);
      var richContent = buildRichContent(item, lang);
      var departuresLabel = lang === 'en'
        ? ((item.days || []).length + ' departures/week')
        : ((item.days || []).length + ' partenze/settimana');
      var experienceLabel = item.detailsHtml
        ? (lang === 'en' ? 'Curated details' : 'Scheda completa')
        : (lang === 'en' ? 'Quick overview' : 'Panoramica rapida');
      var miniMeta = '<div class="exc-mini-meta">' +
        '<span class="exc-mini-pill">' + departuresLabel + '</span>' +
        '<span class="exc-mini-pill">' + experienceLabel + '</span>' +
      '</div>';
      var badges = (item.days || []).map(function (d) {
        return '<span class="exc-day-badge">' + (dayMap ? (dayMap[d] || d) : d) + '</span>';
      }).join('');
      var priceStr = item.priceNote ? item.priceNote : (item.price ? '\u20AC' + Number(item.price).toFixed(0) : '');
      var includesLabel = lang === 'en' ? 'Included' : 'Incluso';
      var teaserHtml = description
        ? '<p class="exc-teaser">' + description + '</p>'
        : '';
      var includesHtml = includes
        ? '<div class="exc-includes"><strong>' + includesLabel + '</strong>' + includes + '</div>'
        : '';
      var notesHtml = notes ? '<p class="exc-notes">' + notes + '</p>' : '';
      var daysList = (item.days || []).map(function (d) { return dayMap ? (dayMap[d] || d) : d; }).join(', ');
      var waText = lang === 'en'
        ? 'Hi, I would like to book the excursion: ' + name + ' (' + daysList + ')' + (priceStr ? ' - ' + priceStr : '')
        : 'Ciao, vorrei prenotare l\'escursione: ' + name + ' (' + daysList + ')' + (priceStr ? ' - ' + priceStr : '');
      var waUrl = 'https://wa.me/390813331053?text=' + encodeURIComponent(waText);
      var btnLabel = lang === 'en' ? 'Book on WhatsApp' : 'Prenota su WhatsApp';
      var discoverLabel = lang === 'en' ? 'Open details' : 'Apri dettagli';

      return '<article class="service-card exc-card flex flex-col">' +
        '<button type="button" class="exc-toggle" aria-expanded="false">' +
          '<div class="exc-toggle-top">' +
            '<div class="mb-2">' + badges + '</div>' +
            '<span class="exc-discover">' + discoverLabel + '</span>' +
          '</div>' +
          '<div class="exc-toggle-main">' +
            '<div class="exc-heading-wrap">' +
              '<h3 class="mt-0">' + name + '</h3>' +
              miniMeta +
              teaserHtml +
            '</div>' +
            '<span class="exc-chevron" aria-hidden="true"></span>' +
          '</div>' +
        '</button>' +
        '<div class="exc-panel">' +
          '<div class="exc-panel-shell">' +
            richContent +
            includesHtml +
            notesHtml +
          '</div>' +
        '</div>' +
        '<div class="mt-auto pt-4 flex items-center justify-between gap-4 exc-card-footer">' +
          '<span class="exc-price">' + priceStr + '</span>' +
          '<a href="' + waUrl + '" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-whatsapp" style="font-size:0.8rem;padding:8px 14px;">' + btnLabel + '</a>' +
        '</div>' +
        '</article>';
    }).join('');

    bindAccordion(grid);
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) {
        throw new Error('HTTP ' + r.status + ' on ' + url);
      }
      return r.json();
    });
  }

  function getFallbackDataUrl() {
    var scriptEl = document.currentScript;
    if (scriptEl && scriptEl.src) {
      return new URL('../assets/escursioni-default.json', scriptEl.src).toString();
    }
    return '/assets/escursioni-default.json';
  }

  function shouldUseApi() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  var lang = document.documentElement.lang === 'en' ? 'en' : 'it';
  var fallbackUrl = getFallbackDataUrl();

  var dataPromise = shouldUseApi()
    ? fetchJson('/api/escursioni').catch(function () {
        // Fallback per ambienti locali senza endpoint API.
        return fetchJson(fallbackUrl);
      })
    : fetchJson(fallbackUrl);

  dataPromise
    .then(function (data) { renderExcursions(data, lang); })
    .catch(function (err) {
      var g = document.getElementById('exc-grid');
      if (g) {
        g.innerHTML = '<p class="text-red-500 text-sm col-span-full text-center py-10">' +
          (lang === 'en' ? 'Unable to load excursions.' : 'Impossibile caricare le escursioni.') +
          '</p>';
      }
      var subtitle = document.getElementById('exc-subtitle');
      if (subtitle) {
        subtitle.textContent = lang === 'en'
          ? 'Temporarily unavailable. Please contact us on WhatsApp.'
          : 'Temporaneamente non disponibile. Contattaci su WhatsApp.';
      }
    });
}());
