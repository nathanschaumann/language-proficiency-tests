# Method

How the tests were built and checked, and what they cannot claim.

## Pitching passages to levels

Each bank has passages at five levels: Intermediate Low, Intermediate Mid, Advanced Low, Advanced Mid and Superior (Novice and Advanced High come from weak or borderline scores at neighbouring levels). Each passage has three multiple-choice questions, with a fixed mix of question types per level: gist, detail, selective listening at the lowest level, and inference at the top two. Passages were written with Claude against a written brief per level and per language (register, genres, the discourse features that separate neighbouring levels), and with word-count and duration targets.

Every bank was then rated blind. Several AI raters, given only level criteria, saw each passage stripped of its id, its intended level and its questions, and named a level. The gate was at least 70% exact agreement with the intended level, no passage more than one step off, and average drift within a quarter step per level. Failed passages were revised, or replaced if raters missed the same way twice, and the bank was rated again on a fresh shuffle. Final rounds:

- Portuguese listening: 80% exact, 100% within one step. One level (Intermediate Low) drifted +0.6 and was accepted knowingly.
- Portuguese reading: 88% exact, 100% within one step, all drifts inside the limit.
- Spanish listening: 80% exact, 96% within one step, mean drift 0.00; one passage was revised again and re-rated to reach 100%.
- Russian listening: a second round on the revised passages gave 80% exact, 100% within one step.

## The blind test-taker check on questions

A model answering with the questions and choices but without the passage should not score too high, because that means the answers leak. The target was 50 to 70% (chance is 25%). The first draft banks scored 91%. Questions were rewritten (never the passages) in three to four rounds, with the rule that no answer option may be longer, more specific or more hedged than the others, until each group passed, meaning the blind score was at most 70% and a reader with the passage agreed with the key on every question. Final blind scores: Spanish listening 60%, Russian listening 69%, Portuguese reading 62%, Portuguese listening 66%. Published exam items from several standardized tests scored roughly 50 to 85% on the same check, so 91% was an outlier and near-zero was never expected. Question sets for passages that had already been taken in the author's own sittings were left unchanged, so those may still be easier to answer blind.

## Scoring

A sitting is a walk through blocks of five passages. It starts at Advanced Low. A block score of 12 out of 15 or more goes up, otherwise down. After two blocks, two neighbouring blocks (30 questions) are added and looked up in a table of score bands. A third block is added when the pair tops out or bottoms out. The band boundaries follow the published table cited in the README. The branch threshold, the third-block rules, the flat 120 second answer window, the fixed five minutes per reading passage and an extra Distinguished band are this project's own choices. The bands live in `content/scoring-table.json`, so nothing is hidden in code.

## Speaking rubric

Claude rates the whole sample, not question by question. The floor is the level sustained across the routine questions. The ceiling is where language breaks down on the harder questions: losing the time frame, dropping to strung-together sentences, or running out of vocabulary. Rehearsed answers are discounted. The test form chosen in the self-assessment caps the highest level printed. Practice sittings also give a level per answer and a list of grammar and word-choice mistakes, each quoted from the answer. Prompt and rubric text are in `js/grading.js`.

## Limitations

- No human rater has validated any of this. The raters were AI models sharing similar habits, so a shared bias cannot be ruled out.
- Passages and questions are AI-generated, and the audio is synthetic speech, which is cleaner than real speech.
- Banks are small: repeated sittings reuse passages.
- The speaking rating is one model's judgment of a transcript, and speech-to-text errors can lower it.
- These are not official ratings and should not be used for decisions about people.
