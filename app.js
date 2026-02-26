// ==========================================
// 영어 마스터 - 멀티코스 플랫폼
// ==========================================

// ---- Course Definitions ----
const COURSES = {
    eps: {
        id: 'eps',
        name: 'EPS 컨퍼런스콜',
        heroTitle: 'EPS Conference Call<br><span class="hero-highlight">English Master</span>',
        heroSub: '1,000 sentences · 15-day curriculum',
        emoji: '🏢',
        getData: () => SENTENCES,
        storageKey: 'eps_eng_master'
    },
    travel: {
        id: 'travel',
        name: '여행 영어',
        heroTitle: 'Travel English<br><span class="hero-highlight">Master</span>',
        heroSub: '275 sentences · 5-day curriculum',
        emoji: '✈️',
        getData: () => SENTENCES_TRAVEL,
        storageKey: 'travel_eng_master'
    },
    hospital: {
        id: 'hospital',
        name: '병원 직원 영어',
        heroTitle: 'Hospital Staff<br><span class="hero-highlight">English Master</span>',
        heroSub: '275 sentences · 5-day curriculum',
        emoji: '🏥',
        getData: () => SENTENCES_HOSPITAL,
        storageKey: 'hospital_eng_master'
    }
};

let currentCourse = null; // 현재 선택된 코스 ID
let ACTIVE_SENTENCES = []; // 현재 코스의 문장 배열 (기존 SENTENCES 대체)

// ---- Storage Keys ----
let STORAGE_KEY = 'eps_eng_master';

// ---- App State ----
let appState = {
    progress: {},      // { sentenceId: { box: 1-5, lastReview: dateStr, wrongCount: 0 } }
    streak: 0,
    lastStudyDate: null,
    testHistory: [],
    starredSentences: [], // 즐겨찾기 보관함
    learnSession: {}     // { day: [answeredIds] } 세션 중간 저장
};

// ---- Current Session State ----
let currentLearnDay = null;
let currentLearnCards = [];
let currentLearnIndex = 0;
let learnKnown = 0;
let learnUnknown = 0;
let learnUnknownList = []; // 즉시 복기용 틀린 카드 ID
let isCardFlipped = false;
let learnHistory = []; // Undo 히스토리 스택: [{id, wasKnown, prevBox, prevWrongCount}]

let reviewCards = [];
let reviewIndex = 0;
let reviewCorrect = 0;
let reviewWrong = 0;
let isReviewFlipped = false;
let reviewHistory = []; // Undo 히스토리 스택

// ---- Swipe Gesture State ----
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;
let clickBlockedBySwipe = false; // 제스처 중 카드 뒤집힘(click) 방지 플래그
const SWIPE_THRESHOLD = 90; // 스와이프 판정 임계값(px)

let testType = 'listening';
let testDays = [0]; // 0 = all
let testCount = 20;
let testQuestions = [];
let testIndex = 0;
let testScore = 0;
let testWrongList = [];

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
    // 마지막으로 사용한 코스가 있으면 바로 진입
    const lastCourse = localStorage.getItem('last_course');
    if (lastCourse && COURSES[lastCourse]) {
        selectCourse(lastCourse);
    } else {
        showCourseSelect();
    }
});

// ---- Course Selection ----
function showCourseSelect() {
    document.getElementById('screen-courses').style.display = 'flex';
    document.getElementById('navbar').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
}

function selectCourse(courseId) {
    const course = COURSES[courseId];
    if (!course) return;

    currentCourse = courseId;
    ACTIVE_SENTENCES = course.getData();
    STORAGE_KEY = course.storageKey;

    // 마지막 코스 저장
    localStorage.setItem('last_course', courseId);

    // 히어로 배너 업데이트
    document.querySelector('.hero-title').innerHTML = course.heroTitle;
    document.querySelector('.hero-sub').textContent = course.heroSub;

    // 코스 선택 화면 숨기고 앱 표시
    document.getElementById('screen-courses').style.display = 'none';
    document.getElementById('navbar').style.display = '';

    // 상태 로드 및 화면 초기화
    appState = {
        progress: {},
        streak: 0,
        lastStudyDate: null,
        testHistory: [],
        starredSentences: [],
        learnSession: {}
    };
    loadState();
    updateStreak();
    renderHome();
    renderLearnDaySelect();
    renderTestDayChips();
    showScreen('home');

    // 최초 방문 시 가이드
    if (!localStorage.getItem('guide_seen_' + courseId)) {
        showGuide();
    }
}

// ---- Storage ----
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            appState = JSON.parse(saved);
        }
    } catch (e) {
        console.log('Failed to load state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.log('Failed to save state:', e);
    }
}

// ---- Streak ----
function updateStreak() {
    const today = getToday();
    if (appState.lastStudyDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    if (appState.lastStudyDate === yesterdayStr) {
        // Streak continues
    } else if (appState.lastStudyDate !== today) {
        appState.streak = 0;
    }
}

function recordStudyToday() {
    const today = getToday();
    if (appState.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (appState.lastStudyDate === formatDate(yesterday)) {
            appState.streak++;
        } else {
            appState.streak = 1;
        }
        appState.lastStudyDate = today;
    }
    saveState();
}

// ---- Date Helpers ----
function getToday() {
    return formatDate(new Date());
}

function formatDate(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function daysSince(dateStr) {
    if (!dateStr) return 999;
    const then = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// ---- Spaced Repetition (Leitner) ----
const BOX_INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 7, 5: 30 };

function getProgress(id) {
    if (!appState.progress[id]) {
        return { box: 0, lastReview: null, wrongCount: 0 };
    }
    return appState.progress[id];
}

function setProgress(id, box, isCorrect) {
    if (!appState.progress[id]) {
        appState.progress[id] = { box: 1, lastReview: getToday(), wrongCount: 0 };
    }

    if (isCorrect) {
        appState.progress[id].box = Math.min(5, box + 1);
    } else {
        appState.progress[id].box = 1;
        appState.progress[id].wrongCount = (appState.progress[id].wrongCount || 0) + 1;
    }
    appState.progress[id].lastReview = getToday();
    saveState();
}

function initSentenceProgress(id) {
    if (!appState.progress[id]) {
        appState.progress[id] = { box: 1, lastReview: getToday(), wrongCount: 0 };
        saveState();
    }
}

function isDueForReview(id) {
    const prog = getProgress(id);
    if (prog.box === 0) return false;
    if (prog.box >= 5) return false;
    const interval = BOX_INTERVALS[prog.box] || 0;
    return daysSince(prog.lastReview) >= interval;
}

function getReviewCards() {
    const due = [];
    for (const idStr in appState.progress) {
        const id = parseInt(idStr);
        const prog = appState.progress[id];
        if (prog.box >= 1 && prog.box < 5) {
            const interval = BOX_INTERVALS[prog.box] || 0;
            if (daysSince(prog.lastReview) >= interval) {
                due.push(ACTIVE_SENTENCES.find(s => s.id === id));
            }
        }
    }
    return due.filter(Boolean).sort(() => Math.random() - 0.5);
}

// ---- Audio & TTS (AI Voice + Fallback) ----
let currentAudio = null;

function speak(id, textFallback, lang = 'en-US') {
    // 1. 기존 재생 중인 MP3 중지
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    // 2. 기존 브라우저 TTS 중지
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    // 파일 로컬 경로
    const audioPath = `audio/${id}.mp3`;
    currentAudio = new Audio(audioPath);

    // 성공적으로 로드된 경우 재생
    currentAudio.play().catch(e => {
        // 재생 실패 (파일 없음, 브라우저 정책 막힘 등) -> 기존 Web Speech API로 폴백
        console.warn(`[Audio] Failed to play MP3 for ID ${id}. Fallback to basic TTS.`, e);
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(textFallback);
            u.lang = lang;
            u.rate = 0.85; // 천천히 읽기
            u.pitch = 1;
            window.speechSynthesis.speak(u);
        }
    });
}

function speakEnglish() {
    const card = currentLearnCards[currentLearnIndex];
    if (card) speak(card.id, card.en);
}

function speakReviewEnglish() {
    const card = reviewCards[reviewIndex];
    if (card) speak(card.id, card.en);
}

function speakTestEnglish() {
    if (testQuestions[testIndex]) speak(testQuestions[testIndex].sentence.id, testQuestions[testIndex].sentence.en);
}

// ---- Navigation with History API ----
function showScreen(name, updateHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + name).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-btn[data-screen="${name}"]`);
    if (activeNav) activeNav.classList.add('active');

    window.scrollTo(0, 0);

    if (name === 'home') renderHome();
    if (name === 'review') initReview();
    if (name === 'stats') renderStats();
    if (name === 'starred') renderStarredList();
    if (name === 'learn') {
        renderLearnDaySelect();
        document.getElementById('learn-day-select').style.display = '';
        document.getElementById('learn-card-view').style.display = 'none';
        document.getElementById('learn-complete').style.display = 'none';
        document.getElementById('learn-title').textContent = '학습';
    }
    if (name === 'test') {
        // Keep test setup if not in progress
    }

    // 뒤로가기 처리를 위한 History 반영
    if (updateHistory) {
        history.pushState({ screen: name }, name, `#${name}`);
    }
}

// 스마트폰 기기 "물리 뒤로가기 버튼" 및 브라우저 뒤로가기 감지 (PWA 핵심)
// *** 히스토리 가드(guard) 패턴: 홈에서 뒤로가기 누르면 앱이 종료되지 않게 방어 ***
window.addEventListener('popstate', (e) => {
    // 모달(가이드 등)이 켜져있을 때 뒤로가기를 누르면 모달만 닫기
    if (document.getElementById('guide-overlay').style.display === 'flex') {
        closeGuide(false);
        // 가드 재삽입
        history.pushState({ screen: 'home' }, 'home', '#home');
        return;
    }

    // 마스터 뷰 열려있으면 닫기
    const masterView = document.getElementById('screen-mastered');
    if (masterView) {
        masterView.remove();
        history.pushState({ screen: 'home' }, 'home', '#home');
        return;
    }

    if (e.state && e.state.screen) {
        showScreen(e.state.screen, false);
    } else {
        // 홈 화면에서 뒤로가기 누르면 앱 종료 방지: 가드 재삽입
        showScreen('home', false);
        history.pushState({ screen: 'home' }, 'home', '#home');
    }
});

// ---- Unique Days ----
function getUniqueDays() {
    const days = [...new Set(ACTIVE_SENTENCES.map(s => s.day))].sort((a, b) => a - b);
    return days;
}

function getSentencesByDay(day) {
    return ACTIVE_SENTENCES.filter(s => s.day === day);
}

// ---- Home Screen ----
function renderHome() {
    const days = getUniqueDays();
    const totalSentences = ACTIVE_SENTENCES.length;

    // Count mastered (box 5)
    let mastered = 0;
    let studied = 0;
    for (const id in appState.progress) {
        if (appState.progress[id].box >= 5) mastered++;
        if (appState.progress[id].box >= 1) studied++;
    }

    // Review count
    const reviewCount = getReviewCards().length;

    document.getElementById('home-total-mastered').textContent = mastered;
    document.getElementById('home-master-bar').style.width =
        (totalSentences > 0 ? (mastered / totalSentences * 100) : 0) + '%';
    document.getElementById('home-review-count').textContent = reviewCount;
    document.getElementById('home-streak').innerHTML = appState.streak + '<span class="dash-unit">일</span>';

    // 시간대별 인사말
    const greetEl = document.getElementById('hero-greeting');
    if (greetEl) {
        const hour = new Date().getHours();
        if (hour < 12) greetEl.textContent = 'Good morning ☀️';
        else if (hour < 18) greetEl.textContent = 'Good afternoon 🌤️';
        else greetEl.textContent = 'Good evening 🌙';
    }

    // 대시보드 카드 클릭 이벤트
    const masterCard = document.querySelector('.dash-master');
    if (masterCard) {
        masterCard.style.cursor = mastered > 0 ? 'pointer' : 'default';
        masterCard.onclick = mastered > 0 ? () => showMasteredList() : null;
    }
    const reviewCard = document.querySelector('.dash-review');
    if (reviewCard) {
        reviewCard.style.cursor = reviewCount > 0 ? 'pointer' : 'default';
        reviewCard.onclick = reviewCount > 0 ? () => showScreen('review') : null;
    }
    const streakCard = document.querySelector('.dash-streak');
    if (streakCard) {
        streakCard.style.cursor = 'pointer';
        streakCard.onclick = () => {
            const msg = appState.streak > 0
                ? `🔥 ${appState.streak}일 연속 학습 중! 계속 파이팅!`
                : '오늘 학습을 시작하면 연속 학습 1일이 됩니다!';
            showToast(msg);
        };
    }

    // Day list
    const dayList = document.getElementById('home-day-list');
    dayList.innerHTML = '';

    days.forEach(day => {
        const sentences = getSentencesByDay(day);
        const dayStudied = sentences.filter(s => appState.progress[s.id] && appState.progress[s.id].box >= 1).length;
        const percent = Math.round(dayStudied / sentences.length * 100);

        const dayName = DAY_NAMES[day] || `Day ${day}`;
        const dayNameEn = DAY_NAMES_EN[day] || '';

        const div = document.createElement('div');
        div.className = 'day-item';
        div.onclick = () => startLearnDay(day);
        div.innerHTML = `
      <div class="day-badge day-badge-${day}">D${day}</div>
      <div class="day-info">
        <div class="day-title">${dayName}</div>
        <div class="day-subtitle">${dayNameEn} · ${sentences.length}문장</div>
      </div>
      <div class="day-progress-mini">${percent}%</div>
    `;
        dayList.appendChild(div);
    });
}

// ---- Learn Screen ----
function renderLearnDaySelect() {
    const days = getUniqueDays();
    const grid = document.getElementById('learn-day-select');
    grid.innerHTML = '';

    days.forEach(day => {
        const sentences = getSentencesByDay(day);
        const dayName = DAY_NAMES[day] || `Day ${day}`;

        const card = document.createElement('div');
        card.className = 'day-select-card';
        card.onclick = () => startLearnDay(day);
        card.innerHTML = `
      <div class="day-num">Day ${day}</div>
      <div class="day-name">${dayName}</div>
      <div class="day-count">${sentences.length}문장</div>
    `;
        grid.appendChild(card);
    });
}

function startLearnDay(day) {
    showScreen('learn');
    currentLearnDay = day;

    // 세션 중간 저장: 이미 답한 카드 건너뛰기
    const allCards = getSentencesByDay(day);
    const answeredIds = (appState.learnSession && appState.learnSession[day]) || [];
    const remainingCards = allCards.filter(c => !answeredIds.includes(c.id));

    if (remainingCards.length === 0) {
        // 전부 답변 완료 → 세션 초기화 후 전체 재시작
        if (appState.learnSession) delete appState.learnSession[day];
        saveState();
        currentLearnCards = allCards.sort(() => Math.random() - 0.5);
    } else {
        currentLearnCards = remainingCards.sort(() => Math.random() - 0.5);
    }

    currentLearnIndex = 0;
    learnKnown = 0;
    learnUnknown = 0;
    isCardFlipped = false;
    learnHistory = [];

    document.getElementById('learn-day-select').style.display = 'none';
    document.getElementById('learn-preview-view').style.display = '';
    document.getElementById('learn-card-view').style.display = 'none';
    document.getElementById('learn-complete').style.display = 'none';

    const dayName = DAY_NAMES[day] || `Day ${day}`;
    document.getElementById('learn-title').textContent = `📖 ${dayName} - 사전학습`;

    renderLearnPreview();
}

function renderLearnPreview() {
    const list = document.getElementById('preview-list');
    list.innerHTML = '';

    const sortedCards = [...currentLearnCards].sort((a, b) => a.id - b.id);

    sortedCards.forEach((card, idx) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <div class="preview-num">${idx + 1}</div>
            <div class="preview-text">
                <div class="preview-en">${card.en}</div>
                <div class="preview-ko">${card.ko}</div>
            </div>
            <button class="tts-btn" onclick="speak(${card.id}, '${card.en.replace(/'/g, "\\'")}')">
                🔊
            </button>
        `;
        list.appendChild(item);
    });
}

function startLearnFlashcards() {
    document.getElementById('learn-preview-view').style.display = 'none';
    document.getElementById('learn-card-view').style.display = '';

    document.getElementById('learn-title').textContent = `Day ${currentLearnDay} 플래시카드`;
    document.getElementById('learn-total').textContent = currentLearnCards.length;

    showLearnCard();
    recordStudyToday();
}


function startQuickLearn() {
    // Start with first day that has unlearned sentences, or review
    const days = getUniqueDays();
    for (const day of days) {
        const sentences = getSentencesByDay(day);
        const unlearned = sentences.filter(s => !appState.progress[s.id] || appState.progress[s.id].box === 0);
        if (unlearned.length > 0) {
            startLearnDay(day);
            return;
        }
    }
    // All learned, go to review
    showScreen('review');
}

function showLearnCard() {
    if (currentLearnIndex >= currentLearnCards.length) {
        showLearnComplete();
        return;
    }

    const card = currentLearnCards[currentLearnIndex];
    isCardFlipped = false;

    document.getElementById('card-front').style.display = '';
    document.getElementById('card-back').style.display = 'none';
    document.getElementById('card-number').textContent = `#${card.id}`;
    document.getElementById('card-korean').textContent = card.ko;
    document.getElementById('card-number-back').textContent = `#${card.id}`;
    document.getElementById('card-english').textContent = card.en;
    document.getElementById('card-korean-back').textContent = card.ko;

    document.getElementById('learn-current').textContent = currentLearnIndex + 1;

    const progress = ((currentLearnIndex) / currentLearnCards.length) * 100;
    document.getElementById('learn-progress-bar').style.width = progress + '%';

    // 별표 상태 업데이트
    updateStarUI(card.id);

    // Animate card
    const cardEl = document.getElementById('learn-card');
    cardEl.style.animation = 'none';
    cardEl.offsetHeight; // trigger reflow
    cardEl.style.animation = 'fadeIn 0.3s ease';
}

function flipCard() {
    if (clickBlockedBySwipe) return; // 스와이프 도중 또는 직후에는 뒤집기(클릭) 이벤트 차단
    isCardFlipped = !isCardFlipped;
    document.getElementById('card-front').style.display = isCardFlipped ? 'none' : '';
    document.getElementById('card-back').style.display = isCardFlipped ? '' : 'none';

    if (isCardFlipped) {
        const card = currentLearnCards[currentLearnIndex];
        speak(card.id, card.en);
    }
}

function markCard(known) {
    const card = currentLearnCards[currentLearnIndex];
    initSentenceProgress(card.id);

    // Undo를 위해 이전 상태 기록
    const prevProg = getProgress(card.id);
    learnHistory.push({
        id: card.id,
        wasKnown: known,
        prevBox: prevProg.box,
        prevWrongCount: prevProg.wrongCount || 0,
        prevLastReview: prevProg.lastReview
    });

    if (known) {
        learnKnown++;
        setProgress(card.id, getProgress(card.id).box, true);
    } else {
        learnUnknown++;
        learnUnknownList.push(card.id);
        setProgress(card.id, getProgress(card.id).box, false);
    }

    // 세션 중간 저장
    if (!appState.learnSession) appState.learnSession = {};
    if (!appState.learnSession[currentLearnDay]) appState.learnSession[currentLearnDay] = [];
    appState.learnSession[currentLearnDay].push(card.id);
    saveState();

    // ✓/✗ 피드백 애니메이션
    const fb = document.getElementById('learn-card-feedback');
    if (fb) {
        fb.textContent = known ? '✓' : '✗';
        fb.style.color = known ? 'var(--accent-green)' : 'var(--accent-red)';
        fb.classList.add('show');
    }
    setTimeout(() => {
        if (fb) fb.classList.remove('show');
        currentLearnIndex++;
        showLearnCard();
        const undoBtn = document.getElementById('learn-undo-btn');
        if (undoBtn) undoBtn.style.display = learnHistory.length > 0 ? '' : 'none';
    }, 350);
}

// ---- Swipe Gesture Logic ----
// cardElementId: 카드 element id
// markFunction: 알아요/몰라요 처리 함수 (true/false)
// flipFunction: 카드 뒤집기 함수 (탭 시 호출)
function initSwipeListeners(cardElementId, markFunction, flipFunction) {
    const cardEl = document.getElementById(cardElementId);
    if (!cardEl) return;

    let startX = 0;
    let startY = 0;
    let moved = false;

    // 별표/버튼은 터치가 카드까지 전파되지 않도록 격리
    cardEl.querySelectorAll('.star-btn, .tts-btn, .card-action-btn').forEach(btn => {
        btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
        btn.addEventListener('touchend', e => e.stopPropagation(), { passive: true });
    });

    cardEl.addEventListener('touchstart', (e) => {
        // 버튼 자식 요소에서 시작된 터치는 무시
        if (e.target.closest('.star-btn') || e.target.closest('.tts-btn') || e.target.closest('.card-action-btn')) {
            return;
        }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        moved = false;
        cardEl.style.transition = 'none';
    }, { passive: true });

    cardEl.addEventListener('touchmove', (e) => {
        if (e.target.closest('.star-btn') || e.target.closest('.tts-btn') || e.target.closest('.card-action-btn')) {
            return;
        }
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        // 가로 이동이 세로 이동보다 클 때만 스와이프로 처리 (세로 스크롤과 구분)
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            moved = true;
            const rotation = dx * 0.05;
            cardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;

            if (dx > SWIPE_THRESHOLD / 2) {
                cardEl.classList.add('swiping-right');
                cardEl.classList.remove('swiping-left');
            } else if (dx < -SWIPE_THRESHOLD / 2) {
                cardEl.classList.add('swiping-left');
                cardEl.classList.remove('swiping-right');
            } else {
                cardEl.classList.remove('swiping-right', 'swiping-left');
            }
        }
    }, { passive: true });

    cardEl.addEventListener('touchend', (e) => {
        if (e.target.closest('.star-btn') || e.target.closest('.tts-btn') || e.target.closest('.card-action-btn')) {
            return;
        }

        cardEl.style.transition = 'transform 0.3s ease';
        cardEl.classList.remove('swiping-right', 'swiping-left');
        const dx = (e.changedTouches[0].clientX) - startX;

        if (!moved) {
            // 이동이 거의 없으면 탭으로 간주 → 카드 뒤집기
            cardEl.style.transform = '';
            if (flipFunction) flipFunction();
        } else if (dx > SWIPE_THRESHOLD) {
            // 오른쪽 스와이프 → 알아요
            cardEl.style.transform = `translateX(${window.innerWidth}px) rotate(20deg)`;
            setTimeout(() => { cardEl.style.transform = ''; markFunction(true); }, 300);
        } else if (dx < -SWIPE_THRESHOLD) {
            // 왼쪽 스와이프 → 모르겠어요
            cardEl.style.transform = `translateX(-${window.innerWidth}px) rotate(-20deg)`;
            setTimeout(() => { cardEl.style.transform = ''; markFunction(false); }, 300);
        } else {
            // 기준 미달 → 원위치
            cardEl.style.transform = 'translateX(0) rotate(0)';
            setTimeout(() => { cardEl.style.transform = ''; }, 300);
        }
    });
}

function showLearnComplete() {
    document.getElementById('learn-card-view').style.display = 'none';
    document.getElementById('learn-complete').style.display = '';
    document.getElementById('learn-progress-bar').style.width = '100%';

    document.getElementById('complete-known').textContent = learnKnown;
    document.getElementById('complete-unknown').textContent = learnUnknown;

    // 세션 완료 → 해당 Day 세션 데이터 초기화
    if (appState.learnSession && appState.learnSession[currentLearnDay]) {
        delete appState.learnSession[currentLearnDay];
        saveState();
    }

    // 동적 CTA 영역
    const ctaWrap = document.getElementById('complete-cta');
    if (ctaWrap) {
        ctaWrap.innerHTML = '';
        // 기본 복습 버튼
        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'action-btn action-primary';
        reviewBtn.textContent = '복습하러 가기';
        reviewBtn.onclick = () => showScreen('review');
        ctaWrap.appendChild(reviewBtn);

        // 틀린 문장 복기
        if (learnUnknown > 0) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'action-btn action-secondary';
            retryBtn.style.cssText = 'margin-top:10px; background:rgba(255,100,100,0.1); color:#ff6b6b; border:1px solid rgba(255,100,100,0.2);';
            retryBtn.innerHTML = `❌ 틀린 ${learnUnknown}문장 바로 복기`;
            retryBtn.onclick = startInstantReview;
            ctaWrap.appendChild(retryBtn);
        }
        // 다음 Day
        const nextDay = getNextUnlearnedDay(currentLearnDay);
        if (nextDay) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'action-btn action-secondary';
            nextBtn.style.marginTop = '10px';
            nextBtn.innerHTML = `⚡ Day ${nextDay} 바로 시작`;
            nextBtn.onclick = () => startLearnDay(nextDay);
            ctaWrap.appendChild(nextBtn);
        }
    }
}

function getNextUnlearnedDay(afterDay) {
    const days = getUniqueDays();
    for (const day of days) {
        if (day <= afterDay) continue;
        const sents = getSentencesByDay(day);
        const unlearned = sents.filter(s => !appState.progress[s.id] || appState.progress[s.id].box === 0);
        if (unlearned.length > 0) return day;
    }
    return null;
}

function startInstantReview() {
    if (learnUnknownList.length === 0) return;
    const cards = learnUnknownList.map(id => ACTIVE_SENTENCES.find(s => s.id === id)).filter(Boolean);
    currentLearnCards = cards;
    currentLearnIndex = 0;
    learnKnown = 0;
    learnUnknown = 0;
    learnUnknownList = [];
    isCardFlipped = false;
    learnHistory = [];
    document.getElementById('learn-complete').style.display = 'none';
    document.getElementById('learn-card-view').style.display = '';
    document.getElementById('learn-total').textContent = cards.length;
    document.getElementById('learn-title').textContent = '틀린 문장 복기';
    showLearnCard();
}

// ---- Review Screen ----
function initReview() {
    reviewCards = getReviewCards();
    reviewIndex = 0;
    reviewCorrect = 0;
    reviewWrong = 0;
    isReviewFlipped = false;
    reviewHistory = [];

    document.getElementById('review-complete').style.display = 'none';

    if (reviewCards.length === 0) {
        document.getElementById('review-empty').style.display = '';
        document.getElementById('review-card-view').style.display = 'none';
    } else {
        document.getElementById('review-empty').style.display = 'none';
        document.getElementById('review-card-view').style.display = '';
        document.getElementById('review-total').textContent = reviewCards.length;
        showReviewCard();
        recordStudyToday();
    }
}

function showReviewCard() {
    if (reviewIndex >= reviewCards.length) {
        showReviewComplete();
        return;
    }

    const card = reviewCards[reviewIndex];
    const prog = getProgress(card.id);
    isReviewFlipped = false;

    document.getElementById('review-card-front').style.display = '';
    document.getElementById('review-card-back').style.display = 'none';
    document.getElementById('review-card-number').textContent = `#${card.id}`;
    document.getElementById('review-card-korean').textContent = card.ko;
    document.getElementById('review-card-number-back').textContent = `#${card.id}`;
    document.getElementById('review-card-english').textContent = card.en;
    document.getElementById('review-card-korean-back').textContent = card.ko;

    document.getElementById('review-current').textContent = reviewIndex + 1;
    document.getElementById('review-box-badge').textContent = `Box ${prog.box}`;
    document.getElementById('review-remaining').textContent = `남은 문장: ${reviewCards.length - reviewIndex}`;

    const progress = (reviewIndex / reviewCards.length) * 100;
    document.getElementById('review-progress-bar').style.width = progress + '%';

    // 별표 상태 업데이트
    updateStarUI(card.id);
}

function flipReviewCard() {
    if (clickBlockedBySwipe) return; // 스와이프 도중 또는 직후에는 뒤집기(클릭) 이벤트 차단
    isReviewFlipped = !isReviewFlipped;
    document.getElementById('review-card-front').style.display = isReviewFlipped ? 'none' : '';
    document.getElementById('review-card-back').style.display = isReviewFlipped ? '' : 'none';

    if (isReviewFlipped) {
        speak(reviewCards[reviewIndex].id, reviewCards[reviewIndex].en);
    }
}

function markReviewCard(correct) {
    const card = reviewCards[reviewIndex];
    const prog = getProgress(card.id);

    // Undo를 위해 이전 상태 기록
    reviewHistory.push({
        id: card.id,
        wasCorrect: correct,
        prevBox: prog.box,
        prevWrongCount: prog.wrongCount || 0,
        prevLastReview: prog.lastReview
    });

    if (correct) {
        reviewCorrect++;
        setProgress(card.id, prog.box, true);
    } else {
        reviewWrong++;
        setProgress(card.id, prog.box, false);
    }

    // ✓/✗ 피드백
    const fb = document.getElementById('review-card-feedback');
    if (fb) {
        fb.textContent = correct ? '✓' : '✗';
        fb.style.color = correct ? 'var(--accent-green)' : 'var(--accent-red)';
        fb.classList.add('show');
    }
    setTimeout(() => {
        if (fb) fb.classList.remove('show');
        reviewIndex++;
        showReviewCard();
        const undoBtn = document.getElementById('review-undo-btn');
        if (undoBtn) undoBtn.style.display = reviewHistory.length > 0 ? '' : 'none';
    }, 350);
}

function showReviewComplete() {
    document.getElementById('review-card-view').style.display = 'none';
    document.getElementById('review-complete').style.display = '';
    document.getElementById('review-progress-bar').style.width = '100%';

    document.getElementById('review-correct').textContent = reviewCorrect;
    document.getElementById('review-wrong').textContent = reviewWrong;
}

// ---- Test Screen ----
function renderTestDayChips() {
    const days = getUniqueDays();
    const container = document.getElementById('test-day-chips');
    // Keep the "전체" chip, add day chips
    days.forEach(day => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.textContent = `Day ${day}`;
        btn.onclick = () => toggleTestDay(day, btn);
        container.appendChild(btn);
    });
}

function toggleTestDay(day, el) {
    if (day === 0) {
        testDays = [0];
        document.querySelectorAll('#test-day-chips .chip').forEach(c => c.classList.remove('chip-active'));
        el.classList.add('chip-active');
    } else {
        testDays = testDays.filter(d => d !== 0);

        if (testDays.includes(day)) {
            testDays = testDays.filter(d => d !== day);
            el.classList.remove('chip-active');
        } else {
            testDays.push(day);
            el.classList.add('chip-active');
        }

        // Remove 'all' active
        document.querySelector('#test-day-chips .chip:first-child').classList.remove('chip-active');

        if (testDays.length === 0) {
            testDays = [0];
            document.querySelector('#test-day-chips .chip:first-child').classList.add('chip-active');
        }
    }
}

function selectTestType(type, el) {
    testType = type;
    document.querySelectorAll('.test-type-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

function setTestCount(count, el) {
    testCount = count;
    document.querySelectorAll('.test-count-btns .chip').forEach(c => c.classList.remove('chip-active'));
    el.classList.add('chip-active');
}

function startTest() {
    // Get sentences by selected days
    let pool = [];
    if (testDays.includes(0)) {
        pool = [...ACTIVE_SENTENCES];
    } else {
        testDays.forEach(d => {
            pool.push(...getSentencesByDay(d));
        });
    }

    if (pool.length < 4) {
        alert('선택한 범위에 문장이 너무 적습니다.');
        return;
    }

    // Shuffle and pick
    pool = pool.sort(() => Math.random() - 0.5);
    const count = Math.min(testCount, pool.length);

    testQuestions = [];
    for (let i = 0; i < count; i++) {
        const sentence = pool[i];
        const question = generateQuestion(sentence, pool, testType);
        testQuestions.push(question);
    }

    testIndex = 0;
    testScore = 0;
    testWrongList = [];

    document.getElementById('test-setup').style.display = 'none';
    document.getElementById('test-in-progress').style.display = '';
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('test-total').textContent = count;

    showTestQuestion();
    recordStudyToday();
}

function generateQuestion(sentence, pool, type) {
    if (type === 'listening') {
        // Pick 3 wrong Korean answers
        const wrongs = pool.filter(s => s.id !== sentence.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(s => s.ko);
        const options = [...wrongs, sentence.ko].sort(() => Math.random() - 0.5);
        return { sentence, type: 'listening', options, answer: sentence.ko };
    } else if (type === 'translate') {
        // Pick 3 wrong English answers
        const wrongs = pool.filter(s => s.id !== sentence.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(s => s.en);
        const options = [...wrongs, sentence.en].sort(() => Math.random() - 0.5);
        return { sentence, type: 'translate', options, answer: sentence.en };
    } else {
        // Fill in the blank
        const words = sentence.en.split(' ').filter(w => w.length > 3);
        if (words.length === 0) {
            // Fallback: use translate type
            const wrongs = pool.filter(s => s.id !== sentence.id)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
                .map(s => s.en);
            const options = [...wrongs, sentence.en].sort(() => Math.random() - 0.5);
            return { sentence, type: 'translate', options, answer: sentence.en };
        }
        const blankWord = words[Math.floor(Math.random() * words.length)];
        // Clean the word (remove punctuation for answer)
        const cleanWord = blankWord.replace(/[.,!?;:'"]/g, '');
        const blankSentence = sentence.en.replace(blankWord, '_____');
        return { sentence, type: 'fill', blankSentence, answer: cleanWord };
    }
}

function showTestQuestion() {
    if (testIndex >= testQuestions.length) {
        showTestResults();
        return;
    }

    const q = testQuestions[testIndex];
    document.getElementById('test-current').textContent = testIndex + 1;

    const progress = (testIndex / testQuestions.length) * 100;
    document.getElementById('test-progress-bar').style.width = progress + '%';

    // Hide all quiz types
    document.getElementById('quiz-listening').style.display = 'none';
    document.getElementById('quiz-translate').style.display = 'none';
    document.getElementById('quiz-fill').style.display = 'none';

    if (q.type === 'listening') {
        document.getElementById('quiz-listening').style.display = '';
        speak(q.sentence.id, q.sentence.en);

        const optionsDiv = document.getElementById('quiz-listening-options');
        optionsDiv.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = opt;
            btn.onclick = () => handleQuizAnswer(btn, opt, q.answer, optionsDiv);
            optionsDiv.appendChild(btn);
        });
    } else if (q.type === 'translate') {
        document.getElementById('quiz-translate').style.display = '';
        document.getElementById('quiz-korean-sentence').textContent = q.sentence.ko;

        const optionsDiv = document.getElementById('quiz-translate-options');
        optionsDiv.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = opt;
            btn.onclick = () => handleQuizAnswer(btn, opt, q.answer, optionsDiv);
            optionsDiv.appendChild(btn);
        });
    } else if (q.type === 'fill') {
        document.getElementById('quiz-fill').style.display = '';
        document.getElementById('quiz-fill-sentence').textContent = q.blankSentence;
        document.getElementById('quiz-fill-hint').textContent = q.sentence.ko;
        document.getElementById('quiz-fill-input').value = '';
        document.getElementById('fill-feedback').style.display = 'none';
        document.getElementById('quiz-fill-input').focus();
    }
}

function handleQuizAnswer(btn, selected, answer, container) {
    const buttons = container.querySelectorAll('.quiz-option');
    buttons.forEach(b => {
        b.disabled = true;
        if (b.textContent === answer) {
            b.classList.add('correct');
        }
    });

    const isCorrect = selected === answer;
    if (!isCorrect) {
        btn.classList.add('wrong');
        testWrongList.push(testQuestions[testIndex].sentence);
    } else {
        testScore++;
    }

    // Update spaced rep
    const sid = testQuestions[testIndex].sentence.id;
    const prog = getProgress(sid);
    if (prog.box > 0) {
        setProgress(sid, prog.box, isCorrect);
    }

    // Auto advance after delay
    setTimeout(() => {
        testIndex++;
        showTestQuestion();
    }, isCorrect ? 600 : 1500);
}

function submitFillAnswer() {
    const q = testQuestions[testIndex];
    const input = document.getElementById('quiz-fill-input').value.trim();
    const feedback = document.getElementById('fill-feedback');

    if (!input) return;

    const isCorrect = input.toLowerCase() === q.answer.toLowerCase();

    feedback.style.display = '';
    feedback.className = 'fill-feedback ' + (isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
        testScore++;
        feedback.textContent = '✅ 정답!';
    } else {
        testWrongList.push(q.sentence);
        feedback.innerHTML = `❌ 오답! 정답: <strong>${q.answer}</strong><br>${q.sentence.en}`;
    }

    // Update spaced rep
    const prog = getProgress(q.sentence.id);
    if (prog.box > 0) {
        setProgress(q.sentence.id, prog.box, isCorrect);
    }

    setTimeout(() => {
        testIndex++;
        showTestQuestion();
    }, isCorrect ? 800 : 2000);
}

// Enter key for fill-in-the-blank
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('quiz-fill').style.display !== 'none') {
        submitFillAnswer();
    }
});

function showTestResults() {
    document.getElementById('test-in-progress').style.display = 'none';
    document.getElementById('test-results').style.display = '';
    document.getElementById('test-progress-bar').style.width = '100%';

    const total = testQuestions.length;
    const percent = Math.round((testScore / total) * 100);

    document.getElementById('test-score').textContent = testScore;
    document.getElementById('test-score-total').textContent = total;
    document.getElementById('test-score-percent').textContent = percent + '%';

    // Icon based on score
    if (percent >= 90) {
        document.getElementById('test-result-icon').textContent = '🏆';
        document.getElementById('test-result-title').textContent = '완벽해요!';
    } else if (percent >= 70) {
        document.getElementById('test-result-icon').textContent = '👏';
        document.getElementById('test-result-title').textContent = '잘했어요!';
    } else if (percent >= 50) {
        document.getElementById('test-result-icon').textContent = '💪';
        document.getElementById('test-result-title').textContent = '조금만 더!';
    } else {
        document.getElementById('test-result-icon').textContent = '📚';
        document.getElementById('test-result-title').textContent = '복습이 필요해요';
    }

    // Wrong list
    const wrongItems = document.getElementById('test-wrong-items');
    wrongItems.innerHTML = '';
    if (testWrongList.length === 0) {
        document.getElementById('test-wrong-list').style.display = 'none';
    } else {
        document.getElementById('test-wrong-list').style.display = '';
        testWrongList.forEach(s => {
            const div = document.createElement('div');
            div.className = 'wrong-item';
            div.innerHTML = `
        <div class="wrong-en">${s.en}</div>
        <div class="wrong-ko">${s.ko}</div>
      `;
            div.onclick = () => speak(s.id, s.en);
            div.style.cursor = 'pointer';
            wrongItems.appendChild(div);
        });
    }
}

function exitTest() {
    document.getElementById('test-setup').style.display = '';
    document.getElementById('test-in-progress').style.display = 'none';
    document.getElementById('test-results').style.display = 'none';
    showScreen('home');
}

// ---- Starred Sentences (즐겨찾기 보관함) ----
function toggleStar(sentenceId, event) {
    if (event) event.stopPropagation();

    const idx = appState.starredSentences.indexOf(sentenceId);
    if (idx === -1) {
        appState.starredSentences.push(sentenceId);
    } else {
        appState.starredSentences.splice(idx, 1);
    }
    saveState();

    // UI 업데이트 (현재 떠있는 카드별 ID 비교)
    updateStarUI(sentenceId);
}

function updateStarUI(sentenceId) {
    const isStarred = appState.starredSentences.includes(sentenceId);
    const starEls = document.querySelectorAll(`.star-btn[data-id="${sentenceId}"]`);

    starEls.forEach(el => {
        if (isStarred) {
            el.classList.add('active');
            el.innerHTML = '⭐';
        } else {
            el.classList.remove('active');
            el.innerHTML = '☆';
        }
    });

    // 만약 보관함 화면에 있다면 리스트 갱신
    if (currentScreen === 'starred') {
        renderStarredList();
    }
}

function renderStarredList() {
    const list = document.getElementById('starred-list');
    if (!list) return;

    list.innerHTML = '';
    const starredIds = appState.starredSentences || [];

    document.getElementById('starred-count').textContent = starredIds.length;

    if (starredIds.length === 0) {
        list.innerHTML = '<div class="empty-state-small">즐겨찾기한 문장이 없습니다.</div>';
        return;
    }

    // ID 리스트를 기반으로 실제 데이터 매핑
    const starredSentences = starredIds.map(id => ACTIVE_SENTENCES.find(s => s.id === id)).filter(Boolean);

    starredSentences.forEach((card, idx) => {
        const item = document.createElement('div');
        item.className = 'preview-item'; // 재사용 가능한 디자인 패턴 활용
        item.innerHTML = `
            <div class="preview-num" style="background: rgba(255,171,64,0.1); color: var(--accent-orange);">${idx + 1}</div>
            <div class="preview-text">
                <div class="preview-en">${card.en}</div>
                <div class="preview-ko">${card.ko}</div>
            </div>
            <button class="tts-btn" onclick="speak(${card.id}, '${card.en.replace(/'/g, "\\'")}')">
                🔊
            </button>
            <button class="icon-btn star-btn active" data-id="${card.id}" onclick="toggleStar(${card.id}, event)" style="margin-left: 8px; font-size: 20px;">
                ⭐
            </button>
        `;
        list.appendChild(item);
    });
}

// ---- Stats Screen ----
function renderStats() {
    const total = ACTIVE_SENTENCES.length;
    const boxCounts = [0, 0, 0, 0, 0, 0]; // box 0-5

    // 마스터 맵 렌더링
    const mapScroll = document.getElementById('master-map-scroll');
    if (mapScroll) {
        mapScroll.innerHTML = '';
        const days = getUniqueDays().sort((a, b) => a - b);
        days.forEach(day => {
            const daySents = getSentencesByDay(day);
            let learned = 0, mastered = 0;
            daySents.forEach(s => {
                const p = appState.progress[s.id];
                if (p && p.box > 0) learned++;
                if (p && p.box === 5) mastered++;
            });
            let cls = '';
            if (mastered === daySents.length && daySents.length > 0) cls = 'mastered';
            else if (learned > 0) cls = 'in-progress';
            const node = document.createElement('div');
            node.className = `map-node ${cls}`;
            node.innerHTML = `<div class="map-circle">${day}</div><div class="map-label">Day ${day}</div>`;
            node.onclick = () => { showScreen('learn'); startLearnDay(day); };
            mapScroll.appendChild(node);
        });
    }

    for (const id in appState.progress) {
        const box = appState.progress[id].box;
        if (box >= 0 && box <= 5) {
            boxCounts[box]++;
        }
    }

    const mastered = boxCounts[5];
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;

    document.getElementById('stats-percent').textContent = percent + '%';

    // Circle
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percent / 100) * circumference;
    document.getElementById('stats-circle-fill').style.strokeDashoffset = offset;

    // Box bars
    for (let i = 1; i <= 5; i++) {
        const barPercent = total > 0 ? (boxCounts[i] / total * 100) : 0;
        document.getElementById(`stats-box${i}`).textContent = boxCounts[i];
        document.getElementById(`stats-box${i}-bar`).style.width = barPercent + '%';
    }

    // Hard sentences (most wrong count)
    const hardList = document.getElementById('stats-hard-list');
    const allProgress = Object.entries(appState.progress)
        .filter(([id, p]) => p.wrongCount > 0)
        .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
        .slice(0, 10);

    if (allProgress.length === 0) {
        hardList.innerHTML = '<div class="empty-state-small">아직 데이터가 없습니다</div>';
    } else {
        hardList.innerHTML = '';
        allProgress.forEach(([id, prog], idx) => {
            const sentence = ACTIVE_SENTENCES.find(s => s.id === parseInt(id));
            if (!sentence) return;

            const div = document.createElement('div');
            div.className = 'hard-item';
            div.innerHTML = `
        <div class="hard-rank">${idx + 1}</div>
        <div class="hard-text">
          <div class="hard-en">${sentence.en}</div>
          <div>${sentence.ko}</div>
        </div>
        <div class="hard-count">${prog.wrongCount}회</div>
      `;
            div.style.cursor = 'pointer';
            div.onclick = () => speak(sentence.id, sentence.en);
            hardList.appendChild(div);
        });
    }
}

function addSVGGradient() {
    // Add SVG gradient definition for the stats circle
    const svg = document.querySelector('.stats-circle');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'statsGradient');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#667eea');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#764ba2');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.insertBefore(defs, svg.firstChild);
}

function confirmReset() {
    if (confirm('정말 모든 학습 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        appState = { progress: {}, streak: 0, lastStudyDate: null, testHistory: [], starredSentences: [] };
        saveState();
        renderHome();
        renderStats();
        alert('학습 데이터가 초기화되었습니다.');
    }
}

// ---- ⭐ 즐겨찾기 (내 단어장) ----
function toggleStar(id, event) {
    if (event) event.stopPropagation();
    if (!appState.starredSentences) appState.starredSentences = [];
    const idx = appState.starredSentences.indexOf(id);
    if (idx === -1) {
        appState.starredSentences.push(id);
    } else {
        appState.starredSentences.splice(idx, 1);
    }
    saveState();
    updateStarUI(id);
}

function updateStarUI(id) {
    if (!appState.starredSentences) appState.starredSentences = [];
    const isStarred = appState.starredSentences.includes(id);
    // 학습 카드 별표 버튼
    const learnStar = document.querySelector('#learn-card .star-btn');
    if (learnStar) {
        learnStar.textContent = isStarred ? '⭐' : '☆';
        learnStar.setAttribute('data-id', id);
        learnStar.classList.toggle('active', isStarred);
    }
    // 복습 카드 별표 버튼
    const reviewStar = document.querySelector('#review-card .star-btn');
    if (reviewStar) {
        reviewStar.textContent = isStarred ? '⭐' : '☆';
        reviewStar.setAttribute('data-id', id);
        reviewStar.classList.toggle('active', isStarred);
    }
}

function renderStarredList() {
    if (!appState.starredSentences) appState.starredSentences = [];
    const list = document.getElementById('starred-list');
    const countEl = document.getElementById('starred-count');
    if (!list) return;

    const starred = appState.starredSentences
        .map(id => ACTIVE_SENTENCES.find(s => s.id === id))
        .filter(Boolean);

    if (countEl) countEl.textContent = starred.length;

    if (starred.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px; text-align:center;">
                <div class="empty-icon">⭐</div>
                <h3>아직 저장된 문장이 없어요</h3>
                <p>플래시카드에서 별표 버튼을 눌러<br>중요한 문장을 추가해보세요!</p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    starred.forEach((card, idx) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <div class="preview-num">${idx + 1}</div>
            <div class="preview-text">
                <div class="preview-en">${card.en}</div>
                <div class="preview-ko">${card.ko}</div>
            </div>
            <button class="tts-btn" onclick="speak(${card.id}, '${card.en.replace(/'/g, "\\'")}')">🔊</button>
            <button class="tts-btn" style="margin-left:4px; color: var(--accent-orange, #ffab40);" onclick="toggleStar(${card.id}, event); renderStarredList();">☆ 삭제</button>
        `;
        list.appendChild(item);
    });
}

// ---- 🏆 마스터 문장 목록 ----
function showMasteredList() {
    const mastered = Object.entries(appState.progress)
        .filter(([id, p]) => p.box >= 5)
        .map(([id]) => ACTIVE_SENTENCES.find(s => s.id === parseInt(id)))
        .filter(Boolean);

    const existing = document.getElementById('screen-mastered');
    if (existing) existing.remove();

    const screen = document.createElement('div');
    screen.id = 'screen-mastered';
    screen.className = 'screen active';
    screen.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:var(--bg-primary);overflow-y:auto;padding-bottom:80px;';

    let html = `
        <div class="learn-header" style="position:sticky;top:0;z-index:10;background:var(--bg-primary);">
            <button class="back-btn" onclick="history.back()">← 뒤로</button>
            <h2>🏆 마스터 문장</h2>
            <div class="learn-progress">${mastered.length}문장</div>
        </div>
        <div class="preview-list" style="padding:12px 16px;">
    `;

    mastered.forEach((card, idx) => {
        html += `
            <div class="preview-item">
                <div class="preview-num">${idx + 1}</div>
                <div class="preview-text">
                    <div class="preview-en">${card.en}</div>
                    <div class="preview-ko">${card.ko}</div>
                </div>
                <button class="tts-btn" onclick="speak(${card.id}, '${card.en.replace(/'/g, "\\'")}')">🔊</button>
            </div>`;
    });

    html += '</div>';
    screen.innerHTML = html;
    document.getElementById('app').appendChild(screen);
    // 마스터 목록도 모바일 뒤로가기 대응
    history.pushState({ modal: 'mastered' }, 'mastered', '#mastered');
}

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (!appState.progress) appState.progress = {};
    if (!appState.testHistory) appState.testHistory = [];
    if (!appState.starredSentences) appState.starredSentences = []; // 즐겨찾기 보장

    renderHome();
    addSVGGradient();

    // Swipe Listeners Initialization (탭=플립, 스와이프=넘기기 단일 핸들러)
    initSwipeListeners('learn-card', markCard, flipCard);
    initSwipeListeners('review-card', markReviewCard, flipReviewCard);

    // 최초 구동 시 현재 화면(홈) 상태를 히스토리 0번지에 꽂음
    history.replaceState({ screen: 'home' }, 'home', '#home');
});

// ---- Guide Modal ----
function showGuide() {
    document.getElementById('guide-overlay').style.display = 'flex';
    // 모달을 띄울 때도 가상 히스토리를 꽂아넣어, 뒤로가기 누르면 팝업만 꺼지게 함
    history.pushState({ modal: 'guide' }, 'guide', '#guide');
}

function closeGuide(popHistory = true) {
    document.getElementById('guide-overlay').style.display = 'none';
    localStorage.setItem('guide_seen_' + (currentCourse || 'eps'), 'true');
    // 사용자가 X버튼으로 닫은 경우에만 히스토리 백 강제 실행 (물리 뒤로가기로 닫힌 경우는 패스)
    if (popHistory) {
        if (history.state && history.state.modal === 'guide') {
            history.back();
        }
    }
}

// ---- Undo (Learn) ----
function undoLearnCard() {
    if (learnHistory.length === 0) return;

    const last = learnHistory.pop();

    // 카운터 복원
    if (last.wasKnown) {
        learnKnown--;
    } else {
        learnUnknown--;
        const ukIdx = learnUnknownList.indexOf(last.id);
        if (ukIdx !== -1) learnUnknownList.splice(ukIdx, 1);
    }

    // 진행률 복원
    currentLearnIndex--;

    // 이전 상태로 복원 (box, wrongCount, lastReview)
    if (appState.progress[last.id]) {
        appState.progress[last.id].box = last.prevBox;
        appState.progress[last.id].wrongCount = last.prevWrongCount;
        appState.progress[last.id].lastReview = last.prevLastReview;
    }

    // 세션 저장 목록에서도 제거
    if (appState.learnSession && appState.learnSession[currentLearnDay]) {
        const idx = appState.learnSession[currentLearnDay].lastIndexOf(last.id);
        if (idx !== -1) appState.learnSession[currentLearnDay].splice(idx, 1);
    }
    saveState();

    // 카드 다시 표시
    showLearnCard();

    // Undo 버튼 숨김 처리
    const undoBtn = document.getElementById('learn-undo-btn');
    if (undoBtn) undoBtn.style.display = learnHistory.length > 0 ? '' : 'none';
}

// ---- Undo (Review) ----
function undoReviewCard() {
    if (reviewHistory.length === 0) return;

    const last = reviewHistory.pop();

    // 카운터 복원
    if (last.wasCorrect) {
        reviewCorrect--;
    } else {
        reviewWrong--;
    }

    // 진행률 복원
    reviewIndex--;

    // 이전 상태로 복원
    if (appState.progress[last.id]) {
        appState.progress[last.id].box = last.prevBox;
        appState.progress[last.id].wrongCount = last.prevWrongCount;
        appState.progress[last.id].lastReview = last.prevLastReview;
    }
    saveState();

    // 카드 다시 표시
    showReviewCard();

    // Undo 버튼 숨김 처리
    const undoBtn = document.getElementById('review-undo-btn');
    if (undoBtn) undoBtn.style.display = reviewHistory.length > 0 ? '' : 'none';
}

// ---- Toast 알림 ----
function showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

// ==========================================
// 🎧 듣기 모드 (Day 전체 자동 재생)
// Phase 1: 영어 3회 반복 (모든 문장)
// Phase 2: 영어 1회 + 한국어 1회 (모든 문장)
// ==========================================

let listenSentences = [];
let listenPhase = 1;        // 1 or 2
let listenSentIdx = 0;      // 현재 문장 인덱스
let listenRepeat = 0;       // Phase1에서 현재 반복 횟수 (0,1,2)
let listenSubStep = 0;      // Phase2에서 0=EN, 1=KO
let listenPaused = false;
let listenActive = false;
let listenAudio = null;     // 현재 재생 중인 Audio 객체
let listenDay = 0;
let listenTimeout = null;

function startListenMode() {
    if (!currentLearnCards || currentLearnCards.length === 0) return;

    listenSentences = [...currentLearnCards].sort((a, b) => a.id - b.id);
    listenDay = currentLearnDay;
    listenPhase = 1;
    listenSentIdx = 0;
    listenRepeat = 0;
    listenSubStep = 0;
    listenPaused = false;
    listenActive = true;

    // UI 표시
    document.getElementById('listen-overlay').style.display = 'flex';
    document.getElementById('listen-title').textContent = `🎧 Day ${listenDay} 듣기`;
    document.getElementById('listen-play-btn').textContent = '⏸';

    updateListenUI();
    playCurrentListenStep();
}

function stopListenMode() {
    listenActive = false;
    listenPaused = false;
    if (listenAudio) { listenAudio.pause(); listenAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }
    document.getElementById('listen-overlay').style.display = 'none';
}

function toggleListenPause() {
    if (!listenActive) return;
    listenPaused = !listenPaused;
    document.getElementById('listen-play-btn').textContent = listenPaused ? '▶' : '⏸';

    if (listenPaused) {
        if (listenAudio) listenAudio.pause();
        if ('speechSynthesis' in window) window.speechSynthesis.pause();
        if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }
    } else {
        if (listenAudio) listenAudio.play().catch(() => { });
        if ('speechSynthesis' in window) window.speechSynthesis.resume();
        // 만약 오디오 없이 대기 중이었다면 다시 재생
        if (!listenAudio && !window.speechSynthesis.speaking) {
            playCurrentListenStep();
        }
    }
}

function listenNext() {
    if (!listenActive) return;
    if (listenAudio) { listenAudio.pause(); listenAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }

    // 다음 문장으로
    listenRepeat = 0;
    listenSubStep = 0;
    listenSentIdx++;
    if (listenSentIdx >= listenSentences.length) {
        if (listenPhase === 1) {
            // Phase 2로 전환
            listenPhase = 2;
            listenSentIdx = 0;
        } else {
            // 완료
            finishListenMode();
            return;
        }
    }
    updateListenUI();
    if (!listenPaused) playCurrentListenStep();
}

function listenPrev() {
    if (!listenActive) return;
    if (listenAudio) { listenAudio.pause(); listenAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }

    listenRepeat = 0;
    listenSubStep = 0;
    if (listenSentIdx > 0) listenSentIdx--;
    updateListenUI();
    if (!listenPaused) playCurrentListenStep();
}

function updateListenUI() {
    const sent = listenSentences[listenSentIdx];
    if (!sent) return;

    document.getElementById('listen-en').textContent = sent.en;
    document.getElementById('listen-ko').textContent = sent.ko;

    if (listenPhase === 1) {
        document.getElementById('listen-phase').textContent = 'Phase 1: 영어 3회 반복';
        document.getElementById('listen-repeat').textContent = `반복 ${listenRepeat + 1} / 3`;
    } else {
        document.getElementById('listen-phase').textContent = 'Phase 2: 영어 + 한국어';
        document.getElementById('listen-repeat').textContent = listenSubStep === 0 ? '🔊 English' : '🔊 한국어';
    }

    // 전체 진행도 계산
    const total = listenSentences.length;
    let progress;
    if (listenPhase === 1) {
        progress = (listenSentIdx / total) * 50; // Phase1 = 0~50%
    } else {
        progress = 50 + (listenSentIdx / total) * 50; // Phase2 = 50~100%
    }
    document.getElementById('listen-progress-bar').style.width = progress + '%';
    document.getElementById('listen-count').textContent =
        `${listenPhase === 1 ? listenSentIdx + 1 : total + listenSentIdx + 1} / ${total * 2}`;
}

function playCurrentListenStep() {
    if (!listenActive || listenPaused) return;
    const sent = listenSentences[listenSentIdx];
    if (!sent) return;

    updateListenUI();

    if (listenPhase === 1) {
        // Phase 1: 영어 3회
        playEnglishAudio(sent, () => {
            if (!listenActive || listenPaused) return;
            listenRepeat++;
            if (listenRepeat < 3) {
                // 0.8초 간격 후 다음 반복
                updateListenUI();
                listenTimeout = setTimeout(() => playCurrentListenStep(), 800);
            } else {
                // 3회 완료 → 다음 문장 (1.5초 간격)
                listenRepeat = 0;
                listenSentIdx++;
                if (listenSentIdx >= listenSentences.length) {
                    // Phase 2로 전환
                    listenPhase = 2;
                    listenSentIdx = 0;
                    listenSubStep = 0;
                    updateListenUI();
                    showToast('🎧 Phase 2: 영어 + 한국어');
                    listenTimeout = setTimeout(() => playCurrentListenStep(), 2000);
                } else {
                    updateListenUI();
                    listenTimeout = setTimeout(() => playCurrentListenStep(), 1500);
                }
            }
        });
    } else {
        // Phase 2: 영어 1회 → 한국어 1회
        if (listenSubStep === 0) {
            playEnglishAudio(sent, () => {
                if (!listenActive || listenPaused) return;
                listenSubStep = 1;
                updateListenUI();
                listenTimeout = setTimeout(() => playCurrentListenStep(), 800);
            });
        } else {
            playKoreanTTS(sent.ko, () => {
                if (!listenActive || listenPaused) return;
                listenSubStep = 0;
                listenSentIdx++;
                if (listenSentIdx >= listenSentences.length) {
                    finishListenMode();
                } else {
                    updateListenUI();
                    listenTimeout = setTimeout(() => playCurrentListenStep(), 1500);
                }
            });
        }
    }
}

function playEnglishAudio(sent, onEnd) {
    const audioPath = `audio/${sent.id}.mp3`;
    listenAudio = new Audio(audioPath);
    listenAudio.onended = () => { listenAudio = null; onEnd(); };
    listenAudio.onerror = () => {
        // MP3 실패 → SpeechSynthesis 폴백
        listenAudio = null;
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(sent.en);
            u.lang = 'en-US';
            u.rate = 0.85;
            u.onend = onEnd;
            window.speechSynthesis.speak(u);
        } else {
            onEnd();
        }
    };
    listenAudio.play().catch(() => {
        listenAudio = null;
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(sent.en);
            u.lang = 'en-US';
            u.rate = 0.85;
            u.onend = onEnd;
            window.speechSynthesis.speak(u);
        } else {
            onEnd();
        }
    });
}

function playKoreanTTS(text, onEnd) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        u.rate = 0.9;
        u.onend = onEnd;
        window.speechSynthesis.speak(u);
    } else {
        onEnd();
    }
}

function finishListenMode() {
    document.getElementById('listen-progress-bar').style.width = '100%';
    document.getElementById('listen-phase').textContent = '✅ 듣기 완료!';
    document.getElementById('listen-en').textContent = '🎉';
    document.getElementById('listen-ko').textContent = `Day ${listenDay} 전체 듣기가 끝났습니다.`;
    document.getElementById('listen-repeat').textContent = '';
    document.getElementById('listen-count').textContent = '';
    document.getElementById('listen-play-btn').textContent = '▶';
    listenActive = false;
    showToast('🎧 듣기 모드 완료!');
}
