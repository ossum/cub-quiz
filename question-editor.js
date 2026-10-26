const QUESTION_BANK_STORAGE_KEY = 'edward-cub-quiz-question-bank-v1';
let questionEditorReturnTarget = 'manager';
let questionEditorOriginalId = null;

function readQuestionBankOverride() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUESTION_BANK_STORAGE_KEY) || 'null');
    return Array.isArray(saved?.questions) ? saved.questions : null;
  } catch { return null; }
}
function writeQuestionBankOverride() {
  try { localStorage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify({ questions: bank })); return true; }
  catch { return false; }
}
function defaultEditorQuestion() {
  const programme = selection.programme || 'SW';
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
  const query = filter.trim().toLowerCase();
  const visible = bank.filter((question) => `${question.id} ${question.question} ${question.programme} ${questionAdvancementLabel(question)}`.toLowerCase().includes(query));
  app.innerHTML = `<div class="question-manager editor-page">
    <div class="editor-heading"><div><p class="eyebrow">LEADER TOOL</p><h1>Question bank</h1><p>Changes save in this browser. Download the JSON to keep them in the project.</p></div><button class="secondary" id="manager-done">Back to quiz setup</button></div>
    <div class="editor-toolbar"><button class="primary" id="new-question">Add a question <span aria-hidden="true">＋</span></button><button class="secondary" id="download-question-bank">Download questions.json</button><label class="secondary file-button">Import questions.json<input id="import-question-bank" type="file" accept="application/json,.json"></label><button class="text-button" id="reset-question-bank">Use project version</button></div>
    <p class="editor-note">Images you upload are stored inside the question data. After downloading, replace <code>data/questions.json</code> in the project. “Use project version” clears browser-only edits after you have updated the project file.</p>
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
  window.removeEventListener('resize', drawMatchLines);
  const source = structuredClone(question || defaultEditorQuestion());
  questionEditorReturnTarget = returnTarget;
  questionEditorOriginalId = question?.id || null;
  const type = source.type || 'multiple-choice';
  const programme = source.programme || selection.programme;
  const advancementIds = source.advancementIds || [source.advancementId].filter(Boolean);
  const sourceOptions = Array.isArray(source.options) ? source.options : [];
  const choiceMode = sourceOptions[0] && typeof sourceOptions[0] === 'object' ? 'pictures' : 'text';
  const choices = choiceMode === 'pictures' ? source.options : [1, 2, 3, 4].map((i) => ({ id: `choice-${i}`, image: '', alt: '' }));
  const pairRows = editorPairsFromQuestion(source);
  const programmeOptions = catalogue.map((item) => `<option value="${item.id}" ${item.id === programme ? 'selected' : ''}>${escapeHtml(item.name)} (${item.id})</option>`).join('');
  app.innerHTML = `<div class="question-editor editor-page">
    <div class="editor-heading"><div><p class="eyebrow">LEADER TOOL</p><h1>${question ? 'Edit question' : 'Add a question'}</h1><p>Fill in the question, its advancement and the answer choices.</p></div><button class="secondary" id="cancel-question-editor">Cancel</button></div>
    <form id="question-editor-form" novalidate>
      <div class="editor-form-grid">
        <label>Question ID<input class="editor-input" name="id" required value="${escapeAttribute(source.id || '')}"><small>Short and unique, for example gw-road-sign-1.</small></label>
        <label>Programme<select class="editor-input" name="programme">${programmeOptions}</select></label>
        <label>Advancement ID(s)<input class="editor-input" name="advancementIds" required value="${escapeAttribute(advancementIds.join(', '))}"><small>Use one ID, or a comma-separated list for a shared question.</small></label>
        <label>Question type<select class="editor-input" id="editor-question-type" name="type"><option value="multiple-choice" ${type === 'multiple-choice' ? 'selected' : ''}>Choose an answer</option><option value="image-dropdown" ${type === 'image-dropdown' ? 'selected' : ''}>Picture and dropdown</option><option value="image-match" ${type === 'image-match' ? 'selected' : ''}>Matching</option></select></label>
      </div>
      <label class="editor-wide">Question text<input class="editor-input" name="question" required value="${escapeAttribute(source.question || '')}" placeholder="Write a short question"></label>
      <label class="editor-wide">Explanation (optional)<textarea class="editor-input" name="explanation" rows="2">${escapeHtml(source.explanation || '')}</textarea></label>
      <section class="editor-type-panel" data-type-panel="multiple-choice" ${type === 'multiple-choice' ? '' : 'hidden'}>
        <h2>Answer choices</h2><label>Choice style<select class="editor-input" id="editor-choice-mode"><option value="text" ${choiceMode === 'text' ? 'selected' : ''}>Text answers</option><option value="pictures" ${choiceMode === 'pictures' ? 'selected' : ''}>Picture answers</option></select></label>
        <div data-choice-panel="text" ${choiceMode === 'text' ? '' : 'hidden'}><label>Answer choices, one per line<textarea class="editor-input" name="textOptions" rows="5">${escapeHtml(choiceMode === 'text' ? sourceOptions.join('\n') : '')}</textarea></label><label>Correct answer<input class="editor-input" name="textAnswer" value="${escapeAttribute(choiceMode === 'text' ? source.answer || '' : '')}"></label></div>
        <div data-choice-panel="pictures" ${choiceMode === 'pictures' ? '' : 'hidden'}><p class="editor-note">Upload each picture or enter its project-relative path. Choose which picture is correct.</p><div id="picture-choice-list">${renderPictureChoiceRows(choices, source.answer)}</div><button type="button" class="secondary" id="add-picture-choice">Add picture choice</button></div>
      </section>
      <section class="editor-type-panel" data-type-panel="image-dropdown" ${type === 'image-dropdown' ? '' : 'hidden'}>
        <h2>Question picture and dropdown answers</h2>${renderImageField('question-image', source.image || '', source.imageAlt || '', 'Question picture')}
        <label>Answer choices, one per line<textarea class="editor-input" name="dropdownOptions" rows="5">${escapeHtml(type === 'image-dropdown' ? (source.options || []).join('\n') : '')}</textarea></label><label>Correct answer<input class="editor-input" name="dropdownAnswer" value="${escapeAttribute(type === 'image-dropdown' ? source.answer || '' : '')}"></label>
      </section>
      <section class="editor-type-panel" data-type-panel="image-match" ${type === 'image-match' ? '' : 'hidden'}>
        <h2>Matching pairs</h2><label>Pairs shown in each round<input class="editor-input" name="sampleSize" type="number" min="2" value="${source.sampleSize || source.leftItems?.length || 4}"></label><p class="editor-note">Each row is one correct pair. Choose a picture or short text for each side. The app shuffles the right-hand choices.</p><div id="matching-pair-list">${renderMatchingPairRows(pairRows)}</div><button type="button" class="secondary" id="add-matching-pair">Add matching pair</button>
      </section>
      <div class="editor-save-row"><p id="editor-error" role="alert"></p><button class="primary" type="submit">Save question <span aria-hidden="true">✓</span></button></div>
    </form>
  </div>`;
  document.querySelector('#cancel-question-editor').addEventListener('click', cancelQuestionEditor);
  document.querySelector('#question-editor-form').addEventListener('submit', saveQuestionFromEditor);
  document.querySelector('#editor-question-type').addEventListener('change', (event) => {
    const draft = readQuestionEditorForm(); draft.type = event.target.value;
    if (draft.type === 'multiple-choice') { draft.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']; draft.answer = ''; }
    else if (draft.type === 'image-dropdown') { draft.image = ''; draft.imageAlt = ''; draft.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']; draft.answer = ''; }
    else { draft.leftItems = []; draft.rightItems = []; draft.answer = {}; }
    renderQuestionEditor(draft, questionEditorReturnTarget);
  });
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
    const draft = readQuestionEditorForm(); draft.matchPairs.push(emptyMatchPair());
    renderQuestionEditor(draft, questionEditorReturnTarget);
  });
  app.querySelectorAll('[data-remove-matching-pair]').forEach((button) => button.addEventListener('click', () => {
    const draft = readQuestionEditorForm(); draft.matchPairs.splice(Number(button.dataset.removeMatchingPair), 1);
    renderQuestionEditor(draft, questionEditorReturnTarget);
  }));
  app.querySelectorAll('.editor-kind').forEach((select) => select.addEventListener('change', () => updateEditorSideVisibility(select.closest('.editor-side'))));
  app.querySelectorAll('[data-upload-image]').forEach((input) => input.addEventListener('change', uploadEditorImage));
  app.querySelectorAll('[data-choice-field="id"]').forEach((input) => input.addEventListener('input', () => { input.closest('[data-choice-row]').querySelector('[name="picture-answer"]').value = input.value; }));
  app.querySelectorAll('[data-choice-field="image"], [name="question-image"], [data-pair-value]').forEach((input) => input.addEventListener('input', () => refreshEditorPreview(input)));
  app.querySelectorAll('[name="question-image-alt"], [data-pair-alt], [data-choice-field="alt"]').forEach((input) => input.addEventListener('input', () => { const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview'); if (preview) preview.alt = input.value; }));
}
function emptyMatchPair() { return { left: { kind: 'image', value: '', alt: '' }, right: { kind: 'image', value: '', alt: '' } }; }
function filterQuestionList(value) {
  const query = value.trim().toLowerCase(); let shown = 0;
  app.querySelectorAll('[data-edit-question]').forEach((button) => { button.hidden = !button.dataset.searchText.includes(query); if (!button.hidden) shown++; });
  const empty = document.querySelector('#question-empty'); if (empty) empty.hidden = shown > 0;
}
function editorPairsFromQuestion(question) {
  if (question.matchPairs) return question.matchPairs;
  if (question.type !== 'image-match' || !question.leftItems?.length) return [emptyMatchPair(), emptyMatchPair(), emptyMatchPair(), emptyMatchPair()];
  return (question.leftItems || []).map((left) => {
    const right = question.rightItems?.find((item) => item.id === question.answer?.[left.id]) || {};
    return { left: { kind: left.image ? 'image' : 'text', value: left.image || left.text || '', alt: left.alt || '' }, right: { kind: right.image ? 'image' : 'text', value: right.image || right.text || '', alt: right.alt || '' } };
  });
}
function renderImageField(name, value, alt, label) {
  return `<div class="editor-image-field"><label>${escapeHtml(label)} path or URL<input class="editor-input" name="${name}" value="${escapeAttribute(value)}" placeholder="images/example.png"></label><label>Image description<input class="editor-input" name="${name}-alt" value="${escapeAttribute(alt)}"></label><label class="file-button secondary">Upload image<input type="file" accept="image/*" data-upload-image="${name}"></label><img class="editor-preview" src="${escapeAttribute(value)}" alt="${escapeAttribute(alt)}" ${value ? '' : 'hidden'}></div>`;
}
function renderPictureChoiceRows(options, answer) {
  return options.map((option, index) => `<div class="picture-choice-row" data-choice-row="${index}"><div class="editor-form-grid"><label>Choice ID<input class="editor-input" data-choice-field="id" value="${escapeAttribute(option.id || `choice-${index + 1}`)}"></label><label>Image path or URL<input class="editor-input" data-choice-field="image" value="${escapeAttribute(option.image || '')}" placeholder="images/example.png"></label><label>Description<input class="editor-input" data-choice-field="alt" value="${escapeAttribute(option.alt || '')}"></label><label class="file-button secondary">Upload image<input type="file" accept="image/*" data-upload-image="choice" data-choice-index="${index}"></label></div><img class="editor-preview" src="${escapeAttribute(option.image || '')}" alt="${escapeAttribute(option.alt || '')}" ${option.image ? '' : 'hidden'}><label class="editor-radio"><input type="radio" name="picture-answer" value="${escapeAttribute(option.id || `choice-${index + 1}`)}" ${answer === option.id ? 'checked' : ''}> Correct answer</label><button type="button" class="text-button" data-remove-picture-choice="${index}" ${options.length <= 2 ? 'disabled' : ''}>Remove choice</button></div>`).join('');
}
function renderMatchingPairRows(pairs) {
  return pairs.map((pair, index) => `<div class="matching-pair-row" data-pair-row="${index}"><strong>Pair ${index + 1}</strong>${renderMatchSide('left', pair.left, index)}${renderMatchSide('right', pair.right, index)}<button type="button" class="text-button" data-remove-matching-pair="${index}" ${pairs.length <= 2 ? 'disabled' : ''}>Remove pair</button></div>`).join('');
}
function renderMatchSide(side, item, index) {
  const kind = item.kind || 'image'; const isImage = kind === 'image';
  return `<div class="editor-side"><label>${side === 'left' ? 'Left item' : 'Matching answer'} type<select class="editor-input editor-kind" data-side="${side}" data-index="${index}"><option value="image" ${isImage ? 'selected' : ''}>Picture</option><option value="text" ${!isImage ? 'selected' : ''}>Short text</option></select></label><label>${isImage ? 'Image path or URL' : 'Text'}<input class="editor-input" data-pair-value="${side}" data-index="${index}" value="${escapeAttribute(item.value || '')}" placeholder="${isImage ? 'images/example.png' : 'Short answer'}"></label><label ${isImage ? '' : 'hidden'}>Image description<input class="editor-input" data-pair-alt="${side}" data-index="${index}" value="${escapeAttribute(item.alt || '')}"></label><label class="file-button secondary" ${isImage ? '' : 'hidden'}>Upload image<input type="file" accept="image/*" data-upload-image="pair-${side}" data-pair-index="${index}"></label><img class="editor-preview" src="${escapeAttribute(isImage ? item.value || '' : '')}" alt="${escapeAttribute(item.alt || '')}" ${isImage && item.value ? '' : 'hidden'}></div>`;
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
  if (type === 'multiple-choice') {
    const mode = document.querySelector('#editor-choice-mode').value;
    if (mode === 'text') return { ...common, options: get('textOptions').split(/\r?\n/).map((option) => option.trim()).filter(Boolean), answer: get('textAnswer').trim(), editorChoiceMode: 'text' };
    const options = [...app.querySelectorAll('[data-choice-row]')].map((row) => ({ id: row.querySelector('[data-choice-field="id"]').value.trim(), image: row.querySelector('[data-choice-field="image"]').value.trim(), alt: row.querySelector('[data-choice-field="alt"]').value.trim() }));
    return { ...common, options, answer: form.querySelector('[name="picture-answer"]:checked')?.value || '', editorChoiceMode: 'pictures' };
  }
  if (type === 'image-dropdown') return { ...common, image: get('question-image').trim(), imageAlt: get('question-image-alt').trim(), options: get('dropdownOptions').split(/\r?\n/).map((option) => option.trim()).filter(Boolean), answer: get('dropdownAnswer').trim() };
  const matchPairs = [...app.querySelectorAll('[data-pair-row]')].map((row) => {
    const side = (name) => { const kind = row.querySelector(`.editor-kind[data-side="${name}"]`).value; return { kind, value: row.querySelector(`[data-pair-value="${name}"]`).value.trim(), alt: row.querySelector(`[data-pair-alt="${name}"]`)?.value.trim() || '' }; };
    return { left: side('left'), right: side('right') };
  });
  return { ...common, matchPairs, sampleSize: Number(get('sampleSize')) || 0 };
}
function questionFromEditorDraft(draft) {
  const { advancementIds, editorChoiceMode, matchPairs, sampleSize, ...question } = draft;
  if (advancementIds.length === 1) question.advancementId = advancementIds[0]; else question.advancementIds = advancementIds;
  delete question.editorChoiceMode;
  if (question.type === 'image-match') {
    question.sampleSize = sampleSize;
    question.leftItems = []; question.rightItems = []; question.answer = {};
    matchPairs.forEach((pair, index) => {
      const leftId = `left-${index + 1}`; const rightId = `right-${index + 1}`;
      question.leftItems.push(pair.left.kind === 'image' ? { id: leftId, image: pair.left.value, alt: pair.left.alt } : { id: leftId, text: pair.left.value });
      question.rightItems.push(pair.right.kind === 'image' ? { id: rightId, image: pair.right.value, alt: pair.right.alt } : { id: rightId, text: pair.right.value });
      question.answer[leftId] = rightId;
    });
  }
  return question;
}
function validateEditorDraft(draft, question) {
  if (!question.id || !question.question) return 'Add a question ID and question text.';
  if (!['SW', 'GW'].includes(question.programme)) return 'Choose SW or GW.';
  if (!draft.advancementIds.length) return 'Add at least one advancement ID.';
  const validIds = catalogue.flatMap((p) => p.categories.flatMap((category) => category.advancements.map((item) => item.id)));
  if (draft.advancementIds.some((id) => !validIds.includes(id))) return 'One or more advancement IDs are not in the catalogue.';
  if (draft.advancementIds.some((id) => !id.startsWith(`${question.programme}-`))) return 'The advancement IDs must belong to the selected programme.';
  if (bank.some((item) => item.id === question.id && item.id !== questionEditorOriginalId)) return 'That question ID is already in use.';
  if (question.type === 'multiple-choice') {
    if (!question.options || question.options.length < 2) return 'Add at least two answer choices.';
    if (draft.editorChoiceMode === 'text' && !question.options.includes(question.answer)) return 'The correct answer must exactly match one of the choices.';
    if (draft.editorChoiceMode === 'pictures') {
      if (question.options.some((item) => !item.id || !item.image || !item.alt)) return 'Each picture choice needs an ID, image, and description.';
      if (new Set(question.options.map((item) => item.id)).size !== question.options.length) return 'Picture choice IDs must be unique.';
      if (!question.options.some((item) => item.id === question.answer)) return 'Choose the correct picture.';
    }
  }
  if (question.type === 'image-dropdown' && (!question.image || question.options.length < 2 || !question.options.includes(question.answer))) return 'Add a question picture, at least two dropdown choices, and a correct answer from the list.';
  if (question.type === 'image-match') {
    if (question.leftItems.length < 2) return 'Add at least two matching pairs.';
    if (question.sampleSize < 2 || question.sampleSize > question.leftItems.length) return 'Choose a display size between two pairs and the number of pairs in the pool.';
    if (question.leftItems.some((item) => !(item.image || item.text)) || question.rightItems.some((item) => !(item.image || item.text))) return 'Complete both sides of every matching pair.';
    if (question.leftItems.some((item) => item.image && !item.alt) || question.rightItems.some((item) => item.image && !item.alt)) return 'Add a short description for each picture.';
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
  if (questionEditorReturnTarget === 'quiz') { questions[index] = question; renderQuestion(); } else renderQuestionManager();
}
function cancelQuestionEditor() { if (questionEditorReturnTarget === 'quiz') renderQuestion(); else renderQuestionManager(); }
function downloadQuestionBank() {
  const blob = new Blob([`${JSON.stringify({ questions: bank }, null, 2)}\n`], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'questions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importQuestionBank(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()); if (!Array.isArray(data.questions)) throw new Error('The file needs a questions array.');
    const ids = data.questions.map((question) => question.id); if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Every question needs a unique ID.');
    bank = data.questions; if (!writeQuestionBankOverride()) alert('Imported for this session, but browser storage is full. Download the question bank to keep it.'); renderQuestionManager();
  } catch (error) { alert(`Could not import this question bank: ${error.message}`); }
}
function resetQuestionBankOverride() {
  if (!confirm('Clear browser-only question edits and reload questions.json from the project? Export your changes first if needed.')) return;
  localStorage.removeItem(QUESTION_BANK_STORAGE_KEY); location.reload();
}
async function uploadEditorImage(event) {
  const input = event.target; const file = input.files?.[0]; if (!file) return;
  try {
    const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image conversion failed.')), 'image/png'));
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    applyUploadedImage(input, dataUrl);
  } catch { alert('Could not read that image. Try a PNG or JPG file.'); }
}
function applyUploadedImage(input, dataUrl) {
  const type = input.dataset.uploadImage; let target;
  if (type === 'question-image') target = document.querySelector('[name="question-image"]');
  if (type === 'choice') target = input.closest('.picture-choice-row').querySelector('[data-choice-field="image"]');
  if (type === 'pair-left' || type === 'pair-right') target = input.closest('.editor-side').querySelector('[data-pair-value]');
  if (!target) return;
  target.value = dataUrl;
  const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview');
  if (preview) { preview.src = dataUrl; preview.hidden = false; }
}
function refreshEditorPreview(input) {
  const preview = input.closest('.editor-image-field, .picture-choice-row, .editor-side')?.querySelector('.editor-preview');
  if (!preview) return;
  const imageKind = !input.matches('[data-pair-value]') || input.closest('.editor-side').querySelector('.editor-kind').value === 'image';
  preview.src = input.value;
  preview.hidden = !imageKind || !input.value;
}
