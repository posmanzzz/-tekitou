# 合言葉大富豪 production distribution (PWA + strict CSP)

The source stays ONE file (`/home/claude/daifugo.html`); the split happens at build time.

## Build
    python3 /home/claude/dist_build.py                    # -> /home/claude/dist/
    python3 /home/claude/dist_build.py --in X.html --out DIR
    # local test build only (keeps window.__DFG_PEER_OPTS__, widens connect-src):
    python3 /home/claude/dist_build.py --test --extra-connect "http://127.0.0.1:9100 ws://127.0.0.1:9100" --out /tmp/t
Exit code 1 plus a `BUILD FAILED:` message if the input changed shape (style/script count, hooks that
could not be stripped, new `__dfg*` globals, eval / inline handlers / javascript: URLs, ...).
`--site-url` only feeds og:url / og:image (default is the GitHub Pages URL).

## Test
    cd /home/claude/t && node disttest.js [--in PATH]     # builds, serves :8210 + PeerServer :9100, 56 checks
Screenshots land in `t/dist_*.png`. Takes ~3 min (four full solo games in parallel).

## Deploy (GitHub Pages, folder `daifugo/` of posmanzzz/-tekitou)
Copy the WHOLE content of `/home/claude/dist/` (nothing else, never a `--test` build):
    index.html app.js app.css peerjs.min.js pwa.js sw.js manifest.webmanifest icons/*.png
All URLs are relative, so the sub-path works. Do not publish `snapshot.html`, templates or vendor/.

## Files in this folder
`sw.template.js`, `pwa.template.js` (templates, `__BUILD_VERSION__` is a hash of all built files),
`vendor/peerjs-1.5.5.min.js` (official npm build, sha256 checked by the build),
`make_icons.py` + `icons/` (generated art; rerun the script to redraw), `snapshot.html` (dev copy).

## Caveats
- GitHub Pages cannot set headers: CSP is a `<meta>` tag, so `frame-ancestors` / `report-uri` are not possible.
- `style-src` needs `'unsafe-inline'` because the app renders many `style=""` attributes.
- Page load connects to `wss://0.peerjs.com` (room directory `dirStart()`), even in solo mode.
- Updates: a new service worker waits; `__pwa.updateReady` flips to true and a toast offers the reload.
  A user only sees a deploy after tapping it (or after closing all tabs). Set `window.__pwa.ui=false` to
  hide the built-in toast once the settings screen calls `__pwa.applyUpdate()` itself.
- Asset URLs carry `?v=<hash>` so a half-propagated deploy cannot mix old HTML with new JS.
- The repo's other published copies (single file as-is) are unaffected; they keep the CDN fallback.
- iOS: install prompt does not exist (`canInstall` stays false); use Share > Add to Home Screen.
