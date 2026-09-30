// Headless browser check. Serves the site locally, drives it in Chrome with audio muted,
// and stubs fetch for api.anthropic.com so no real API call is ever made.
// Usage: node tests/e2e.mjs [--shot]     (CHROME_PATH overrides the browser location)
// The server and the Chrome debugging port are picked fresh on every run (LPP_HTTP_PORT and
// LPP_CDP_PORT pin them), so two runs at once, or a leftover from a killed run, cannot collide.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const HTTP = Number(process.env.LPP_HTTP_PORT) || await freePort();
const CDP = Number(process.env.LPP_CDP_PORT) || await freePort();
const FAKE_KEY = "sk-ant-FAKE-TEST-KEY";
const base = `http://127.0.0.1:${HTTP}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const failures = [];
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) failures.push(msg); };

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lpp-chrome-"));
const server = spawn("perl", ["-e", "alarm 300; exec @ARGV", "python3", "-m", "http.server", String(HTTP), "--bind", "127.0.0.1"],
  { cwd: root, detached: true, stdio: "ignore" });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  "--mute-audio", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  "--autoplay-policy=no-user-gesture-required", "--window-size=1440,900", "--no-first-run",
  "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const chromePid = chrome.pid;
function cleanup() {
  try { process.kill(chromePid); } catch (e) {}
  try { process.kill(-server.pid); } catch (e) {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
}
process.on("exit", cleanup);
setTimeout(() => { console.error("global timeout"); cleanup(); process.exit(2); }, 280000).unref();

// ---- CDP client
let ws, msgId = 0; const pending = new Map(), listeners = [];
async function connect() {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); target = list.find(t => t.type === "page"); } catch (e) {}
    if (!target) await sleep(250);
  }
  if (!target) throw new Error("chrome did not start");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(f => f(m));
  };
}
const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error("eval: " + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || "").slice(0, 400) + " @ " + expr.slice(0, 140));
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function waitFor(expr, ms = 20000, label = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(120); }
  throw new Error("timeout waiting for " + label);
}

const problems = { console: [], failed: [], external: [] };
listeners.push(m => {
  if (m.method === "Runtime.exceptionThrown") problems.console.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") problems.console.push("console.error: " + m.params.args.map(a => a.value || a.description).join(" "));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.console.push("log: " + m.params.entry.text + " " + (m.params.entry.url || ""));
  if (m.method === "Network.loadingFailed" && !m.params.canceled) problems.failed.push(m.params.errorText + " " + m.params.requestId);
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400) problems.failed.push(m.params.response.status + " " + m.params.response.url);
  if (m.method === "Network.requestWillBeSent") {
    const u = m.params.request.url;
    if (!u.startsWith("http://127.0.0.1:" + HTTP) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) problems.external.push(u);
  }
});

const INIT = `
(() => {
  try { localStorage.setItem("lpp_speaking_skip_mic_check", "1"); } catch (e) {}
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.muted = true; this.volume = 0; return play.call(this); };
  window.__calls = [];
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.anthropic.com/")) {
      const body = JSON.parse(opts.body);
      window.__calls.push({ url: String(url), method: opts.method, headers: opts.headers, body });
      const user = body.messages[0].content;
      let text;
      if (body.model === "claude-opus-5") {
        const n = (user.match(/--- Prompt \\d+/g) || []).length;
        const practice = /PRACTICE sitting/.test(user);
        text = JSON.stringify({ rating: "IM", floor: "IL", ceiling: "IH", rationale: "Stubbed rationale for the test.",
          per_prompt: Array.from({ length: n }, (_, i) => Object.assign({ n: i + 1, level_targeted: "IM", kind: "level_check", meets: "fully", note: "Stub note." }, practice ? { rating: "IM" } : {})) });
      } else {
        text = JSON.stringify({ mistakes: [{ quote: "yo tiene", issue: "Verb agreement.", correction: "yo tengo" }] });
      }
      return new Response(JSON.stringify({ id: "msg_stub", type: "message", role: "assistant", model: body.model,
        content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 800 } }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(url, opts);
  };
})();`;

// Look-and-click in ONE evaluation: the timed phases auto-advance (3 s in fast mode), so a separate
// look-then-click can find the button already gone and throw "Cannot read properties of null".
const clickIf = id => ev(`(() => { const b = document.getElementById('${id}'); if (!b) return false; b.click(); return true; })()`);

async function go(rel) { await send("Page.navigate", { url: base + rel }); await sleep(400); await waitFor("document.readyState==='complete'", 15000); }

async function runListening(route, label) {
  await go(`index.html?route=${route}&fast=1`);
  const t0 = Date.now();
  let answered = 0;
  while (Date.now() - t0 < 120000) {
    const st = await ev(`(() => { const a = document.querySelector('.screen.active'); return { s: a && a.id, adv: !!document.getElementById('advance-btn'), pv: !!document.getElementById('preview-next-btn'), rv: !!document.getElementById('review-next-btn') }; })()`);
    if (st.s === "screen-results") break;
    if (st.s === "screen-soundcheck") await clickIf("sc-go-btn");
    else if (st.s === "screen-item") {
      if (st.adv) {
        const did = await ev(`(() => { const btn = document.getElementById('advance-btn'), p = App.currentPassage; if (!btn || !p) return false; p.questions.forEach((q, i) => { const pick = Math.random() < 0.75 ? q.correct : (q.correct + 1) % 4; const inp = document.querySelector('input[name="q' + i + '"][value="' + pick + '"]'); if (inp) inp.click(); }); btn.click(); return true; })()`);
        if (did) answered++;
      } else if (st.pv) await clickIf("preview-next-btn");
      else if (st.rv) await clickIf("review-next-btn");
    }
    await sleep(150);
  }
  const res = await ev(`({ rating: document.getElementById('results-rating').textContent, pair: document.getElementById('results-pair').textContent, rows: document.querySelectorAll('#breakdown-body tr').length, saved: JSON.parse(localStorage.getItem('lpp_listening_history')||'[]').length })`);
  check(!!res && res.rows > 10 && /\w/.test(res.rating), `${label}: reached results after ${answered} passages, rating "${res.rating}", ${res.pair}`);
  return res;
}

async function setKey() {
  await ev(`document.getElementById('key-pill').click()`);
  await ev(`(() => { document.getElementById('kp-input').value = ${JSON.stringify(FAKE_KEY)}; document.getElementById('kp-save').click(); document.getElementById('kp-close').click(); })()`);
  check(await ev(`document.getElementById('key-pill').textContent.includes('set') && !document.getElementById('key-pill').textContent.includes('not set')`), "key pill shows a key is set");
  check(await ev(`localStorage.getItem('lpp_anthropic_key') === null`), "key is NOT written to localStorage by default");
}

async function runSpeakingExam() {
  await go("speaking.html?route=speaking/exam");
  await setKey();
  await waitFor(`document.getElementById('screen-selfassessment').classList.contains('active')`);
  await ev(`document.querySelector('input[name="sa"][value="3"]').click(); document.getElementById('sa-continue-btn').click()`);
  await waitFor(`document.getElementById('screen-setup').classList.contains('active')`);
  await ev(`document.getElementById('setup-skip-btn').click()`);
  await waitFor(`document.getElementById('screen-test').classList.contains('active')`);
  for (let i = 1; i <= 14; i++) {
    await waitFor(`document.getElementById('test-progress').textContent.startsWith('Question ${i} ')`, 10000, "question " + i);
    await ev(`(() => { const t = document.getElementById('pf-transcript'); t.value = 'Respuesta de prueba numero ${i}. Me gusta hablar de mi rutina y de mis planes.'; document.getElementById('pf-finish-btn').click(); })()`);
    await sleep(120);
  }
  await waitFor(`document.getElementById('screen-results').classList.contains('active')`);
  await waitFor(`document.getElementById('results-ready') && document.getElementById('results-ready').style.display !== 'none'`, 15000, "rating shown");
  const calls = await ev(`window.__calls`);
  check(calls.length === 1, "speaking test made exactly one API request (stubbed), got " + calls.length);
  const c = calls[0];
  check(c.url === "https://api.anthropic.com/v1/messages" && c.method === "POST", "request goes to https://api.anthropic.com/v1/messages by POST");
  check(c.headers["x-api-key"] === FAKE_KEY && c.headers["anthropic-version"] === "2023-06-01" && c.headers["anthropic-dangerous-direct-browser-access"] === "true",
    "headers: x-api-key, anthropic-version 2023-06-01, anthropic-dangerous-direct-browser-access true");
  check(c.body.model === "claude-opus-5" && c.body.max_tokens === 16000 && typeof c.body.system === "string" && c.body.messages[0].role === "user",
    `body: model ${c.body.model}, max_tokens ${c.body.max_tokens}, system prompt and one user message`);
  check(/Form sat: Form 3/.test(c.body.messages[0].content) && (c.body.messages[0].content.match(/--- Prompt \d+/g) || []).length === 14,
    "user message names the form and carries all 14 answers");
  const out = await ev(`({ rating: document.getElementById('results-rating').textContent, fc: document.getElementById('results-floor-ceiling').textContent, rows: document.querySelectorAll('#results-evidence-body tr').length, saved: JSON.parse(localStorage.getItem('lpp_speaking_history')||'[]').length })`);
  check(/Intermediate Mid/.test(out.rating) && out.rows === 14 && out.saved >= 1, `fake response rendered: "${out.rating}", ${out.rows} evidence rows, saved to history`);
}

async function runPractice() {
  await go("speaking.html?route=writing/drill");
  await setKey();
  await waitFor(`document.getElementById('screen-practice2-count').classList.contains('active') && document.querySelector('#practice2-count-grid [data-count]')`);
  await ev(`document.querySelector('#practice2-count-grid [data-count="1"]').click()`);
  await waitFor(`document.getElementById('screen-practice2').classList.contains('active') && document.getElementById('p2-write-box')`);
  await ev(`(() => { const t = document.getElementById('p2-write-box'); t.value = 'Yo tiene un perro y me gusta caminar por el parque.'; t.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('p2-finish-btn').click(); })()`);
  await waitFor(`document.getElementById('screen-practice2-results').classList.contains('active')`);
  await waitFor(`document.querySelector('#practice2-mistakes-list .mistake-item')`, 15000, "mistake list");
  await waitFor(`document.getElementById('practice2-ready') && document.getElementById('practice2-ready').style.display !== 'none'`, 15000, "practice rating");
  const calls = await ev(`window.__calls`);
  const models = calls.map(c => c.body.model).sort().join(",");
  check(models === "claude-opus-5,claude-sonnet-5", "practice made one rating call (claude-opus-5) and one mistake-check call (claude-sonnet-5): " + models);
  const sonnet = calls.find(c => c.body.model === "claude-sonnet-5");
  check(/TYPED/.test(sonnet.body.messages[0].content) && sonnet.headers["x-api-key"] === FAKE_KEY, "mistake check sends the typed-sample line and the key");
  check(await ev(`document.querySelector('#practice2-mistakes-list .mistake-quote').textContent.includes('yo tiene')`), "fake mistakes rendered");
}

async function runSample() {
  await go("speaking.html?route=speaking/sample");
  await waitFor(`document.getElementById('screen-results').classList.contains('active')`);
  const out = await ev(`({ banner: document.getElementById('sample-banner').textContent, rating: document.getElementById('results-rating').textContent, rows: document.querySelectorAll('#results-evidence-body tr').length, rationale: document.getElementById('results-rationale').textContent.length, calls: window.__calls.length })`);
  check(/Sample \(illustrative\)/.test(out.banner) && /Intermediate High/.test(out.rating) && out.rows === 14 && out.rationale > 50 && out.calls === 0,
    `sample result renders (${out.rating}, ${out.rows} rows, no API calls)`);
}

async function runResultsPage() {
  await go("results.html?route=results");
  const out = await ev(`({ lr: document.querySelectorAll('#tbl-lr tbody tr').length, sp: document.querySelectorAll('#tbl-sp tbody tr').length })`);
  check(out.lr >= 1 && out.sp >= 1, `results page lists saved sittings (${out.lr} listening/reading, ${out.sp} speaking)`);
  await go("results.html?route=how");
  check(await ev(`!document.getElementById('view-how').hidden`), "how-it-works page renders");
}

async function shot(rel, file) {
  await go(rel); await sleep(500);
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(root, file), Buffer.from(r.result.data, "base64"));
}

try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch (e) {} await sleep(250); }
  await connect();
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  await go("index.html");
  check(await ev(`document.title`) === "Language Proficiency Practice Tests", "hub loads");
  check(await ev(`document.querySelector('.site-footer').textContent.startsWith('Inspired by the ACTFL Proficiency Guidelines. Not affiliated')`), "footer disclaimer present");
  check(await ev(`document.getElementById('hub-title').textContent === 'Tests' && !/\\bexams?\\b/i.test(document.body.innerText)`), "hub says Tests, with no visible \"exam\" wording");
  check(await ev(`document.querySelectorAll('#origin-line').length === 1`), "origin line shown once on the hub");
  await runListening("listening-es", "Spanish listening");
  await runListening("reading", "Portuguese reading");
  await runSpeakingExam();
  await runPractice();
  await runSample();
  await runResultsPage();
  if (process.argv.includes("--shot")) await shot("index.html?route=exams", "screenshot.png");
  check(problems.console.length === 0, "no console errors" + (problems.console.length ? ": " + problems.console.slice(0, 3).join(" | ") : ""));
  check(problems.failed.length === 0, "no failed requests" + (problems.failed.length ? ": " + problems.failed.slice(0, 3).join(" | ") : ""));
  check(problems.external.length === 0, "no requests left the local server" + (problems.external.length ? ": " + problems.external.slice(0, 3).join(" | ") : ""));
} catch (e) {
  check(false, "harness error: " + e.message);
}
cleanup();
console.log(failures.length ? `\n${failures.length} FAILED` : "\nALL PASSED");
process.exit(failures.length ? 1 : 0);
