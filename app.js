const app = document.querySelector('#app');
const colours = { green: '#5b914f', blue: '#4b83bd', yellow: '#d4a92f', red: '#cf6253' };
let bank = [];
let catalogue = [];
let questions = [];
let index = 0;
let score = 0;
let locked = false;
let selection = { programme: 'SW', mode: 'advancement', advancementId: '' };
let matchState = null;

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

async function loadData() {
  try {
    const [questionResponse, advancementResponse] = await Promise.all([
      fetch('./data/questions.json'),
      fetch('./data/advancements.json')
    ]);
    if (!questionResponse.ok || !advancementResponse.ok) throw new Error('The quiz files could not be found.');
    const questionData = await questionResponse.json();
    const advancementData = await advancementResponse.json();
    bank = readQuestionBankOverride() || questionData.questions;
    catalogue = advancementData.programmes;
    if (!Array.isArray(bank) || !Array.isArray(catalogue) || !catalogue.length) throw new Error('The quiz data is not in the expected format.');
    const firstAvailable = bank.find((question) => question.programme === selection.programme);
    selection.advancementId = firstAvailable?.advancementId || firstAvailable?.advancementIds?.[0] || '';
    renderSetup();
  } catch (error) {
    const openedAsFile = window.location.protocol === 'file:';
    const localDiagnostic = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? `<pre style="white-space:pre-wrap;text-align:left;font-size:11px;color:#7b4e26;background:#fff8e8;padding:10px;border-radius:8px;overflow-wrap:anywhere">${escapeHtml(error?.stack || String(error))}</pre>` : '';
    app.innerHTML = `<div class="results"><div class="result-icon" aria-hidden="true">!</div><p class="eyebrow">OOPS! THE TRAIL IS BLOCKED</p><h2>We couldn’t load the quiz.</h2><p class="summary">${openedAsFile ? 'Open the project through a local web server (for example, VS Code Live Server). Browsers block the question files when index.html is opened directly.' : 'Check that data/questions.json and data/advancements.json are in the project, then refresh the page.'}</p>${localDiagnostic}<button class="primary" onclick="location.reload()">Try again</button></div>`;
  }
}

function getProgramme() {
  return catalogue.find((programme) => programme.id === selection.programme);
}

function getAdvancement(id = selection.advancementId) {
  for (const category of getProgramme()?.categories || []) {
    const advancement = category.advancements.find((item) => item.id === id);
    if (advancement) return { ...advancement, category };
  }
  return null;
}

function questionsForSelection() {
  return bank.filter((question) => question.programme === selection.programme &&
    (selection.mode === 'random' || question.advancementId === selection.advancementId || question.advancementIds?.includes(selection.advancementId)));
}

function renderSetup() {
  const programme = getProgramme();
  if (!programme) return;
  const availableCount = questionsForSelection().length;
  const selected = getAdvancement();
  const groups = programme.categories.map((category) => `<optgroup label="${escapeHtml(category.name)} • ${escapeHtml(category.color)}">
    ${category.advancements.map((advancement) => `<option value="${advancement.id}" ${advancement.id === selection.advancementId ? 'selected' : ''}>${advancement.number}. ${escapeHtml(advancement.name)}</option>`).join('')}
  </optgroup>`).join('');

  app.innerHTML = `<div class="setup">
    <div class="setup-heading"><p class="eyebrow">YOUR NEXT CUB ADVENTURE</p><h1>Choose a challenge</h1><p>Practise one advancement or mix it up with a random ${programme.name} test.</p></div>
    <div class="step-label"><span>1</span> Choose a Wolf badge</div>
    <div class="choice-row" role="group" aria-label="Choose a Wolf badge">
      ${catalogue.map((option) => `<button class="choice-button ${option.id === programme.id ? 'selected' : ''}" data-programme="${option.id}" aria-pressed="${option.id === programme.id}"><span class="choice-icon">${option.id === 'SW' ? '✦' : '★'}</span><span><strong>${option.name}</strong><small>${option.id} • ${option.categories.reduce((sum, category) => sum + category.advancements.length, 0)} advancements</small></span></button>`).join('')}
    </div>
    <div class="step-label"><span>2</span> Choose your quiz</div>
    <div class="mode-row" role="group" aria-label="Choose quiz type">
      <button class="mode-button ${selection.mode === 'advancement' ? 'selected' : ''}" data-mode="advancement" aria-pressed="${selection.mode === 'advancement'}"><strong>One advancement</strong><small>Focus on one numbered skill or topic.</small></button>
      <button class="mode-button ${selection.mode === 'random' ? 'selected' : ''}" data-mode="random" aria-pressed="${selection.mode === 'random'}"><strong>Random ${programme.id} test</strong><small>Questions from this badge, shuffled each time.</small></button>
    </div>
    ${selection.mode === 'advancement' ? `<div class="advancement-picker"><label for="advancement-select">3 Choose an advancement</label><select id="advancement-select">${groups}</select>
      ${selected ? `<div class="category-hint"><span class="colour-dot" style="--category-colour:${colours[selected.category.color]}"></span><span>${selected.category.name}</span><span class="hint-separator">•</span><span>${selected.category.color}</span></div>` : ''}
    </div>` : ''}
    <div class="setup-bottom"><p class="question-count">${availableCount ? `${availableCount} ${availableCount === 1 ? 'question' : 'questions'} ready` : 'No questions added for this choice yet'}</p><div class="setup-actions"><button class="secondary" id="manage-questions">Manage questions</button><button class="primary" id="start" ${selection.mode === 'advancement' && !selection.advancementId ? 'disabled' : ''}>Start ${selection.mode === 'random' ? `${programme.id} test` : 'quiz'} <span aria-hidden="true">→</span></button></div></div>
  </div>`;

  app.querySelectorAll('[data-programme]').forEach((button) => button.addEventListener('click', () => {
    selection.programme = button.dataset.programme;
    const firstQuestion = bank.find((question) => question.programme === selection.programme);
    selection.advancementId = firstQuestion?.advancementId || firstQuestion?.advancementIds?.[0] || '';
    renderSetup();
  }));
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    selection.mode = button.dataset.mode;
    renderSetup();
  }));
  document.querySelector('#advancement-select')?.addEventListener('change', (event) => {
    selection.advancementId = event.target.value;
    renderSetup();
  });
  document.querySelector('#manage-questions').addEventListener('click', () => renderQuestionManager());
  document.querySelector('#start').addEventListener('click', startQuiz);
}

function startQuiz() {
  const matching = questionsForSelection();
  if (!matching.length) {
    renderEmptySelection();
    return;
  }
  questions = shuffle(matching);
  index = 0;
  score = 0;
  renderQuestion();
}

function renderEmptySelection() {
  const advancement = getAdvancement();
  app.innerHTML = `<div class="results"><div class="result-icon" aria-hidden="true">✎</div><p class="eyebrow">QUESTION BANK IN PROGRESS</p><h2>We haven’t added these questions yet.</h2><p class="summary">${selection.mode === 'random' ? `There are no ${selection.programme} questions in the bank yet.` : `${escapeHtml(selection.programme)} ${advancement.number}: ${escapeHtml(advancement.name)} is ready for questions.`} Ask your Cub leader to add questions for this topic.</p><button class="primary" id="back-to-setup">Choose another challenge</button></div>`;
  document.querySelector('#back-to-setup').addEventListener('click', renderSetup);
}

function renderQuestion() {
  window.removeEventListener('resize', drawMatchLines);
  locked = false;
  matchState = null;
  const question = questions[index];
  const taggedAdvancements = (question.advancementIds || [question.advancementId]).filter(Boolean).map((id) => getAdvancement(id)).filter(Boolean);
  const advancement = taggedAdvancements[0] || getAdvancement(question.advancementId);
  const tagLabel = taggedAdvancements.length > 1 ? `${question.programme} · ${advancement.category.name} · ${taggedAdvancements.map((item) => item.number).join(', ')}` : advancement ? `${question.programme} ${advancement.number} · ${advancement.category.name}` : question.programme;
  const progress = Math.round(((index + 1) / questions.length) * 100);
  app.innerHTML = `<div class="quiz">
    <div class="quiz-top"><span>QUESTION ${index + 1} OF ${questions.length}</span><span class="quiz-tools"><span>✦ ${score} ${score === 1 ? 'star' : 'stars'}</span><button class="text-button quiz-edit-button" id="edit-current-question" type="button">Edit this question</button></span></div>
    <div class="progress-wrap" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${index + 1}"><div class="progress" style="width:${progress}%"></div></div>
    <div class="question"><div class="advancement-tag" style="--category-colour:${colours[advancement?.category.color] || '#71965d'}">${escapeHtml(tagLabel)}</div><h2>${escapeHtml(question.question)}</h2>
      ${question.type === 'image-match' ? renderImageMatch(question) : renderSingleAnswer(question)}
      <div id="feedback-slot"></div>
    </div>
  </div>`;
  if (question.type === 'image-match') wireImageMatch(question);
  if (question.type === 'image-dropdown') {
    const select = document.querySelector('#answer-select');
    select.addEventListener('change', () => { document.querySelector('#submit-answer').disabled = !select.value; });
  }
}

function renderSingleAnswer(question) {
  const options = shuffle(question.options);
  if (question.type === 'image-dropdown') {
    return `${renderQuestionImage(question)}<label class="answer-label" for="answer-select">Choose your answer</label><select class="answer-select" id="answer-select"><option value="">Choose an answer…</option>${options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join('')}</select><div class="next-row"><button class="primary" id="submit-answer" disabled>Check answer <span aria-hidden="true">→</span></button></div>`;
  }
  if (options.length && typeof options[0] === 'object') {
    return `<div class="answers picture-answers">${options.map((option) => `<button class="answer picture-answer" type="button" data-option="${escapeAttribute(option.id)}" aria-label="${escapeAttribute(option.alt)}"><img src="${escapeAttribute(option.image)}" alt="${escapeAttribute(option.alt)}"></button>`).join('')}</div>`;
  }
  return `${renderQuestionImage(question)}<div class="answers">${options.map((option) => `<button class="answer" data-option="${escapeAttribute(option)}">${escapeHtml(option)}</button>`).join('')}</div>`;
}

function renderQuestionImage(question) {
  return question.image ? `<img class="question-image" src="${escapeAttribute(question.image)}" alt="${escapeAttribute(question.imageAlt || '')}">` : '';
}

function renderImageMatch(question) {
  const poolSize = question.leftItems.length;
  const sampleSize = Math.max(1, Math.min(Number(question.sampleSize) || poolSize, poolSize));
  const leftItems = shuffle(question.leftItems).slice(0, sampleSize);
  const selectedRightIds = new Set(leftItems.map((item) => question.answer[item.id]));
  const rightItems = shuffle(question.rightItems.filter((item) => selectedRightIds.has(item.id)));
  matchState = { links: {}, activeLeft: null, draggingLeft: null, pointerId: null, pointer: null, checked: false, suppressClickUntil: 0, leftItems, rightItems };
  const instructions = poolSize > sampleSize
    ? `Match these ${sampleSize} pairs. You’ll get a different selection next time.`
    : 'Tap one item on the left, then tap its match on the right. You can also drag a line between them.';
  return `<div class="match-instructions">${instructions}</div>
    <div class="match-board" id="match-board">
      <svg class="match-lines" id="match-lines" aria-hidden="true"></svg>
      <div class="match-column"><h3>Match these</h3>${leftItems.map((item, i) => renderMatchItem(item, 'left', i)).join('')}</div>
      <div class="match-column"><h3>Find each match</h3>${rightItems.map((item, i) => renderMatchItem(item, 'right', i)).join('')}</div>
    </div>
    <p class="match-status" id="match-status" aria-live="polite">Choose any item to begin.</p>
    <div class="next-row"><button class="primary" id="check-matches" disabled>Check matches <span aria-hidden="true">→</span></button></div>`;
}

function renderMatchItem(item, side, indexInColumn) {
  const fallback = side === 'left' ? `Picture ${indexInColumn + 1}` : `Possible match ${indexInColumn + 1}`;
  const label = item.text || item.alt || fallback;
  const content = item.image
    ? `<img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.alt || fallback)}"><span>${fallback}</span>`
    : `<span class="match-item-text">${escapeHtml(item.text || fallback)}</span>`;
  return `<button class="match-item ${item.text ? 'match-item-choice' : ''}" type="button" data-match-side="${side}" data-item-id="${escapeAttribute(item.id)}" aria-label="${escapeAttribute(label)}">${content}</button>`;
}

function wireImageMatch(question) {
  const board = document.querySelector('#match-board');
  board.addEventListener('click', (event) => {
    if (Date.now() < matchState.suppressClickUntil || matchState.checked) return;
    const item = event.target.closest('.match-item');
    if (item) handleMatchTap(item.dataset.matchSide, item.dataset.itemId);
  });
  board.addEventListener('pointerdown', (event) => {
    const item = event.target.closest('.match-item[data-match-side="left"]');
    if (!item || matchState.checked || event.button !== 0) return;
    matchState.draggingLeft = item.dataset.itemId;
    matchState.activeLeft = item.dataset.itemId;
    matchState.pointerId = event.pointerId;
    matchState.pointer = boardPoint(event, board);
    board.setPointerCapture(event.pointerId);
    renderMatchItems();
    drawMatchLines();
  });
  board.addEventListener('pointermove', (event) => {
    if (matchState.draggingLeft == null || event.pointerId !== matchState.pointerId) return;
    matchState.pointer = boardPoint(event, board);
    drawMatchLines();
  });
  board.addEventListener('pointerup', (event) => {
    if (matchState.draggingLeft == null || event.pointerId !== matchState.pointerId) return;
    const rightButton = document.elementFromPoint(event.clientX, event.clientY)?.closest('.match-item[data-match-side="right"]');
    const leftId = matchState.draggingLeft;
    matchState.draggingLeft = null;
    matchState.pointer = null;
    matchState.pointerId = null;
    matchState.suppressClickUntil = Date.now() + 500;
    if (rightButton) {
      connectMatch(leftId, rightButton.dataset.itemId);
    } else {
      matchState.activeLeft = leftId;
      updateMatchStatus('Item selected. Tap or drag it to a match on the right.');
      renderMatchItems();
      drawMatchLines();
    }
  });
  board.addEventListener('pointercancel', () => {
    if (!matchState.draggingLeft) return;
    matchState.activeLeft = matchState.draggingLeft;
    matchState.draggingLeft = null;
    matchState.pointer = null;
    matchState.pointerId = null;
    renderMatchItems();
    drawMatchLines();
  });
  window.addEventListener('resize', drawMatchLines, { passive: true });
  document.querySelector('#check-matches').addEventListener('click', () => checkImageMatches(question));
  drawMatchLines();
}

function boardPoint(event, board) {
  const rect = board.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function handleMatchTap(side, id) {
  if (side === 'left') {
    if (matchState.activeLeft === id) {
      matchState.activeLeft = null;
      updateMatchStatus('Selection cleared. Choose a picture to begin.');
    } else {
      matchState.activeLeft = id;
      const number = matchState.leftItems.findIndex((item) => item.id === id) + 1;
      updateMatchStatus(`Item ${number} selected. Now tap its match on the right.`);
    }
    renderMatchItems();
    drawMatchLines();
    return;
  }
  if (!matchState.activeLeft) {
    updateMatchStatus('Choose an item in the left column first.');
    return;
  }
  connectMatch(matchState.activeLeft, id);
}

function connectMatch(leftId, rightId) {
  for (const [existingLeft, existingRight] of Object.entries(matchState.links)) {
    if (existingRight === rightId && existingLeft !== leftId) delete matchState.links[existingLeft];
  }
  matchState.links[leftId] = rightId;
  matchState.activeLeft = null;
  const complete = Object.keys(matchState.links).length === matchState.leftItems.length;
  updateMatchStatus(complete ? 'All pairs are connected. Check your matches!' : 'Connected! Choose the next picture on the left.');
  document.querySelector('#check-matches').disabled = !complete;
  renderMatchItems();
  drawMatchLines();
}

function renderMatchItems() {
  document.querySelectorAll('.match-item').forEach((button) => {
    const { matchSide: side, itemId: id } = button.dataset;
    button.classList.toggle('selected', side === 'left' && matchState.activeLeft === id);
    button.classList.toggle('linked', side === 'left' ? id in matchState.links : Object.values(matchState.links).includes(id));
    button.disabled = matchState.checked;
  });
}

function updateMatchStatus(message) {
  const status = document.querySelector('#match-status');
  if (status) status.textContent = message;
}

function drawMatchLines() {
  const board = document.querySelector('#match-board');
  const svg = document.querySelector('#match-lines');
  if (!board || !svg || !matchState) return;
  const rect = board.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute('width', rect.width);
  svg.setAttribute('height', rect.height);
  const namespace = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  const lineFor = (leftId, rightId, className, toPoint = null) => {
    const left = board.querySelector(`.match-item[data-match-side="left"][data-item-id="${CSS.escape(leftId)}"]`);
    const right = toPoint ? null : board.querySelector(`.match-item[data-match-side="right"][data-item-id="${CSS.escape(rightId)}"]`);
    if (!left || (!right && !toPoint)) return;
    const a = left.getBoundingClientRect();
    const b = right?.getBoundingClientRect();
    const line = document.createElementNS(namespace, 'line');
    line.setAttribute('x1', `${a.right - rect.left}`);
    line.setAttribute('y1', `${a.top + a.height / 2 - rect.top}`);
    line.setAttribute('x2', `${toPoint ? toPoint.x : b.left - rect.left}`);
    line.setAttribute('y2', `${toPoint ? toPoint.y : b.top + b.height / 2 - rect.top}`);
    line.setAttribute('class', `match-line ${className}`);
    svg.append(line);
  };
  for (const [leftId, rightId] of Object.entries(matchState.links)) {
    const isCorrect = matchState.checked && questions[index].answer[leftId] === rightId;
    lineFor(leftId, rightId, matchState.checked ? (isCorrect ? 'correct' : 'incorrect') : 'connected');
    if (matchState.checked && !isCorrect) lineFor(leftId, questions[index].answer[leftId], 'answer-key');
  }
  if (matchState.draggingLeft && matchState.pointer) lineFor(matchState.draggingLeft, '', 'preview', matchState.pointer);
}

function checkImageMatches(question) {
  const correctCount = matchState.leftItems.filter((item) => matchState.links[item.id] === question.answer[item.id]).length;
  matchState.checked = true;
  locked = true;
  const correct = correctCount === matchState.leftItems.length;
  if (correct) score++;
  renderMatchItems();
  drawMatchLines();
  const detail = correct ? 'Every picture is in the right pair.' : `${correctCount} of ${matchState.leftItems.length} pairs are correct. Green lines show the right matches.`;
  showFeedback(correct, question, detail);
}

function chooseAnswer(button, choice, question) {
  if (locked) return;
  locked = true;
  const correct = choice === question.answer;
  if (correct) score++;
  app.querySelectorAll('.answer').forEach((answer) => {
    answer.disabled = true;
    if (answer.dataset.option === question.answer) answer.classList.add('correct');
  });
  if (!correct) button.classList.add('incorrect');
  showFeedback(correct, question);
}

function submitDropdown(question) {
  if (locked) return;
  const select = document.querySelector('#answer-select');
  if (!select?.value) return;
  locked = true;
  const correct = select.value === question.answer;
  if (correct) score++;
  select.disabled = true;
  document.querySelector('#submit-answer').disabled = true;
  select.classList.add(correct ? 'correct' : 'incorrect');
  if (!correct) select.insertAdjacentHTML('afterend', `<p class="correct-answer">Correct answer: ${escapeHtml(question.answer)}</p>`);
  showFeedback(correct, question);
}

function showFeedback(correct, question, detail = '') {
  const slot = document.querySelector('#feedback-slot');
  const heading = correct ? 'Brilliant! That’s right.' : 'Good try! The answer is shown in green.';
  slot.innerHTML = `<div class="feedback ${correct ? 'good' : 'try'}" role="status"><strong>${heading}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ''}</div><div class="next-row"><button class="primary" id="next">${index + 1 === questions.length ? 'See my score' : 'Next question'} <span aria-hidden="true">→</span></button></div>`;
  document.querySelector('#next').addEventListener('click', advanceQuestion);
}

function advanceQuestion() {
  index++;
  if (index < questions.length) renderQuestion(); else renderResults();
}

function renderResults() {
  const percent = score / questions.length;
  const programme = getProgramme();
  const advancement = selection.mode === 'advancement' ? getAdvancement() : null;
  const context = advancement ? `${programme.name} ${advancement.number}: ${advancement.name}` : `Random ${programme.name} test`;
  let message = 'Every adventure teaches you something. Have another go and see what you discover!';
  let badge = '✦';
  if (percent === 1) { message = 'A perfect round! You’re ready to share your Cub knowledge.'; badge = '★'; }
  else if (percent >= .7) message = 'Great work! You know your stuff. Keep that curiosity going.';
  app.innerHTML = `<div class="results"><div class="result-icon" aria-hidden="true">${badge}</div><p class="eyebrow">ADVENTURE COMPLETE</p><h2>${percent >= .7 ? 'Well done, Cub!' : 'Nice exploring!'}</h2><p class="score">${score} out of ${questions.length} stars</p><p class="summary">${escapeHtml(context)}<br>${message}</p><div class="result-actions"><button class="primary" id="restart">Play again <span aria-hidden="true">↻</span></button><button class="secondary" id="change-test">Choose another test</button></div></div>`;
  document.querySelector('#restart').addEventListener('click', startQuiz);
  document.querySelector('#change-test').addEventListener('click', renderSetup);
}

app.addEventListener('click', (event) => {
  if (event.target.closest('#edit-current-question')) { renderQuestionEditor(questions[index], 'quiz'); return; }
  if (event.target.closest('.answer')) {
    const button = event.target.closest('.answer');
    const question = questions[index];
    const options = question.options;
    const label = button.dataset.option;
    chooseAnswer(button, label, question);
  }
  if (event.target.closest('#submit-answer')) submitDropdown(questions[index]);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function escapeAttribute(value) { return escapeHtml(value); }

loadData();

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
      .catch((error) => console.warn('Offline support could not be enabled.', error));
  });
}
