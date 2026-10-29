const QUESTION_BANK_STORAGE_KEY = 'edward-cub-quiz-question-bank-v1';
let questionEditorReturnTarget = 'manager';
let questionEditorOriginalId = null;
let questionOverrideVersion = '';

function legacyMatchItemToSide(item) {
  return item?.image
    ? { type: 'image', src: item.image, alt: item.alt || '' }
    : { type: 'text', value: item?.text || '' };
}
function normalizePairQuestion(question) {
  if (!question || question.type !== 'image-pairs') return question;
  const { format, ...normalized } = question;
  normalized.allowReversal = question.allowReversal !== false;
  return normalized;
}
function migrateLegacyImageMatch(question) {
  if (!question || question.type !== 'image-match') return normalizePairQuestion(question);
  if (Array.isArray(question.pairs)) return normalizePairQuestion({ ...question, type: 'image-pairs' });
  if (!Array.isArray(question.leftItems) || !Array.isArray(question.rightItems) || !question.answer) return question;
  const pairs = question.leftItems.map((left, index) => {
    const rightId = question.answer[left.id];
    const right = question.rightItems.find((item) => item.id === rightId);
    if (!right) return null;
    return { id: left.id || `pair-${index + 1}`, left: legacyMatchItemToSide(left), right: legacyMatchItemToSide(right) };
  });
  if (pairs.some((pair) => !pair)) return question;
  const { leftItems, rightItems, answer, ...rest } = question;
  return normalizePairQuestion({ ...rest, type: 'image-pairs', pairs });
}
function migrateQuestionBank(questions) {
  let normalized = questions.map(migrateLegacyImageMatch);
  const legacyPigpen = normalized.find((question) => question.id === 'gw-pigpen-cub-motto' && question.type === 'image-option');
  if (legacyPigpen && !normalized.some((question) => question.id === 'gw-pigpen-code-pool')) {
    const phrases = { 'pigpen-doyourbest': 'Do your best', 'pigpen-doyourworst': 'Do your worst', 'pigpen-doyousmell': 'Do you smell', 'pigpen-whoatethecake': 'Who ate the cake' };
    normalized = normalized.filter((question) => question.id !== legacyPigpen.id);
    normalized.push({ id: 'gw-pigpen-code-pool', type: 'image-pairs', format: 'image-option', programme: 'GW', advancementId: 'GW-13', question: 'Which code matches this phrase?', image: legacyPigpen.image, imageAlt: legacyPigpen.imageAlt, optionCount: 4, pairs: legacyPigpen.options.map((option) => ({ id: option.id, left: { type: 'text', value: phrases[option.id] || option.id }, right: { type: 'image', src: option.image, alt: option.alt || '' } })) });
  }
  const oldNature = normalized.filter((question) => question.id.startsWith('sw-pigpen-nature-cipher-') && question.type === 'image-option');
  if (oldNature.length && !normalized.some((question) => question.id === 'sw-nature-cipher-pool')) {
    const words = ['BAT','BUG','CAP','CAT','CUB','DEN','FUN','HUG','MAP','MUD','SAP','SUN'];
    normalized = normalized.filter((question) => !question.id.startsWith('sw-pigpen-nature-cipher-'));
    normalized.push({ id: 'sw-nature-cipher-pool', type: 'image-pairs', format: 'image-option', programme: 'SW', advancementId: 'SW-14', question: 'Which code spells this word?', image: oldNature[0].image, imageAlt: oldNature[0].imageAlt || '', optionCount: 4, pairs: words.map((word) => ({ id: 'nature-' + word.toLowerCase(), left: { type: 'text', value: word.toLowerCase() }, right: { type: 'image', src: 'images/codes/nature-cipher/' + word + '.png', alt: 'Nature cipher spelling ' + word.toLowerCase() } })) });
  }
  return normalized.map(normalizePairQuestion);
}
function readQuestionBankOverride() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUESTION_BANK_STORAGE_KEY) || 'null');
    return Array.isArray(saved?.questions) ? { version: saved.version || '', questions: migrateQuestionBank(saved.questions) } : null;
  } catch { return null; }
}
function writeQuestionBankOverride() {
  try { questionOverrideVersion = new Date().toISOString(); localStorage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify({ version: questionOverrideVersion, questions: bank })); return true; }
  catch { return false; }
}
function defaultEditorQuestion() {
  const programme = ['MEM', 'SW', 'GW'].includes(selection.programme) ? selection.programme : 'SW';
  const advancementId = catalogue.find((item) => item.id === programme)?.categories[0]?.advancements[0]?.id || `${programme}-1`;
  return { id: `${programme.toLowerCase()}-question-${Date.now()}`, type: 'multiple-choice', programme, advancementId, question: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], answer: '', explanation: '' };
}
function questionAdvancementLabel(question) {
  return (question.advancementIds || [question.advancementId]).filter(Boolean).map((id) => {
    for (const programme of catalogue) for (const category of programme.categories) {
      const item = category.advancements.find((advancement) => advancement.id === id);
      if (item) return `${programme.id} ${item.number}`;
    }
    return id;
  }).join(', ');
}
function renderQuestionManager(filter = '') {
  clearInterval(memoryTimer);
  const query = filter.trim().toLowerCase();
  const visible = bank.filter((question) => `${question.id} ${question.question} ${question.programme} ${questionAdvancementLabel(question)}`.toLowerCase().includes(query));
  app.innerHTML = `<div class="question-manager editor-page">
    <div class="editor-heading"><div><p class="eyebrow">LEADER TOOL</p><h1>Question bank</h1><p>Changes save in this browser. Download the JSON to keep them in the project.</p></div><button class="secondary" id="manager-done">Back to quiz setup</button></div>
    <div class="editor-toolbar"><button class="primary" id="new-question">Add a question <span aria-hidden="true">＋</span></button><button class="secondary" id="download-question-bank">Download questions.json</button><label class="secondary file-button">Import questions.json<input id="import-question-bank" type="file" accept="application/json,.json"></label><button class="text-button" id="reset-question-bank">Use project version</button></div>
    <p class="editor-note">Image paths are stored in the question data. Keep the image files in the project (for example, images/flags/). After downloading, replace <code>data/questions.json</code> in the project. “Use project version” clears browser-only edits after you have updated the project file.</p>
    <label class="search-label" for="question-search">Find a question</label><input id="question-search" class="editor-input" type="search" placeholder="Search question text, ID or advancement" value="${escapeAttribute(filter)}">
    <div class="question-list" id="question-list">${visible.map((question) => `<button class="question-list-item" type="button" data-search-text="${escapeAttribute(`${question.id} ${question.question} ${question.programme} ${questionAdvancementLabel(question)}`.toLowerCase())}" data-edit-question="${escapeAttribute(question.id)}"><span><strong>${escapeHtml(question.question || 'Untitled question')}</strong><small>${escapeHtml(question.programme)} · ${escapeHtml(questionAdvancementLabel(question) || 'No advancement')} · ${escapeHtml(question.type)}</small></span><span aria-hidden="true">Edit →</span></button>`).join('')}<p class="editor-empty" id="question-empty" ${visible.length ? 'hidden' : ''}>No questions match that search.</p></div>
    <p class="editor-total">${bank.length} questions in this bank</p>
  </div>`;
  document.querySelector('#manager-done').addEventListener('click', renderSetup);
  document.querySelector('#new-question').addEventListener('click', () => renderQuestionEditor(null, 'manager'));
  document.querySelector('#download-question-bank').addEventListener('click', downloadQuestionBank);
  document.querySelector('#reset-question-bank').addEventListener('click', resetQuestionBankOverride);
  document.querySelector('#question-search').addEventListener('input', (event) => filterQuestionList(event.target.value));
  document.querySelector('#import-question-bank').addEventListener('change', importQuestionBank);
  app.querySelectorAll('[data-edit-question]').forEach((button) => button.addEventListener('click', () => {
    const question = bank.find((item) => item.id === button.dataset.editQuestion);
    if (question) renderQuestionEditor(question, 'manager');
  }));
}
function renderQuestionEditor(question, returnTarget = 'manager') {
  clearInterval(memoryTimer);
  window.removeEventListener('resize', drawMatchLines);
  const source = structuredClone(question || defaultEditorQuestion());
  questionEditorReturnTarget = returnTarget;
  questionEditorOriginalId = question?.id || null;
  const type = source.type === 'image-match' ? 'image-pairs' : (source.type || 'multiple-choice');
  const pairOptionCount = Math.min(source.optionCount || 4, source.matchPairs?.length || source.pairs?.length || 4);
  const pairAllowReversal = source.allowReversal !== false;
  const programme = source.programme || selection.programme;
  const advancementIds = source.advancementIds || [source.advancementId].filter(Boolean);
  const sourceOptions = Array.isArray(source.options) ? source.options : [];
  const choiceMode = sourceOptions[0] && typeof sourceOptions[0] === 'object' ? 'pictures' : 'text';
  const choices = choiceMode === 'pictures' ? source.options : [1, 2, 3, 4].map((i) => ({ id: `choice-${i}`, image: '', alt: '' }));
  const pairRows = editorPairsFromQuestion(source);
  const memoryPaths = source.cells?.map((cell) => cell.image) || source.memoryImagePaths || Array.from({ length: 16 }, (_, i) => `images/memory-grid/${String.fromCharCode(65 + i)}.png`);
  const memorySequence = source.sequence || source.memorySequence || [3, 7, 13];
  const memoryRecallCount = source.recallCount || source.memoryRecallCount || 3;
  const memoryRandomizePrompts = source.randomizePrompts ?? source.memoryRandomizePrompts ?? !source.sequence?.length;
  const memoryRows = source.rows || source.memoryRows || 4;
  const memoryColumns = source.columns || source.memoryColumns || 4;
  const memoryPreviewSeconds = source.previewSeconds || source.memoryPreviewSeconds || 20;
  const memoryShuffle = source.shuffleCells !== false && source.memoryShuffle !== false;
  const programmeOptions = catalogue.map((item) => `<option value="${item.id}" ${item.id === programme ? 'selected' : ''}>${escapeHtml(item.name)} (${item.id})</option>`).join('');
  app.innerHTML = `<div class="question-editor editor-page">
    <div class="editor-heading"><div><p class="eyebrow">LEADER TOOL</p><h1>${question ? 'Edit question' : 'Add a question'}</h1><p>Fill in the question, its advancement and the answer choices.</p></div><button class="secondary" id="cancel-question-editor">Cancel</button></div>
    <form id="question-editor-form" novalidate>
      <div class="editor-form-grid">
        <label>Question ID<input class="editor-input" name="id" required value="${escapeAttribute(source.id || '')}"><small>Short and unique, for example gw-road-sign-1.</small></label>
        <label>Programme<select class="editor-input" name="programme">${programmeOptions}</select></label>
        <label>Advancement ID(s)<input class="editor-input" name="advancementIds" required value="${escapeAttribute(advancementIds.join(', '))}"><small>Use one ID, or a comma-separated list for a shared question.</small></label>
        <label>Question type<select class="editor-input" id="editor-question-type" name="type"><option value="multiple-choice" ${type === 'multiple-choice' ? 'selected' : ''}>Choose an answer</option><option value="image-dropdown" ${type === 'image-dropdown' ? 'selected' : ''}>Picture and dropdown</option><option value="image-pairs" ${type === 'image-pairs' ? 'selected' : ''}>Pair question pool</option><option value="memory-grid" ${type === 'memory-grid' ? 'selected' : ''}>Memory grid</option><option value="ordering" ${type === 'ordering' ? 'selected' : ''}>Put steps in order</option></select></label>
      </div>
      <label class="editor-wide">Question text<input class="editor-input" name="question" required value="${escapeAttribute(source.question || '')}" placeholder="Write a short question"></label>
      <label class="editor-wide">Explanation (optional)<textarea class="editor-input" name="explanation" rows="2">${escapeHtml(source.explanation || '')}</textarea></label>
      <section class="editor-type-panel" data-type-panel="multiple-choice" ${['multiple-choice', 'image-option'].includes(type) ? '' : 'hidden'}>
        <h2>Answer choices</h2>${renderImageField('prompt-image', source.image || '', source.imageAlt || '', type === 'image-option' ? 'Question picture (required)' : 'Question picture (optional)')}${type === 'image-option' ? '<p class="editor-note">Add one large picture and exactly four choices below. The choices may be words or pictures.</p>' : ''}<label>Choice style<select class="editor-input" id="editor-choice-mode"><option value="text" ${choiceMode === 'text' ? 'selected' : ''}>Text answers</option><option value="pictures" ${choiceMode === 'pictures' ? 'selected' : ''}>Picture answers</option></select></label>
        <div data-choice-panel="text" ${choiceMode === 'text' ? '' : 'hidden'}><label>Answer choices, one per line<textarea class="editor-input" name="textOptions" rows="5">${escapeHtml(choiceMode === 'text' ? sourceOptions.join('\n') : '')}</textarea></label><label>Correct answer<input class="editor-input" name="textAnswer" value="${escapeAttribute(choiceMode === 'text' ? source.answer || '' : '')}"></label></div>
        <div data-choice-panel="pictures" ${choiceMode === 'pictures' ? '' : 'hidden'}><p class="editor-note">Enter project-relative image paths. Choosing a file fills its filename only; it does not copy the image into the project. Choose which picture is correct.</p><div id="picture-choice-list">${renderPictureChoiceRows(choices, source.answer)}</div>${type === 'image-option' ? '' : '<button type="button" class="secondary" id="add-picture-choice">Add picture choice</button>'}</div>
      </section>
      <section class="editor-type-panel" data-type-panel="image-dropdown" ${type === 'image-dropdown' ? '' : 'hidden'}>
        <h2>Question picture and dropdown answers</h2>${renderImageField('question-image', source.image || '', source.imageAlt || '', 'Question picture')}
        <label>Answer choices, one per line<textarea class="editor-input" name="dropdownOptions" rows="5">${escapeHtml(type === 'image-dropdown' ? (source.options || []).join('\n') : '')}</textarea></label><label>Correct answer<input class="editor-input" name="dropdownAnswer" value="${escapeAttribute(type === 'image-dropdown' ? source.answer || '' : '')}"></label>
      </section>
      <section class="editor-type-panel" data-type-panel="image-pairs" ${type === 'image-pairs' ? '' : 'hidden'}>
        <h2>Pair question pool</h2>${renderImageField('pair-prompt-image', source.image || '', source.imageAlt || '', 'Top-level image (optional)')}<div class="editor-form-grid"><label>Pairs shown in a matching round<input class="editor-input" name="sampleSize" type="number" min="2" value="${source.sampleSize || source.pairs?.length || 4}"></label><label>Choices in a single-answer round<input class="editor-input" name="optionCount" type="number" min="2" value="${pairOptionCount}"></label></div><label class="editor-radio"><input type="checkbox" name="allowReversal" ${pairAllowReversal ? 'checked' : ''}> Allow reversed questions (show a right-side item and ask for its left-side match)</label><p class="editor-note">The quiz randomly chooses between a matching round, a left-to-right single-answer question, and (when enabled) a reversed single-answer question. Each row is one prompt and its correct match. Top-level image is optional.</p><div id="matching-pair-list">${renderMatchingPairRows(pairRows)}</div><button type="button" class="secondary" id="add-matching-pair">Add pair</button>
      </section>
      <section class="editor-type-panel" data-type-panel="ordering" ${type === 'ordering' ? '' : 'hidden'}>
        <h2>Put steps in order</h2><p class="editor-note">Enter one step per line as: step text | JPG image path | image description. The saved order is the correct order; cards are shuffled for each quiz round.</p><label>Steps<textarea class="editor-input" name="orderingSteps" rows="8">${escapeHtml((source.steps || []).map((step) => `${step.text || ''} | ${step.image || ''} | ${step.alt || ''}`).join('\n'))}</textarea></label>
      </section>
      <section class="editor-type-panel" data-type-panel="memory-grid" ${type === 'memory-grid' ? '' : 'hidden'}>
        <h2>Memory grid</h2><div class="editor-form-grid"><label>Rows<input class="editor-input" name="memoryRows" type="number" min="1" max="10" value="${memoryRows}"></label><label>Columns<input class="editor-input" name="memoryColumns" type="number" min="1" max="10" value="${memoryColumns}"></label><label>Picture display time (seconds)<input class="editor-input" name="memoryPreviewSeconds" type="number" min="1" max="120" value="${memoryPreviewSeconds}"></label><label class="editor-radio"><input type="checkbox" name="memoryShuffle" ${memoryShuffle ? 'checked' : ''}> Shuffle picture positions each round</label></div><p class="editor-note">Enter one path per square, from top-left to bottom-right. The number of paths must equal rows × columns. The app can choose random pictures and order each round, or use the fixed squares below. Placeholder paths use A.png through P.png in images/memory-grid/.</p><label>Grid images (paths)<textarea class="editor-input" name="memoryImages" rows="10">${escapeHtml(memoryPaths.join('\n'))}</textarea></label><div class="editor-form-grid"><label>Pictures to recall each round<input class="editor-input" name="memoryRecallCount" type="number" min="1" max="100" value="${memoryRecallCount}"></label><label class="editor-radio"><input type="checkbox" name="memoryRandomizePrompts" ${memoryRandomizePrompts ? 'checked' : ''}> Randomize target pictures and their order each round</label></div><label data-fixed-memory-sequence ${memoryRandomizePrompts ? 'hidden' : ''}>Fixed target squares (only used when random targets are off; numbers follow the original grid order)<input class="editor-input" name="memorySequence" value="${escapeAttribute(memorySequence.join(', '))}" placeholder="3, 7, 13"></label>
      </section>
      <div class="editor-save-row"><p id="editor-error" role="alert"></p><div class="editor-save-actions"><button class="secondary" id="download-one-question" type="button">Download this question (.json)</button><button class="primary" type="submit">Save question <span aria-hidden="true">✓</span></button></div></div>
    </form>
  </div>`;
  document.querySelector('#cancel-question-editor').addEventListener('click', cancelQuestionEditor);
  document.querySelector('#question-editor-form').addEventListener('submit', saveQuestionFromEditor);
  document.querySelector('#download-one-question').addEventListener('click', downloadCurrentQuestion);
  document.querySelector('#editor-question-type').addEventListener('change', (event) => {
    const draft = readQuestionEditorForm(); draft.type = event.target.value;
    if (['multiple-choice', 'image-option'].includes(draft.type)) { draft.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']; draft.answer = ''; }
    else if (draft.type === 'image-dropdown') { draft.image = ''; draft.imageAlt = ''; draft.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']; draft.answer = ''; }
    else if (draft.type === 'image-pairs') { draft.matchPairs = [1, 2, 3, 4].map((pair) => emptyMatchPair('pair-' + pair)); draft.allowReversal = true; draft.optionCount = 4; draft.sampleSize = 4; }
    else if (draft.type === 'ordering') { draft.steps = ['Clear the area and check the rules', 'Collect a bucket of sand or water', 'Build the fire', 'Cook the food', 'Make sure the fire is completely out', 'Leave the area'].map((text, i) => ({ id: `step-${i + 1}`, text, image: ['images/gw-fire-safety/clear-area-rules.jpg','images/gw-fire-safety/collect-sand-water.jpg','images/gw-fire-safety/build-fire.jpg','images/gw-fire-safety/cook-food.jpg','images/gw-fire-safety/extinguish-fire-completely.jpg','images/gw-fire-safety/leave-area.jpg'][i], alt: text })); draft.programme = 'GW'; draft.advancementIds = ['GW-34']; }
    else if (draft.type === 'memory-grid') { draft.memoryImagePaths = Array.from({ length: 16 }, (_, i) => `images/memory-grid/${String.fromCharCode(65 + i)}.png`); draft.memorySequence = [3, 7, 13]; draft.memoryRecallCount = 3; draft.memoryRandomizePrompts = true; draft.memoryRows = 4; draft.memoryColumns = 4; draft.memoryPreviewSeconds = 20; draft.memoryShuffle = true; if (draft.programme === 'SW') draft.advancementIds = ['SW-13']; }
    renderQuestionEditor(draft, questionEditorReturnTarget);
  });
  document.querySelector('[name="memoryRandomizePrompts"]')?.addEventListener('change', (event) => { const fixed = document.querySelector('[data-fixed-memory-sequence]'); if (fixed) fixed.hidden = event.target.checked; });
  document.querySelector('#editor-choice-mode')?.addEventListener('change', (event) => {
    app.querySelectorAll('[data-choice-panel]').forEach((element) => { element.hidden = element.dataset.choicePanel !== event.target.value; });
  });
  document.querySelector('#add-picture-choice')?.addEventListener('click', () => {
    const draft = readQuestionEditorForm(); draft.options.push({ id: `choice-${draft.options.length + 1}`, image: '', alt: '' });
    renderQuestionEditor(draft, questionEditorReturnTarget);
  });
  app.querySelectorAll('[data-remove-picture-choice]').forEach((button) => button.addEventListener('click', () => {
    const draft = readQuestionEditorForm(); draft.options.splice(Number(button.dataset.removePictureChoice), 1);
    renderQuestionEditor(draft, questionEditorReturnTarget);
  }));
  document.querySelector('#add-matching-pair')?.addEventListener('click', () => {
    const draft = readQuestionEditorForm(); draft.matchPairs.push(emptyMatchPair('pair-' + Date.now()));
    renderQuestionEditor(draft, questionEditorReturnTarget);
  });
  app.querySelectorAll('[data-remove-matching-pair]').forEach((button) => button.addEventListener('click', () => {
    const draft = readQuestionEditorForm(); draft.matchPairs.splice(Number(button.dataset.removeMatchingPair), 1);
    renderQuestionEditor(draft, questionEditorReturnTarget);
  }));
  app.querySelectorAll('.editor-kind').forEach((select) => select.addEventListener('change', () => updateEditorSideVisibility(select.closest('.editor-side'))));
  app.querySelectorAll('[data-upload-image]').forEach((input) => input.addEventListener('change', selectEditorImagePath));
  app.querySelectorAll('[data-choice-field="id"]').forEach((input) => input.addEventListener('input', () => { input.closest('[data-choice-row]').querySelector('[name="picture-answer"]').value = input.value; }));
  app.querySelectorAll('[data-choice-field="image"], [name="prompt-image"], [name="question-image"], [name="pair-prompt-image"], [data-pair-value]').forEach((input) => input.addEventListener('input', () => refreshEditorPreview(input)));
  app.querySelectorAll('[name="prompt-image-alt"], [name="question-image-alt"], [name="pair-prompt-image-alt"], [data-pair-alt], [data-choice-field="alt"]').forEach((input) => input.addEventListener('input', () => { const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview'); if (preview) preview.alt = input.value; }));
}
function emptyMatchPair(id = '') { return { id, left: { kind: 'image', value: '', alt: '' }, right: { kind: 'image', value: '', alt: '' } }; }
function filterQuestionList(value) {
  const query = value.trim().toLowerCase(); let shown = 0;
  app.querySelectorAll('[data-edit-question]').forEach((button) => { button.hidden = !button.dataset.searchText.includes(query); if (!button.hidden) shown++; });
  const empty = document.querySelector('#question-empty'); if (empty) empty.hidden = shown > 0;
}
function editorPairsFromQuestion(question) {
  if (question.matchPairs) return question.matchPairs;
  const normalized = migrateLegacyImageMatch(question);
  if (normalized.type !== 'image-pairs' || !Array.isArray(normalized.pairs)) {
    return [1, 2, 3, 4].map((index) => emptyMatchPair(`pair-${index}`));
  }
  return normalized.pairs.map((pair) => ({
    id: pair.id,
    left: pair.left.type === 'image'
      ? { kind: 'image', value: pair.left.src, alt: pair.left.alt || '' }
      : { kind: 'text', value: pair.left.value || '', alt: '' },
    right: pair.right.type === 'image'
      ? { kind: 'image', value: pair.right.src, alt: pair.right.alt || '' }
      : { kind: 'text', value: pair.right.value || '', alt: '' }
  }));
}
function renderImageField(name, value, alt, label) {
  return `<div class="editor-image-field"><label>${escapeHtml(label)} path<input class="editor-input" name="${name}" value="${escapeAttribute(value)}" placeholder="images/example.png"></label><small>Selecting a file fills its path only; it does not copy the image into the project. Put it in images/ or edit the path for a subfolder such as images/flags/.</small><label>Image description<input class="editor-input" name="${name}-alt" value="${escapeAttribute(alt)}"></label><label class="file-button secondary">Choose file<input type="file" accept="image/*" data-upload-image="${name}"></label><img class="editor-preview" src="${escapeAttribute(value)}" alt="${escapeAttribute(alt)}" ${value ? '' : 'hidden'}></div>`;
}
function renderPictureChoiceRows(options, answer) {
  return options.map((option, index) => `<div class="picture-choice-row" data-choice-row="${index}"><div class="editor-form-grid"><label>Choice ID<input class="editor-input" data-choice-field="id" value="${escapeAttribute(option.id || `choice-${index + 1}`)}"></label><label>Image path<input class="editor-input" data-choice-field="image" value="${escapeAttribute(option.image || '')}" placeholder="images/example.png"></label><label>Description<input class="editor-input" data-choice-field="alt" value="${escapeAttribute(option.alt || '')}"></label><label class="file-button secondary">Choose file<input type="file" accept="image/*" data-upload-image="choice" data-choice-index="${index}"></label></div><img class="editor-preview" src="${escapeAttribute(option.image || '')}" alt="${escapeAttribute(option.alt || '')}" ${option.image ? '' : 'hidden'}><label class="editor-radio"><input type="radio" name="picture-answer" value="${escapeAttribute(option.id || `choice-${index + 1}`)}" ${answer === option.id ? 'checked' : ''}> Correct answer</label><button type="button" class="text-button" data-remove-picture-choice="${index}" ${options.length <= 2 ? 'disabled' : ''}>Remove choice</button></div>`).join('');
}
function renderMatchingPairRows(pairs) {
  return pairs.map((pair, index) => `<div class="matching-pair-row" data-pair-row="${index}" data-pair-id="${escapeAttribute(pair.id || ('pair-' + (index + 1)))}"><strong>Pair ${index + 1}</strong>${renderMatchSide('left', pair.left, index)}${renderMatchSide('right', pair.right, index)}<button type="button" class="text-button" data-remove-matching-pair="${index}" ${pairs.length <= 2 ? 'disabled' : ''}>Remove pair</button></div>`).join('');
}
function renderMatchSide(side, item, index) {
  const kind = item.kind || 'image'; const isImage = kind === 'image';
  return `<div class="editor-side"><label>${side === 'left' ? 'Left item' : 'Matching answer'} type<select class="editor-input editor-kind" data-side="${side}" data-index="${index}"><option value="image" ${isImage ? 'selected' : ''}>Picture</option><option value="text" ${!isImage ? 'selected' : ''}>Short text</option></select></label><label>${isImage ? 'Image path' : 'Text'}<input class="editor-input" data-pair-value="${side}" data-index="${index}" value="${escapeAttribute(item.value || '')}" placeholder="${isImage ? 'images/example.png' : 'Short answer'}"></label><label ${isImage ? '' : 'hidden'}>Image description<input class="editor-input" data-pair-alt="${side}" data-index="${index}" value="${escapeAttribute(item.alt || '')}"></label><label class="file-button secondary" ${isImage ? '' : 'hidden'}>Choose file<input type="file" accept="image/*" data-upload-image="pair-${side}" data-pair-index="${index}"></label><img class="editor-preview" src="${escapeAttribute(isImage ? item.value || '' : '')}" alt="${escapeAttribute(item.alt || '')}" ${isImage && item.value ? '' : 'hidden'}></div>`;
}
function updateEditorSideVisibility(sideElement) {
  if (!sideElement) return;
  const image = sideElement.querySelector('.editor-kind').value === 'image';
  const alt = sideElement.querySelector('[data-pair-alt]')?.closest('label');
  const upload = sideElement.querySelector('[data-upload-image]')?.closest('label');
  if (alt) alt.hidden = !image; if (upload) upload.hidden = !image;
  const preview = sideElement.querySelector('.editor-preview'); if (preview) preview.hidden = !image || !sideElement.querySelector('[data-pair-value]').value;
  const valueLabel = sideElement.querySelector('[data-pair-value]')?.closest('label');
  const valueInput = valueLabel?.querySelector('input'); if (valueInput) valueInput.placeholder = image ? 'images/example.png' : 'Short answer';
}
function readQuestionEditorForm() {
  const form = document.querySelector('#question-editor-form'); const get = (name) => form.elements.namedItem(name)?.value || '';
  const type = get('type');
  const common = { id: get('id').trim(), programme: get('programme'), advancementIds: get('advancementIds').split(',').map((id) => id.trim()).filter(Boolean), type, question: get('question').trim(), explanation: get('explanation').trim() };
  if (['multiple-choice', 'image-option'].includes(type)) {
    const mode = document.querySelector('#editor-choice-mode').value;
    if (mode === 'text') return { ...common, image: get('prompt-image').trim(), imageAlt: get('prompt-image-alt').trim(), options: get('textOptions').split(/\r?\n/).map((option) => option.trim()).filter(Boolean), answer: get('textAnswer').trim(), editorChoiceMode: 'text' };
    const options = [...app.querySelectorAll('[data-choice-row]')].map((row) => ({ id: row.querySelector('[data-choice-field="id"]').value.trim(), image: row.querySelector('[data-choice-field="image"]').value.trim(), alt: row.querySelector('[data-choice-field="alt"]').value.trim() }));
    return { ...common, image: get('prompt-image').trim(), imageAlt: get('prompt-image-alt').trim(), options, answer: form.querySelector('[name="picture-answer"]:checked')?.value || '', editorChoiceMode: 'pictures' };
  }
  if (type === 'image-dropdown') return { ...common, image: get('question-image').trim(), imageAlt: get('question-image-alt').trim(), options: get('dropdownOptions').split(/\r?\n/).map((option) => option.trim()).filter(Boolean), answer: get('dropdownAnswer').trim() };
  if (type === 'image-pairs') {
    const matchPairs = [...app.querySelectorAll('[data-pair-row]')].map((row) => {
      const side = (name) => { const kind = row.querySelector(`.editor-kind[data-side="${name}"]`).value; return { kind, value: row.querySelector(`[data-pair-value="${name}"]`).value.trim(), alt: row.querySelector(`[data-pair-alt="${name}"]`)?.value.trim() || '' }; };
      return { id: row.dataset.pairId, left: side('left'), right: side('right') };
    });
    return { ...common, image: get('pair-prompt-image').trim(), imageAlt: get('pair-prompt-image-alt').trim(), allowReversal: form.elements.namedItem('allowReversal')?.checked === true, optionCount: Number(get('optionCount')) || 4, matchPairs, sampleSize: Number(get('sampleSize')) || 0 };
  }
  if (type === 'ordering') return { ...common, orderingSteps: get('orderingSteps').split(/\r?\n/).map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts.some(Boolean)).map((parts, index) => ({ id: `step-${index + 1}`, text: parts[0] || '', image: parts[1] || '', alt: parts[2] || parts[0] || '' })) };
  if (type === 'memory-grid') return { ...common, memoryImagePaths: get('memoryImages').split(/\r?\n/).map((path) => path.trim()), memorySequence: get('memorySequence').split(/[,\s]+/).map(Number).filter(Number.isFinite), memoryRows: Number(get('memoryRows')), memoryColumns: Number(get('memoryColumns')), memoryPreviewSeconds: Number(get('memoryPreviewSeconds')), memoryShuffle: form.elements.namedItem('memoryShuffle')?.checked === true, memoryRecallCount: Number(get('memoryRecallCount')), memoryRandomizePrompts: form.elements.namedItem('memoryRandomizePrompts')?.checked === true };
  const matchPairs = [...app.querySelectorAll('[data-pair-row]')].map((row) => {
    const side = (name) => { const kind = row.querySelector(`.editor-kind[data-side="${name}"]`).value; return { kind, value: row.querySelector(`[data-pair-value="${name}"]`).value.trim(), alt: row.querySelector(`[data-pair-alt="${name}"]`)?.value.trim() || '' }; };
    return { id: row.dataset.pairId, left: side('left'), right: side('right') };
  });
  return { ...common, matchPairs, sampleSize: Number(get('sampleSize')) || 0 };
}
function questionFromEditorDraft(draft) {
  const { advancementIds, editorChoiceMode, matchPairs, sampleSize, optionCount, allowReversal, memoryImagePaths, memorySequence, memoryRows, memoryColumns, memoryPreviewSeconds, memoryShuffle, memoryRecallCount, memoryRandomizePrompts, orderingSteps, ...question } = draft;
  if (advancementIds.length === 1) question.advancementId = advancementIds[0]; else question.advancementIds = advancementIds;
  delete question.editorChoiceMode;
  if (question.type === 'ordering') question.steps = orderingSteps;
  if (question.type === 'memory-grid') {
    question.cells = memoryImagePaths.map((image, index) => ({ id: `cell-${index + 1}`, image, alt: image.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || `Picture ${index + 1}` }));
    question.recallCount = memoryRecallCount;
    question.randomizePrompts = memoryRandomizePrompts;
    if (memoryRandomizePrompts) delete question.sequence; else question.sequence = memorySequence;
    question.rows = memoryRows;
    question.columns = memoryColumns;
    question.previewSeconds = memoryPreviewSeconds;
    question.shuffleCells = memoryShuffle;
  }
  if (question.type === 'image-pairs') {
    const toSide = (side) => side.kind === 'image'
      ? { type: 'image', src: side.value, alt: side.alt }
      : { type: 'text', value: side.value };
    delete question.format;
    question.allowReversal = allowReversal !== false;
    question.sampleSize = sampleSize;
    question.optionCount = optionCount;
    question.pairs = matchPairs.map((pair, index) => ({
      id: pair.id || ('pair-' + (index + 1)),
      left: toSide(pair.left),
      right: toSide(pair.right)
    }));
    delete question.leftItems;
    delete question.rightItems;
    delete question.answer;
  }
  return question;
}
function validateEditorDraft(draft, question) {
  if (!question.id || !question.question) return 'Add a question ID and question text.';
  if (!['MEM', 'SW', 'GW'].includes(question.programme)) return 'Choose Membership, SW or GW.';
  if (!draft.advancementIds.length) return 'Add at least one advancement ID.';
  const validIds = catalogue.flatMap((p) => p.categories.flatMap((category) => category.advancements.map((item) => item.id)));
  if (draft.advancementIds.some((id) => !validIds.includes(id))) return 'One or more advancement IDs are not in the catalogue.';
  if (draft.advancementIds.some((id) => !id.startsWith(`${question.programme}-`))) return 'The advancement IDs must belong to the selected programme.';
  if (bank.some((item) => item.id === question.id && item.id !== questionEditorOriginalId)) return 'That question ID is already in use.';
  if (['multiple-choice', 'image-option'].includes(question.type)) {
    if (!question.options || question.options.length < 2) return 'Add at least two answer choices.';
    if (question.type === 'image-option' && question.options.length !== 4) return 'An image-option question needs exactly four answer choices.';
    if (question.type === 'image-option' && !question.image) return 'Add the question picture.';
    if (draft.editorChoiceMode === 'text' && question.type === 'image-option' && new Set(question.options).size !== 4) return 'The four text choices must be different.';
    if (draft.editorChoiceMode === 'text' && !question.options.includes(question.answer)) return 'The correct answer must exactly match one of the choices.';
    if (draft.editorChoiceMode === 'pictures') {
      if (question.options.some((item) => !item.id || !item.image || !item.alt)) return 'Each picture choice needs an ID, image, and description.';
      if (new Set(question.options.map((item) => item.id)).size !== question.options.length) return 'Picture choice IDs must be unique.';
      if (!question.options.some((item) => item.id === question.answer)) return 'Choose the correct picture.';
    }
  }
  if (question.type === 'ordering') {
    if (!Array.isArray(question.steps) || question.steps.length < 2) return 'Add at least two steps.';
    if (question.steps.some((step) => !step.text || !step.image || !step.alt)) return 'Each step needs text, an image path, and an image description.';
    if (new Set(question.steps.map((step) => step.id)).size !== question.steps.length) return 'Step IDs must be unique.';
  }
  if (question.type === 'memory-grid') {
    if (!Number.isInteger(question.rows) || question.rows < 1 || question.rows > 10 || !Number.isInteger(question.columns) || question.columns < 1 || question.columns > 10) return 'Rows and columns must each be between 1 and 10.';
    if (question.cells.length !== question.rows * question.columns || question.cells.some((cell) => !cell.image)) return `Add exactly ${question.rows * question.columns} image paths for this grid.`;
    if (!Number.isInteger(question.previewSeconds) || question.previewSeconds < 1 || question.previewSeconds > 120) return 'Set a preview time between 1 and 120 seconds.';
    if (!Number.isInteger(question.recallCount) || question.recallCount < 1 || question.recallCount > question.cells.length) return `Choose between 1 and ${question.cells.length} pictures to recall.`;
    if (question.randomizePrompts === false && (!question.sequence || question.sequence.length !== question.recallCount || question.sequence.some((number) => !Number.isInteger(number) || number < 1 || number > question.cells.length) || new Set(question.sequence).size !== question.sequence.length)) return 'Choose a different valid square for each fixed target picture.';
  }
  if (question.type === 'image-dropdown' && (!question.image || question.options.length < 2 || !question.options.includes(question.answer))) return 'Add a question picture, at least two dropdown choices, and a correct answer from the list.';
  if (question.type === 'image-pairs') {
    if (!question.pairs || question.pairs.length < 2) return 'Add at least two matching pairs.';
    if (question.sampleSize < 2 || question.sampleSize > question.pairs.length) return 'Choose a matching round size between two pairs and the number of pairs in the pool.';
    if (!Number.isInteger(question.optionCount) || question.optionCount < 2) return 'Choose at least two answer choices.';
    const sideKey = (side) => side.type === 'image' ? `image:${side.src}` : `text:${String(side.value || '').trim().toLowerCase()}`;
    const rightCount = new Set(question.pairs.map((pair) => sideKey(pair.right))).size;
    const leftCount = new Set(question.pairs.map((pair) => sideKey(pair.left))).size;
    if (question.optionCount > rightCount || (question.allowReversal && question.optionCount > leftCount)) return 'Each answer side needs enough unique items for the selected number of choices.';
    if (new Set(question.pairs.map((pair) => pair.id)).size !== question.pairs.length) return 'Pair IDs must be unique.';
    if (question.pairs.some((pair) => [pair.left, pair.right].some((side) => side.type === 'image' ? !side.src : !side.value))) return 'Complete both sides of every matching pair.';
    if (question.pairs.some((pair) => [pair.left, pair.right].some((side) => side.type === 'image' && !side.alt))) return 'Add a short description for each picture.';
  }
  return '';
}
function saveQuestionFromEditor(event) {
  event.preventDefault(); const draft = readQuestionEditorForm(); const question = questionFromEditorDraft(draft);
  const error = validateEditorDraft(draft, question); const errorSlot = document.querySelector('#editor-error');
  if (error) { errorSlot.textContent = error; return; }
  const existingIndex = bank.findIndex((item) => item.id === questionEditorOriginalId);
  if (existingIndex >= 0) bank[existingIndex] = question; else bank.push(question);
  if (!writeQuestionBankOverride()) alert('The question is saved for this session, but browser storage is full. Download questions.json now to keep it.');
  else { servedDataVersions.questions = `local edits ${questionOverrideVersion}`; renderDataVersion(); }
  if (questionEditorReturnTarget === 'quiz') { questions[index] = question; renderQuestion(); } else renderQuestionManager();
}

function downloadCurrentQuestion() {
  const draft = readQuestionEditorForm();
  const question = questionFromEditorDraft(draft);
  const error = validateEditorDraft(draft, question);
  const errorSlot = document.querySelector('#editor-error');
  if (error) { errorSlot.textContent = error; return; }
  const blob = new Blob([`${JSON.stringify({ version: new Date().toISOString(), questions: [question] }, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${question.id.replace(/[^a-z0-9_-]+/gi, '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cancelQuestionEditor() { if (questionEditorReturnTarget === 'quiz') renderQuestion(); else renderQuestionManager(); }
function downloadQuestionBank() {
  const version = new Date().toISOString();
  questionOverrideVersion = version;
  servedDataVersions.questions = `local edits ${version}`;
  renderDataVersion();
  const blob = new Blob([`${JSON.stringify({ version, questions: bank }, null, 2)}\n`], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'questions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importQuestionBank(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()); if (!Array.isArray(data.questions)) throw new Error('The file needs a questions array.');
    const ids = data.questions.map((question) => question.id); if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Every question needs a unique ID.');
    bank = migrateQuestionBank(data.questions); if (!writeQuestionBankOverride()) alert('Imported for this session, but browser storage is full. Download the question bank to keep it.'); renderQuestionManager();
  } catch (error) { alert(`Could not import this question bank: ${error.message}`); }
}
function resetQuestionBankOverride() {
  if (!confirm('Clear browser-only question edits and reload questions.json from the project? Export your changes first if needed.')) return;
  localStorage.removeItem(QUESTION_BANK_STORAGE_KEY); location.reload();
}
function selectEditorImagePath(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;

  const type = input.dataset.uploadImage;
  let target;
  if (type === 'question-image') target = document.querySelector('[name="question-image"]');
  if (type === 'prompt-image') target = document.querySelector('[name="prompt-image"]');
  if (type === 'pair-prompt-image') target = document.querySelector('[name="pair-prompt-image"]');
  if (type === 'choice') target = input.closest('.picture-choice-row').querySelector('[data-choice-field="image"]');
  if (type === 'pair-left' || type === 'pair-right') target = input.closest('.editor-side').querySelector('[data-pair-value]');
  if (!target) return;

  const currentPath = target.value.trim().replace(/\\/g, '/');
  const folder = currentPath.startsWith('images/') && currentPath.includes('/')
    ? currentPath.slice(0, currentPath.lastIndexOf('/'))
    : 'images';
  target.value = `${folder}/${file.name}`;
  const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview');
  if (preview) { preview.src = target.value; preview.hidden = false; }
}
function refreshEditorPreview(input) {
  const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview');
  if (!preview) return;
  const imageKind = !input.matches('[data-pair-value]') || input.closest('.editor-side').querySelector('.editor-kind').value === 'image';
  preview.src = input.value;
  preview.hidden = !imageKind || !input.value;
}


