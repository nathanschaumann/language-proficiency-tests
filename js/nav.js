/* Navigation bar and route table shared by every page. Each page is a plain
   HTML document; a route is "which document" plus a ?route= query that the
   document reads on load. */
(function (global) {
  "use strict";

  var ROUTES = {
    "": { doc: "index.html", page: "Tests" },
    "exams": { doc: "index.html", page: "Tests" },
    "practice": { doc: "index.html", page: "Practice" },
    "results": { doc: "results.html", page: "Results" },
    "how": { doc: "results.html", page: "How it works" },
    "listening": { doc: "index.html", page: "Portuguese listening test" },
    "reading": { doc: "index.html", page: "Portuguese reading test" },
    "listening-ru": { doc: "index.html", page: "Russian listening test" },
    "listening-es": { doc: "index.html", page: "Spanish listening test" },
    "speaking/exam": { doc: "speaking.html", page: "Speaking test" },
    "speaking/sample": { doc: "speaking.html", page: "Sample result" },
    "speaking/drill": { doc: "speaking.html", page: "Speaking practice" },
    "writing/drill": { doc: "speaking.html", page: "Writing practice" },
    "speaking/drill-hy": { doc: "speaking.html", page: "Speaking practice" },
    "writing/drill-hy": { doc: "speaking.html", page: "Writing practice" },
    "speaking/drill-ru": { doc: "speaking.html", page: "Speaking practice" },
    "writing/drill-ru": { doc: "speaking.html", page: "Writing practice" }
  };

  var PILL_OF = {
    "": "", "exams": "", "listening": "", "reading": "", "listening-ru": "", "listening-es": "",
    "speaking/exam": "", "speaking/sample": "",
    "practice": "practice", "speaking/drill": "practice", "writing/drill": "practice",
    "speaking/drill-hy": "practice", "writing/drill-hy": "practice",
    "speaking/drill-ru": "practice", "writing/drill-ru": "practice",
    "results": "results", "how": "how"
  };

  var BAR_CSS = [
    ":root { --nav-h: 62px; }",
    "body.in-test .navbar, body.in-test .site-footer { display: none; }",
    ".navbar { height: 38px; box-sizing: border-box; display: flex; align-items: center;",
    "  justify-content: space-between; gap: 16px; padding: 0 18px; background: var(--card, #fff);",
    "  border-bottom: 1px solid var(--border, #dde3ef);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: var(--fs-md); }",
    ".navbar-where { white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "  color: var(--muted, #6b7a99); font-weight: 600; }",
    ".navbar-where b { color: var(--text, #1a2030); font-weight: 700; }",
    ".navbar-sep { margin: 0 6px; opacity: 0.55; }",
    ".navbar-links { flex: none; display: flex; gap: 8px; align-items: center; }",
    ".navbar-links a { white-space: nowrap; color: var(--muted, #6b7a99); text-decoration: none;",
    "  border: 1px solid var(--border, #dde3ef); border-radius: 999px; padding: 3px 12px;",
    "  font-size: var(--fs-sm); font-weight: 600; }",
    ".navbar-links a:hover { color: var(--text, #1a2030); border-color: var(--accent, #4f7ef8); }",
    ".navbar-links a.navbar-here { color: #fff; background: var(--accent, #4f7ef8); border-color: var(--accent, #4f7ef8); }",
    "body:not(.in-test) .step-body { padding-bottom: 44px; }",
    ".site-footer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--bg, #eef1f6);",
    "  height: 24px; box-sizing: border-box; padding: 0 18px; display: flex; align-items: center;",
    "  justify-content: center; color: var(--muted-2, #8a94ad); font-size: 11px; white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }",
    "@media (max-width: 560px) { .navbar { padding: 0 8px; gap: 8px; } .navbar-links { gap: 4px; }",
    "  .navbar-links a { padding: 3px 7px; } .site-footer { font-size: 9px; padding: 0 6px; } }",
    "@media (max-width: 430px) { .navbar-where { display: none; } }"
  ].join("\n");

  var FOOTER = "Inspired by the ACTFL Proficiency Guidelines. Not affiliated with or endorsed by ACTFL; results are not official ratings.";

  function resolve(route) {
    return Object.prototype.hasOwnProperty.call(ROUTES, route) ? route : "";
  }
  function urlFor(route) {
    var r = ROUTES[route] || ROUTES[""];
    var params;
    try { params = new URLSearchParams(global.location.search); } catch (e) { params = new URLSearchParams(); }
    params.delete("route");
    if (route) params.set("route", route);
    var q = params.toString();
    return r.doc + (q ? "?" + q : "");
  }
  function routeFromQuery() {
    var q = "";
    try { q = new URLSearchParams(global.location.search).get("route") || ""; } catch (e) { q = ""; }
    return resolve(q);
  }
  var _route = routeFromQuery();
  function go(route) { global.location.href = urlFor(resolve(route)); }

  var barEl = null, pageEl = null;
  function pillFor(route) { return Object.prototype.hasOwnProperty.call(PILL_OF, route) ? PILL_OF[route] : ""; }
  function linkHtml(route, label) {
    return '<a href="' + urlFor(route) + '" data-route="' + route + '"' +
      (pillFor(_route) === route ? ' class="navbar-here"' : "") + ">" + label + "</a>";
  }
  function setPage(page) {
    if (pageEl) pageEl.textContent = page || (ROUTES[_route] || ROUTES[""]).page;
  }
  function setTestMode(on) { document.body.classList.toggle("in-test", !!on); }

  function mount() {
    if (barEl) return;
    var style = document.createElement("style");
    style.textContent = BAR_CSS;
    document.head.appendChild(style);
    barEl = document.createElement("div");
    barEl.className = "navbar";
    barEl.innerHTML =
      '<span class="navbar-where"><b>Language Proficiency Practice Tests</b><span class="navbar-sep">&middot;</span>' +
      '<span id="navbar-page"></span></span>' +
      '<nav class="navbar-links">' +
      linkHtml("", "Tests") + linkHtml("practice", "Practice") + linkHtml("results", "Results") + linkHtml("how", "How it works") +
      "</nav>";
    document.body.insertBefore(barEl, document.body.firstChild);
    pageEl = barEl.querySelector("#navbar-page");
    setPage();
    function addFooter() {
      var foot = document.createElement("div");
      foot.className = "site-footer";
      foot.textContent = FOOTER;
      document.body.appendChild(foot);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addFooter);
    else addFooter();
  }

  global.NavBar = {
    ROUTES: ROUTES, mount: mount, setPage: setPage, setTestMode: setTestMode,
    route: function () { return _route; }, go: go, urlFor: urlFor, footer: FOOTER
  };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})(window);
