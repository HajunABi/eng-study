// scenario.js — 시나리오 대화 모드
// Day 선택 UI → 처음 10문장을 교대 대화 시뮬레이션

let scenarioSentences = [];
let scenarioIndex = 0;
let scenarioDay = 1;
let scenarioRevealed = false;

// 홈 → 시나리오 화면 진입
function startScenarioMode() {
    showScreen('scenario');
    renderScenarioDaySelect();
    document.getElementById('scenario-day-select').style.display = '';
    document.getElementById('scenario-play').style.display = 'none';
    document.getElementById('scenario-title').textContent = '🎭 시나리오';
    document.getElementById('scenario-current').textContent = '0';
    document.getElementById('scenario-total').textContent = '10';
}

// Day 선택 그리드 렌더링 (기존 learn screen의 day-select-grid와 동일 스타일 재사용)
function renderScenarioDaySelect() {
    const grid = document.getElementById('scenario-day-grid');
    grid.innerHTML = '';
    const days = getUniqueDays().sort((a, b) => a - b);
    days.forEach(day => {
        const sents = getSentencesByDay(day);
        const btn = document.createElement('button');
        btn.className = 'day-select-btn';
        btn.innerHTML = `<span class="day-num">Day ${day}</span><span class="day-count">${Math.min(sents.length, 10)}문장</span>`;
        btn.onclick = () => startScenarioDay(day);
        grid.appendChild(btn);
    });
}

// Day 선택 → 대화 시작
function startScenarioDay(day) {
    const sents = getSentencesByDay(day);
    if (sents.length === 0) return;

    scenarioDay = day;
    scenarioSentences = sents.slice(0, 10);
    scenarioIndex = 0;
    scenarioRevealed = false;

    document.getElementById('scenario-day-select').style.display = 'none';
    document.getElementById('scenario-play').style.display = '';
    document.getElementById('scenario-title').textContent = `🎭 Day ${day}`;
    document.getElementById('scenario-current').textContent = '0';
    document.getElementById('scenario-total').textContent = scenarioSentences.length;
    document.getElementById('scenario-chat').innerHTML = '';
    document.getElementById('scenario-actions').innerHTML =
        `<button class="action-btn action-primary" onclick="nextScenarioStep()">대화 시작 ▶</button>`;
}

function nextScenarioStep() {
    if (scenarioIndex >= scenarioSentences.length) {
        finishScenario();
        return;
    }

    const sent = scenarioSentences[scenarioIndex];
    const isUser = scenarioIndex % 2 === 0;
    const chat = document.getElementById('scenario-chat');
    const bubble = document.createElement('div');

    if (!isUser) {
        bubble.className = 'scenario-bubble counterparty';
        bubble.innerHTML = `
            <div class="speaker-name">Client / PM</div>
            <div class="en-text">${sent.en}</div>
            <div class="ko-text">${sent.ko}</div>`;
        chat.appendChild(bubble);
        _speakScenario(sent.en);
        scenarioIndex++;
        document.getElementById('scenario-current').textContent = scenarioIndex;
        document.getElementById('scenario-actions').innerHTML =
            `<button class="action-btn action-primary" onclick="nextScenarioStep()">다음 대화 ▶</button>`;
    } else {
        scenarioRevealed = false;
        bubble.className = 'scenario-bubble user placeholder';
        bubble.id = `sc-bubble-${scenarioIndex}`;
        bubble.innerHTML = `
            <div class="speaker-name">당신의 차례</div>
            <div class="ko-text" style="font-size:15px">"${sent.ko}"</div>
            <div class="tap-hint">탭하여 영어 확인</div>`;
        bubble.onclick = () => _revealUser(sent);
        chat.appendChild(bubble);
        document.getElementById('scenario-actions').innerHTML = '';
    }
    chat.scrollTop = chat.scrollHeight;
}

function _revealUser(sent) {
    if (scenarioRevealed) return;
    scenarioRevealed = true;
    const bubble = document.getElementById(`sc-bubble-${scenarioIndex}`);
    if (!bubble) return;
    bubble.className = 'scenario-bubble user revealed';
    bubble.onclick = null;
    bubble.innerHTML = `
        <div class="speaker-name">Me</div>
        <div class="en-text">${sent.en}</div>
        <div class="ko-text">${sent.ko}</div>`;
    _speakScenario(sent.en);
    scenarioIndex++;
    document.getElementById('scenario-current').textContent = scenarioIndex;
    document.getElementById('scenario-chat').scrollTop =
        document.getElementById('scenario-chat').scrollHeight;
    document.getElementById('scenario-actions').innerHTML = `
        <button class="card-action-btn btn-dont-know" onclick="nextScenarioStep()" style="flex:1">
            <span>🤔</span> 다시 연습
        </button>
        <button class="card-action-btn btn-know" onclick="nextScenarioStep()" style="flex:1">
            <span>👍</span> 좋아요!
        </button>`;
}

function finishScenario() {
    const chat = document.getElementById('scenario-chat');
    const done = document.createElement('div');
    done.style.cssText = 'text-align:center; margin:20px 0; color:var(--text-muted); font-size:14px;';
    done.innerHTML = `🎉 Day ${scenarioDay} 시나리오 완료!`;
    chat.appendChild(done);
    chat.scrollTop = chat.scrollHeight;
    document.getElementById('scenario-actions').innerHTML = `
        <button class="action-btn action-secondary" onclick="startScenarioMode()">Day 선택</button>
        <button class="action-btn action-primary" onclick="showScreen('home')">홈으로</button>`;
}

function exitScenario() {
    // 대화 중이면 Day 선택으로, Day 선택에서면 홈으로
    if (document.getElementById('scenario-play').style.display !== 'none') {
        startScenarioMode();
    } else {
        showScreen('home');
    }
}

function _speakScenario(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}
