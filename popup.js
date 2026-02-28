/* global chrome */
'use strict';

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const tabBtns      = document.querySelectorAll('.tab-btn');
const panels       = document.querySelectorAll('.tab-panel');

const taskEl       = document.getElementById('task');
const contextEl    = document.getElementById('context');
const linksEl      = document.getElementById('context-links');
const formatEl     = document.getElementById('format');
const toneEl       = document.getElementById('tone');
const exampleEl    = document.getElementById('example');

const buildBtn     = document.getElementById('build-btn');
const clearBtn     = document.getElementById('clear-btn');
const outputSection= document.getElementById('output-section');
const finalPrompt  = document.getElementById('final-prompt');
const copyBtn      = document.getElementById('copy-btn');
const saveBtn      = document.getElementById('save-btn');
const copyStatus   = document.getElementById('copy-status');
const saveStatus   = document.getElementById('save-status');

const noSavedMsg   = document.getElementById('no-saved-msg');
const savedList    = document.getElementById('saved-list');
const clearAllBtn  = document.getElementById('clear-all-btn');

// ─── Tab Switching ───────────────────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === target);
      b.setAttribute('aria-selected', b.dataset.tab === target ? 'true' : 'false');
    });

    panels.forEach(p => {
      const isTarget = p.id === `panel-${target}`;
      p.classList.toggle('active', isTarget);
      p.classList.toggle('hidden', !isTarget);
    });

    if (target === 'saved') renderSaved();
  });
});

// ─── Build Prompt ────────────────────────────────────────────────────────────
buildBtn.addEventListener('click', () => {
  const task    = taskEl.value.trim();
  const context = contextEl.value.trim();
  const links   = linksEl.value.trim();
  const format  = formatEl.value.trim();
  const tone    = toneEl.value.trim();
  const example = exampleEl.value.trim();

  if (!task) {
    taskEl.focus();
    taskEl.style.borderColor = '#ff5e6c';
    setTimeout(() => { taskEl.style.borderColor = ''; }, 1500);
    return;
  }

  const parts = [];

  parts.push(`Task:\n${task}`);

  if (context || links) {
    let ctxBlock = 'Context:\n';
    if (context) ctxBlock += context;
    if (links) {
      if (context) ctxBlock += '\n\nReferences:\n';
      else ctxBlock += 'References:\n';
      ctxBlock += links;
    }
    parts.push(ctxBlock);
  }

  if (format)  parts.push(`Format:\n${format}`);
  if (tone)    parts.push(`Tone:\n${tone}`);
  if (example) parts.push(`Example:\n${example}`);

  finalPrompt.value = parts.join('\n\n---\n\n');
  outputSection.classList.remove('hidden');
  outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  hideStatus();
});

// ─── Clear Form ──────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  [taskEl, contextEl, linksEl, formatEl, toneEl, exampleEl].forEach(el => { el.value = ''; });
  outputSection.classList.add('hidden');
  finalPrompt.value = '';
  hideStatus();
});

// ─── Copy to Clipboard ───────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  if (!finalPrompt.value) return;
  navigator.clipboard.writeText(finalPrompt.value).then(() => {
    showStatus(copyStatus);
  }).catch(() => {
    // Fallback for environments where clipboard API is restricted
    finalPrompt.select();
    document.execCommand('copy');
    showStatus(copyStatus);
  });
});

// ─── Save Prompt ─────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const prompt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    task:    taskEl.value.trim(),
    context: contextEl.value.trim(),
    links:   linksEl.value.trim(),
    format:  formatEl.value.trim(),
    tone:    toneEl.value.trim(),
    example: exampleEl.value.trim(),
    built:   finalPrompt.value,
  };

  if (!prompt.task && !prompt.built) return;

  loadSaved(saved => {
    saved.unshift(prompt);
    persistSaved(saved, () => showStatus(saveStatus));
  });
});

// ─── Saved Prompts Tab ────────────────────────────────────────────────────────
function renderSaved() {
  loadSaved(saved => {
    savedList.innerHTML = '';

    if (!saved.length) {
      noSavedMsg.classList.remove('hidden');
      savedList.classList.add('hidden');
      return;
    }

    noSavedMsg.classList.add('hidden');
    savedList.classList.remove('hidden');

    saved.forEach(p => {
      const li = document.createElement('li');
      li.className = 'saved-item';
      li.innerHTML = `
        <div class="item-title">${escHtml(p.task || '(no task)')}</div>
        <div class="item-preview">${escHtml(p.built || '')}</div>
        <div class="item-actions">
          <button class="btn btn-primary btn-sm" data-action="reuse" data-id="${p.id}">♻️ Reuse</button>
          <button class="btn btn-secondary btn-sm" data-action="copy" data-id="${p.id}">📋 Copy</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${p.id}">🗑️ Delete</button>
        </div>`;
      savedList.appendChild(li);
    });
  });
}

savedList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  loadSaved(saved => {
    const prompt = saved.find(p => p.id === id);
    if (!prompt) return;

    if (action === 'reuse') {
      taskEl.value    = prompt.task    || '';
      contextEl.value = prompt.context || '';
      linksEl.value   = prompt.links   || '';
      formatEl.value  = prompt.format  || '';
      toneEl.value    = prompt.tone    || '';
      exampleEl.value = prompt.example || '';
      finalPrompt.value = prompt.built || '';
      if (prompt.built) outputSection.classList.remove('hidden');
      switchTab('builder');
    }

    if (action === 'copy') {
      navigator.clipboard.writeText(prompt.built || '').catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    }

    if (action === 'delete') {
      const updated = saved.filter(p => p.id !== id);
      persistSaved(updated, () => renderSaved());
    }
  });
});

clearAllBtn.addEventListener('click', () => {
  persistSaved([], () => renderSaved());
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function switchTab(tabName) {
  tabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
    b.setAttribute('aria-selected', b.dataset.tab === tabName ? 'true' : 'false');
  });
  panels.forEach(p => {
    const isTarget = p.id === `panel-${tabName}`;
    p.classList.toggle('active', isTarget);
    p.classList.toggle('hidden', !isTarget);
  });
}

function showStatus(el) {
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2000);
}

function hideStatus() {
  [copyStatus, saveStatus].forEach(el => el.classList.add('hidden'));
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Storage helpers – use chrome.storage.local when available, else localStorage
function loadSaved(cb) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['savedPrompts'], result => {
      cb(result.savedPrompts || []);
    });
  } else {
    try {
      cb(JSON.parse(localStorage.getItem('savedPrompts') || '[]'));
    } catch (err) { void err; cb([]); }
  }
}

function persistSaved(data, cb) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ savedPrompts: data }, cb);
  } else {
    localStorage.setItem('savedPrompts', JSON.stringify(data));
    if (cb) cb();
  }
}
