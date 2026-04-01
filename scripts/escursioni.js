(function () {
  var ORDER = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
  var DAY_IT_TO_EN = null; // set by EN page

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

    grid.innerHTML = items.map(function (item) {
      var badges = (item.days || []).map(function (d) {
        return '<span class="exc-day-badge">' + (dayMap ? (dayMap[d] || d) : d) + '</span>';
      }).join('');
      var priceStr = item.priceNote ? item.priceNote : (item.price ? '\u20AC' + Number(item.price).toFixed(0) : '');
      var includesLabel = lang === 'en' ? 'Included' : 'Incluso';
      var includesHtml = item.includes
        ? '<div class="exc-includes"><strong>' + includesLabel + '</strong>' + item.includes + '</div>'
        : '';
      var notesHtml = item.notes ? '<p class="exc-notes">' + item.notes + '</p>' : '';
      var daysList = (item.days || []).map(function (d) { return dayMap ? (dayMap[d] || d) : d; }).join(', ');
      var waText = lang === 'en'
        ? 'Hi, I would like to book the excursion: ' + item.name + ' (' + daysList + ')' + (priceStr ? ' - ' + priceStr : '')
        : 'Ciao, vorrei prenotare l\'escursione: ' + item.name + ' (' + daysList + ')' + (priceStr ? ' - ' + priceStr : '');
      var waUrl = 'https://wa.me/390813331053?text=' + encodeURIComponent(waText);
      var btnLabel = lang === 'en' ? 'Book on WhatsApp' : 'Prenota su WhatsApp';

      return '<article class="service-card flex flex-col">' +
        '<div class="mb-2">' + badges + '</div>' +
        '<h3 class="mt-0">' + item.name + '</h3>' +
        includesHtml + notesHtml +
        '<div class="mt-auto pt-4 flex items-center justify-between gap-4">' +
          '<span class="exc-price">' + priceStr + '</span>' +
          '<a href="' + waUrl + '" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-whatsapp" style="font-size:0.8rem;padding:8px 14px;">' + btnLabel + '</a>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  var lang = document.documentElement.lang === 'en' ? 'en' : 'it';
  var apiBase = lang === 'en' ? '/api/escursioni' : '/api/escursioni';

  fetch(apiBase)
    .then(function (r) { return r.json(); })
    .then(function (data) { renderExcursions(data, lang); })
    .catch(function (err) {
      var g = document.getElementById('exc-grid');
      if (g) g.innerHTML = '<p class="text-red-500 text-sm col-span-full text-center py-10">Errore: ' + (err && err.message ? err.message : String(err)) + '</p>';
    });
}());
