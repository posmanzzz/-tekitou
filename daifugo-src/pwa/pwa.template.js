/* PWA glue for 合言葉大富豪 (loaded after app.js). Generated from pwa.template.js by dist_build.py.
 *
 *   window.__pwa = { canInstall, install(), updateReady, applyUpdate(), version, ui }
 *   window dispatches "pwa-change" whenever canInstall or updateReady changes.
 *   Set window.__pwa.ui = false to turn off the built-in "update ready" toast.
 */
(function () {
  "use strict";
  var VERSION = "__BUILD_VERSION__";
  var canInstall = false, updateReady = false, deferred = null, waiting = null, applying = false, reg = null;

  function emit() {
    try { window.dispatchEvent(new CustomEvent("pwa-change", { detail: { canInstall: canInstall, updateReady: updateReady } })); } catch (e) {}
    syncToast();
  }

  var ui = true;
  var api = {
    get ui() { return ui; },
    set ui(v) { ui = v; syncToast(); },
    get canInstall() { return canInstall; },
    get updateReady() { return updateReady; },
    get version() { return VERSION; },
    install: function () {
      if (!deferred) return Promise.resolve({ outcome: "unavailable" });
      var d = deferred; deferred = null;
      return Promise.resolve().then(function () { d.prompt(); return d.userChoice; }).then(function (c) {
        canInstall = false; emit(); return c;
      }, function () { canInstall = false; emit(); return { outcome: "dismissed" }; });
    },
    applyUpdate: function () {
      if (!updateReady || !waiting) return;
      applying = true; // only reload when WE asked for the swap, never on our own
      try { waiting.postMessage({ type: "SKIP_WAITING" }); } catch (e) { applying = false; }
    },
  };
  window.__pwa = api;

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; canInstall = true; emit(); });
  window.addEventListener("appinstalled", function () { deferred = null; canInstall = false; emit(); });

  // ---- built-in toast (page must not be in a game: `.table` under #app) ----
  var toast = null, poll = null;
  function inGame() { return !!document.querySelector("#app .table"); }
  function showToast() {
    if (toast) return;
    toast = document.createElement("button");
    toast.type = "button";
    toast.setAttribute("role", "status");
    toast.textContent = "新しいバージョンがあるよ（タップで更新）";
    toast.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);" +
      "z-index:99999;max-width:92vw;padding:10px 16px;border-radius:999px;border:1px solid #f5c542;" +
      "background:rgba(7,5,14,.94);color:#f5c542;font:700 13px/1.3 'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif;" +
      "box-shadow:0 4px 18px rgba(0,0,0,.6),0 0 14px rgba(245,197,66,.28);cursor:pointer;-webkit-tap-highlight-color:transparent";
    toast.onclick = function () { api.applyUpdate(); };
    document.body.appendChild(toast);
  }
  function hideToast() { if (toast) { toast.remove(); toast = null; } }
  function syncToast() {
    if (!updateReady) { hideToast(); if (poll) { clearInterval(poll); poll = null; } return; }
    if (!poll) poll = setInterval(syncToast, 1500); // follows the game / entry screen changes (cheap)
    if (ui === false || inGame()) hideToast(); else showToast();
  }

  // ---- service worker ----
  function setWaiting(w) { waiting = w; if (!updateReady) { updateReady = true; emit(); } }
  function track(r) {
    if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
    r.addEventListener("updatefound", function () {
      var n = r.installing; if (!n) return;
      n.addEventListener("statechange", function () {
        if (n.state === "installed" && navigator.serviceWorker.controller) setWaiting(n);
      });
    });
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (applying) { applying = false; location.reload(); }
    });
    var start = function () {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).then(function (r) {
        reg = r; track(r);
        var chk = function () { try { r.update(); } catch (e) {} };
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") chk(); });
        setInterval(chk, 60 * 60 * 1000);
      }).catch(function () {});
    };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  }
})();
