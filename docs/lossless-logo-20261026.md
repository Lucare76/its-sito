# Lossless homepage logo optimization

Base: 3bf44b7aa7f89a98ea0253e19e01b9e906880a27. Scope: Italian homepage only.

The production report identifies logo-nav.png as a 46 KiB image. The original 311×129 PNG remains available. The homepage now requests a losslessly recompressed PNG with identical RGBA bytes, dimensions, alpha, sRGB intent, gamma and DPI metadata. No resize, palette reduction, sharpening, color-profile changes or lossy recompression was used. PNG is retained to preserve browser decoding behavior as well as file pixel values.

- Original: 47,115 bytes.
- Optimized: 42,924 bytes.
- Saving: 4,191 bytes (8.9%) on the homepage request.

Only the image URL changes in markup. CSS, layout, texts, hero, fonts, JavaScript, links and booking behavior are untouched. Other pages retain their existing PNG reference.

The existing PR workflow runs build, API/page smoke tests, three mobile Lighthouse runs per revision and mobile/desktop screenshots. A browser check compares canvas-decoded original and optimized PNG RGBA values and verifies that the optimized logo is selected at both viewports. Source files were also compared byte-for-byte after decoding in Pillow, including PNG metadata equality.

Do not promise a Lighthouse score increase from a 4 KB saving. The benefit is a small deterministic transfer reduction with no pixel changes. Additional lossy hero compression cannot guarantee identical output. The summary report does not identify the cause of the observed 210 ms production TBT; no speculative JavaScript changes are included.

No deployment is included in this PR.
