# Cub Quiz

A reusable, static quiz for South African Cub Scouts. It uses plain HTML, CSS and JavaScript, with the advancement catalogue and question bank kept in JSON. No accounts, backend, build step, external service or dependencies are needed.

## Run locally

Serve the project folder over HTTP. Browsers restrict `fetch()` from local files, so do not open `index.html` directly as a `file://` page.

In VS Code, use Live Server on `index.html`, or run this in a terminal opened at the project folder:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`. The site can be published on GitHub Pages as a static website. Enable Pages for the repository branch and folder containing `index.html`.

## Install on a phone

The project is a Progressive Web App. Publish it over HTTPS (for example, with GitHub Pages), then open its URL on the phone and use the browser menu to install or add it to the home screen. Open the quiz once while online so the service worker can cache the question bank and its images; after that, the quiz can be opened offline.

On iPhone or iPad, open the site in Safari, tap Share, then Add to Home Screen. On Android, open the site in Chrome and choose Install app or Add to Home screen from the browser menu.

## Using the quiz

Choose Silver Wolf (SW) or Gold Wolf (GW), then select either one numbered advancement or a random test for that programme. Questions and answer choices are shuffled. A random test includes every question currently tagged for that programme. Questions do not repeat within an attempt. Add any number of separate questions with the same advancement tag; a focused quiz includes all of them and shuffles their order.

The selector lists all 71 testable SW and 75 GW advancements. The starter bank has 19 SW and 14 GW sample questions, so many advancement choices will show a message until questions are added. The count on the setup screen shows how many questions are ready for the current choice.

## Add or edit questions

Open **Manage questions** on the setup screen to create, search, edit, import or export questions. During a quiz, use **Edit this question** to correct the current item. Edits are kept in this browser for testing. Download the updated `questions.json` and replace the project copy to make them permanent. Images uploaded in the editor are resized to a maximum 1200 px and embedded in the exported question data. Use **Use project version** after replacing the project file to clear browser-only changes.

Edit `data/questions.json` and add an object to the `questions` array. Every question needs a unique `id`, a `type`, and `programme` (`SW` or `GW`). Add `advancementId` for one advancement or `advancementIds` for a shared question; its tags control which focused quizzes and random tests include it.

### Multiple choice

```json
{
  "id": "sw-home-safety-1",
  "type": "multiple-choice",
  "programme": "SW",
  "advancementId": "SW-59",
  "question": "Which situation could cause someone to trip at home?",
  "options": ["A toy on a staircase", "A book on a shelf", "A cushion on a sofa"],
  "answer": "A toy on a staircase",
  "explanation": "Keeping walkways clear can help prevent trips and falls."
}
```

### Choose a picture

For picture answers, use option objects with a unique `id`, `image`, and accessible `alt` description. The app displays a four-choice image grid and checks the selected ID against `answer`.

### Show a picture and choose from a dropdown

Use `image` and `imageAlt` with the same `options` and `answer` fields. The app displays the full picture without cropping it, shuffles the options, and provides a simple dropdown.

### Match pictures

A Cub can tap an item on the left and then tap its match on the right. A mouse or stylus can drag a line between them. Each pair keeps both sides together in one object. A side can be an image (type, src, and optional alt) or short text (type and value), so picture-to-picture and picture-to-text matching both work. Set sampleSize to randomly choose that many pairs each time the question appears:

```json
{
  "id": "sw-picture-match-1",
  "type": "image-match",
  "programme": "SW",
  "advancementId": "SW-41",
  "question": "Match each picture to its pair.",
  "pairs": [
    {
      "id": "bird",
      "left": {"type": "image", "src": "images/bird.png", "alt": "A bird"},
      "right": {"type": "image", "src": "images/bird-answer.png", "alt": "A bird"}
    },
    {
      "id": "nest",
      "left": {"type": "image", "src": "images/nest.png", "alt": "A nest"},
      "right": {"type": "text", "value": "Nest"}
    }
  ],
  "sampleSize": 2,
  "explanation": "A bird builds a nest."
}
```

The starter matching question uses the supplied worksheet artwork and answer key: stack 1 → target 2, stack 2 → target 1, stack 3 → target 4, and stack 4 → target 3.

### Memory grid

A Cub studies a configurable picture grid, then finds three shown pictures in order. `rows`, `columns`, `previewSeconds`, and `shuffleCells` configure its size, preview time, and whether cell positions shuffle each round. `cells` is in original row-major order; `sequence` contains three 1-based square numbers in that original grid, counted left to right and top to bottom. The complete example is `sw-memory-grid-placeholder` in `data/questions.json`, with a 4×4 board, 20-second preview, shuffled pictograms, and SW-13 tag.

### Question fields

- **id**: unique short ID.
- **type**: multiple-choice, image-option, image-dropdown, image-match, or memory-grid. Multiple-choice and image-option choices can be strings or picture objects.
- **programme**: SW or GW.
- **advancementId**: programme plus advancement number. For one question shared by several advancements, use advancementIds, an array of IDs; the question appears in each focused quiz.
- **question**: short prompt.
- **options**: for multiple-choice, image-option, or image-dropdown questions; answer must exactly match one option.
- **answer**: correct option text for single-answer questions. Image-match questions store each correct relationship in the pair itself.
- **image** / **imageAlt**: picture and its screen-reader description for image-option and image-dropdown questions; optional for multiple-choice. Image-option uses exactly four choices.
- **pairs**: image-match pairs. Each pair has a unique ID, a left side, and a right side. Image sides use type=image with src and optional alt; text sides use type=text with value.
- **sampleSize**: optional number of pairs to randomly display from a larger matching pool; if omitted, all pairs are shown.
- **cells** / **sequence**: for memory-grid, `rows × columns` image cells in original row-major order and three 1-based cell numbers to recall in sequence. `previewSeconds` controls how long the images are shown; `shuffleCells` randomizes the positions each round while keeping the same three images as targets.
- **explanation**: optional feedback shown after answering.

Store image files in `images/` and use project-relative paths. Keep JSON valid: strings use double quotes, and array objects are separated by commas. Question tags must match an ID in `data/advancements.json`.

## Advancement catalogue and colours

`data/advancements.json` contains the SW and GW programmes, categories, colours and numbered testable advancements. The colour mapping for both programmes is Awareness green, Outdoor blue, Community yellow and Aptitude red. Edit this file if the advancement list or colours change. SW 72 and 73 are omitted because they are not testable. SW-43 has eight picture-choice questions based on the supplied common tracking signs chart. GW-49 now has two map-symbol pools (line/area symbols and place icons), each showing four random pairs. GW-55 has a 21-entry Jungle Book name-to-animal-and-clue pool, showing four random pairs per round. GW-66 includes four matching sets for the ScoutWiki traffic signs, with 14 unique signs; the last set revisits two familiar signs to keep four pairs per round. The map-symbol PNGs are cropped from the [Cub Pro-Plan Chart 43: Map Symbols PDF](https://scoutwiki.scouts.org.za/w/images/2/26/Cub-Pro-Plan-Chart-43-Map-Symbols_%28PF%29.pdf). The traffic-sign PNGs are cropped from the [Cub Pro-Plan Chart 8: Traffic Signs PDF](https://scoutwiki.scouts.org.za/w/images/a/ac/Cub-Pro-Plan-Chart-8-Traffic-Signs_%28PF%29.pdf), listed on the [Cub Pro-Plan Charts page](https://scoutwiki.scouts.org.za/wiki/Cub_Pro-Plan_Charts).

Question content and images are stored locally. Use images you have permission to share, and keep question content free of personal information. The knot-name list follows SCOUTS South Africa Wiki’s [Leaping Wolf knot list](https://scoutwiki.scouts.org.za/wiki/Leaping_Wolf). Knot-use references include [Basic Knots](https://scoutwiki.scouts.org.za/wiki/Basic_Knots), [Reef knot](https://scoutwiki.scouts.org.za/wiki/Reef_knot), [Fisherman’s knot](https://scoutwiki.scouts.org.za/wiki/Fisherman%27s_knot), [Round Turn and 2 Half Hitches](https://scoutwiki.scouts.org.za/wiki/Round_Turn_and_2_Half_Hitches), and [Figure of eight knot](https://scoutwiki.scouts.org.za/wiki/Figure_of_Eight_knot). All question images use PNG files and are displayed without cropping. The supplied Bowline JPG has been converted to PNG without cropping. For the other seven knots, each filename has a clearly marked PNG placeholder for a leader to replace with an accurate knot picture. Knot practice uses four-knot matching rounds for uses and names in each programme. Each round is linked to all four related advancement numbers, with short matching choices to reduce reading.

## Files

- `index.html` — page shell.
- `style.css` — responsive visual design.
- `app.js` — quiz selection, question rendering, matching, feedback and scoring.
- `question-editor.js` — leader question bank manager, editor, browser storage and JSON import/export.
- `manifest.webmanifest` and `service-worker.js` — installable app details and offline cache.
- `data/advancements.json` — editable programmes and advancement catalogue.
- `data/questions.json` — editable tagged question bank.
- `images/` — local question images, including PNG question images, the matching example, and knot-image placeholders ready to replace.

## Before publishing

Run the site over HTTP or HTTPS. Verify the PWA manifest and service worker on localhost or the published HTTPS site, then test offline after its first online load. Try focused knot quizzes for SW 45–48 and GW 51–54, an advancement with no questions yet, random SW and GW tests, image dropdowns, SW-43 picture choices, GW-49 map-symbol pools, GW-55 random Jungle Book matches, GW-66 traffic sign matches, and both picture matching interactions. SW 45–48 and GW 51–54 each share a four-knot matching round for uses and another for names. Check correct and incorrect feedback, progress, final score, restart, and image loading. GitHub Pages serves these files as a static site; no build or secret configuration is required.
