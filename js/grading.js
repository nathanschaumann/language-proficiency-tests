/* Speaking grading in the browser, with the visitor's own Anthropic API key.
   The key lives in memory for the session. If the visitor ticks "remember on
   this device" it is also kept in this browser's localStorage. It is only ever
   sent to https://api.anthropic.com. No other server is contacted. */
(function (global) {
  "use strict";

  var API_URL = "https://api.anthropic.com/v1/messages";
  var API_VERSION = "2023-06-01";
  var MODELS = {
    rate: { id: "claude-opus-5", label: "Claude Opus 5", inPerM: 5, outPerM: 25, maxTokens: 16000, effort: "medium" },
    analyze: { id: "claude-sonnet-5", label: "Claude Sonnet 5", inPerM: 2, outPerM: 10, maxTokens: 8000, effort: "low" }
  };
  var STORE_KEY = "lpp_anthropic_key";
  var memKey = "";
  try { memKey = global.localStorage.getItem(STORE_KEY) || ""; } catch (e) { memKey = ""; }

  var LEVEL_LINE =
    "Level codes: NL NM NH (Novice Low, Mid, High), IL IM IH (Intermediate), AL AM AH (Advanced), S (Superior).";

  var FORM_RANGES = {
    1: "NL-IL (Novice Low through Intermediate Low)",
    2: "NL-IH (Novice Low through Intermediate High)",
    3: "NL-AL (Novice Low through Advanced Low)",
    4: "IH-AH (Intermediate High through Advanced High; not ratable below IH)",
    5: "AL-Superior (Advanced Low through Superior; not ratable below AL)"
  };
  var LANGUAGE_NAMES = { es: "Spanish", hy: "Armenian", ru: "Russian" };

  var RATER_SYSTEM = [
    "You are an experienced speaking-proficiency rater. You rate a spoken or typed sample in one language against a",
    "Novice-to-Superior scale with Low, Mid and High sublevels. This is a practice tool, so your rating is an informed",
    "estimate and never an official score. Follow these rules:",
    "",
    "1. RATE THE WHOLE SAMPLE HOLISTICALLY, not prompt by prompt. Weigh four things together: the Functions the speaker can",
    "   perform, the Accuracy of the language produced, the Context and content (topics, settings) handled, and the Text",
    "   type (words and phrases, sentences, paragraphs, extended discourse).",
    "",
    "2. FLOOR = the highest level the speaker sustains across all of those criteria, all of the time, shown across SEVERAL",
    "   prompts (the level-check prompts). One strong answer does not establish a floor.",
    "",
    "3. CEILING = shown by linguistic breakdown on the harder probe prompts one level up. Breakdown markers: losing control of",
    "   the time frame (narrating a past event in the present tense throughout), failing to sustain paragraph-length",
    "   discourse (falling back to strung-together simple sentences), vocabulary narrowing or borrowing from English, needing",
    "   a patient listener to be understood at all. If there is no breakdown anywhere in the sample, the rating tops out at",
    "   the test form's ceiling. Do not invent breakdown that is not there, and do not rate past the form's ceiling.",
    "",
    "4. SUBLEVEL. Low: holds the level only minimally. Mid: solid quantity and quality at the level, consistently, with some",
    "   features of the next level appearing. High: performs next-level functions much of the time but cannot sustain them.",
    "   Superior has no sublevels.",
    "",
    "5. FORM CAP. The form the candidate sat caps the printable range. Never print a rating above the form's ceiling:",
    "   Form 1 ceiling Intermediate Low. Form 2 ceiling Intermediate High. Form 3 ceiling Advanced Low.",
    "   Form 4 floor Intermediate High, ceiling Advanced High. Form 5 floor Advanced Low, ceiling Superior.",
    "",
    "6. REHEARSED OR MEMORIZED LANGUAGE IS DISCOUNTED. A memorized chunk is normal at Novice. An Intermediate or Advanced claim",
    "   built on a script or an obviously rehearsed monologue that does not hold up under a spontaneous probe is not credited.",
    "",
    "7. At Superior, a pattern of errors in basic structures caps the rating at Advanced. A personal anecdote answering an",
    "   abstract opinion prompt is Advanced evidence, not Superior evidence.",
    "",
    LEVEL_LINE,
    "",
    "For EVERY prompt, also write a short evidence note: which level it targeted, whether it was a level-check (routine,",
    "description, habit) or a probe (the harder comparison, complication, opinion or hypothetical prompt), and whether the",
    "response met the targeted level fully, minimally, or not.",
    "",
    "Respond with STRICT JSON ONLY, with no markdown fences and no prose before or after, in exactly this shape:",
    "{",
    '  "rating": "<level code>",',
    '  "floor": "<level code, the sustained floor>",',
    '  "ceiling": "<level code where breakdown appeared, or the form ceiling if none>",',
    '  "rationale": "<2-4 sentences: why this floor, why this ceiling, why this sublevel>",',
    '  "per_prompt": [',
    '    {"n": <int>, "level_targeted": "<level code>", "kind": "level_check" | "probe",',
    '     "meets": "fully" | "minimally" | "not", "note": "<one sentence of evidence>"}',
    "  ]",
    "}"
  ].join("\n");

  var ANALYZER_SYSTEM = [
    "You are a language-speaking coach. You are given the learner's SPOKEN (speech-to-text transcript) or TYPED answer to a",
    "prompt, in the language named in the user message. Your ONLY job is to find concrete grammar and word-choice mistakes",
    "in what the learner actually said or wrote, and explain each one simply.",
    "",
    "Rules:",
    "1. Only flag genuine grammar mistakes (verb conjugation, gender or number agreement, wrong preposition, wrong tense or mood)",
    "   and lexical mistakes (wrong word, a false friend, an anglicism, a word that does not fit the context) that are ACTUALLY",
    "   PRESENT in the text, except where rules 3, 6 and 7 say not to. Only when the sample is TYPED, also flag accent-mark",
    "   mistakes (a missing, extra or wrong written accent the spelling requires). Accents are invisible in speech.",
    "2. Quote the exact wrong phrase verbatim.",
    "3. Do not flag disfluencies that are only artifacts of imperfect speech-to-text (stray repeated words, obvious glitches)",
    "   unless they plausibly reflect a real language error.",
    "4. Do NOT rate overall proficiency and do not mention levels, scores or any holistic rating. Your only output is a flat list",
    "   of specific mistakes.",
    "5. If there are no real mistakes, return an empty list.",
    "6. TRANSCRIPT CHARITY: a spoken transcript is automatic, not what the speaker typed. Before flagging, ask whether the words",
    "   are a plausible mis-hearing of a CORRECT phrase that sounds the same or nearly the same (in Spanish: a ver / haber,",
    "   si no / sino, echo / hecho, vez / ves, split or merged words, dropped or doubled syllables). If a correct reading exists,",
    "   do not flag it.",
    "7. SELF-CORRECTION: when a wrong form is immediately followed by its corrected form in the same sentence, the speaker",
    "   corrected themselves. Do not flag the first attempt.",
    "",
    "Respond with STRICT JSON ONLY, no markdown fences, in exactly this shape:",
    "{",
    '  "mistakes": [',
    '    {"quote": "<the exact wrong phrase>",',
    '     "issue": "<one short sentence: what is wrong, grammar, word-choice or accent-mark>",',
    '     "correction": "<the corrected phrase or word>"}',
    "  ]",
    "}"
  ].join("\n");

  var PRACTICE_LINE =
    "ADDITIONAL OUTPUT FOR THIS PRACTICE SITTING: give EACH per_prompt entry an extra \"rating\" field holding one level code " +
    "(NL NM NH IL IM IH AL AM AH S), the highest level THAT ONE ANSWER, on its own, actually demonstrates. Do not carry a strong " +
    "answer's level across to a weak one, and do not average. A question with no response at all gets \"NL\". Keep every other " +
    "field, including the holistic \"rating\" at the top level, exactly as specified.";
  var TYPED_RATER_LINE =
    "Sample medium: TYPED. The candidate wrote these answers at a keyboard under the same per-question time limit. Nothing here " +
    "was spoken, so judge only the language itself and never pronunciation, accent, delivery, hesitation or pausing.";
  var TYPED_ANALYZE_LINE =
    "Sample medium: TYPED. These are not speech transcripts, so there are no mis-hearings to be charitable about: apply the " +
    "transcript-charity rule to nothing here, and treat a wrong homophone or a stray repeated word as a real mistake. The " +
    "self-correction rule still applies. Also check for accent-mark mistakes.";
  var LANG_RATER_LINES = {
    hy: "Sample language: EASTERN ARMENIAN, not Spanish. Read every mention of Spanish above as Armenian. Typical breakdown markers: " +
      "losing the aorist/imperfect distinction when narrating the past, mis-selecting or dropping case endings and the definite " +
      "article, failing to sustain paragraph-length discourse, and vocabulary narrowing into Russian or English borrowings.",
    ru: "Sample language: RUSSIAN, not Spanish. Read every mention of Spanish above as Russian. Typical breakdown markers: losing " +
      "control of verbal aspect when narrating the past, case-ending and agreement errors (especially after prepositions and " +
      "numerals), mishandled verbs of motion, failing to sustain paragraph-length discourse, and vocabulary narrowing into English borrowings."
  };
  var LANG_ANALYZE_LINES = {
    hy: "Sample language: EASTERN ARMENIAN. The mistakes you list are Armenian grammar and word-choice mistakes.",
    ru: "Sample language: RUSSIAN. The mistakes you list are Russian grammar and word-choice mistakes. Russian is normally written " +
      "without stress marks and often with е for ё: never flag either."
  };

  function langOf(payload) { return LANGUAGE_NAMES[payload.language] ? payload.language : "es"; }

  function buildRaterMessage(payload) {
    var lang = langOf(payload), langName = LANGUAGE_NAMES[lang], first;
    if (payload.form === "practice") {
      first = "Form sat: NONE. This is a PRACTICE sitting, not a form-based administration. There is no form cap: ignore rule 5 " +
        "and rate on the evidence alone across the full Novice Low to Superior range.";
    } else {
      var desc = FORM_RANGES[payload.form] || ("Form " + payload.form + " (unrecognized, use judgment and cap at Advanced High)");
      first = "Form sat: Form " + payload.form + ", printable range " + desc + ".";
    }
    var lines = [first];
    if (payload.mode === "writing") lines.push(TYPED_RATER_LINE);
    if (LANG_RATER_LINES[lang]) lines.push(LANG_RATER_LINES[lang]);
    if (payload.form === "practice") lines.push(PRACTICE_LINE);
    lines.push("", "Transcript, in administration order (prompt n, level targeted, prompt type, the " + langName +
      " prompt or English role-play instruction, the candidate's response):", "");
    (payload.transcripts || []).forEach(function (t) {
      lines.push("--- Prompt " + t.n + " [" + (t.level || "?") + " / " + (t.type || "?") + "] ---");
      if (t.promptEs) lines.push("Prompt (" + langName + "): " + t.promptEs);
      if (t.promptEn) lines.push("Prompt (English gloss/instruction): " + t.promptEn);
      lines.push("Candidate response: " + (t.response || "(no response given / silence)"), "");
    });
    lines.push("Rate this sitting now. Output ONLY the strict JSON object described in your system instructions.");
    return lines.join("\n");
  }

  function buildAnalyzerMessage(payload) {
    var typed = payload.mode === "writing", lang = langOf(payload), langName = LANGUAGE_NAMES[lang];
    var lines = [typed ? langName + " answer the learner TYPED, to check for grammar, word-choice and accent-mark mistakes:"
      : langName + " speaking transcript to check for grammar and word-choice mistakes:", ""];
    if (typed) lines.push(TYPED_ANALYZE_LINE, "");
    if (LANG_ANALYZE_LINES[lang]) lines.push(LANG_ANALYZE_LINES[lang], "");
    (payload.transcripts || []).forEach(function (t, i) {
      lines.push("--- Response " + (i + 1) + " ---");
      if (t.promptEs) lines.push("Prompt (" + langName + "): " + t.promptEs);
      lines.push((typed ? "Learner's typed response: " : "Learner's spoken response transcript: ") +
        (t.response || "(no response given / silence)"), "");
    });
    lines.push("Find the mistakes now. Output ONLY the strict JSON object described in your system instructions.");
    return lines.join("\n");
  }

  function parseJson(text) {
    text = (text || "").trim();
    if (text.indexOf("```") === 0) {
      text = text.replace(/^`+/, "").replace(/`+$/, "");
      if (text.slice(0, 4) === "json") text = text.slice(4);
      text = text.trim();
    }
    return JSON.parse(text);
  }

  /* One call to the Messages API. Resolves to {ok:true, data} or {ok:false, error, detail}. */
  async function callClaude(kind, system, user) {
    if (!memKey) return { ok: false, error: "no-key" };
    var m = MODELS[kind];
    var res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": memKey,
          "anthropic-version": API_VERSION,
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: m.id,
          max_tokens: m.maxTokens,
          system: system,
          output_config: { effort: m.effort },
          messages: [{ role: "user", content: user }]
        })
      });
    } catch (e) {
      return { ok: false, error: "network", detail: "Could not reach api.anthropic.com. Check your connection." };
    }
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = body && body.error && body.error.message ? body.error.message : "HTTP " + res.status;
      if (res.status === 401) return { ok: false, error: "bad-key", detail: "Anthropic rejected the key. Check it and try again." };
      if (res.status === 429) return { ok: false, error: "rate-limited", detail: "Rate limited by Anthropic. Wait a minute and retry." };
      return { ok: false, error: "api-error", detail: msg };
    }
    var text = ((body && body.content) || []).filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; }).join("");
    try { return { ok: true, data: parseJson(text), usage: body.usage || null }; }
    catch (e) { return { ok: false, error: "bad-json", detail: "The model did not return valid JSON. Try again." }; }
  }

  var spent = { inTok: 0, outTok: 0, usd: 0 };
  function addUsage(kind, usage) {
    if (!usage) return;
    var m = MODELS[kind];
    spent.inTok += usage.input_tokens || 0;
    spent.outTok += usage.output_tokens || 0;
    spent.usd += ((usage.input_tokens || 0) * m.inPerM + (usage.output_tokens || 0) * m.outPerM) / 1e6;
  }

  /* runGrading(kind, payload, opts) resolves to the shape the speaking page expects:
       rate:    {ok:true, rating:{...}} or {ok:false, error, detail}
       analyze: {ok:true, mistakes:[...]}; opts.onPartial gets {perQuestion:[{index, mistakes}]} as each answer finishes. */
  async function runGrading(kind, payload, opts) {
    opts = opts || {};
    var onStatus = opts.onStatus || function () {};
    var started = Date.now();
    var tick = setInterval(function () {
      onStatus((kind === "rate" ? "Rating" : "Analysing") + "… " + Math.round((Date.now() - started) / 1000) + "s");
    }, 1000);
    try {
      if (kind === "rate") {
        var r = await callClaude("rate", RATER_SYSTEM, buildRaterMessage(payload));
        if (!r.ok) return r;
        addUsage("rate", r.usage);
        if (!r.data || typeof r.data.rating !== "string") return { ok: false, error: "bad-json", detail: "The rating had no level in it." };
        return { ok: true, rating: r.data };
      }
      var items = payload.transcripts || [], all = [], firstError = null, done = 0, next = 0;
      async function worker() {
        while (next < items.length) {
          var i = next++;
          var one = Object.assign({}, payload, { transcripts: [items[i]] });
          var a = await callClaude("analyze", ANALYZER_SYSTEM, buildAnalyzerMessage(one));
          done++;
          if (!a.ok) { firstError = firstError || a; continue; }
          addUsage("analyze", a.usage);
          var list = (a.data && Array.isArray(a.data.mistakes)) ? a.data.mistakes : [];
          list.forEach(function (m) { m.q = i; all.push(m); });
          if (opts.onPartial) opts.onPartial({ perQuestion: [{ index: i, mistakes: list }] });
        }
      }
      var workers = [];
      for (var w = 0; w < Math.min(4, items.length); w++) workers.push(worker());
      await Promise.all(workers);
      if (firstError && !all.length) return firstError;
      return { ok: true, mistakes: all };
    } finally { clearInterval(tick); }
  }

  /* ---- Cost estimate from the real prompt sizes -------------------------------------- */
  var CHARS_PER_TOKEN = 3.5;      // rough average across English and the tested languages
  var WORDS_PER_ANSWER = 165;     // 90 seconds at about 110 words per minute
  var CHARS_PER_WORD = 6.2;
  var PROMPT_TOKENS = 45;         // one prompt plus its English gloss
  var RATER_VISIBLE_OUT = 350;    // top-level JSON
  var PER_PROMPT_OUT = 65;        // one evidence note
  var THINKING_OUT = 3000;        // assumed adaptive-thinking tokens at medium effort
  var ANALYZER_OUT = 250;
  function tok(chars) { return Math.ceil(chars / CHARS_PER_TOKEN); }
  function usd(kind, inTok, outTok) { var m = MODELS[kind]; return (inTok * m.inPerM + outTok * m.outPerM) / 1e6; }
  function estimate(nQuestions, withAnalysis) {
    var ans = tok(WORDS_PER_ANSWER * CHARS_PER_WORD);
    var rateIn = tok(RATER_SYSTEM.length) + 250 + nQuestions * (ans + PROMPT_TOKENS);
    var rateOut = RATER_VISIBLE_OUT + nQuestions * PER_PROMPT_OUT + THINKING_OUT;
    var total = usd("rate", rateIn, rateOut);
    var detail = { rateIn: rateIn, rateOut: rateOut };
    if (withAnalysis) {
      var anIn = tok(ANALYZER_SYSTEM.length) + 120 + ans + PROMPT_TOKENS;
      total += nQuestions * usd("analyze", anIn, ANALYZER_OUT);
      detail.analyzeCalls = nQuestions;
    }
    return { usd: total, detail: detail };
  }
  function money(x) { return x < 0.01 ? "under $0.01" : "$" + x.toFixed(2); }

  /* ---- Settings panel ----------------------------------------------------------------- */
  var panel = null;
  function hasKey() { return !!memKey; }
  function refreshPill() {
    var pill = document.getElementById("key-pill");
    if (pill) pill.textContent = memKey ? "Grading key: set" : "Grading key: not set";
  }
  function setKey(k, remember) {
    memKey = (k || "").trim();
    try {
      if (memKey && remember) global.localStorage.setItem(STORE_KEY, memKey);
      else global.localStorage.removeItem(STORE_KEY);
    } catch (e) { /* storage may be blocked */ }
    refreshPill();
  }
  function rememberedOnDevice() { try { return !!global.localStorage.getItem(STORE_KEY); } catch (e) { return false; } }
  function panelHtml() {
    var ex = estimate(14, false), pr5 = estimate(5, true), pr1 = estimate(1, true);
    return '<div class="kp-card" role="dialog" aria-modal="true" aria-labelledby="kp-title">' +
      '<h2 id="kp-title">Grading with your own Anthropic API key</h2>' +
      '<p>The speaking exam and the practice drills are graded by Claude. This site has no server and no shared key, so ' +
      'grading uses <b>your</b> key. Your recordings are never stored. Only the text of your answers is sent.</p>' +
      '<ul>' +
      '<li>The key stays in this browser. It is sent only to <code>api.anthropic.com</code>, nowhere else.</li>' +
      '<li>By default it is kept in memory and disappears when you close the tab. Tick the box below to remember it on this device.</li>' +
      '<li>Grading is billed to your Anthropic account as API credits. Use a key with a spending limit.</li>' +
      '<li>Speech-to-text uses your browser\'s built-in recognition (Chrome, Edge and Safari). The browser vendor may process the audio.</li>' +
      '</ul>' +
      '<label class="kp-field">API key<input type="password" id="kp-input" autocomplete="off" spellcheck="false" placeholder="sk-ant-..."></label>' +
      '<label class="kp-check"><input type="checkbox" id="kp-remember"> Remember on this device (stored in this browser\'s localStorage)</label>' +
      '<div class="kp-actions"><button class="btn" id="kp-save" type="button">Use this key</button>' +
      '<button class="btn secondary" id="kp-forget" type="button">Forget key</button>' +
      '<button class="btn secondary" id="kp-close" type="button">Close</button></div>' +
      '<div class="kp-msg" id="kp-msg"></div>' +
      '<h3>Rough cost per sitting</h3>' +
      '<table class="kp-table"><tr><th>Sitting</th><th>Estimate</th></tr>' +
      '<tr><td>Speaking exam, 14 answers (one rating call)</td><td>about ' + money(ex.usd) + '</td></tr>' +
      '<tr><td>Practice, 5 questions (rating plus mistake check)</td><td>about ' + money(pr5.usd) + '</td></tr>' +
      '<tr><td>Practice, 1 question</td><td>about ' + money(pr1.usd) + '</td></tr></table>' +
      '<p class="kp-small">Assumptions: rating uses ' + MODELS.rate.label + ' (' + MODELS.rate.id + ') at $' + MODELS.rate.inPerM + ' per million input and $' +
      MODELS.rate.outPerM + ' per million output tokens; the mistake check uses ' + MODELS.analyze.label + ' (' + MODELS.analyze.id + ') at $' +
      MODELS.analyze.inPerM + ' and $' + MODELS.analyze.outPerM + '. Prices are Anthropic\'s published list prices as of 2026-09-25 and may change. ' +
      'Token counts come from the real prompt sizes at about ' + CHARS_PER_TOKEN + ' characters per token, answers of about ' + WORDS_PER_ANSWER +
      ' words (90 seconds), and about ' + THINKING_OUT + ' tokens of model thinking per rating call. Real cost varies with how much you say.</p>' +
      '<p class="kp-small" id="kp-spent"></p></div>';
  }
  function openPanel() {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "kp-overlay";
      panel.hidden = true;
      document.body.appendChild(panel);
    }
    panel.innerHTML = panelHtml();
    panel.hidden = false;
    var input = panel.querySelector("#kp-input"), remember = panel.querySelector("#kp-remember"), msg = panel.querySelector("#kp-msg");
    remember.checked = rememberedOnDevice();
    if (memKey) msg.textContent = "A key is set for this session" + (remember.checked ? " and remembered on this device." : ".");
    if (spent.usd > 0) panel.querySelector("#kp-spent").textContent = "Spent this session (from Anthropic's usage numbers): about " +
      money(spent.usd) + " (" + spent.inTok + " input, " + spent.outTok + " output tokens).";
    panel.querySelector("#kp-save").onclick = function () {
      var v = input.value.trim();
      if (!v) { msg.textContent = "Paste a key first."; return; }
      setKey(v, remember.checked);
      input.value = "";
      msg.textContent = "Key set" + (remember.checked ? " and remembered on this device." : " for this session only.");
      document.dispatchEvent(new CustomEvent("grading-key-changed"));
    };
    panel.querySelector("#kp-forget").onclick = function () {
      setKey("", false);
      msg.textContent = "Key forgotten. Nothing is stored.";
      remember.checked = false;
      document.dispatchEvent(new CustomEvent("grading-key-changed"));
    };
    panel.querySelector("#kp-close").onclick = function () { panel.hidden = true; };
  }
  function mountPill() {
    var links = document.querySelector(".navbar-links");
    if (!links || document.getElementById("key-pill")) return;
    var a = document.createElement("a");
    a.id = "key-pill";
    a.href = "#";
    a.addEventListener("click", function (e) { e.preventDefault(); openPanel(); });
    links.appendChild(a);
    refreshPill();
  }
  var css = document.createElement("style");
  css.textContent =
    ".kp-overlay{position:fixed;inset:0;background:rgba(20,28,45,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}" +
    ".kp-overlay[hidden]{display:none}" +
    ".kp-card{background:var(--card,#fff);color:var(--text,#1a2030);border-radius:12px;max-width:640px;width:100%;padding:22px 24px;max-height:92vh;overflow:auto;font-size:14px;line-height:1.5}" +
    ".kp-card h2{font-size:17px;margin-bottom:8px}.kp-card h3{font-size:14px;margin:14px 0 6px}" +
    ".kp-card ul{margin:8px 0 10px 18px}.kp-card li{margin:3px 0}" +
    ".kp-field{display:block;font-weight:600;margin-top:8px}.kp-field input{display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border,#dde3ef);border-radius:8px;background:var(--bg-2,#f5f7fb)}" +
    ".kp-check{display:block;margin-top:8px;color:var(--muted,#6b7a99)}" +
    ".kp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.kp-msg{min-height:1.2em;margin-top:8px;color:var(--muted,#6b7a99)}" +
    ".kp-table{border-collapse:collapse;width:100%}.kp-table td,.kp-table th{border-bottom:1px solid var(--border,#dde3ef);padding:5px 6px;text-align:left}" +
    ".kp-small{font-size:12px;color:var(--muted,#6b7a99);margin-top:8px}" +
    ".rating-nokey a,.rating-error a{color:var(--accent,#4f7ef8);cursor:pointer;text-decoration:underline}";
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPill); else mountPill();

  global.Grading = {
    MODELS: MODELS, API_URL: API_URL, hasKey: hasKey, setKey: setKey, openPanel: openPanel,
    run: runGrading, estimate: estimate, money: money,
    buildRaterMessage: buildRaterMessage, buildAnalyzerMessage: buildAnalyzerMessage,
    RATER_SYSTEM: RATER_SYSTEM, ANALYZER_SYSTEM: ANALYZER_SYSTEM
  };
})(window);
