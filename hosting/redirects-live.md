# Live redirect configuration

## Diagnosis

The live domain currently serves the site through GitHub Pages behind Cloudflare.
The response headers include `X-Github-Request-Id`, Fastly cache headers, and `Server: cloudflare`.

Because production is GitHub Pages, `server.js` is not executed on the live domain.
GitHub Pages does not support repository-defined 301 redirects for arbitrary `.html` URLs.

## Required live fix

Apply the redirects at Cloudflare, before the request reaches GitHub Pages.

Use `hosting/cloudflare-bulk-redirects.csv` in:

Cloudflare dashboard -> Rules -> Bulk Redirects -> Create Bulk Redirect List -> Import CSV

Then create and deploy a Bulk Redirect Rule for that list.

The CSV format is:

`<SOURCE_URL>,<TARGET_URL>,<STATUS_CODE>,<PRESERVE_QUERY_STRING>,<INCLUDE_SUBDOMAINS>,<SUBPATH_MATCHING>,<PRESERVE_PATH_SUFFIX>`

The exact `.html` rows handle legacy URLs directly to the final non-`www`, extensionless URL.
The final catch-all row handles remaining `www` URLs and preserves path/query.

Do not redirect `ops.html` or the Google verification HTML file.

## Tests

After the Cloudflare rule is deployed, run:

```bash
curl -I https://ischiatransferservice.it/contatti.html
curl -I https://ischiatransferservice.it/index.html
curl -I https://ischiatransferservice.it/en/index.html
curl -I "https://www.ischiatransferservice.it/transfer-ischia.html?x=1"
```

Expected:

```text
HTTP/1.1 301 Moved Permanently
Location: https://ischiatransferservice.it/contatti

HTTP/1.1 301 Moved Permanently
Location: https://ischiatransferservice.it/

HTTP/1.1 301 Moved Permanently
Location: https://ischiatransferservice.it/en/

HTTP/1.1 301 Moved Permanently
Location: https://ischiatransferservice.it/transfer-ischia?x=1
```
