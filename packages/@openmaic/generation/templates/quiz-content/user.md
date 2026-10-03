Title: {{title}}
Description: {{description}}
Test Points: {{keyPoints}}
Question Count: {{questionCount}}, Difficulty: {{difficulty}}, Question Types: {{questionTypes}}

## Source Material (the learner's own document)

Use the passage below as the **ground truth**. Every question, option and correct
answer must be derivable from it or from the test points above — a quiz that
asserts something the document never says teaches the learner the wrong thing.

{{#if sourceExcerpt}}
{{sourceExcerpt}}
{{/if}}

If no passage appears above, stay strictly within the test points: never
introduce facts, figures, rules, standards or constants that are not stated
there, and make sure the keyed answer is one the material actually supports.

## Language Directive
{{languageDirective}}

Output a JSON array directly (no explanation, no code blocks, no LaTeX). Each choice option MUST be `{ "label": "<content text>", "value": "<one ASCII uppercase letter A-Z>" }`. `value` is an enum A-Z and is never the option content; `label` is the content text and is never just the letter. Never reverse them (invalid: `{ "value": "(6, 2)", "label": "A" }`). `answer` MUST be an array of those `value` letters, never the content text:
[{"id":"q1","type":"single","question":"Question text","options":[{"label":"Option A content","value":"A"},{"label":"Option B content","value":"B"},{"label":"Option C content","value":"C"},{"label":"Option D content","value":"D"}],"answer":["A"]}]
