(() => {
  'use strict';

  const storageKey = 'arbitrationCourseStateV1';
  const totalLessons = 9;
  const state = loadState();

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function loadState() {
    const fallback = { completed: [], bestScore: 0, assignment: '', theme: 'light' };
    try {
      return { ...fallback, ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    saveState();
  }

  const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (!localStorage.getItem(storageKey)) state.theme = preferredTheme;
  setTheme(state.theme);

  $('#themeToggle').addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    showToast(state.theme === 'dark' ? 'تم تشغيل الوضع الليلي.' : 'تم تشغيل الوضع النهاري.');
  });

  // Mobile navigation
  const sidebar = $('#courseSidebar');
  const menuToggle = $('#menuToggle');
  menuToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  $$('.course-nav a').forEach(link => link.addEventListener('click', () => {
    sidebar.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));

  // Search
  const searchPanel = $('#searchPanel');
  const searchInput = $('#siteSearch');
  const searchResults = $('#searchResults');
  const searchableSections = $$('.observed-section');

  function toggleSearch(open) {
    searchPanel.hidden = !open;
    if (open) setTimeout(() => searchInput.focus(), 50);
    else {
      searchInput.value = '';
      searchResults.innerHTML = '';
    }
  }

  $('#searchToggle').addEventListener('click', () => toggleSearch(searchPanel.hidden));
  $('#closeSearch').addEventListener('click', () => toggleSearch(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !searchPanel.hidden) toggleSearch(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      toggleSearch(true);
    }
  });

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      searchResults.innerHTML = '';
      return;
    }
    const results = searchableSections.filter(section => {
      const haystack = `${section.dataset.title || ''} ${section.dataset.search || ''} ${section.textContent}`.toLowerCase();
      return haystack.includes(query);
    });
    searchResults.innerHTML = results.length
      ? results.map(section => `<a href="#${section.id}" data-search-link><strong>${escapeHtml(section.dataset.title)}</strong><small>انتقل إلى هذا المحور</small></a>`).join('')
      : '<p>لا توجد نتيجة مطابقة. جرّب كلمة قانونية أقصر.</p>';
    $$('[data-search-link]', searchResults).forEach(link => link.addEventListener('click', () => toggleSearch(false)));
  });

  // Scrollspy
  const navItems = $$('.nav-item');
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navItems.forEach(item => item.classList.toggle('active', item.dataset.section === visible.target.id));
  }, { rootMargin: '-20% 0px -65% 0px', threshold: [0.05, 0.2, 0.5] });
  searchableSections.forEach(section => observer.observe(section));

  // Course progress
  function updateProgressUI() {
    const completedCount = new Set(state.completed).size;
    const percent = Math.round((completedCount / totalLessons) * 100);
    $('#progressLabel').textContent = `${percent}%`;
    $('#progressBar').style.width = `${percent}%`;
    $('.progress-track').setAttribute('aria-valuenow', String(percent));
    $$('.complete-button').forEach(button => {
      const done = state.completed.includes(button.dataset.complete);
      button.classList.toggle('completed', done);
      button.textContent = done ? '✓ تم إكمال المحور' : 'وضع علامة مكتمل';
    });
    if (percent === 100 && state.bestScore >= 7) $('#certificateCard').hidden = false;
  }

  $$('.complete-button').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.complete;
      state.completed = state.completed.includes(id)
        ? state.completed.filter(item => item !== id)
        : [...state.completed, id];
      saveState();
      updateProgressUI();
      showToast(state.completed.includes(id) ? 'تم تسجيل إكمال المحور.' : 'تم إلغاء علامة الإكمال.');
    });
  });

  $('#resetProgress').addEventListener('click', () => {
    const confirmed = window.confirm('هل تريد حذف علامات الإكمال ونتيجة الاختبار والتكليف المحفوظ؟');
    if (!confirmed) return;
    state.completed = [];
    state.bestScore = 0;
    state.assignment = '';
    saveState();
    $('#assignmentText').value = '';
    updateWordCount();
    $('#certificateCard').hidden = true;
    $('#quizResult').hidden = true;
    updateProgressUI();
    showToast('تمت إعادة ضبط التقدم.');
  });

  // Practice question
  $$('[data-practice] [data-answer]').forEach(button => {
    button.addEventListener('click', () => {
      const box = button.closest('[data-practice]');
      $$('[data-answer]', box).forEach(item => item.classList.remove('correct', 'wrong'));
      const correct = button.dataset.answer === 'correct';
      button.classList.add(correct ? 'correct' : 'wrong');
      $('.practice-feedback', box).textContent = correct
        ? 'صحيح. لا يمكن تثبيت التاريخ دون فحص القاعدة التي عيّنها الاتفاق والنظام المؤسسي والقانون الواجب.'
        : 'الإجابة قاطعة أكثر من اللازم؛ نقطة البدء تتغير بتغير القواعد والاتفاق والقانون.';
    });
  });

  // Accordions
  $$('[data-accordion] .accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const accordion = trigger.closest('[data-accordion]');
      $$('.accordion-item', accordion).forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          $('.accordion-trigger', other).setAttribute('aria-expanded', 'false');
          $('.accordion-trigger b', other).textContent = '+';
        }
      });
      const open = item.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
      $('b', trigger).textContent = open ? '−' : '+';
    });
  });

  // Copy request template
  $('#copyTemplate').addEventListener('click', async () => {
    const template = `طلب التحكيم\n\n1. بيانات الأطراف والتمثيل\n2. اتفاق التحكيم والقواعد الواجبة\n3. عرض موجز للوقائع\n4. أساس المطالبات\n5. الطلبات وقيمة النزاع\n6. تشكيل هيئة التحكيم\n7. قائمة المستندات والمرفقات`;
    try {
      await navigator.clipboard.writeText(template);
      showToast('تم نسخ هيكل طلب التحكيم.');
    } catch {
      showToast('تعذر النسخ التلقائي. يمكنك تحديد النص ونسخه يدويًا.');
    }
  });

  // Party decision flow
  const flowText = {
    signed: 'ابدأ بالتوقيع أو الانضمام الصريح. إن لم توقع الشركة الأم، لا تنتقل تلقائيًا إلى النتيجة؛ افحص الأسس القانونية الأخرى دون افتراض.',
    conduct: 'السلوك في التفاوض أو التنفيذ أو الضمان قد يكون ذا صلة، لكن قيمته تختلف باختلاف القانون والوقائع ولا يكفي مجرد الانتماء إلى مجموعة شركات.',
    law: 'المرحلة الحاسمة هي تحديد القانون أو المنهج الذي يحكم امتداد اتفاق التحكيم، ومدى قابليته للرقابة عند الإبطال أو التنفيذ.'
  };
  $$('[data-flow]').forEach(button => button.addEventListener('click', () => {
    $$('[data-flow]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    $('#flowExplanation').textContent = flowText[button.dataset.flow];
  }));

  // Issue sorter
  const sorterText = {
    jurisdiction: 'التصنيف المبدئي: مسألة اختصاص؛ لأنها تمس وجود الاتفاق أو نطاقه الشخصي أو الموضوعي.',
    admissibility: 'التصنيف المبدئي: مسألة قبول؛ لأنها تمس توقيت أو جاهزية المطالبة، مع ضرورة فحص القانون والصياغة.'
  };
  $$('.sorter-items button').forEach(button => button.addEventListener('click', () => {
    $('#sorterFeedback').textContent = sorterText[button.dataset.category];
    $$('.sorter-items button').forEach(item => item.style.borderColor = '');
    button.style.borderColor = 'var(--gold-500)';
  }));

  // Deadline calculator
  $('#calculateDeadline').addEventListener('click', () => {
    const value = $('#receivedDate').value;
    const days = Number($('#deadlineDays').value);
    if (!value || !Number.isFinite(days) || days < 1) {
      $('#deadlineResult').textContent = 'أدخل تاريخًا صحيحًا وعدد أيام موجبًا.';
      return;
    }
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    const formatted = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(date);
    $('#deadlineResult').textContent = `النتيجة الحسابية الأولية: ${formatted}. راجع قواعد احتساب المدد والعطلات والتمديد.`;
  });

  // PO builder
  $('#generatePO').addEventListener('click', () => {
    const selected = $$('.builder-options input:checked').map(input => input.value);
    if (selected.length < 2) {
      $('#poOutput').textContent = 'اختر بندين على الأقل لتكوين المسودة.';
      return;
    }
    $('#poOutput').textContent = `مسودة موضوعات الأمر الإجرائي الأول\n\n${selected.map((item, index) => `${index + 1}. ${item}.`).join('\n')}\n\nملاحظة: تُستكمل البنود بعد سماع الطرفين ومراعاة الاتفاق والقواعد والقانون.`;
  });

  // Simulation accordion
  $$('.sim-step > button').forEach(button => button.addEventListener('click', () => {
    const current = button.closest('.sim-step');
    $$('.sim-step').forEach(item => item.classList.toggle('active', item === current));
  }));

  // Assignment autosave and download
  const assignmentText = $('#assignmentText');
  assignmentText.value = state.assignment || '';
  function updateWordCount() {
    const words = assignmentText.value.trim() ? assignmentText.value.trim().split(/\s+/).length : 0;
    $('#wordCount').textContent = `${words} كلمة`;
  }
  assignmentText.addEventListener('input', () => {
    state.assignment = assignmentText.value;
    saveState();
    updateWordCount();
  });
  updateWordCount();

  $('#downloadAssignment').addEventListener('click', () => {
    const text = assignmentText.value.trim();
    if (!text) {
      showToast('اكتب تحليلك أولًا قبل التنزيل.');
      return;
    }
    const content = `التكليف المهني – إجراءات التحكيم\n\n${text}\n\nإعداد عبر منصة مختبر التحكيم`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'تكليف-إجراءات-التحكيم.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  // Print guide
  $('#printGuide').addEventListener('click', () => window.print());

  // Quiz
  const questions = [
    {
      q: 'ما المرجع الأول لتحديد تاريخ بدء إجراءات التحكيم؟',
      options: ['تاريخ توقيع العقد فقط', 'اتفاق الأطراف والقواعد والقانون الواجب', 'تاريخ تشكيل الهيئة دائمًا'],
      answer: 1
    },
    {
      q: 'أي وصف أدق لطلب التحكيم؟',
      options: ['حكم تمهيدي في النزاع', 'وثيقة إطلاق الخصومة وتحديد إطارها الأولي', 'مذكرة ختامية نهائية'],
      answer: 1
    },
    {
      q: 'ما أخطر نتيجة محتملة للخطأ في تحديد الطرف؟',
      options: ['زيادة عدد صفحات الملف فقط', 'منازعة في الاختصاص أو التنفيذ', 'تغيير لغة التحكيم تلقائيًا'],
      answer: 1
    },
    {
      q: 'متى ينبغي إثارة دفع الاختصاص؟',
      options: ['في الوقت المحدد بالقواعد والقانون مع تحفظ واضح', 'بعد صدور الحكم فقط', 'لا يثار أمام الهيئة'],
      answer: 0
    },
    {
      q: 'أي مسألة تميل إلى وصف عدم القبول؟',
      options: ['عدم وجود اتفاق تحكيم', 'عدم انقضاء مهلة تفاوض سابقة', 'عدم قابلية النزاع للتحكيم'],
      answer: 1
    },
    {
      q: 'هل إرسال طلب التحكيم يقطع التقادم في جميع النظم؟',
      options: ['نعم دائمًا', 'لا، يلزم فحص القانون والواقعة المنشئة للأثر', 'فقط إذا كان البريد ورقيًا'],
      answer: 1
    },
    {
      q: 'ما الوثيقة التي تضبط عادة تفاصيل سير الخصومة بعد الجلسة الأولى؟',
      options: ['الأمر الإجرائي الأول', 'الحكم النهائي', 'التوكيل العام'],
      answer: 0
    },
    {
      q: 'أي موضوع ينبغي بحثه في الجلسة الإجرائية الأولى؟',
      options: ['المذكرات والإثبات والجلسات والمواعيد', 'الطلبات النهائية وحدها', 'المصاريف الشخصية للمحامين'],
      answer: 0
    },
    {
      q: 'ما الموقف الأدق من إدخال شركة أم غير موقعة؟',
      options: ['تُدخل تلقائيًا لأنها تملك التابعة', 'يجب إثبات أساس قانوني لامتداد الاتفاق', 'لا يمكن إدخال غير الموقع في أي نظام'],
      answer: 1
    },
    {
      q: 'ما معيار التصميم الإجرائي الجيد؟',
      options: ['أكبر عدد ممكن من المذكرات', 'التوازن بين العدالة والكفاءة والتناسب', 'نسخ جدول قضية أخرى دون تعديل'],
      answer: 1
    }
  ];

  function renderQuiz() {
    const form = $('#quizForm');
    form.innerHTML = questions.map((item, index) => `
      <fieldset class="quiz-question">
        <h3>${index + 1}. ${escapeHtml(item.q)}</h3>
        <div class="quiz-options">
          ${item.options.map((option, optionIndex) => `
            <label><input type="radio" name="q${index}" value="${optionIndex}" /> <span>${escapeHtml(option)}</span></label>
          `).join('')}
        </div>
      </fieldset>
    `).join('') + '<button class="quiz-submit" type="submit">اعرض النتيجة</button>';
  }

  $('#startQuiz').addEventListener('click', () => {
    renderQuiz();
    $('#quizIntro').hidden = true;
    $('#quizForm').hidden = false;
    $('#quizResult').hidden = true;
    $('#quizForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#quizForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if ([...Array(questions.length)].some((_, index) => data.get(`q${index}`) === null)) {
      showToast('أجب عن جميع الأسئلة قبل عرض النتيجة.');
      return;
    }
    let score = 0;
    questions.forEach((question, index) => {
      if (Number(data.get(`q${index}`)) === question.answer) score += 1;
    });
    state.bestScore = Math.max(state.bestScore, score);
    saveState();
    const result = $('#quizResult');
    const pass = score >= 7;
    result.hidden = false;
    result.className = `quiz-result ${pass ? 'pass' : 'fail'}`;
    result.innerHTML = `<h3>${score} / ${questions.length}</h3><p>${pass ? 'أحسنت. اجتزت الاختبار بنجاح.' : 'تحتاج إلى مراجعة بعض المحاور ثم إعادة المحاولة.'}</p><button type="button" id="retryQuiz">إعادة الاختبار</button>`;
    $('#retryQuiz').addEventListener('click', () => {
      renderQuiz();
      result.hidden = true;
      $('#quizForm').scrollIntoView({ behavior: 'smooth' });
    });
    if (pass) {
      if (!state.completed.includes('assessment')) state.completed.push('assessment');
      if (new Set(state.completed.filter(id => id !== 'assessment')).size >= totalLessons - 1) $('#certificateCard').hidden = false;
      showToast('تم حفظ أفضل نتيجة لك.');
    }
    updateProgressUI();
  });

  // Certificate print
  $('#printCertificate').addEventListener('click', () => {
    const name = $('#traineeName').value.trim();
    if (!name) {
      showToast('أدخل اسم المتدرب كما سيظهر في الشهادة.');
      return;
    }
    const fragment = $('#certificateTemplate').content.cloneNode(true);
    $('#printTraineeName', fragment).textContent = name;
    $('#printScore', fragment).textContent = `النتيجة: ${state.bestScore}/10`;
    $('#printDate', fragment).textContent = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(new Date());
    const certificate = fragment.querySelector('.print-certificate');
    certificate.classList.add('print-certificate-active');
    document.body.appendChild(certificate);
    document.body.classList.add('printing-certificate');
    setTimeout(() => window.print(), 100);
    setTimeout(() => {
      certificate.remove();
      document.body.classList.remove('printing-certificate');
    }, 1000);
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }


  // Google-style motion layer
  function initMotionLayer() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const topbar = $('.topbar');

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    const updateScrollProgress = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
    };

    let lastY = window.scrollY;
    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        topbar.classList.toggle('is-scrolled', currentY > 16);
        topbar.classList.toggle('is-hidden', currentY > lastY && currentY > 150);
        if (currentY < 24) topbar.classList.remove('is-hidden');
        lastY = currentY;
        updateScrollProgress();
        scrollTicking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateScrollProgress();

    const revealSelector = [
      '.section-heading', '.concept-banner', '.comparison-card', '.timeline-card',
      '.practice-box', '.two-column > *', '.risk-grid > article',
      '.diagnostic-grid > article', '.decision-lab', '.legal-note',
      '.response-map > article', '.strategy-table-wrap', '.split-panel',
      '.issue-sorter', '.warning-box', '.clock-layout > *',
      '.deadline-calculator', '.conference-hero > *', '.agenda-grid > article',
      '.po-builder', '.case-file', '.sim-step', '.assignment-card',
      '.quiz-intro', '.reference-section .section-heading', '.glossary-grid > article'
    ].join(',');

    const revealTargets = $$(revealSelector).filter((item, index, all) => all.indexOf(item) === index);
    revealTargets.forEach((element, index) => {
      element.classList.add('reveal-target');
      element.style.setProperty('--reveal-delay', `${(index % 5) * 55}ms`);
    });

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('in-view', entry.isIntersecting);
      });
    }, { rootMargin: '-18% 0px -58% 0px', threshold: .05 });
    $$('.course-section').forEach(section => sectionObserver.observe(section));

    if (reduceMotion) {
      revealTargets.forEach(element => element.classList.add('is-visible'));
      return;
    }

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: .08 });
    revealTargets.forEach(element => revealObserver.observe(element));

    const cardSelector = [
      '.objectives-grid article', '.comparison-card', '.risk-grid article',
      '.diagnostic-card', '.response-map article', '.question-stack article',
      '.agenda-grid article', '.glossary-grid article', '.quiz-question',
      '.case-file', '.timeline-card', '.decision-lab', '.issue-sorter',
      '.po-builder', '.assignment-card'
    ].join(',');

    $$(cardSelector).forEach(card => {
      card.classList.add('motion-card');
      card.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--card-ry', `${(x - .5) * 3.5}deg`);
        card.style.setProperty('--card-rx', `${(.5 - y) * 3.5}deg`);
        card.style.setProperty('--glow-x', `${x * 100}%`);
        card.style.setProperty('--glow-y', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--card-rx');
        card.style.removeProperty('--card-ry');
      });
    });

    const heroVisual = $('.hero-visual');
    if (heroVisual) {
      const heroSection = $('.hero-section');
      heroSection.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        const rect = heroSection.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        heroVisual.style.setProperty('--hero-ry', `${x * 5}deg`);
        heroVisual.style.setProperty('--hero-rx', `${-y * 5}deg`);
        heroVisual.style.setProperty('--hero-x', `${x * 10}px`);
        heroVisual.style.setProperty('--hero-y', `${y * 10}px`);
      });
      heroSection.addEventListener('pointerleave', () => {
        ['--hero-rx', '--hero-ry', '--hero-x', '--hero-y'].forEach(name => heroVisual.style.removeProperty(name));
      });
    }

    const rippleSelector = [
      '.primary-button', '.secondary-button', '.icon-button', '.complete-button',
      '.choice-row button', '.decision-flow button', '.sorter-items button',
      '.calculator-fields button', '.assignment-actions button', '.quiz-submit',
      '.quiz-result button', '.certificate-card button', '.document-paper button'
    ].join(',');

    document.addEventListener('pointerdown', event => {
      const button = event.target.closest(rippleSelector);
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'ripple-dot';
      dot.style.left = `${event.clientX - rect.left}px`;
      dot.style.top = `${event.clientY - rect.top}px`;
      button.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
    });
  }

  initMotionLayer();
  updateProgressUI();
})();
