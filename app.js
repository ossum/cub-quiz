const app = document.querySelector('#app');
const colours = { green: '#5b914f', blue: '#4b83bd', yellow: '#d4a92f', red: '#cf6253' };
let bank = [];
let catalogue = [];
let questions = [];
let index = 0;
let score = 0;
let locked = false;
let selection = { programme: 'SW', mode: 'advancement', advancementId: '', randomQuestionCount: 15, challengeLives: 3 };
let challengeState = null;
let matchState = null;
let pairOptionState = null;
let memoryState = null;
let orderingState = null;
let orderingPointer = null;
let memoryTimer = null;
let servedDataVersions = { questions: 'unknown', advancements: 'unknown' };

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
      fetch('./data/questions.json', { cache: 'no-store' }),
      fetch('./data/advancements.json', { cache: 'no-store' })
    ]);
    if (!questionResponse.ok || !advancementResponse.ok) throw new Error('The quiz files could not be found.');
    const questionData = await questionResponse.json();
    const advancementData = await advancementResponse.json();
    const questionOverride = readQuestionBankOverride();
    questionOverrideVersion = questionOverride?.version || '';
    const projectQuestions = questionData.questions.map(migrateLegacyImageMatch).map(normalizePairQuestion);
    if (questionOverride) {
      const overrideQuestions = questionOverride.questions.map(migrateLegacyImageMatch).map(normalizePairQuestion);
      const overrideIds = new Set(overrideQuestions.map((question) => question.id));
      bank = [...overrideQuestions, ...projectQuestions.filter((question) => !overrideIds.has(question.id))];
    } else bank = projectQuestions;
    servedDataVersions = {
      questions: questionOverride ? `local edits${questionOverride.version ? ` ${questionOverride.version}` : ''} + project ${questionData.version || 'unversioned'}` : questionData.version || 'unversioned',
      advancements: advancementData.version || 'unversioned'
    };
    renderDataVersion();
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

function renderDataVersion() {
  const label = document.querySelector('#data-version');
  if (!label) return;
  const sameVersion = servedDataVersions.questions === servedDataVersions.advancements;
  label.textContent = sameVersion ? `Data v${servedDataVersions.questions}` : `Questions ${servedDataVersions.questions} · Advancements ${servedDataVersions.advancements}`;
  label.title = `Question data: ${servedDataVersions.questions}; advancement data: ${servedDataVersions.advancements}`;
}

function getProgramme(id = selection.programme) {
  if (id === 'BOTH') return { id: 'BOTH', name: 'All programmes' };
  return catalogue.find((programme) => programme.id === id);
}

function getAdvancement(id = selection.advancementId, programmeId = selection.programme) {
  const programmes = programmeId === 'BOTH' ? catalogue : catalogue.filter((programme) => programme.id === programmeId);
  for (const programme of programmes) for (const category of programme.categories) {
    const advancement = category.advancements.find((item) => item.id === id);
    if (advancement) return { ...advancement, category };
  }
  return null;
}

function questionsForSelection() {
  return bank.filter((question) => (selection.programme === 'BOTH' || question.programme === selection.programme) &&
    (['random', 'challenge'].includes(selection.mode) || question.advancementId === selection.advancementId || question.advancementIds?.includes(selection.advancementId)));
}

function renderSetup() {
  const programme = getProgramme();
  if (!programme) return;
  const availableCount = questionsForSelection().length;
  const selected = getAdvancement();
  const groups = (programme.categories || []).map((category) => `<optgroup label="${escapeHtml(category.name)}${category.color ? ` • ${escapeHtml(category.color)}` : ''}">
    ${category.advancements.map((advancement) => `<option value="${advancement.id}" ${advancement.id === selection.advancementId ? 'selected' : ''}>${advancement.number}. ${escapeHtml(advancement.name)}</option>`).join('')}
  </optgroup>`).join('');

  app.innerHTML = `<div class="setup">
    <div class="setup-heading"><p class="eyebrow">YOUR NEXT CUB ADVENTURE</p><h1>Choose a challenge</h1><p>${selection.programme === 'BOTH' ? 'Mix Membership, Silver Wolf and Gold Wolf questions in one random test or Challenge mode.' : `Practise one advancement, take a random ${programme.name} test, or try Challenge mode.`}</p></div>
    <div class="step-label"><span>1</span> Choose a programme</div>
    <div class="choice-row" role="group" aria-label="Choose a programme">
      ${catalogue.map((option) => { const badge = { MEM: 'wosm.png', SW: 'silverwolf.png', GW: 'goldwolf.png' }[option.id]; return `<button class="choice-button ${option.id === programme.id ? 'selected' : ''}" data-programme="${option.id}" aria-pressed="${option.id === programme.id}"><span class="choice-icon badge-icon"><img src="images/badges/${badge}" alt="${escapeAttribute(option.name)} badge"></span><span><strong>${option.name}</strong><small>${option.id} • ${option.categories.reduce((sum, category) => sum + category.advancements.length, 0)} advancements</small></span></button>`; }).join('')}
      <button class="choice-button choice-button-both ${selection.programme === 'BOTH' ? 'selected' : ''}" data-programme="BOTH" aria-pressed="${selection.programme === 'BOTH'}"><span class="combined-badges" aria-hidden="true"><img src="images/badges/wosm.png" alt=""><img src="images/badges/silverwolf.png" alt=""><img src="images/badges/goldwolf.png" alt=""></span><span><strong>All programmes</strong><small>Membership, SW &amp; GW questions</small></span></button>
    </div>
    <div class="step-label"><span>2</span> Choose your quiz</div>
    <div class="mode-row" role="group" aria-label="Choose quiz type">
      ${selection.programme === 'BOTH' ? '' : `<button class="mode-button ${selection.mode === 'advancement' ? 'selected' : ''}" data-mode="advancement" aria-pressed="${selection.mode === 'advancement'}"><strong>One advancement</strong><small>Focus on one numbered skill or topic.</small></button>`}
      <button class="mode-button ${selection.mode === 'random' ? 'selected' : ''}" data-mode="random" aria-pressed="${selection.mode === 'random'}"><strong>Random ${selection.programme === 'BOTH' ? 'all programmes' : programme.id} test</strong><small>Choose up to 15 shuffled questions${selection.programme === 'BOTH' ? ' from Membership, SW and GW' : ''}.</small></button>
      <button class="mode-button ${selection.mode === 'challenge' ? 'selected' : ''}" data-mode="challenge" aria-pressed="${selection.mode === 'challenge'}"><strong>Challenge mode</strong><small>Keep going${selection.programme === 'BOTH' ? ' through Membership, SW and GW' : ''}; a wrong answer costs a life.</small></button>
    </div>
    ${selection.mode === 'random' ? `<div class="random-count-picker"><label for="random-question-count">Questions in this test</label><div><input id="random-question-count" type="number" min="1" max="${Math.max(1, availableCount)}" value="${Math.min(selection.randomQuestionCount || 15, availableCount || 15)}" ${availableCount ? '' : 'disabled'}><span>of ${availableCount} available</span></div><small>We’ll choose a fresh random set each time.</small></div>` : ''}
    ${selection.mode === 'challenge' ? `<div class="random-count-picker challenge-lives-picker"><label for="challenge-lives">Starting lives</label><div><input id="challenge-lives" type="number" min="1" max="10" value="${selection.challengeLives || 3}"><span>Choose 1–10 lives</span></div><small>Correct answers add to your score. The challenge ends when no lives remain.</small></div>` : ''}
    ${selection.mode === 'advancement' ? `<div class="advancement-picker"><label for="advancement-select">3 Choose an advancement</label><select id="advancement-select">${groups}</select>
      ${selected ? `<div class="category-hint">${selected.category.color ? `<span class="colour-dot" style="--category-colour:${colours[selected.category.color]}"></span><span>${selected.category.name}</span><span class="hint-separator">•</span><span>${selected.category.color}</span>` : `<span>${escapeHtml(selected.category.name)}</span>`}</div>` : ''}
    </div>` : ''}
    <div class="setup-bottom"><p class="question-count">${availableCount ? `${availableCount} ${availableCount === 1 ? 'question' : 'questions'} ready` : 'No questions added for this choice yet'}</p><div class="setup-actions"><button class="secondary" id="manage-questions">Manage questions</button><button class="primary" id="start" ${!availableCount || (selection.mode === 'advancement' && !selection.advancementId) ? 'disabled' : ''}>Start ${selection.mode === 'challenge' ? 'challenge' : selection.mode === 'random' ? `${selection.programme === 'BOTH' ? 'all programmes' : programme.id} test` : 'quiz'} <span aria-hidden="true">→</span></button></div></div>
  </div>`;

  app.querySelectorAll('[data-programme]').forEach((button) => button.addEventListener('click', () => {
    selection.programme = button.dataset.programme;
    if (selection.programme === 'BOTH') {
      selection.advancementId = '';
      if (selection.mode === 'advancement') selection.mode = 'random';
    } else {
      const firstQuestion = bank.find((question) => question.programme === selection.programme);
      const firstAdvancement = catalogue.find((item) => item.id === selection.programme)?.categories.flatMap((category) => category.advancements)[0];
      selection.advancementId = firstQuestion?.advancementId || firstQuestion?.advancementIds?.[0] || firstAdvancement?.id || '';
    }
    renderSetup();
  }));
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    selection.mode = button.dataset.mode;
    renderSetup();
  }));
  document.querySelector('#challenge-lives')?.addEventListener('change', (event) => {
    selection.challengeLives = Math.max(1, Math.min(10, Number(event.target.value) || 3));
    event.target.value = selection.challengeLives;
  });
  document.querySelector('#random-question-count')?.addEventListener('change', (event) => {
    const requested = Number(event.target.value);
    selection.randomQuestionCount = Math.max(1, Math.min(availableCount, Number.isFinite(requested) ? requested : 15));
    event.target.value = selection.randomQuestionCount;
  });
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
  challengeState = selection.mode === 'challenge' ? { lives: Math.max(1, Math.min(10, Number(document.querySelector('#challenge-lives')?.value || selection.challengeLives) || 3)), totalLives: Math.max(1, Math.min(10, Number(document.querySelector('#challenge-lives')?.value || selection.challengeLives) || 3)), questionsAnswered: 0 } : null;
  if (challengeState) selection.challengeLives = challengeState.totalLives;
  if (selection.mode === 'random') {
    const countField = document.querySelector('#random-question-count');
    const requested = Number(countField?.value || selection.randomQuestionCount) || 15;
    selection.randomQuestionCount = requested;
    questions = questions.slice(0, Math.max(1, Math.min(requested, questions.length)));
  }
  index = 0;
  score = 0;
  renderQuestion();
}

function renderEmptySelection() {
  const advancement = getAdvancement();
  app.innerHTML = `<div class="results"><div class="result-icon" aria-hidden="true">✎</div><p class="eyebrow">QUESTION BANK IN PROGRESS</p><h2>We haven’t added these questions yet.</h2><p class="summary">${selection.mode !== 'advancement' ? `There are no ${selection.programme === 'BOTH' ? 'Membership, SW and GW' : getProgramme().name} questions in the bank yet.` : `${escapeHtml(getProgramme().name)} ${advancement.number}: ${escapeHtml(advancement.name)} is ready for questions.`} Ask your Cub leader to add questions for this topic.</p><button class="primary" id="back-to-setup">Choose another challenge</button></div>`;
  document.querySelector('#back-to-setup').addEventListener('click', renderSetup);
}

function renderQuestion() {
  window.removeEventListener('resize', drawMatchLines);
  clearInterval(memoryTimer);
  locked = false;
  matchState = null;
  pairOptionState = null;
  memoryState = null;
  orderingState = null;
  orderingPointer = null;
  const question = questions[index];
  const pairPresentation = question.type === 'image-pairs' ? choosePairPresentation(question) : null;
  const questionText = pairPresentation && pairPresentation !== 'match' ? 'Choose the item that matches.' : question.question;
  const taggedAdvancements = (question.advancementIds || [question.advancementId]).filter(Boolean).map((id) => getAdvancement(id)).filter(Boolean);
  const advancement = taggedAdvancements[0] || getAdvancement(question.advancementId, question.programme);
  const tagLabel = taggedAdvancements.length > 1 ? `${question.programme} · ${advancement.category.name} · ${taggedAdvancements.map((item) => item.number).join(', ')}` : advancement ? `${question.programme} ${advancement.number} · ${advancement.category.name}` : question.programme;
  const progress = challengeState ? 0 : Math.round(((index + 1) / questions.length) * 100);
  const questionHeading = challengeState ? `CHALLENGE · QUESTION ${challengeState.questionsAnswered + 1}` : `QUESTION ${index + 1} OF ${questions.length}`;
  const scoreAndLives = challengeState ? `<span>♥ ${challengeState.lives} ${challengeState.lives === 1 ? 'life' : 'lives'}</span><span>✦ ${score} correct</span>` : `<span>✦ ${score} ${score === 1 ? 'star' : 'stars'}</span>`;
  app.innerHTML = `<div class="quiz">
    <div class="quiz-top"><span>${questionHeading}</span><span class="quiz-tools">${scoreAndLives}${challengeState ? '' : '<button class="text-button quiz-edit-button" id="edit-current-question" type="button">Edit this question</button>'}</span></div>
    ${challengeState ? '' : `<div class="progress-wrap" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${index + 1}"><div class="progress" style="width:${progress}%"></div></div>`}
    <div class="question"><div class="advancement-tag" style="--category-colour:${colours[advancement?.category.color] || '#71965d'}">${escapeHtml(tagLabel)}</div><h2>${escapeHtml(questionText)}</h2>
      ${question.type === 'ordering' ? renderOrderingQuestion(question) : question.type === 'image-pairs' ? renderImagePairs(question, pairPresentation) : question.type === 'image-match' ? `${renderQuestionImage(question)}${renderImageMatch(question)}` : question.type === 'memory-grid' ? renderMemoryGrid(question) : renderSingleAnswer(question)}
      <div id="feedback-slot"></div>
    </div>
  </div>`;
  if (question.type === 'image-match' || (question.type === 'image-pairs' && pairPresentation === 'match')) wireImageMatch(question);
  if (question.type === 'memory-grid') startMemoryPreviewTimer(question);
  if (question.type === 'image-dropdown') {
    const select = document.querySelector('#answer-select');
    select.addEventListener('change', () => { document.querySelector('#submit-answer').disabled = !select.value; });
  }
}


function renderOrderingQuestion(question) {
  orderingState = shuffle(question.steps || []).map((step) => step.id);
  return `<p class="order-instructions">Drag the pictures into the right order. You can also use the arrow buttons.</p><ol class="order-list" id="order-list" aria-label="Steps in your chosen order">${renderOrderingCards(question)}</ol><div class="next-row"><button class="primary" id="check-order">Check order <span aria-hidden="true">→</span></button></div>`;
}
function renderOrderingCards(question) {
  const byId = new Map(question.steps.map((step) => [step.id, step]));
  return orderingState.map((id, index) => {
    const step = byId.get(id);
    return `<li class="order-card" data-order-id="${escapeAttribute(step.id)}" aria-label="${escapeAttribute(step.text)}. Position ${index + 1}"><span class="order-grip" aria-hidden="true">⠿</span><img src="${escapeAttribute(step.image)}" alt="${escapeAttribute(step.alt || step.text)}"><span class="order-card-text">${escapeHtml(step.text)}</span><span class="order-controls"><button type="button" class="order-move" data-order-move="-1" aria-label="Move ${escapeAttribute(step.text)} earlier" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="order-move" data-order-move="1" aria-label="Move ${escapeAttribute(step.text)} later" ${index === question.steps.length - 1 ? 'disabled' : ''}>↓</button></span></li>`;
  }).join('');
}
function refreshOrderingCards(question) {
  const list = document.querySelector('#order-list');
  if (list) list.innerHTML = renderOrderingCards(question);
}
function checkOrderingAnswer(question) {
  if (locked) return;
  locked = true;
  const correctOrder = question.steps.map((step) => step.id);
  const correct = orderingState.length === correctOrder.length && orderingState.every((id, index) => id === correctOrder[index]);
  if (correct) score++;
  document.querySelectorAll('#order-list .order-card').forEach((card) => card.classList.add(correct ? 'order-correct' : 'order-review'));
  const detail = correct ? 'You put every step in the right order.' : `The correct order is: ${question.steps.map((step) => step.text).join(' → ')}.`;
  showFeedback(correct, question, detail);
}

function renderSingleAnswer(question) {
  const options = shuffle(question.options);
  if (question.type === 'image-dropdown') {
    return `${renderQuestionImage(question)}<label class="answer-label" for="answer-select">Choose your answer</label><select class="answer-select" id="answer-select"><option value="">Choose an answer…</option>${options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join('')}</select><div class="next-row"><button class="primary" id="submit-answer" disabled>Check answer <span aria-hidden="true">→</span></button></div>`;
  }
  if (options.length && typeof options[0] === 'object') {
    return `${renderQuestionImage(question)}<div class="answers picture-answers">${options.map((option) => `<button class="answer picture-answer" type="button" data-option="${escapeAttribute(option.id)}" aria-label="${escapeAttribute(option.alt)}"><img src="${escapeAttribute(option.image)}" alt="${escapeAttribute(option.alt)}"></button>`).join('')}</div>`;
  }
  return `${renderQuestionImage(question)}<div class="answers">${options.map((option) => `<button class="answer" data-option="${escapeAttribute(option)}">${escapeHtml(option)}</button>`).join('')}</div>`;
}

function renderQuestionImage(question) {
  return question.image ? `<img class="question-image" src="${escapeAttribute(question.image)}" alt="${escapeAttribute(question.imageAlt || '')}">` : '';
}

function choosePairPresentation(question) {
  const presentations = question.allowReversal === false ? ['match', 'forward'] : ['match', 'forward', 'reverse'];
  return presentations[Math.floor(Math.random() * presentations.length)];
}
function renderImagePairs(question, presentation) {
  if (presentation === 'match') {
    pairOptionState = { presentation };
    return `${renderQuestionImage(question)}${renderImageMatch(question)}`;
  }
  return `${renderQuestionImage(question)}${renderPairOption(question, presentation === 'reverse')}`;
}
function renderPairSide(side) {
  if (side.type === 'image') return `<img src="${escapeAttribute(side.src)}" alt="${escapeAttribute(side.alt || '')}">`;
  return `<span>${escapeHtml(side.value || '')}</span>`;
}
function pairAnswerKey(side) {
  return side.type === 'image' ? `image:${side.src}` : `text:${String(side.value || '').trim().toLowerCase()}`;
}
function renderPairOption(question, reverse = false) {
  const promptName = reverse ? 'right' : 'left';
  const answerName = reverse ? 'left' : 'right';
  const pair = shuffle(question.pairs)[0];
  const promptSide = pair[promptName];
  const correctAnswer = pair[answerName];
  const optionCount = Math.max(2, Math.min(Number(question.optionCount) || 4, question.pairs.length));
  const correctKey = pairAnswerKey(correctAnswer);
  const uniqueDistractors = new Map();
  for (const candidate of shuffle(question.pairs.filter((item) => item.id !== pair.id))) {
    const answer = candidate[answerName];
    const key = pairAnswerKey(answer);
    if (key !== correctKey && !uniqueDistractors.has(key)) uniqueDistractors.set(key, candidate);
  }
  const choices = shuffle([pair, ...[...uniqueDistractors.values()].slice(0, optionCount - 1)]);
  pairOptionState = { presentation: reverse ? 'reverse' : 'forward', answerId: pair.id };
  const allPictures = choices.every((choice) => choice[answerName].type === 'image');
  return `<div class="pair-option-prompt">${renderPairSide(promptSide)}</div><div class="answers ${allPictures ? 'picture-answers' : 'pair-option-answers'}">${choices.map((choice) => { const answer = choice[answerName]; return `<button class="answer ${answer.type === 'image' ? 'picture-answer' : 'pair-option-text'}" type="button" data-option="${escapeAttribute(choice.id)}" aria-label="${escapeAttribute(answer.alt || answer.value || 'Answer option')}">${answer.type === 'image' ? `<img src="${escapeAttribute(answer.src)}" alt="${escapeAttribute(answer.alt || '')}">` : escapeHtml(answer.value || '')}</button>`; }).join('')}</div>`;
}
function renderImageMatch(question) {
  const poolSize = question.pairs.length;
  const sampleSize = Math.max(1, Math.min(Number(question.sampleSize) || poolSize, poolSize));
  const selectedPairs = shuffle(question.pairs).slice(0, sampleSize);
  const toMatchItem = (side, id) => side.type === 'image'
    ? { id, image: side.src, alt: side.alt || '' }
    : { id, text: side.value };
  const leftItems = selectedPairs.map((pair) => toMatchItem(pair.left, pair.id));
  const rightItems = shuffle(selectedPairs.map((pair) => toMatchItem(pair.right, pair.id)));
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

function renderMemoryGrid(question) {
  const rows = Number(question.rows) || 4;
  const columns = Number(question.columns) || 4;
  const previewSeconds = Math.max(1, Number(question.previewSeconds) || 20);
  const originalCells = question.cells || [];
  const cells = question.shuffleCells === false ? [...originalCells] : shuffle(originalCells);
  const recallCount = Math.max(1, Math.min(originalCells.length, Number(question.recallCount) || question.sequence?.length || 3));
  const randomizePrompts = question.randomizePrompts ?? !question.sequence?.length;
  const targets = randomizePrompts === false
    ? (question.sequence || []).map((cellNumber) => originalCells[cellNumber - 1]).filter(Boolean)
    : shuffle(originalCells).slice(0, recallCount);
  const orderedTargets = randomizePrompts === false ? targets : shuffle(targets);
  const targetIds = orderedTargets.map((cell) => cell.id);
  const sequence = targetIds.map((id) => cells.findIndex((cell) => cell.id === id) + 1);
  memoryState = { stage: 'preview', secondsLeft: previewSeconds, previewSeconds, rows, columns, cells, sequence, promptIndex: 0, answers: [] };
  return `<section class="memory-stage" id="memory-stage">${renderMemoryGridStage(question)}</section>`;
}
function renderMemoryGridStage(question) {
  const cells = memoryState.cells;
  const gridStyle = `grid-template-columns:repeat(${memoryState.columns},minmax(0,1fr))`;
  if (memoryState.stage === 'preview') {
    return `<p class="memory-instruction">Study the pictures. They will be hidden in <strong class="memory-countdown" aria-live="polite">${memoryState.secondsLeft}</strong> seconds.</p><div class="memory-grid memory-grid-preview" style="${gridStyle}">${cells.map((cell, i) => `<div class="memory-cell"><img src="${escapeAttribute(cell.image)}" alt="${escapeAttribute(cell.alt || `Picture ${i + 1}`)}"></div>`).join('')}</div><div class="next-row"><button type="button" class="primary" id="hide-memory-grid">Hide pictures and start <span aria-hidden="true">→</span></button></div>`;
  }
  if (memoryState.stage === 'recall') {
    const cellNumber = memoryState.sequence[memoryState.promptIndex];
    const prompt = cells[cellNumber - 1];
    return `<p class="memory-instruction">Find where this picture was. <strong>Picture ${memoryState.promptIndex + 1} of ${memoryState.sequence.length}</strong></p><div class="memory-prompt"><img src="${escapeAttribute(prompt.image)}" alt="${escapeAttribute(prompt.alt || `Picture ${cellNumber}`)}"></div><div class="memory-grid memory-grid-recall" style="${gridStyle}">${cells.map((_, i) => `<button type="button" class="memory-cell memory-cell-blank" data-memory-cell="${i + 1}" aria-label="Square ${i + 1}"><span>${i + 1}</span></button>`).join('')}</div>`;
  }
  const targetCells = new Set(memoryState.sequence);
  const pickedCells = new Map(memoryState.answers.map((cellNumber, i) => [cellNumber, i + 1]));
  const correctCount = memoryState.sequence.filter((cellNumber, i) => memoryState.answers[i] === cellNumber).length;
  return `<p class="memory-instruction">Here are the pictures and your choices.</p><div class="memory-grid memory-grid-review" style="${gridStyle}">${cells.map((cell, i) => {
    const number = i + 1;
    const isTarget = targetCells.has(number);
    const isCorrect = isTarget && memoryState.answers[memoryState.sequence.indexOf(number)] === number;
    const pickedFor = pickedCells.get(number);
    const stateClass = isCorrect ? ' memory-cell-correct' : pickedFor ? ' memory-cell-incorrect' : '';
    const marker = isCorrect ? '<span class="memory-result-marker">✓</span>' : pickedFor ? `<span class="memory-result-marker">Pick ${pickedFor}</span>` : '';
    return `<div class="memory-cell${stateClass}"><img src="${escapeAttribute(cell.image)}" alt="${escapeAttribute(cell.alt || `Picture ${number}`)}">${marker}</div>`;
  }).join('')}</div><div class="memory-sequence-review">${memoryState.sequence.map((cellNumber, i) => `<span class="${memoryState.answers[i] === cellNumber ? 'memory-sequence-correct' : 'memory-sequence-incorrect'}">Picture ${i + 1}: ${memoryState.answers[i] === cellNumber ? 'right square' : `you picked square ${memoryState.answers[i]}`}</span>`).join('')}</div>`;
}
function startMemoryPreviewTimer(question) {
  clearInterval(memoryTimer);
  memoryTimer = setInterval(() => {
    if (!memoryState || memoryState.stage !== 'preview') { clearInterval(memoryTimer); return; }
    memoryState.secondsLeft--;
    const countdown = document.querySelector('.memory-countdown');
    if (countdown) countdown.textContent = String(memoryState.secondsLeft);
    if (memoryState.secondsLeft <= 0) enterMemoryRecall(question);
  }, 1000);
}
function enterMemoryRecall(question) {
  clearInterval(memoryTimer);
  memoryState.stage = 'recall';
  document.querySelector('#memory-stage').innerHTML = renderMemoryGridStage(question);
}
function chooseMemoryCell(question, cellNumber) {
  if (memoryState?.stage !== 'recall' || locked) return;
  memoryState.answers.push(cellNumber);
  memoryState.promptIndex++;
  if (memoryState.promptIndex < memoryState.sequence.length) {
    document.querySelector('#memory-stage').innerHTML = renderMemoryGridStage(question);
    return;
  }
  memoryState.stage = 'review';
  locked = true;
  const correctCount = memoryState.sequence.filter((number, i) => memoryState.answers[i] === number).length;
  const correct = correctCount === memoryState.sequence.length;
  if (correct) score++;
  document.querySelector('#memory-stage').innerHTML = renderMemoryGridStage(question);
  showFeedback(correct, question, `You found ${correctCount} of ${memoryState.sequence.length} pictures in the right squares. Green marks show correct squares; red marks show different choices.`);
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
    const isCorrect = matchState.checked && leftId === rightId;
    lineFor(leftId, rightId, matchState.checked ? (isCorrect ? 'correct' : 'incorrect') : 'connected');
    if (matchState.checked && !isCorrect) lineFor(leftId, leftId, 'answer-key');
  }
  if (matchState.draggingLeft && matchState.pointer) lineFor(matchState.draggingLeft, '', 'preview', matchState.pointer);
}

function checkImageMatches(question) {
  const correctCount = matchState.leftItems.filter((item) => matchState.links[item.id] === item.id).length;
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
  if (challengeState) {
    challengeState.questionsAnswered++;
    if (!correct) challengeState.lives = Math.max(0, challengeState.lives - 1);
  }
  const heading = challengeState && challengeState.lives === 0 ? 'No lives left — challenge complete!' : correct ? 'Brilliant! That’s right.' : 'Good try! The answer is shown in green.';
  slot.innerHTML = `<div class="feedback ${correct ? 'good' : 'try'}" role="status"><strong>${heading}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ''}</div><div class="next-row"><button class="primary" id="next">${challengeState ? (challengeState.lives === 0 ? 'See challenge score' : 'Next question') : index + 1 === questions.length ? 'See my score' : 'Next question'} <span aria-hidden="true">→</span></button></div>`;
  document.querySelector('#next').addEventListener('click', advanceQuestion);
}

function advanceQuestion() {
  if (challengeState?.lives === 0) { renderChallengeResults(); return; }
  if (challengeState) {
    index++;
    if (index >= questions.length) { questions = shuffle(questionsForSelection()); index = 0; }
    renderQuestion();
    return;
  }
  index++;
  if (index < questions.length) renderQuestion(); else renderResults();
}

function renderChallengeResults() {
  const programme = getProgramme();
  app.innerHTML = `<div class="results challenge-results"><div class="result-icon" aria-hidden="true">♥</div><p class="eyebrow">CHALLENGE COMPLETE</p><h2>Keep up the great work!</h2><p class="score">${score} successful ${score === 1 ? 'answer' : 'answers'}</p><p class="challenge-lives-summary">Lives remaining: ${challengeState.lives} of ${challengeState.totalLives}</p><p class="summary">${escapeHtml(programme.name)} Challenge Mode<br>You answered ${challengeState.questionsAnswered} ${challengeState.questionsAnswered === 1 ? 'question' : 'questions'}.</p><div class="result-actions"><button class="primary" id="restart">Play again <span aria-hidden="true">↻</span></button><button class="secondary" id="change-test">Choose another test</button></div></div>`;
  document.querySelector('#restart').addEventListener('click', startQuiz);
  document.querySelector('#change-test').addEventListener('click', renderSetup);
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
  const moveButton = event.target.closest('[data-order-move]');
  if (moveButton && orderingState && !locked) {
    const card = moveButton.closest('.order-card');
    const from = orderingState.indexOf(card.dataset.orderId);
    const to = from + Number(moveButton.dataset.orderMove);
    if (to >= 0 && to < orderingState.length) { [orderingState[from], orderingState[to]] = [orderingState[to], orderingState[from]]; refreshOrderingCards(questions[index]); }
    return;
  }
  if (event.target.closest('#check-order')) { checkOrderingAnswer(questions[index]); return; }
  if (event.target.closest('#hide-memory-grid')) { enterMemoryRecall(questions[index]); return; }
  const memoryCell = event.target.closest('[data-memory-cell]');
  if (memoryCell) { chooseMemoryCell(questions[index], Number(memoryCell.dataset.memoryCell)); return; }
  if (event.target.closest('#edit-current-question')) { renderQuestionEditor(questions[index], 'quiz'); return; }
  if (event.target.closest('.answer')) {
    const button = event.target.closest('.answer');
    const question = questions[index];
    const options = question.options;
    const label = button.dataset.option;
    const answerQuestion = question.type === 'image-pairs' && pairOptionState && pairOptionState.presentation !== 'match' ? { ...question, answer: pairOptionState.answerId } : question;
    chooseAnswer(button, label, answerQuestion);
  }
  if (event.target.closest('#submit-answer')) submitDropdown(questions[index]);
});


app.addEventListener('pointerdown', (event) => {
  const grip = event.target.closest('.order-grip');
  const card = grip?.closest('.order-card');
  if (!card || locked || !orderingState) return;
  orderingPointer = { id: card.dataset.orderId, pointerId: event.pointerId };
  app.setPointerCapture(event.pointerId);
  card.classList.add('order-dragging');
  event.preventDefault();
});
app.addEventListener('pointerup', (event) => {
  if (!orderingPointer || event.pointerId !== orderingPointer.pointerId) return;
  const draggedId = orderingPointer.id;
  document.querySelector(`[data-order-id="${CSS.escape(draggedId)}"]`)?.classList.remove('order-dragging');
  orderingPointer = null;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.order-card');
  if (!target || target.dataset.orderId === draggedId || locked) return;
  const from = orderingState.indexOf(draggedId);
  const to = orderingState.indexOf(target.dataset.orderId);
  if (from < 0 || to < 0) return;
  [orderingState[from], orderingState[to]] = [orderingState[to], orderingState[from]];
  refreshOrderingCards(questions[index]);
});
app.addEventListener('pointercancel', () => { if (orderingPointer) { document.querySelector(`[data-order-id="${CSS.escape(orderingPointer.id)}"]`)?.classList.remove('order-dragging'); orderingPointer = null; } });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function escapeAttribute(value) { return escapeHtml(value); }

loadData();

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch((error) => console.warn('Offline support could not be enabled.', error));
  });
}
