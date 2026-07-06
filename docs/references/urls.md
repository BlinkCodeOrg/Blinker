# URLs

## Blinker-specific Protocols

Blinker specific protocols are served by hono.

- `blinker://` - trusted pages with access to most `blinker.*` APIs.
- `blinker-internal://` - internal pages, including browser UI. This will not be accessible in normal user sessions.
- `blinker-external://` - external pages, untrusted. Should not have access to restricted `blinker.*` APIs.

## URL Transformations

For some cases, we show different URLs to the actual ones loaded in the browser. This might be due to Electron's limitations or other reasons.

### URL to Display URL

- `blinker://error` - This displays error pages, with a parameter (`?url=...`) to the actual URL that caused the error. In this case, the URL parameter is the URL that is displayed.
- `blinker://new-tab` - This displays the new tab page. Display URL is empty.
- `blinker://pdf-viewer` - This displays the PDF viewer page, with a parameter (`?url=...`) to the actual PDF URL. In this case, the URL parameter is the PDF URL that is displayed.
- `chrome-extension://` - This is a Chrome extension URL. We're not on Chrome, so we replace it with `extension://`.
- `chrome://` - Internal Chromium pages are mapped to `blinker://` for display.

### Potential Display URL to URL

Converts a user-facing display URL back to the real internal URL. Returns `null` if no transformation is needed.

- `blinker://` or `chrome://` - Most `blinker://` and `chrome://` URLs map to `blinker://`. However, a small whitelist of `chrome://` pages (e.g. `chrome://gpu`, `chrome://tracing`, `chrome://webrtc-internals`) stay as `chrome://` since they are real Chromium internals pages.
- `extension://` → `chrome-extension://`
