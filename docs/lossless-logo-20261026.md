# Lossless homepage logo optimization

Base: 3bf44b7aa7f89a98ea0253e19e01b9e906880a27. Scope: Italian homepage only.

The production report identifies logo-nav.png as a 46 KiB image. The original 311×129 PNG is retained. The homepage now requests a WebP encoded in lossless, exact mode from that PNG. Decoded RGBA bytes, dimensions and alpha are identical, verified before committing. No resize, palette reduction, sharpening or lossy recompression was used.

- Original: 47,115 bytes.
- Optimized: 36,118 bytes.
- Saving: 10,997 bytes (23.3%) on the homepage request.

Only the image URL changes in markup. CSS, layout, texts, hero, fonts, JavaScript, links and booking behavior are untouched. Other pages retain their existing PNG reference. The original asset remains available.

The existing PR workflow runs build, API/page smoke tests, three mobile Lighthouse runs per revision and mobile/desktop screenshots. A new browser check compares canvas-decoded PNG and WebP RGBA values and verifies that the optimized logo is selected at both viewports.

Do not promise a Lighthouse score increase from an 11 KB saving. The benefit is a deterministic transfer reduction with no pixel changes. The hero is intentionally not recompressed because additional lossy compression cannot guarantee identical output. The summary report does not identify the cause of the observed 210 ms production TBT; no speculative JavaScript changes are included.

No deployment is included in this PR.
