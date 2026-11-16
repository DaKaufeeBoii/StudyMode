// StudyMode - Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  const state = {
    allQuestions: window.QUESTIONS_DATA || [],
    activeUnit: 'all', // 'all', 1, 2, 3, 4, 5
    activeMarks: 'all', // 'all', '5', '10'
    searchQuery: '',
    globalView: 'simple', // 'simple', 'technical', 'split'
    cardViews: {}, // qid -> view
    activeQid: null,
    mastered: new Set(JSON.parse(localStorage.getItem('sm_mastered') || '[]')),
    scratchNotes: JSON.parse(localStorage.getItem('sm_scratchpad') || '{}'),
    theme: localStorage.getItem('sm_theme') || 'dark',
    zenMode: false,
    
    // Pomodoro
    pomoTimeLeft: 25 * 60,
    pomoRunning: false,
    pomoInterval: null,
    pomoMode: 'work' // 'work' (25m) or 'break' (5m)
  };

  // Set initial theme
  document.documentElement.setAttribute('data-theme', state.theme);

  // Set initial active question
  if (state.allQuestions.length > 0) {
    state.activeQid = state.allQuestions[0].id;
  }

  // --- DOM REFS ---
  const dom = {
    sidebarList: document.getElementById('questionNavList'),
    contentArea: document.getElementById('studyViewport'),
    contentScroll: document.getElementById('contentScrollArea'),
    searchInput: document.getElementById('searchInput'),
    mobileNavToggle: document.getElementById('mobileSidebarToggle'),
    sidebar: document.getElementById('sidebar'),
    unitPills: document.querySelectorAll('.unit-filter-scroll .filter-pill'),
    marksBtns: document.querySelectorAll('.marks-toggle-group .marks-btn'),
    globalViewBtns: document.querySelectorAll('.view-switch-group .view-btn'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressStat: document.getElementById('progressStat'),
    
    // Tools
    themeBtn: document.getElementById('themeToggleBtn'),
    zenBtn: document.getElementById('zenToggleBtn'),
    formulaModalBtn: document.getElementById('formulaVaultBtn'),
    scheduleModalBtn: document.getElementById('scheduleBtn'),
    
    // Modals
    formulaModal: document.getElementById('formulaModal'),
    formulaModalClose: document.getElementById('formulaModalClose'),
    scheduleModal: document.getElementById('scheduleModal'),
    scheduleModalClose: document.getElementById('scheduleModalClose'),
    
    // Pomodoro
    pomoDisplay: document.getElementById('pomoDisplay'),
    pomoToggleBtn: document.getElementById('pomoToggleBtn'),
    pomoResetBtn: document.getElementById('pomoResetBtn'),
    
    // Audio
    audioPlayBtn: document.getElementById('audioPlayBtn'),
    audioModeSelect: document.getElementById('audioModeSelect'),
    audioVolSlider: document.getElementById('audioVolSlider'),
    ambientVinylBtn: document.getElementById('ambientVinylBtn'),
    ambientRainBtn: document.getElementById('ambientRainBtn')
  };

  // --- FILTER QUESTIONS ---
  function getFilteredQuestions() {
    return state.allQuestions.filter(q => {
      // Unit filter
      if (state.activeUnit !== 'all' && q.unit !== parseInt(state.activeUnit, 10)) {
        return false;
      }
      // Marks filter
      if (state.activeMarks === '5' && !q.marks.includes('05') && !q.marks.includes('5')) {
        return false;
      }
      if (state.activeMarks === '10' && !q.marks.includes('10')) {
        return false;
      }
      // Search filter
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        const inTitle = q.title.toLowerCase().includes(query);
        const inNum = q.q_num.toLowerCase().includes(query);
        const inPlain = (q.plain_english || '').toLowerCase().includes(query);
        const inBlooms = (q.blooms || '').toLowerCase().includes(query);
        if (!inTitle && !inNum && !inPlain && !inBlooms) return false;
      }
      return true;
    });
  }

  // --- RENDER SIDEBAR LIST ---
  function renderSidebar() {
    const questions = getFilteredQuestions();
    dom.sidebarList.innerHTML = '';

    if (questions.length === 0) {
      dom.sidebarList.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-dim); font-size: 0.85rem;">
          No questions matched your search or filters.
        </div>`;
      return;
    }

    questions.forEach(q => {
      const isMastered = state.mastered.has(q.id);
      const isActive = q.id === state.activeQid;
      const is10M = q.marks.includes('10');

      const item = document.createElement('div');
      item.className = `question-nav-item ${isActive ? 'active' : ''} ${isMastered ? 'mastered' : ''}`;
      item.id = `nav_${q.id}`;

      item.innerHTML = `
        <input type="checkbox" class="q-check-box" data-qid="${q.id}" ${isMastered ? 'checked' : ''} title="Mark as mastered">
        <div class="q-nav-details">
          <div class="q-nav-top">
            <span class="q-nav-id">U${q.unit} • ${q.q_num}</span>
            <span class="q-nav-marks ${is10M ? 'badge-10m' : 'badge-5m'}">${q.marks}</span>
          </div>
          <div class="q-nav-title" title="${q.title}">${q.title}</div>
        </div>
      `;

      // Checkbox click
      const cb = item.querySelector('.q-check-box');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMastered(q.id);
      });

      // Item click (scroll to card)
      item.addEventListener('click', () => {
        state.activeQid = q.id;
        document.querySelectorAll('.question-nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        scrollToQuestion(q.id);

        // Auto-close mobile sidebar on selection
        if (dom.sidebar && dom.sidebar.classList.contains('mobile-open')) {
          dom.sidebar.classList.remove('mobile-open');
        }
      });

      dom.sidebarList.appendChild(item);
    });

    updateProgress();
  }

  // --- RENDER MAIN CONTENT ---
  function renderContent() {
    const questions = getFilteredQuestions();
    dom.contentArea.innerHTML = '';

    if (questions.length === 0) {
      dom.contentArea.innerHTML = `
        <div class="study-card" style="text-align: center; padding: 3rem;">
          <h2 style="margin-bottom: 0.5rem; color: var(--text-muted);">No Questions Found</h2>
          <p style="color: var(--text-dim);">Try clearing your search query or switching unit filters.</p>
        </div>`;
      return;
    }

    questions.forEach(q => {
      const card = createQuestionCard(q);
      dom.contentArea.appendChild(card);
    });

    // Re-render KaTeX if available
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(dom.contentArea, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      } catch (err) {
        console.warn("KaTeX render error:", err);
      }
    }
  }

  // --- CREATE QUESTION CARD ELEMENT ---
  function createQuestionCard(q) {
    const card = document.createElement('article');
    card.className = 'study-card';
    card.id = `card_${q.id}`;

    const is10M = q.marks.includes('10');
    const isMastered = state.mastered.has(q.id);
    const viewMode = state.cardViews[q.id] || state.globalView;
    const scratchContent = state.scratchNotes[q.id] || '';

    // Build Checklist Items
    const checklistHtml = (q.checklist || []).map(c => `<li>${c}</li>`).join('');

    card.innerHTML = `
      <div class="card-header-bar">
        <div class="card-title-block">
          <div class="card-unit-crumb">${q.unit_title} • ${q.q_num}</div>
          <h2 class="card-question-title">${q.title}</h2>
        </div>
        <div class="card-actions-block">
          <div class="card-badges">
            <span class="badge ${is10M ? 'badge-10m' : 'badge-5m'}">${q.marks}</span>
            <span class="badge badge-bloom">${q.blooms}</span>
          </div>
          <button class="btn-mastered ${isMastered ? 'mastered' : ''}" data-qid="${q.id}">
            <span>${isMastered ? '✓ Mastered' : '○ Mark Mastered'}</span>
          </button>
        </div>
      </div>

      <!-- LOCAL VIEW SWITCHER -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div class="card-view-tabs" data-qid="${q.id}">
          <button class="card-tab-btn ${viewMode === 'simple' ? 'active' : ''}" data-view="simple">💡 Simple</button>
          <button class="card-tab-btn ${viewMode === 'technical' ? 'active' : ''}" data-view="technical">📐 Technical</button>
          <button class="card-tab-btn ${viewMode === 'split' ? 'active' : ''}" data-view="split">⚖️ Split View</button>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">
          Bloom's Taxonomy: <strong>${q.blooms}</strong>
        </div>
      </div>

      <!-- BODY VIEWS -->
      <div class="card-body-host" data-qid="${q.id}">
        ${renderCardBodyContent(q, viewMode, checklistHtml)}
      </div>

      <!-- SCRATCHPAD FOR ACTIVE RECALL -->
      <div class="card-scratchpad-area">
        <button class="scratchpad-toggle-btn" data-qid="${q.id}">
          ✏️ <span>Practice Scratchpad (Scribble formulas & outline)</span>
        </button>
        <div class="scratchpad-box ${scratchContent ? 'open' : ''}" id="scratchBox_${q.id}">
          <textarea class="scratchpad-textarea" data-qid="${q.id}" placeholder="Jot down the key formula, diagram sketch notes, or 3-4 bullet headings from memory...">${scratchContent}</textarea>
          <div class="scratchpad-hint">Auto-saved to your browser. Use this to practice retrieving keywords without peeking!</div>
        </div>
      </div>
    `;

    // Bind card tab buttons
    card.querySelectorAll('.card-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newView = btn.dataset.view;
        state.cardViews[q.id] = newView;
        card.querySelectorAll('.card-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const host = card.querySelector(`.card-body-host[data-qid="${q.id}"]`);
        host.innerHTML = renderCardBodyContent(q, newView, checklistHtml);

        if (window.renderMathInElement) {
          window.renderMathInElement(host, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\(', right: '\\)', display: false},
              {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
          });
        }
      });
    });

    // Bind mastered button
    const masterBtn = card.querySelector('.btn-mastered');
    masterBtn.addEventListener('click', () => {
      toggleMastered(q.id);
    });

    // Bind scratchpad toggle
    const scratchToggle = card.querySelector('.scratchpad-toggle-btn');
    const scratchBox = card.querySelector(`#scratchBox_${q.id}`);
    scratchToggle.addEventListener('click', () => {
      scratchBox.classList.toggle('open');
    });

    // Bind scratchpad textarea auto-save
    const textarea = card.querySelector('.scratchpad-textarea');
    textarea.addEventListener('input', (e) => {
      state.scratchNotes[q.id] = e.target.value;
      localStorage.setItem('sm_scratchpad', JSON.stringify(state.scratchNotes));
    });

    return card;
  }

  // --- RENDER CARD BODY HTML ACCORDING TO VIEW MODE ---
  function renderCardBodyContent(q, viewMode, checklistHtml) {
    const simplePart = `
      <div class="simple-view-container">
        <!-- PLAIN ENGLISH CALLOUT -->
        <div class="callout-box plain-english">
          <strong>💡 In Plain English (Real-World Analogy):</strong>
          <p>${q.plain_english}</p>
        </div>

        <!-- EXAMINER CHECKLIST -->
        <div class="callout-box examiner-hook">
          <strong>🎯 Examiner Scoring Checklist (Must-Include Items):</strong>
          <ul class="checklist-items">
            ${checklistHtml}
          </ul>
        </div>

        <!-- SIMPLIFIED ANSWER SECTIONS -->
        <div class="simple-sections-body">
          ${q.simple_sections_html}
        </div>

        <!-- MEMORY TRICK -->
        <div class="callout-box memory-trick">
          <strong>🧠 10-Second Exam Memory Hook:</strong>
          <p>${q.memory_trick}</p>
        </div>
      </div>
    `;

    const technicalPart = `
      <div class="technical-view-container">
        ${q.technical_html}
      </div>
    `;

    if (viewMode === 'simple') {
      return simplePart;
    } else if (viewMode === 'technical') {
      return technicalPart;
    } else {
      // Split mode
      return `
        <div class="split-view-container">
          <div class="split-col">
            <div class="split-header simple">💡 Intuitive / Plain English</div>
            ${simplePart}
          </div>
          <div class="split-col">
            <div class="split-header technical">📐 University Exam Standard</div>
            ${technicalPart}
          </div>
        </div>
      `;
    }
  }

  // --- SCROLL TO QUESTION ---
  function scrollToQuestion(qid) {
    const card = document.getElementById(`card_${qid}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // --- TOGGLE MASTERED STATUS ---
  function toggleMastered(qid) {
    if (state.mastered.has(qid)) {
      state.mastered.delete(qid);
    } else {
      state.mastered.add(qid);
    }
    localStorage.setItem('sm_mastered', JSON.stringify(Array.from(state.mastered)));

    // Update Sidebar
    const navItem = document.getElementById(`nav_${qid}`);
    if (navItem) {
      const cb = navItem.querySelector('.q-check-box');
      const isM = state.mastered.has(qid);
      if (cb) cb.checked = isM;
      navItem.classList.toggle('mastered', isM);
    }

    // Update Card Button
    const card = document.getElementById(`card_${qid}`);
    if (card) {
      const btn = card.querySelector('.btn-mastered');
      const isM = state.mastered.has(qid);
      btn.classList.toggle('mastered', isM);
      btn.innerHTML = `<span>${isM ? '✓ Mastered' : '○ Mark Mastered'}</span>`;
    }

    updateProgress();
  }

  // --- UPDATE PROGRESS BAR & STATS ---
  function updateProgress() {
    const total = state.allQuestions.length;
    const count = state.mastered.size;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    dom.progressBarFill.style.width = `${pct}%`;
    dom.progressStat.textContent = `${count}/${total} Mastered (${pct}%)`;
  }

  // --- EVENT LISTENERS ---

  // Search
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderSidebar();
    renderContent();
  });

  // Unit filter pills
  dom.unitPills.forEach(pill => {
    pill.addEventListener('click', () => {
      dom.unitPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeUnit = pill.dataset.unit;
      renderSidebar();
      renderContent();
    });
  });

  // Marks filter buttons
  dom.marksBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.marksBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeMarks = btn.dataset.marks;
      renderSidebar();
      renderContent();
    });
  });

  // Global View switch buttons
  dom.globalViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.globalViewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.globalView = btn.dataset.view;
      state.cardViews = {}; // reset custom per-card overrides
      
      if (state.globalView === 'split') {
        document.body.classList.add('split-active');
      } else {
        document.body.classList.remove('split-active');
      }

      renderContent();
    });
  });

  // Theme toggle
  const themes = ['dark', 'oled', 'sepia', 'light'];
  dom.themeBtn.addEventListener('click', () => {
    const currIdx = themes.indexOf(state.theme);
    const nextTheme = themes[(currIdx + 1) % themes.length];
    state.theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('sm_theme', nextTheme);
  });

  // Zen Mode toggle
  dom.zenBtn.addEventListener('click', () => {
    state.zenMode = !state.zenMode;
    document.body.classList.toggle('zen-mode', state.zenMode);
    dom.zenBtn.classList.toggle('active', state.zenMode);
  });

  // Mobile sidebar toggle & backdrop
  if (dom.mobileNavToggle && dom.sidebar) {
    dom.mobileNavToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.sidebar.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (dom.sidebar.classList.contains('mobile-open') && !dom.sidebar.contains(e.target) && e.target !== dom.mobileNavToggle) {
        dom.sidebar.classList.remove('mobile-open');
      }
    });
  }

  // --- MODALS ---
  dom.formulaModalBtn.addEventListener('click', () => {
    dom.formulaModal.classList.add('open');
    if (window.renderMathInElement) {
      window.renderMathInElement(dom.formulaModal, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  });

  dom.formulaModalClose.addEventListener('click', () => {
    dom.formulaModal.classList.remove('open');
  });

  dom.scheduleModalBtn.addEventListener('click', () => {
    dom.scheduleModal.classList.add('open');
  });

  dom.scheduleModalClose.addEventListener('click', () => {
    dom.scheduleModal.classList.remove('open');
  });

  window.addEventListener('click', (e) => {
    if (e.target === dom.formulaModal) dom.formulaModal.classList.remove('open');
    if (e.target === dom.scheduleModal) dom.scheduleModal.classList.remove('open');
  });

  // --- POMODORO TIMER ---
  function updatePomoDisplay() {
    const mins = Math.floor(state.pomoTimeLeft / 60);
    const secs = state.pomoTimeLeft % 60;
    dom.pomoDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  dom.pomoToggleBtn.addEventListener('click', () => {
    if (state.pomoRunning) {
      // Pause
      clearInterval(state.pomoInterval);
      state.pomoRunning = false;
      dom.pomoToggleBtn.textContent = '▶';
    } else {
      // Start
      state.pomoRunning = true;
      dom.pomoToggleBtn.textContent = '⏸';
      state.pomoInterval = setInterval(() => {
        if (state.pomoTimeLeft > 0) {
          state.pomoTimeLeft--;
          updatePomoDisplay();
        } else {
          // Timer finished!
          clearInterval(state.pomoInterval);
          state.pomoRunning = false;
          dom.pomoToggleBtn.textContent = '▶';
          if (window.studyAudio) window.studyAudio.playTimerBell();
          
          if (state.pomoMode === 'work') {
            state.pomoMode = 'break';
            state.pomoTimeLeft = 5 * 60;
            alert("⏰ 25-Minute Study Sprint Finished! Stand up, stretch, drink water for 5 minutes.");
          } else {
            state.pomoMode = 'work';
            state.pomoTimeLeft = 25 * 60;
            alert("🔔 Break over! Ready for the next focus sprint?");
          }
          updatePomoDisplay();
        }
      }, 1000);
    }
  });

  dom.pomoResetBtn.addEventListener('click', () => {
    clearInterval(state.pomoInterval);
    state.pomoRunning = false;
    dom.pomoToggleBtn.textContent = '▶';
    state.pomoTimeLeft = (state.pomoMode === 'work' ? 25 : 5) * 60;
    updatePomoDisplay();
  });

  // --- AUDIO WIRING ---
  dom.audioPlayBtn.addEventListener('click', () => {
    if (!window.studyAudio) return;
    const isPlaying = window.studyAudio.togglePlay();
    dom.audioPlayBtn.classList.toggle('playing', isPlaying);
    dom.audioPlayBtn.textContent = isPlaying ? '❚❚' : '▶';
  });

  dom.audioModeSelect.addEventListener('change', (e) => {
    if (window.studyAudio) {
      window.studyAudio.setMode(e.target.value);
    }
  });

  dom.audioVolSlider.addEventListener('input', (e) => {
    if (window.studyAudio) {
      window.studyAudio.setVolume(parseFloat(e.target.value));
    }
  });

  dom.ambientVinylBtn.addEventListener('click', () => {
    if (window.studyAudio) {
      const active = window.studyAudio.toggleVinyl();
      dom.ambientVinylBtn.classList.toggle('active', active);
    }
  });

  dom.ambientRainBtn.addEventListener('click', () => {
    if (window.studyAudio) {
      const active = window.studyAudio.toggleRain();
      dom.ambientRainBtn.classList.toggle('active', active);
    }
  });

  // --- KEYBOARD SHORTCUTS ---
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      dom.audioPlayBtn.click();
    } else if (e.key === 'z' || e.key === 'Z') {
      dom.zenBtn.click();
    } else if (e.key === 'f' || e.key === 'F') {
      dom.formulaModalBtn.click();
    } else if (e.key === 'Escape') {
      dom.formulaModal.classList.remove('open');
      dom.scheduleModal.classList.remove('open');
      if (state.zenMode) dom.zenBtn.click();
    }
  });

  // --- INITIAL RENDER ---
  renderSidebar();
  renderContent();
  updatePomoDisplay();
});
