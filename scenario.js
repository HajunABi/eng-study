// scenario.js — 시나리오 대화 모드
// Day의 처음 10문장을 교대로 대화 형식 시뮬레이션

let scenarioSentences = [];
let scenarioIndex = 0;
let scenarioDay = 1;
let scenarioRevealed = false;

function startScenarioMode() {
    const dayStr = prompt("몇 Day 시나리오를 시작할까요? (예: 1)", "1");
    if (!dayStr) return;
    const day = parseInt(dayStr);
    if (isNaN(day) || day < 1) { alert("올바른 Day를 입력해주세요."); return; }

    const sents = getSentencesByDay(day);
    if (sents.length === 0) { alert(`Day ${day} 데이터가 없습니다.`); return; }

    scenarioDay = day;
    scenarioSentences = sents.slice(0, 10);
    scenarioIndex = 0;
    scenarioRevealed = false;

    showScreen('scenario');
    document.getElementById('scenario-title').textContent = `🎭 Day ${day} 시나리오`;
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
    const isUser = scenarioIndex % 2 === 0; // 짝수=내 차례, 홀수=상대
    const chat = document.getElementById('scenario-chat');

    const bubble = document.createElement('div');

    if (!isUser) {
        // 상대방 턴 — 즉시 보여주기
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
        // 내 턴 — placeholder → 탭하면 공개
        scenarioRevealed = false;
        bubble.className = 'scenario-bubble user placeholder';
        bubble.id = `sc-bubble-${scenarioIndex}`;
        bubble.innerHTML = `
            <div class="speaker-name">당신의 차례</div>
            <div class="ko-text" style="font-size:15px">"${sent.ko}"</div>
            <div class="tap-hint">탭하여 영어 확인</div>`;
        bubble.onclick = () => _revealUser(sent);
        chat.appendChild(bubble);
        document.getElementById('scenario-actions').innerHTML = ''; // 버튼 숨김
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
        <button class="action-btn action-secondary" onclick="showScreen('home')">종료</button>
        <button class="action-btn action-primary" onclick="startScenarioMode()">다른 Day</button>`;
}

function exitScenario() { showScreen('home'); }

function _speakScenario(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}
