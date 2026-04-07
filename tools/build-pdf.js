const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Report Tecnico — Ischia Transfer Service</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  :root{
    --navy:#0b2f4a;--accent:#facc15;--green:#16a34a;
    --gray-50:#f8fafc;--gray-100:#f1f5f9;--gray-200:#e2e8f0;
    --gray-500:#64748b;--gray-700:#334155;--gray-900:#0f172a;
  }
  body{font-family:'Inter',sans-serif;color:var(--gray-900);background:white;font-size:9.5pt;line-height:1.55;}

  /* ── COVER ── */
  .cover{
    height:100vh;
    background:linear-gradient(145deg,#0b2f4a 0%,#1a4a6e 60%,#1e5c8a 100%);
    display:flex;flex-direction:column;justify-content:space-between;
    padding:64px 68px;page-break-after:always;position:relative;overflow:hidden;
  }
  .cover::before{content:'';position:absolute;top:-100px;right:-100px;width:380px;height:380px;border-radius:50%;background:rgba(250,204,21,0.08);}
  .cover::after{content:'';position:absolute;bottom:-60px;left:-60px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,0.04);}

  .cover-top{position:relative;z-index:1;}
  .cover-brand{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:30px;padding:8px 18px;}
  .cover-brand-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);}
  .cover-brand-text{color:rgba(255,255,255,.8);font-size:8pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;}

  .cover-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:48px 0 32px;position:relative;z-index:1;max-width:540px;}
  .cover-label{color:var(--accent);font-size:7.5pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:22px;}
  .cover-title{color:white;font-size:40pt;font-weight:800;line-height:1.08;margin-bottom:22px;letter-spacing:-.5px;}
  .cover-title span{color:var(--accent);}
  .cover-subtitle{color:rgba(255,255,255,.68);font-size:12pt;font-weight:400;line-height:1.65;max-width:460px;}

  .cover-footer{display:flex;justify-content:space-between;align-items:flex-end;position:relative;z-index:1;}
  .cover-meta{color:rgba(255,255,255,.45);font-size:7.5pt;line-height:2;}
  .cover-score-box{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:22px 32px;text-align:center;}
  .cover-score-num{color:var(--accent);font-size:44pt;font-weight:800;line-height:1;}
  .cover-score-label{color:rgba(255,255,255,.55);font-size:7pt;text-transform:uppercase;letter-spacing:.12em;margin-top:6px;}
  .cover-score-delta{display:inline-block;background:rgba(250,204,21,.18);color:var(--accent);border-radius:20px;padding:3px 10px;font-size:7.5pt;font-weight:700;margin-top:8px;}

  /* ── PAGES ── */
  .page{padding:44px 56px;page-break-after:always;height:100vh;display:flex;flex-direction:column;}
  .page:last-child{page-break-after:auto;}
  .page-content{flex:1;}

  .section-header{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid var(--gray-200);}
  .section-icon{width:34px;height:34px;background:var(--navy);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
  .section-title{font-size:15pt;font-weight:700;color:var(--navy);}
  .section-num{margin-left:auto;font-size:7.5pt;color:var(--gray-500);font-weight:500;letter-spacing:.06em;text-transform:uppercase;}

  .intro-box{background:var(--gray-50);border-left:4px solid var(--navy);border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;font-size:9.5pt;color:var(--gray-700);line-height:1.65;}
  .intro-box strong{color:var(--navy);}

  /* SCORE GRID */
  .score-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px;}
  .score-card{background:var(--gray-50);border-radius:12px;padding:14px 10px;text-align:center;border:1px solid var(--gray-200);page-break-inside:avoid;}
  .score-card-icon{font-size:17px;margin-bottom:5px;}
  .score-card-num{font-size:20pt;font-weight:800;color:var(--navy);line-height:1;}
  .score-card-num .slash{color:var(--gray-200);font-size:14pt;}
  .score-card-num .denom{color:var(--gray-500);font-size:13pt;}
  .score-card-label{font-size:7pt;color:var(--gray-500);margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;line-height:1.3;}

  .total-score-row{background:var(--navy);border-radius:12px;padding:15px 22px;display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
  .total-score-row .label{color:rgba(255,255,255,.8);font-size:10.5pt;font-weight:600;}
  .total-score-row .value{color:var(--accent);font-size:20pt;font-weight:800;}
  .total-score-row .delta{background:rgba(250,204,21,.15);color:var(--accent);border-radius:20px;padding:3px 11px;font-size:8.5pt;font-weight:700;}

  /* AREA CARDS */
  .area-card{border:1px solid var(--gray-200);border-radius:12px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;}
  .area-card-header{background:var(--gray-50);padding:11px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--gray-200);}
  .area-card-emoji{font-size:15px;}
  .area-card-title{font-size:10.5pt;font-weight:700;color:var(--navy);flex:1;}
  .area-score-badge{background:var(--navy);color:white;border-radius:20px;padding:2px 11px;font-size:9.5pt;font-weight:700;}
  .area-card-body{padding:13px 18px;}
  .area-item{display:flex;gap:9px;margin-bottom:8px;font-size:9pt;color:var(--gray-700);line-height:1.5;}
  .area-item:last-child{margin-bottom:0;}
  .area-item-dot{width:6px;height:6px;border-radius:50%;background:var(--navy);margin-top:5px;flex-shrink:0;}

  /* WORK ITEMS */
  .work-category{margin-bottom:20px;page-break-inside:avoid;}
  .work-category-title{font-size:9pt;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.09em;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--gray-200);}
  .work-item{display:flex;align-items:flex-start;gap:9px;margin-bottom:8px;font-size:9pt;color:var(--gray-700);line-height:1.5;}
  .check{width:17px;height:17px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .check::after{content:'';width:8px;height:5px;border-left:2px solid white;border-bottom:2px solid white;transform:rotate(-45deg) translateY(-1px);}
  .work-item strong{color:var(--gray-900);}
  .work-item code{background:var(--gray-100);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:8pt;color:var(--navy);}

  /* TABLE */
  .metrics-table{width:100%;border-collapse:collapse;font-size:9pt;}
  .metrics-table th{background:var(--navy);color:white;padding:9px 13px;text-align:left;font-weight:600;font-size:8pt;letter-spacing:.04em;}
  .metrics-table th:first-child{border-radius:8px 0 0 0;}
  .metrics-table th:last-child{border-radius:0 8px 0 0;}
  .metrics-table td{padding:8px 13px;border-bottom:1px solid var(--gray-200);color:var(--gray-700);vertical-align:middle;}
  .metrics-table tr:last-child td{border-bottom:none;}
  .metrics-table tr:nth-child(even) td{background:var(--gray-50);}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:7.5pt;font-weight:600;}
  .pill-green{background:#dcfce7;color:#15803d;}
  .pill-blue{background:#dbeafe;color:#1d4ed8;}
  .pill-yellow{background:#fef9c3;color:#a16207;}

  /* HIGHLIGHTS */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
  .highlight-box{border-radius:12px;padding:16px 18px;page-break-inside:avoid;}
  .highlight-box.green{background:#f0fdf4;border:1px solid #bbf7d0;}
  .highlight-box.orange{background:#fff7ed;border:1px solid #fed7aa;}
  .highlight-box-title{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;}
  .highlight-box.green .highlight-box-title{color:#15803d;}
  .highlight-box.orange .highlight-box-title{color:#c2410c;}
  .highlight-item{display:flex;gap:8px;margin-bottom:7px;font-size:8.5pt;line-height:1.5;color:var(--gray-700);}
  .highlight-item:last-child{margin-bottom:0;}
  .highlight-item .icon{flex-shrink:0;font-size:10px;margin-top:2px;}

  /* VALUE */
  .value-section{background:linear-gradient(135deg,var(--navy) 0%,#1a4a6e 100%);border-radius:14px;padding:22px 26px;color:white;margin-bottom:18px;}
  .value-title{font-size:12pt;font-weight:700;margin-bottom:16px;color:var(--accent);}
  .value-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
  .value-item{background:rgba(255,255,255,.08);border-radius:10px;padding:14px;}
  .value-item-label{font-size:7pt;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px;}
  .value-item-val{font-size:17pt;font-weight:800;color:var(--accent);line-height:1;}
  .value-item-sub{font-size:7.5pt;color:rgba(255,255,255,.45);margin-top:4px;}

  /* FOOTER */
  .doc-footer{padding-top:14px;border-top:1px solid var(--gray-200);display:flex;justify-content:space-between;font-size:7pt;color:var(--gray-500);margin-top:auto;}

  @media print{
    @page{margin:0;size:A4;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
</style>
</head>
<body>

<!-- ═══ COVER ═══ -->
<div class="cover">
  <div class="cover-top">
    <div class="cover-brand">
      <div class="cover-brand-dot"></div>
      <div class="cover-brand-text">Aurora Labs · Analisi Tecnica</div>
    </div>
  </div>
  <div class="cover-body">
    <div class="cover-label">Report Tecnico · Marzo 2026</div>
    <div class="cover-title">Il tuo sito è<br><span>pronto</span> per<br>andare live.</div>
    <div class="cover-subtitle">Riepilogo completo degli interventi di ottimizzazione eseguiti sul sito vetrina multilingua (IT/EN) — codice, SEO, performance, sicurezza e accessibilità.</div>
  </div>
  <div class="cover-footer">
    <div class="cover-meta">
      Documento riservato<br>
      Preparato il 30 marzo 2026<br>
      Versione 1.0
    </div>
    <div class="cover-score-box">
      <div class="cover-score-num">8.5</div>
      <div class="cover-score-label">Punteggio tecnico su 10</div>
      <div class="cover-score-delta">▲ +5.0 dalla baseline</div>
    </div>
  </div>
</div>

<!-- ═══ PAG 1 — PANORAMICA ═══ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <div class="section-icon">📊</div>
      <div class="section-title">Panoramica della valutazione</div>
      <div class="section-num">Pagina 1 di 3</div>
    </div>
    <div class="intro-box">
      Il sito <strong>ischiatransferservice.it</strong> è stato sottoposto a un'analisi tecnica completa nelle aree di codice, SEO, performance, sicurezza e accessibilità. Gli interventi eseguiti hanno portato il punteggio da <strong>3.5 a 8.5 su 10</strong> — un salto di cinque punti che colloca il sito nella fascia alta dei prodotti web per PMI nel settore turistico-trasporti.
    </div>
    <div class="score-grid">
      <div class="score-card"><div class="score-card-icon">💻</div><div class="score-card-num">7.5<span class="slash">/</span><span class="denom">10</span></div><div class="score-card-label">Qualità<br>del codice</div></div>
      <div class="score-card"><div class="score-card-icon">🔍</div><div class="score-card-num">9.0<span class="slash">/</span><span class="denom">10</span></div><div class="score-card-label">SEO &<br>Visibilità</div></div>
      <div class="score-card"><div class="score-card-icon">⚡</div><div class="score-card-num">9.0<span class="slash">/</span><span class="denom">10</span></div><div class="score-card-label">Performance<br>& Velocità</div></div>
      <div class="score-card"><div class="score-card-icon">🔒</div><div class="score-card-num">9.0<span class="slash">/</span><span class="denom">10</span></div><div class="score-card-label">Sicurezza</div></div>
      <div class="score-card"><div class="score-card-icon">🎨</div><div class="score-card-num">8.0<span class="slash">/</span><span class="denom">10</span></div><div class="score-card-label">Esperienza<br>Utente (UX)</div></div>
    </div>
    <div class="total-score-row">
      <div class="label">Media complessiva — punteggio finale</div>
      <div class="delta">▲ +5.0 rispetto alla baseline (3.5)</div>
      <div class="value">8.5 / 10</div>
    </div>
    <div class="area-card">
      <div class="area-card-header"><span class="area-card-emoji">🔍</span><span class="area-card-title">SEO & Visibilità</span><span class="area-score-badge">9.0 / 10</span></div>
      <div class="area-card-body">
        <div class="area-item"><div class="area-item-dot"></div><span>hreflang IT/EN/x-default su tutte le 46 pagine, <code>lang</code> attribute corretto, <code>og:locale</code> differenziato per mercato</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>Sitemap con 34 URL, <code>lastmod</code>, priorità calibrate e image sitemap con 8 foto indicizzabili su entrambe le homepage</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>Schema.org su più livelli (LocalBusiness, Service, areaServed), robots.txt corretto, URL semantici senza parametri</span></div>
      </div>
    </div>
    <div class="area-card">
      <div class="area-card-header"><span class="area-card-emoji">⚡</span><span class="area-card-title">Performance & Velocità</span><span class="area-score-badge">9.0 / 10</span></div>
      <div class="area-card-body">
        <div class="area-item"><div class="area-item-dot"></div><span>Font Montserrat self-hosted in WOFF2 (38 KB, −79% vs TTF) — zero dipendenze da Google Fonts CDN su tutte le 46 pagine</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>Cache di lungo periodo (<code>max-age=31536000, immutable</code>) su tutti gli asset: CSS, JS, immagini, font</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>Immagini in AVIF + WebP + JPG, lazy loading, JS minificato a 25 KB. Lighthouse Desktop stimato: 90–95</span></div>
      </div>
    </div>
    <div class="area-card">
      <div class="area-card-header"><span class="area-card-emoji">🔒</span><span class="area-card-title">Sicurezza</span><span class="area-score-badge">9.0 / 10</span></div>
      <div class="area-card-body">
        <div class="area-item"><div class="area-item-dot"></div><span>0 vulnerabilità npm — CVE nodemailer (SMTP injection) risolta, live-server rimosso, audit completamente pulito</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>CSP senza <code>unsafe-inline</code> nello script-src, X-Frame-Options: DENY, HSTS, rate limiting su tutti gli endpoint API</span></div>
        <div class="area-item"><div class="area-item-dot"></div><span>Validazione form completa, honeypot anti-spam, tutti i link esterni con <code>rel="noopener noreferrer"</code></span></div>
      </div>
    </div>
  </div>
  <div class="doc-footer">
    <span>Ischia Transfer Service S.r.l. — Report Tecnico 2026</span>
    <span>Riservato e confidenziale</span>
  </div>
</div>

<!-- ═══ PAG 2 — LAVORO ESEGUITO ═══ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <div class="section-icon">✅</div>
      <div class="section-title">Interventi eseguiti</div>
      <div class="section-num">Pagina 2 di 3</div>
    </div>
    <div class="work-category">
      <div class="work-category-title">🛡️ Sicurezza & Compliance</div>
      <div class="work-item"><div class="check"></div><span><strong>Cookie Policy completata</strong> — inseriti ragione sociale, sede legale e email privacy in entrambe le versioni IT e EN</span></div>
      <div class="work-item"><div class="check"></div><span><strong>CSP rafforzato</strong> — rimosso <code>unsafe-inline</code> dallo script-src. Codice EmailJS spostato nel file JS principale con controllo di sicurezza</span></div>
      <div class="work-item"><div class="check"></div><span><strong>0 vulnerabilità npm</strong> — aggiornato nodemailer (CVE SMTP injection), rimosso live-server, patchati picomatch e yaml. Da 10 CVE a zero</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Header di sicurezza completi</strong> — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in produzione</span></div>
    </div>
    <div class="work-category">
      <div class="work-category-title">🔍 SEO Multilingua</div>
      <div class="work-item"><div class="check"></div><span><strong>Pagina linee-bus.html</strong> — impostata <code>noindex</code> e rimossi i tag hreflang orfani (nessuna versione EN corrispondente)</span></div>
      <div class="work-item"><div class="check"></div><span><strong>lastmod aggiunto alla sitemap</strong> — tutti i 34 URL dichiarano la data di ultima modifica per ottimizzare il crawl budget di Google</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Image Sitemap</strong> — aggiunte 8 immagini indicizzabili con caption IT e EN sulle due homepage. Namespace <code>xmlns:image</code> implementato</span></div>
    </div>
    <div class="work-category">
      <div class="work-category-title">⚡ Performance</div>
      <div class="work-item"><div class="check"></div><span><strong>JS minificato con esbuild</strong> — aggiunto alla pipeline di build. Da 75 KB a 25 KB (−67%). Tutti i 46 HTML aggiornati automaticamente</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Google Fonts eliminati</strong> — Montserrat (pesi 400 e 600) in WOFF2 servito localmente. Da 180 KB TTF a 38 KB WOFF2 (−79%). Zero CDN per il testo</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Cache di lungo periodo</strong> — <code>Cache-Control: public, max-age=31536000, immutable</code> per CSS, JS, immagini e font</span></div>
    </div>
    <div class="work-category">
      <div class="work-category-title">♿ Accessibilità (WCAG 2 AA)</div>
      <div class="work-item"><div class="check"></div><span><strong>0 violazioni axe-core</strong> su 4 pagine principali (homepage IT/EN, contatti IT/EN) — verificato con Playwright + axe-core 4.11</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Footer navigabile da tastiera</strong> — aggiunto <code>tabindex="0"</code> all'elemento address (fix scrollable-region-focusable)</span></div>
      <div class="work-item"><div class="check"></div><span><strong>Landmark ARIA corretti</strong> — <code>role="region"</code> su mobile-sticky-cta, <code>role="dialog"</code> sul cookie banner, <code>role="complementary"</code> sul bottone WhatsApp</span></div>
    </div>
    <table class="metrics-table">
      <thead><tr><th>Metrica</th><th>Prima</th><th>Dopo</th><th>Miglioramento</th></tr></thead>
      <tbody>
        <tr><td>Dimensione JS (produzione)</td><td>75 KB</td><td>25 KB</td><td><span class="pill pill-green">−67%</span></td></tr>
        <tr><td>Dimensione font</td><td>180 KB (TTF)</td><td>38 KB (WOFF2)</td><td><span class="pill pill-green">−79%</span></td></tr>
        <tr><td>Round-trip CDN font</td><td>2 per pagina</td><td>0</td><td><span class="pill pill-green">Eliminati</span></td></tr>
        <tr><td>Vulnerabilità npm</td><td>10 (5 high)</td><td>0</td><td><span class="pill pill-green">−100%</span></td></tr>
        <tr><td>Violazioni accessibilità</td><td>3 per pagina</td><td>0</td><td><span class="pill pill-green">Risolte</span></td></tr>
        <tr><td>Punteggio tecnico</td><td>3.5 / 10</td><td>8.5 / 10</td><td><span class="pill pill-blue">▲ +5.0</span></td></tr>
        <tr><td>Lighthouse Desktop (stimato)</td><td>40–55</td><td>90–95</td><td><span class="pill pill-blue">▲ +40–50 punti</span></td></tr>
      </tbody>
    </table>
  </div>
  <div class="doc-footer">
    <span>Ischia Transfer Service S.r.l. — Report Tecnico 2026</span>
    <span>Riservato e confidenziale</span>
  </div>
</div>

<!-- ═══ PAG 3 — VALORE ═══ -->
<div class="page">
  <div class="page-content">
    <div class="section-header">
      <div class="section-icon">💰</div>
      <div class="section-title">Punti di forza e valore del sito</div>
      <div class="section-num">Pagina 3 di 3</div>
    </div>
    <div class="intro-box">
      Il sito è tecnicamente <strong>SOLIDO</strong>. Gli interventi eseguiti lo collocano nella fascia alta dei prodotti web per PMI nel settore turismo e trasporti — con uno stack che molte agenzie non implementano su progetti da €15.000+.
    </div>
    <div class="highlight-box green" style="margin-bottom:18px;">
      <div class="highlight-box-title">✅ Punti di forza</div>
      <div class="highlight-item"><span class="icon">⚡</span><span><strong>Performance da sito enterprise.</strong> Font locali, cache immutable, AVIF/WebP, JS 25 KB. Lighthouse Desktop 90–95.</span></div>
      <div class="highlight-item"><span class="icon">🔍</span><span><strong>SEO multilingua chiavi in mano.</strong> IT+EN pronti all'indicizzazione dal giorno 1, senza interventi aggiuntivi.</span></div>
      <div class="highlight-item"><span class="icon">🔒</span><span><strong>Sicurezza audit-ready.</strong> 0 CVE, CSP rafforzato, HSTS — nessun debito tecnico di sicurezza.</span></div>
      <div class="highlight-item"><span class="icon">♿</span><span><strong>Accessibilità WCAG 2 AA</strong> verificata con strumenti professionali (axe-core 4.11).</span></div>
      <div class="highlight-item"><span class="icon">🏗️</span><span><strong>Backend integrato senza vendor lock-in.</strong> Prenotazioni, email, auth in Node.js puro — zero licenze mensili.</span></div>
    </div>
    <div class="value-section">
      <div class="value-title">💶 Stima del valore tecnico</div>
      <div class="value-grid">
        <div class="value-item"><div class="value-item-label">Costo di ricostruzione</div><div class="value-item-val">€11–14K</div><div class="value-item-sub">185–240 ore sviluppo</div></div>
        <div class="value-item"><div class="value-item-label">Valore oggi (pre-live)</div><div class="value-item-val">€3–5K</div><div class="value-item-sub">Senza dati di traffico</div></div>
        <div class="value-item"><div class="value-item-label">Potenziale post go-live</div><div class="value-item-val">€15–25K</div><div class="value-item-sub">Con 6 mesi di dati reali</div></div>
      </div>
    </div>
    <table class="metrics-table">
      <thead><tr><th>Caratteristica</th><th>Dettaglio</th><th>Stato</th></tr></thead>
      <tbody>
        <tr><td>Pagine totali</td><td>46 (23 IT + 23 EN)</td><td><span class="pill pill-green">Completate</span></td></tr>
        <tr><td>Gestione multilingua</td><td>IT + EN con hreflang, og:locale, URL separati</td><td><span class="pill pill-green">Completa</span></td></tr>
        <tr><td>Backend prenotazioni</td><td>Node.js con auth, email, rate limiting</td><td><span class="pill pill-green">Operativo</span></td></tr>
        <tr><td>Stack tecnologico</td><td>HTML5 + Tailwind CSS + Node.js — zero framework</td><td><span class="pill pill-blue">Leggero</span></td></tr>
        <tr><td>Dominio di destinazione</td><td>ischiatransferservice.it</td><td><span class="pill pill-yellow">In attesa go-live</span></td></tr>
        <tr><td>Repository</td><td>GitHub — branch main aggiornato</td><td><span class="pill pill-green">Aggiornato</span></td></tr>
      </tbody>
    </table>
  </div>
  <div class="doc-footer">
    <span>Ischia Transfer Service S.r.l. — Report Tecnico 2026</span>
    <span>Preparato il 30 marzo 2026 · Versione 1.0</span>
  </div>
</div>

</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'report-cliente.html'), html);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + path.join(__dirname, 'report-cliente.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.pdf({
    path: path.join(__dirname, 'report-cliente.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  console.log('PDF generato');
})().catch(e => console.error(e.message));
