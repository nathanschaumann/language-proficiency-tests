# Language Proficiency Practice Tests

Listening, reading and speaking practice tests in Spanish, Portuguese, Russian and Armenian, for self-study and as a working example of how to build and check proficiency-style assessments. Static site: no server, no accounts, no build step.

Built inside my private study app from August 2026; published here as a standalone copy on 29 September 2026.

Inspired by the ACTFL Proficiency Guidelines. Not affiliated with or endorsed by ACTFL; results are not official ratings.

## What is included

- **Listening**: Portuguese (35 passages), Spanish (25, five regional varieties), Russian (25), with audio. Each recording plays once.
- **Reading**: Portuguese (40 passages), five minutes each, forward only.
- **Speaking**: a 14-question Spanish test, plus speaking and writing practice in Spanish, Armenian and Russian.
- **Results** page with your saved sittings, and a labeled sample graded speaking result.

Listening and reading walk through blocks of five passages at one level, then look up a level in a score table. See [METHOD.md](METHOD.md) for how passages were pitched to levels, how they were checked, and the limits.

## Run it

    python3 -m http.server 8000

Then open http://localhost:8000. It also works on GitHub Pages. Sittings are saved only in your browser (localStorage). Browser check: `node tests/e2e.mjs` (needs Chrome; audio is muted and no real API call is made).

## Speaking needs your own API key

Speaking and writing are graded by Claude, called straight from your browser with a key you paste in the "Grading key" box.

- The key stays in your browser. It goes only to api.anthropic.com. By default it lives in memory for the tab; "remember on this device" is opt-in.
- Grading spends **your** API credits. Estimate: about $0.14 for the 14-question test, about $0.13 for a 5-question practice, about $0.10 for one question. Assumptions are in the box (Claude Opus 5 for rating, Claude Sonnet 5 for the mistake check, list prices as of 2026-09-25).
- Speech-to-text is your browser's built-in recognition (Chrome, Edge, Safari). The browser vendor may process the audio. You can type answers instead.

## Where the content comes from

- Passages, questions and speaking prompts were written with Claude (Anthropic) and revised using blind AI rater checks.
- Audio is synthetic speech generated with ElevenLabs (elevenlabs.io).
- The score-to-level bands follow Tschirner, "Assessing Evidence of Validity and Reliability of the ACTFL Listening Proficiency Test (LPT)", ACE report 2023: https://www.actfl.org/uploads/files/general/Documents/assessments/acereports/LPT_Report_ACE_2023.pdf . No part of that report is included here. The branching rules and timings are this project's own choices.

## Licenses

- Code (html, js, css, tests): MIT, see [LICENSE](LICENSE).
- Passages, questions and prompts (`content/`): CC BY 4.0.
- Audio (`audio/`): generated with ElevenLabs; check their terms before reusing it.
