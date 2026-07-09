# Firefox Compatibility

This folder contains Blinker's Firefox WebExtension compatibility layer.

What it does:

- Extracts Firefox `.xpi` packages before import.
- Translates compatible Firefox manifest fields into Chromium/Electron-compatible manifest fields.
- Removes Gecko-only metadata and permissions that Chromium cannot load.
- Injects a lightweight `browser.*` namespace polyfill for compatible WebExtension calls.
- Keeps a registry of Firefox-only APIs with explicit support status.

What it cannot do inside Electron:

- Embed Gecko or XPCOM.
- Implement privileged Firefox-only APIs such as `browser.experiments.*`, `browser.dns`, `browser.geckoProfiler`,
  `browser.pkcs11`, `browser.telemetry`, or `browser.urlbar`.

Those APIs are intentionally reported as unsupported instead of being faked. This keeps compatible Firefox extensions
fast to import while making Gecko-only limits visible in one place.
