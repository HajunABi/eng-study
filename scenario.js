// scenario.js
// 시나리오 모드: Day의 1~10번째 문장을 대화 형식으로 시뮬레이션

let scenarioSentences = [];
let scenarioCurrentIndex = 0;
let scenarioDay = 1;
let isUserTurnRevealed = false; // 내 차례일 때 정답(영어)을 확인했는지 여부

function startScenarioMode() {
    // 1. Day 선택 유도를 위해 prompt 사용 (간단 구현)
    // 실제앱에서는 커스텀 팝업이나 Day 리스트를 보여주는게 좋지만, 임시로 prompt 사용
    const targetDayStr = prompt("몇 Day의 시나리오를 시작하시겠습니까? (예: 1)", "1");
    if (!targetDayStr) return; // 취소

    const day = parseInt(targetDayStr);
    if (isNaN(day) || day < 1) {
        alert("올바른 Day 숫자를 입력해주세요.");
        return;
    }

    // 해당 Day의 문장들 가져오기 (10개로 제한)
    const daySents = getSentencesByDay(day);
    if (daySents.length === 0) {
        alert(`Day ${day}의 데이터가 없습니다.`);
        return;
    }

    scenarioDay = day;
    scenarioSentences = daySents.slice(0, 10);
    scenarioCurrentIndex = 0;

    // 화면 전환
    document.getElementById('screen-learn').style.display = 'none'; // 혹시 learn에 있었다면
    showScreen('scenario');

    // UI 초기화
    document.getElementById('scenario-title').textContent = `Day ${day} 시뮬레이션`;
    document.getElementById('scenario-current').textContent = scenarioCurrentIndex;
    document.getElementById('scenario-total').textContent = scenarioSentences.length;

    const chatContainer = document.getElementById('scenario-chat');
    chatContainer.innerHTML = ''; // 기존 대화 초기화

    // 액션 버튼 초기화
    const actionsContainer = document.getElementById('scenario-actions');
    actionsContainer.innerHTML = `
        <button class="action-btn action-primary" id="scenario-next-btn" onclick="nextScenarioStep()">
            대화 시작하기 플레이 ▶
        </button>
    `;
}

function nextScenarioStep() {
    if (scenarioCurrentIndex >= scenarioSentences.length) {
        finishScenario();
        return;
    }

    const currentSentence = scenarioSentences[scenarioCurrentIndex];
    const isUserTurn = scenarioCurrentIndex % 2 === 0; // 짝수 번째 문장을 내 차례로 가정 (0, 2, 4...)

    const chatContainer = document.getElementById('scenario-chat');
    const actionsContainer = document.getElementById('scenario-actions');

    const bubble = document.createElement('div');

    if (!isUserTurn) {
        // 상대방(Counterparty) 턴
        bubble.className = 'scenario-bubble counterparty';
        bubble.innerHTML = `
            <div class="speaker-name">Client / PM (가상)</div>
            <div class="en-text">${currentSentence.en}</div>
            <div class="ko-text">${currentSentence.ko}</div>
        `;
        chatContainer.appendChild(bubble);
        speakScenario(currentSentence.en);

        scenarioCurrentIndex++;
        document.getElementById('scenario-current').textContent = scenarioCurrentIndex;

        // 버튼은 계속 "다음 대화 듣기"
        actionsContainer.innerHTML = `
            <button class="action-btn action-primary" id="scenario-next-btn" onclick="nextScenarioStep()">
                다음 대화 듣기 ▶
            </button>
        `;

    } else {
        // 내(User) 턴
        isUserTurnRevealed = false;
        bubble.className = 'scenario-bubble user placeholder';
        bubble.id = `user-bubble-${scenarioCurrentIndex}`;
        bubble.innerHTML = `
            <div class="speaker-name">당신의 차례입니다</div>
            <div class="ko-text" style="font-size:15px;text-align:center;">"${currentSentence.ko}"</div>
            <div class="tap-hint">영어 문장 확인하기 (Tap)</div>
        `;

        bubble.onclick = () => revealUserTurn(currentSentence);
        chatContainer.appendChild(bubble);

        // 하단 버튼 숨김 (말풍선을 탭해야 진행됨)
        actionsContainer.innerHTML = '';

        // 내 턴이 오면 스크롤은 하단으로 옮김, 하지만 TTS는 아직 안함(내가 말할 차례니까)
    }

    // 스크롤 맨 아래로
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function revealUserTurn(sentence) {
    if (isUserTurnRevealed) return;
    isUserTurnRevealed = true;

    const bubble = document.getElementById(`user-bubble-${scenarioCurrentIndex}`);
    if (!bubble) return;

    bubble.className = 'scenario-bubble user revealed';
    bubble.onclick = null; // 클릭 해제
    bubble.innerHTML = `
        <div class="speaker-name">Me</div>
        <div class="en-text">${sentence.en}</div>
        <div class="ko-text">${sentence.ko}</div>
    `;

    // TTS 발음 듣기
    speakScenario(sentence.en);

    scenarioCurrentIndex++;
    document.getElementById('scenario-current').textContent = scenarioCurrentIndex;

    const chatContainer = document.getElementById('scenario-chat');
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 하단 액션: O/X 로 복습 목록에 반영할지 여부
    const actionsContainer = document.getElementById('scenario-actions');
    actionsContainer.innerHTML = `
        <button class="card-action-btn btn-dont-know" onclick="markScenarioCard(false, ${sentence.id})" style="flex:1;">
            <span>🤔</span>다시 연습
        </button>
        <button class="card-action-btn btn-know" onclick="markScenarioCard(true, ${sentence.id})" style="flex:1;">
            <span>👍</span>좋아요!
        </button>
    `;
}

function markScenarioCard(known, sentenceId) {
    // 실제 app.js의 spaced repetition 로직(`setProgress`)과 연동할 수 있음
    if (appState && appState.progress) {
        const prog = getProgress(sentenceId);
        if (prog.box > 0) {
            setProgress(sentenceId, prog.box, known);
        }
    }
    // 다음 스텝으로 넘어감
    nextScenarioStep();
}

function finishScenario() {
    const chatContainer = document.getElementById('scenario-chat');
    const bubble = document.createElement('div');
    bubble.style.textAlign = 'center';
    bubble.style.margin = '20px 0';
    bubble.style.color = 'var(--text-muted)';
    bubble.style.fontSize = '14px';
    bubble.innerHTML = `🎉 Day ${scenarioDay} 시나리오 완료!`;
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const actionsContainer = document.getElementById('scenario-actions');
    actionsContainer.innerHTML = `
        <button class="action-btn action-secondary" onclick="exitScenario()">종료하기</button>
        <button class="action-btn action-primary" onclick="startScenarioMode()">다른 Day 시작</button>
    `;
}

function exitScenario() {
    showScreen('home');
}

function speakScenario(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}
