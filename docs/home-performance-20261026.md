# Homepage performance review — 26 October 2026

Scope: Italian homepage of https://ischiatransferservice.it/. Base commit: ed6db8c47f4e2bb5135141e03647a1669bdf0a2d.

## Evidence before changes

The live HTML was fetched read-only and compared with the repository homepage: it matches apart from Cloudflare email obfuscation and the corresponding injected decoder script. The user's local mobile report at 11:33 reports performance 79 and SEO/accessibility/best practices 100. These scores are historical evidence, not a controlled baseline for this PR.

- CSS initializes --hero-safe-offset at 120px, while syncHeroOffset() recalculates it after DOMContentLoaded, with a floor of 96px. This permits an initial 24px jump when the floor applies. The CSS default now matches that floor; dynamic handling of unusually tall navigation remains intact.
- The logo and four homepage photos had no intrinsic width/height attributes. These now reserve intrinsic aspect ratios. The original logo file and displayed CSS dimensions are unchanged.
- Hero is already eager/high priority and uses modern formats. It had no mobile-specific source. A mobile WebP made from the same original photo is now preloaded only below 768px, matching picture selection. The desktop AVIF remains unchanged.
- Fleet picture sources served multi-megabyte images even on narrow screens. Both source and img now use 480/960px WebP variants of the same originals, retaining lazy loading, alt text and object-fit styling.
- Montserrat was discovered only via CSS. Both used weights are now preloaded. Font swap is retained; residual font layout shifts must be checked in the new traces.
- The essential stylesheet remains blocking to avoid unstyled content. It is minified; ordered defer scripts avoid parser blocking without changing their dependency order.

## Deterministic asset measurements

| Resource | Before | After | Notes |
|---|---:|---:|---|
| CSS | 64,064 B | 44,777 B | 30.1% smaller uncompressed |
| Mobile hero | 369,679 B | 126,180 B | 65.9% smaller versus original AVIF; same photograph |
| Fleet sedan | 2,808,413 B | 30,542 / 103,994 B | 480 / 960 px |
| Fleet minivan | 2,739,540 B | 34,926 / 104,190 B | 480 / 960 px |
| Fleet bus | 2,912,157 B | 33,948 / 118,898 B | 480 / 960 px |

Fleet total: 8,460,110 B before, 99,416–327,082 B after, depending on viewport/DPR. Lazy resources are not necessarily part of initial viewport transfer.

## Validation and limitations

- Build passes. Existing API smoke test passes, using an isolated temporary database and no email credentials.
- The pages smoke test had stale assertions for the unminified script and an unaccented CTA; updated to match current behavior.
- Chrome 145 downloaded successfully, but this execution host prohibits the local socket required to start Chrome (`socket() failed: Operation not permitted`). No new Lighthouse scores, observed LCP element, production TTFB improvement or visual approval is claimed from this host.
- The PR workflow measures the base and candidate sequentially with identical Lighthouse 13.5.0 mobile defaults, three cold runs per revision. It uploads raw reports, median summary and mobile/desktop screenshots, and checks actual picture selection, image loading and mobile navigation without submitting forms.
- Localhost comparisons isolate frontend changes; they cannot measure production Cloudflare/server latency. The initial live fetch verifies code currency, not every historical Lighthouse finding.

## Risks and review gates

Check image detail after lossy resizing, particularly the background on tall mobile hero sections. Review screenshots and actual LCP/CLS audit nodes before accepting the PR. Font preloads may compete for bandwidth; use the comparison to check the net effect. The CSS spacing change also applies to other pages using the shared stylesheet and should be checked on representative Italian/English landing pages. Changes are confined to a feature branch; no production merge or deployment is authorized.
