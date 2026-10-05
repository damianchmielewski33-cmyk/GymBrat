/**
 * Ładowane przed hydracją (next/script beforeInteractive).
 * Tylko produkcja — ogranicza React DevTools i logi konsoli.
 */
(function () {
  try {
    if (typeof window === "undefined") return;
    var host = window.location && window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      (host && host.endsWith(".local"))
    ) {
      return;
    }

    var noop = function () {};
    var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && typeof hook === "object") {
      for (var key in hook) {
        if (Object.prototype.hasOwnProperty.call(hook, key)) {
          hook[key] = typeof hook[key] === "function" ? noop : null;
        }
      }
    }

    var c = window.console;
    if (!c) return;
    var methods = [
      "log",
      "debug",
      "info",
      "warn",
      "table",
      "dir",
      "dirxml",
      "group",
      "groupCollapsed",
      "groupEnd",
      "trace",
      "time",
      "timeEnd",
      "timeLog",
      "assert",
      "count",
      "countReset",
    ];
    for (var i = 0; i < methods.length; i++) {
      try {
        c[methods[i]] = noop;
      } catch (e) {}
    }
  } catch (e) {}
})();
