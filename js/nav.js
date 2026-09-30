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
    ".navbar { min-height: 38px; box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center;",
    "  justify-content: space-between; gap: 4px 16px; padding: 0 18px; background: var(--card, #fff);",
    "  border-bottom: 1px solid var(--border, #dde3ef);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: var(--fs-md); }",
    ".navbar.navbar-rows { padding-top: 4px; padding-bottom: 4px; }",
    ".navbar-left { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 14px; overflow: hidden; }",
    ".navbar .home-link { flex: none; position: relative; margin: 0 !important; padding-right: 15px; white-space: nowrap; }",
    ".navbar .home-link::after { content: ''; position: absolute; right: 0; top: 50%; height: 20px; margin-top: -10px;",
    "  border-right: 1px solid var(--border, #dde3ef); }",
    ".navbar-where { flex: 0 1 auto; min-width: 0; }",
    ".navbar-where { white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "  color: var(--muted, #6b7a99); font-weight: 600; }",
    ".navbar-where b { color: var(--text, #1a2030); font-weight: 700; }",
    ".navbar-sep { margin: 0 6px; opacity: 0.55; }",
    ".navbar.navbar-tight .navbar-where { display: none; }",
    ".navbar.navbar-tight .home-link { padding-right: 0; }",
    ".navbar.navbar-tight .home-link::after { display: none; }",
    ".navbar-links { flex: none; display: flex; gap: 8px; align-items: center; }",
    ".navbar-links a { white-space: nowrap; color: var(--muted, #6b7a99); text-decoration: none;",
    "  border: 1px solid var(--border, #dde3ef); border-radius: 999px; padding: 3px 12px;",
    "  font-size: var(--fs-sm); font-weight: 600; }",
    ".navbar-links a:hover { color: var(--text, #1a2030); border-color: var(--accent, #4f7ef8); }",
    ".navbar-links a.navbar-here { color: #fff; background: var(--accent, #4f7ef8); border-color: var(--accent, #4f7ef8); }",
    "body:not(.in-test) .step-body { padding-bottom: 44px; }",
    ".site-footer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--bg, #eef1f6);",
    "  height: 24px; box-sizing: border-box; padding: 0 18px; display: flex; align-items: center;",
    "  justify-content: center; color: var(--muted-aa, #5b6781); font-size: 11px; white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }",
    /* Touch-sized tabs: phones, small windows and touch screens get 32px-tall tabs. */
    "@media (max-width: 820px), (max-height: 500px), (pointer: coarse) { .navbar-links a { padding-top: 8px; padding-bottom: 8px; } }",
    "@media (max-width: 560px) { .navbar { padding: 0 8px; gap: 4px 8px; } .navbar-links { gap: 4px; }",
    "  .navbar-links a { padding-left: 7px; padding-right: 7px; }",
    "  .site-footer { line-height: 1.3; padding: 4px 10px; height: auto; min-height: 24px; white-space: normal; text-align: center; } }",
    "@media (max-width: 430px) { .navbar-where { display: none; } .navbar .home-link { padding-right: 0; } .navbar .home-link::after { display: none; } }",
    "@media (max-width: 560px) { :root { --nav-h: 94px; } .navbar { min-height: 70px; padding-top: 4px; padding-bottom: 4px;",
    "  align-content: center; row-gap: 4px; }",
    "  .navbar-left { flex: 1 0 100%; } .navbar-links { flex: 0 1 auto; min-width: 0; flex-wrap: wrap; row-gap: 4px; } }"
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
    fit();
  }
  function setTestMode(on) { document.body.classList.toggle("in-test", !!on); if (!on) fit(); }

  // Keep the bar readable at any width. If the page label does not fit next to the home link
  // and the tabs, drop the label (the home link is never cut). When the tabs have to wrap onto
  // a second row, mark the bar so it gets a little vertical padding.
  function fit() {
    if (!barEl || !barEl.offsetHeight) return; // hidden while a test is running
    var left = barEl.querySelector(".navbar-left"), links = barEl.querySelector(".navbar-links");
    function wrapped() { return links.getBoundingClientRect().top >= left.getBoundingClientRect().bottom - 1; }
    barEl.classList.remove("navbar-tight", "navbar-rows");
    if (left.scrollWidth > left.clientWidth + 1 || wrapped()) barEl.classList.add("navbar-tight");
    if (wrapped()) barEl.classList.add("navbar-rows");
  }

  function mount() {
    if (barEl) return;
    var style = document.createElement("style");
    style.textContent = BAR_CSS;
    document.head.appendChild(style);
    barEl = document.createElement("div");
    barEl.className = "navbar";
    barEl.innerHTML =
      '<div class="navbar-left"><span class="navbar-where"><b>Language Proficiency Practice Tests</b><span class="navbar-sep">&middot;</span>' +
      '<span id="navbar-page"></span></span></div>' +
      '<nav class="navbar-links">' +
      linkHtml("", "Tests") + linkHtml("practice", "Practice") + linkHtml("results", "Results") + linkHtml("how", "How it works") +
      "</nav>";
    document.body.insertBefore(barEl, document.body.firstChild);
    // Each page carries a static "Nathan Schaumann, all projects" link (nav.home-link)
    // before this script. Move it into the bar so it does not add a row above the
    // fixed-height layout; if this script ever fails to load, it stays at the page top.
    var home = document.querySelector("nav.home-link");
    if (home) barEl.querySelector(".navbar-left").insertBefore(home, barEl.querySelector(".navbar-where"));
    pageEl = barEl.querySelector("#navbar-page");
    setPage();
    global.addEventListener("resize", fit);
    global.addEventListener("load", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    // The Grading key tab is added (and relabelled) by another script after this one.
    if (global.MutationObserver) new MutationObserver(fit).observe(barEl, { childList: true, subtree: true, characterData: true });
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
