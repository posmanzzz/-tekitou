#!/usr/bin/env python3
"""Builds the production PWA distribution of the single-file daifugo.html.

  dist_build.py [--in PATH] [--out DIR] [--extra-connect "origin origin"] [--test]
                [--site-url URL]

Fails (exit 1, message on stderr) if anything it needs to find in the input is missing,
or if something that must not ship (debug hooks, CDN URLs, inline script) is still present.
"""
import argparse, hashlib, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PWA = os.path.join(HERE, "pwa")
PEERJS_SRC = os.path.join(PWA, "vendor", "peerjs-1.5.5.min.js")
PEERJS_SHA256 = "7604d8c31bec4f134b0d15c2d80b1d095ea18af005354f439f14291fcd7b4168"  # npm peerjs@1.5.5 dist/peerjs.min.js
ICON_DIR = os.path.join(PWA, "icons")
ICONS = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png"]
SW_TPL = os.path.join(PWA, "sw.template.js")
PWA_TPL = os.path.join(PWA, "pwa.template.js")

NAME = "合言葉大富豪"
SHORT = "大富豪"
DESC = "合言葉で友達と遊べるブラウザ大富豪。UNO・ババ抜き・神経衰弱もあるよ。CPUとひとりでも、オンラインで最大みんなでも。"
BG = "#07050e"
DEFAULT_SITE = "https://posmanzzz.github.io/-tekitou/daifugo/"


def die(msg):
    sys.stderr.write("BUILD FAILED: " + msg + "\n")
    sys.exit(1)


def sub_once(text, pattern, repl, what, flags=0):
    """Regex-substitute exactly one match, or die."""
    rx = re.compile(pattern, flags)
    found = rx.findall(text)
    if len(found) != 1:
        die("expected exactly 1 occurrence of %s in the input, found %d (pattern: %s). "
            "The source changed shape; update dist_build.py." % (what, len(found), pattern))
    return rx.sub(lambda m: repl, text, count=1)


def csp(extra):
    connect = ["'self'", "https://0.peerjs.com", "wss://0.peerjs.com"] + extra.split()
    d = [
        ("default-src", "'self'"),
        ("script-src", "'self'"),
        ("style-src", "'self' 'unsafe-inline'"),
        ("img-src", "'self' data: blob:"),
        ("connect-src", " ".join(connect)),
        ("worker-src", "'self'"),
        ("manifest-src", "'self'"),
        ("object-src", "'none'"),
        ("base-uri", "'none'"),
        ("form-action", "'none'"),
    ]
    return "; ".join(k + " " + v for k, v in d)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="/home/claude/daifugo.html")
    ap.add_argument("--out", default="/home/claude/dist")
    ap.add_argument("--extra-connect", default="", help="extra connect-src origins (local testing only)")
    ap.add_argument("--test", action="store_true", help="keep window.__DFG_PEER_OPTS__ (test builds only)")
    ap.add_argument("--site-url", default=DEFAULT_SITE, help="absolute URL of the deployed folder (only used for og:url/og:image)")
    a = ap.parse_args()

    if not os.path.isfile(a.inp):
        die("input not found: " + a.inp)
    html = open(a.inp, encoding="utf-8").read()

    # ---- required assets ----
    for p in [PEERJS_SRC, SW_TPL, PWA_TPL] + [os.path.join(ICON_DIR, i) for i in ICONS]:
        if not os.path.isfile(p):
            die("missing build asset: %s (icons come from pwa/make_icons.py)" % p)
    peer = open(PEERJS_SRC, "rb").read()
    if hashlib.sha256(peer).hexdigest() != PEERJS_SHA256:
        die("vendored PeerJS does not match the official 1.5.5 build (sha256 mismatch)")
    peer = re.sub(rb"\n?//# sourceMappingURL=\S+\s*$", b"\n", peer)  # no .map shipped

    # ---- split the single file ----
    if len(re.findall(r"<style[\s>]", html)) != 1:
        die("expected exactly one <style> block in the input")
    css = re.search(r"<style[^>]*>(.*?)</style>", html, re.S)
    if not css:
        die("<style> block not terminated")
    css_text = css.group(1)
    scripts = re.findall(r"<script\b[^>]*>", html)
    if len(scripts) != 1 or "src=" in scripts[0]:
        die("expected exactly one inline <script> (found %d: %s)" % (len(scripts), scripts))
    js = re.search(r"<script>(.*)</script>", html, re.S)
    if not js:
        die("inline <script> block not found")
    js_text = js.group(1)
    if "</script" in js_text.lower():
        pass  # fine: only the greedy match end counts, and there is a single script tag

    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body:
        die("<body>...</body> not found")
    body_inner = body.group(1)
    body_inner = body_inner.replace(js.group(0), "")
    if "<script" in body_inner.lower():
        die("a <script> remains in the body after extraction")
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    if not title:
        die("<title> not found")
    if not re.search(r'<div id="app"></div>', body_inner):
        die('<div id="app"></div> not found in the body (pwa.js game detection and app.js rely on it)')
    if not re.search(r'<meta name="viewport"', html):
        die("viewport meta not found in the input (sanity check on head layout)")

    # ---- app.js transforms (each must match exactly once) ----
    js_text = sub_once(js_text, r"^[ \t]*window\.__dfg=\{[^\n]*\};[ \t]*\n", "", "the `window.__dfg={...};` debug export", re.M)
    js_text = sub_once(js_text, r"^[ \t]*if\(window\.__DFG_TEST__\) return;[ \t]*\n", "", "the `if(window.__DFG_TEST__) return;` test guard", re.M)
    js_text = sub_once(js_text, r"^[ \t]*window\.__dfgDebug *=[^\n]*\n", "", "the `window.__dfgDebug/__dfgSet/__dfgNet` line", re.M)
    js_text = sub_once(js_text, r"for\(const u of \[\s*\"https://unpkg\.com[^\]]*\]\)", "for(const u of [])", "the CDN fallback URL list for PeerJS")
    if not a.test:
        js_text = sub_once(js_text, r"\.\.\.\(window\.__DFG_PEER_OPTS__\|\|\{\}\)", "", "the `...(window.__DFG_PEER_OPTS__||{})` spread")
        js_text = js_text.replace("{debug:0, config:{iceServers:ICE_SERVERS}, }", "{debug:0, config:{iceServers:ICE_SERVERS}}")
    # post-conditions: nothing debug-ish may survive
    bad = ["__dfg", "__DFG_TEST__", "unpkg.com", "jsdelivr"] + ([] if a.test else ["__DFG_PEER_OPTS__"])
    for b in bad:
        if b in js_text:
            line = [l for l in js_text.splitlines() if b in l][0][:140]
            die("`%s` is still present in app.js after stripping (new debug hook?): %s" % (b, line))
    if re.search(r"window\.__\w+\s*=", js_text):
        m = re.search(r"window\.__\w+\s*=", js_text)
        die("unexpected global debug-style assignment still in app.js: " + m.group(0))
    for pat, what in [(r"\beval\s*\(", "eval()"), (r"\bnew Function\b", "new Function"), (r"javascript:", "javascript: URL"),
                      (r"setTimeout\(\s*[\"'`]", "string setTimeout"), (r"setInterval\(\s*[\"'`]", "string setInterval"),
                      (r"\bon(click|change|input|error|load|submit|keydown|keyup|pointerdown|touchstart|mouse\w+)\s*=\s*[\"']", "inline event-handler attribute")]:
        if re.search(pat, js_text) or re.search(pat, body_inner):
            die("CSP-incompatible construct found in the source: " + what + " (fix the source, the policy is not loosened)")

    # ---- manifest ----
    manifest = {
        "id": "./",
        "name": NAME, "short_name": SHORT, "description": DESC, "lang": "ja", "dir": "ltr",
        "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
        "theme_color": BG, "background_color": BG, "categories": ["games", "entertainment"],
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"

    # ---- index.html (template: asset refs get ?v=<build hash> after hashing) ----
    site = a.site_url if a.site_url.endswith("/") else a.site_url + "/"
    head = f'''<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{csp(a.extra_connect)}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<title>{title.group(1)}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="{BG}">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{NAME}">
<meta property="og:description" content="{DESC}">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="{site}">
<meta property="og:image" content="{site}icons/icon-512.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="{SHORT}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="app.css?v=__V__">
</head>'''
    tail = '''<noscript><div style="padding:24px;color:#f5c542;font-family:serif">JavaScriptを有効にしてね。</div></noscript>
<script src="peerjs.min.js?v=__V__"></script>
<script src="app.js?v=__V__"></script>
<script src="pwa.js?v=__V__"></script>'''
    index_tpl = f'<!DOCTYPE html>\n<html lang="ja">\n{head}\n<body>{body_inner.rstrip()}\n{tail}\n</body>\n</html>\n'

    pwa_tpl = open(PWA_TPL, encoding="utf-8").read()
    sw_tpl = open(SW_TPL, encoding="utf-8").read()
    for t, n in [(pwa_tpl, "pwa.template.js"), (sw_tpl, "sw.template.js")]:
        if "__BUILD_VERSION__" not in t:
            die(n + " lacks the __BUILD_VERSION__ placeholder")

    files = {  # name -> bytes (templates unexpanded for hashing)
        "index.html": index_tpl.encode(), "app.js": js_text.encode(), "app.css": css_text.strip("\n").encode() + b"\n",
        "peerjs.min.js": peer, "manifest.webmanifest": manifest_text.encode(), "pwa.js": pwa_tpl.encode(),
    }
    for i in ICONS:
        files["icons/" + i] = open(os.path.join(ICON_DIR, i), "rb").read()
    h = hashlib.sha256()
    for k in sorted(files):
        h.update(k.encode() + b"\0" + hashlib.sha256(files[k]).digest())
    h.update(sw_tpl.encode())
    ver = h.hexdigest()[:12]
    for k in ("index.html", "pwa.js"):
        files[k] = files[k].decode().replace("__V__", ver).replace("__BUILD_VERSION__", ver).encode()

    shell = ["./"] + sorted(k if k != "index.html" else "index.html" for k in files)
    shell_urls = []
    for k in sorted(files):
        shell_urls.append(k + ("?v=" + ver if k in ("app.js", "app.css", "peerjs.min.js", "pwa.js") else ""))
    shell_urls.insert(0, "./")
    files["sw.js"] = sw_tpl.replace("__BUILD_VERSION__", ver).replace("__SHELL__", json.dumps(shell_urls, ensure_ascii=False)).encode()

    # ---- write ----
    if os.path.isdir(a.out):
        shutil.rmtree(a.out)
    for k, v in files.items():
        p = os.path.join(a.out, k)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(v)
    print("built %s -> %s  version %s%s" % (a.inp, a.out, ver, "  [TEST BUILD: __DFG_PEER_OPTS__ kept]" if a.test else ""))
    for k in sorted(files):
        print("  %-26s %8d bytes" % (k, len(files[k])))
    print("CSP:", csp(a.extra_connect))


if __name__ == "__main__":
    main()
