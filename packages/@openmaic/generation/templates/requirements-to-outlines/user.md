Please generate scene outlines based on the following course requirements.

---

## User Requirements

{{requirement}}

---

{{userProfile}}

## Language Context

Infer the course language directive by applying the decision rules from the system prompt. Key reminders:
- Requirement language = teaching language (unless overridden by explicit request or learner context)
- Foreign language learning → teach in user's native language, not the target language
- PDF language does NOT override teaching language — translate/explain document content instead

---

## Reference Materials

### PDF Content Summary

{{pdfContent}}

### Available Images

{{availableImages}}

### Web Search Results

{{researchContext}}

{{teacherContext}}

---

## Output Requirements

Please automatically infer the following from user requirements:

- Course topic and core content
- Target audience and difficulty level
- Course duration (default 15-30 minutes if not specified)
- Teaching style (formal/casual/interactive/academic)
- Visual style (minimal/colorful/professional/playful)

Then output your response as a single JSON object.

**Top-level shape — this is what you MUST return:**

```json
{
  "languageDirective": "2-5 sentence instruction describing the course language behavior",
  "courseTitle": "concise course name, ≤30 chars, in the teaching language",
  "outlines": [ /* array of scene objects, schema described below */ ]
}
```

Never return a bare array. Never omit `languageDirective` or `courseTitle`. All three keys are required.

**Each scene inside the `outlines` array has this minimum shape:**

```json
{
  "id": "scene_1",
  "type": "slide" | "quiz" | "interactive" | "pbl",
  "title": "Scene Title",
  "description": "Teaching purpose description",
  "keyPoints": ["Substantive point carrying a fact, definition, figure or example from the document", "..."],
  "sourceExcerpt": "Verbatim passage of the source material this scene teaches, copied word for word",
  "order": 1
}
```

### Key points and source excerpts — this is what makes the course faithful

The scene generator that turns this outline into a slide **sees nothing except
`title`, `description`, `keyPoints` and `sourceExcerpt`** — it never reads the
document itself. Whatever you omit here, it will have to invent.

- **`keyPoints`** — 5 to 8 points, and each must carry real substance: a
  definition, a figure, a rule, a value, a step, an example that actually appears
  in the material. `"Introduction"`, `"Key concepts"`, `"Summary"` teach nothing
  and force the next stage to improvise.
- **`sourceExcerpt`** — for every scene, copy the passage from *Reference
  Materials → PDF Content Summary* that this scene is built on. Copy it **word for
  word**: do not summarise, translate or paraphrase, or it stops being a source
  of truth. Keep it to one focused passage (a few sentences to a short
  paragraph). Leave it empty only when the scene genuinely teaches nothing from
  the document.
- Prefer scenes that map to contiguous passages of the material: each scene then
  gets one excerpt it can actually quote.

### Special Notes

- **quiz scenes must include quizConfig**:
   ```json
   "quizConfig": {
     "questionCount": 2,
     "difficulty": "easy" | "medium" | "hard",
     "questionTypes": ["single", "multiple"]
   }
   ```
{{#if hasSourceImages}}
- **If source images are available**, add `suggestedImageIds` to relevant slide scenes. Only use image IDs listed under Available Images.
{{/if}}
- **Interactive scenes**: If a concept benefits from hands-on simulation/visualization, use `"type": "interactive"` with `widgetType` and `widgetOutline` fields.
  - Select widgetType based on concept: simulation (physics/chem), diagram (processes), code (programming), game (practice), visualization3d (3D models)
  - Provide appropriate widgetOutline for the widget type
  - **Use them regularly, not as a garnish.** A course where the learner only ever reads
    and never acts is a document with slide numbers. For every 3 to 4 scenes of new
    content, place one interactive scene or quiz, spread evenly from the beginning to
    the end rather than clustered at the end.
  - Vary the widget types. Two slides of one concept followed by a simulation is a good
    rhythm; the same `diagram` three times in a row is not.
- **Scene count**: Based on inferred duration, typically 1-2 scenes per minute
- **Quiz placement**: Insert a quiz at each natural checkpoint of the material — after a
  key definition, after a calculation the learner must reproduce, after a process they
  must order. Roughly every 3-5 scenes, spread across the whole course, and **never two
  in a row**. Difficulty must climb with the course: the first quiz checks recognition,
  the last one checks transfer rather than recall.
- **When to prefer `interactive` over `quiz`**: use `interactive` whenever the document
  describes a process, a cycle, a mechanism, a calculation or a classification. A learner
  can *do* those things; multiple choice can only ever ask them to recognise an answer.
- **Language**: Infer from the user's requirement text and context, then output all content in the inferred language
- **If web search results are provided**, reference specific findings and sources in scene descriptions and keyPoints. The search results provide up-to-date information — incorporate it to make the course content current and accurate.

**Final reminder**: your entire response must be a JSON **object** with exactly three top-level keys — `languageDirective` (string), `courseTitle` (string, ≤30 chars, in the teaching language), and `outlines` (array). Do not return a bare array. Do not wrap in prose or code fences.
