const BACKEND_URL = 'https://etsy-ai-backend-production.up.railway.app';

// Screens
const keyScreen = document.getElementById('key-screen');
const chatScreen = document.getElementById('chat-screen');
const settingsScreen = document.getElementById('settings-screen');

// Platform switcher
let currentPlatform = 'etsy';

document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPlatform = btn.dataset.platform;
    const platformName = currentPlatform === 'etsy' ? 'Etsy' : 'eBay';
    const messagesEl = document.getElementById('messages');
    messagesEl.innerHTML = `<div class="message assistant">Hey! I'm RankifyAI. Tell me what you're selling on <strong>${platformName}</strong> and I'll craft an optimized title, description, and tags. 🎨</div>`;
    conversationHistory = [];
  });
});

function showScreen(screen) {
  [keyScreen, chatScreen, settingsScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

// Init
chrome.storage.local.get(['licenseKey', 'expiresAt'], ({ licenseKey, expiresAt }) => {
  if (licenseKey) {
    showScreen(chatScreen);
    document.getElementById('current-key').value = licenseKey;
    if (expiresAt) startCountdown(expiresAt);
  } else {
    showScreen(keyScreen);
  }
});

// Get key link
document.getElementById('get-key-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://rankifyai.netlify.app/#pricing' });
});

// Key activation
document.getElementById('key-submit').addEventListener('click', async () => {
  const key = document.getElementById('key-input').value.trim();
  const errorEl = document.getElementById('key-error');
  const btn = document.getElementById('key-submit');

  if (!key) return;

  btn.textContent = 'Validating...';
  btn.disabled = true;
  errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${BACKEND_URL}/api/keys/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const data = await res.json();

    if (data.valid) {
      chrome.storage.local.set({ licenseKey: key, expiresAt: data.expires_at });
      document.getElementById('current-key').value = key;
      startCountdown(data.expires_at);
      showScreen(chatScreen);
    } else {
      errorEl.textContent = data.message || 'Invalid or expired key.';
      errorEl.classList.remove('hidden');
    }
  } catch {
    errorEl.textContent = 'Could not connect to server. Try again.';
    errorEl.classList.remove('hidden');
  }

  btn.textContent = 'Activate';
  btn.disabled = false;
});

// Settings
document.getElementById('settings-btn').addEventListener('click', () => showScreen(settingsScreen));
document.getElementById('back-btn').addEventListener('click', () => showScreen(chatScreen));
document.getElementById('change-key-btn').addEventListener('click', () => {
  chrome.storage.local.remove('licenseKey');
  document.getElementById('key-input').value = '';
  showScreen(keyScreen);
});

// Chat
const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('user-input');
let conversationHistory = [];
let pageContext = '';

// Try to get Etsy page context from content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CONTEXT' }, (response) => {
      if (response?.context) pageContext = response.context;
    });
  }
});

function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;

  // Add action buttons to assistant messages
  if (role === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 1500);
    });

    // Autofill button
    const fillBtn = document.createElement('button');
    fillBtn.className = 'msg-btn fill-btn';
    fillBtn.textContent = '⚡ Autofill';
    fillBtn.addEventListener('click', () => autofill(text, fillBtn));

    actions.appendChild(copyBtn);
    actions.appendChild(fillBtn);
    div.appendChild(actions);
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function parseListingFromText(text) {
  const data = {};

  const titleMatch = text.match(/TITLE[:\s*]+([^\n]+)/i);
  if (titleMatch) data.title = titleMatch[1].trim().slice(0, 140);

  const descMatch = text.match(/DESCRIPTION[:\s*]+([\s\S]+?)(?=TAGS|$)/i);
  if (descMatch) data.description = descMatch[1].trim();

  const tagsMatch = text.match(/TAGS[:\s*]+([\s\S]+?)$/i);
  if (tagsMatch) {
    data.tags = tagsMatch[1]
      .split(/[\n,]/)
      .map(t => t.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(t => t.length > 0 && t.length <= 20)
      .slice(0, 13);
  }

  return data;
}

async function autofill(text, btn) {
  const data = parseListingFromText(text);

  if (!data.title && !data.description) {
    btn.textContent = 'No listing found';
    setTimeout(() => btn.textContent = '⚡ Autofill', 1500);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    btn.textContent = 'Open Etsy/eBay first';
    setTimeout(() => btn.textContent = '⚡ Autofill', 1500);
    return;
  }

  btn.textContent = 'Filling...';

  chrome.tabs.sendMessage(tab.id, { type: 'FILL_LISTING', data }, (res) => {
    if (res?.success) {
      btn.textContent = '✓ Done!';
    } else {
      btn.textContent = 'Open listing editor first';
    }
    setTimeout(() => btn.textContent = '⚡ Autofill', 2000);
  });
}

async function sendMessage(text) {
  if (!text.trim()) return;

  const platformNote = `[Platform: ${currentPlatform === 'etsy' ? 'Etsy' : 'eBay'} — optimize for this platform]`;
  const enriched = conversationHistory.length === 0 ? `${text}\n${platformNote}` : text;

  addMessage('user', text);
  userInput.value = '';
  conversationHistory.push({ role: 'user', content: enriched });

  const loadingEl = addMessage('loading', 'Thinking...');

  const { licenseKey } = await chrome.storage.local.get('licenseKey');

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: licenseKey,
        messages: conversationHistory,
        pageContext,
        image: currentImageBase64 ? { data: currentImageBase64, mimeType: currentImageMime } : null
      })
    });

    const data = await res.json();

    loadingEl.remove();

    if (res.status === 402) {
      addMessage('assistant', '⚠️ Your subscription has expired. Please renew your key.');
      return;
    }

    if (res.status === 401) {
      addMessage('assistant', '⚠️ Invalid key. Please check your settings.');
      return;
    }

    if (!data.reply) throw new Error('No reply');

    addMessage('assistant', data.reply);
    conversationHistory.push({ role: 'assistant', content: data.reply });
  } catch {
    loadingEl.remove();
    addMessage('assistant', '❌ Something went wrong. Check your connection and try again.');
  }
}

document.getElementById('send-btn').addEventListener('click', () => sendMessage(userInput.value));

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(userInput.value);
  }
});

document.querySelectorAll('.quick-btn').forEach(btn => {
  if (btn.id !== 'photo-listing-btn') {
    btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
  }
});

// Image upload
let currentImageBase64 = null;
let currentImageMime = null;

const imageUpload = document.getElementById('image-upload');
const imageStrip = document.getElementById('image-preview-strip');
const previewImg = document.getElementById('preview-img');

imageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const [meta, base64] = dataUrl.split(',');
    currentImageBase64 = base64;
    currentImageMime = file.type;
    previewImg.src = dataUrl;
    imageStrip.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('clear-image-btn').addEventListener('click', () => {
  currentImageBase64 = null;
  currentImageMime = null;
  imageStrip.classList.add('hidden');
  previewImg.src = '';
});

document.getElementById('photo-listing-btn').addEventListener('click', () => {
  if (!currentImageBase64) {
    imageUpload.click();
    imageUpload.addEventListener('change', () => {
      setTimeout(() => sendMessage('Generate a full optimized listing for this product'), 300);
    }, { once: true });
  } else {
    sendMessage('Generate a full optimized listing for this product');
  }
});

function startCountdown(expiresAt) {
  const countdownEl = document.getElementById('expiry-countdown');
  const chipEl = document.getElementById('header-expiry');

  function update() {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) {
      if (countdownEl) countdownEl.innerHTML = '<span>Key expired</span>';
      if (chipEl) chipEl.textContent = 'Expired';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const urgent = days < 3;
    const timeStr = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;

    if (countdownEl) {
      countdownEl.className = `countdown${urgent ? ' urgent' : ''}`;
      countdownEl.innerHTML = `Access expires in<span class="countdown-time">${timeStr}</span>`;
    }

    if (chipEl) {
      chipEl.className = `expiry-chip${urgent ? ' urgent' : ''}`;
      chipEl.textContent = days > 0 ? `${days}d left` : `${hours}h ${mins}m left`;
    }
  }

  update();
  setInterval(update, 60000);
}
