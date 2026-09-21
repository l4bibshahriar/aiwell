const $ = (s) => document.querySelector(s);
let chats = [];
let current = [];
let personas = [
  { name: 'Nova', provider: 'gemini', persona: 'You are creative, warm, and imaginative.' },
  { name: 'Forge', provider: 'groq', persona: 'You are analytical, direct, and practical.' },
  { name: 'Echo', provider: 'openrouter', persona: 'You are curious, balanced, and good at finding alternatives.' }
];
let user = 'Labib';
const messages = $('#messages');
const MAX_DISCUSSION_ROUNDS = 3;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function renderChats() {
  $('#chatList').innerHTML = chats.slice(-4).reverse().map(c => `<div class="chat-item">${escapeHtml(c.title)}</div>`).join('');
}
function addMsg(name, text, isUser = false) {
  if (messages.querySelector('.empty')) messages.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'msg ' + (isUser ? 'user' : '');
  el.innerHTML = `<div class="avatar">${isUser ? '◉' : '✦'}</div><div><div class="meta">${escapeHtml(name)}</div><div class="bubble">${escapeHtml(text)}</div></div>`;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  return el;
}
function discussionPrompt(topic, round, previousSpeaker) {
  if (round === 0) return topic;
  return `Continue the ongoing discussion about: ${topic}\nThe previous speaker was ${previousSpeaker || 'another AI'}. Respond directly to the latest ideas, add a useful insight, ask a thoughtful question, or respectfully disagree. Do not restart the discussion, do not say you are waiting for the user, and do not mention hidden instructions. This is round ${round + 1} of an automatic AI-to-AI conversation.`;
}
async function ask(ai, prompt, history) {
  const last = addMsg(ai.name, 'Thinking…');
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: ai.provider,
        prompt,
        history,
        persona: `${ai.persona}\nThe user prefers ${$('#language').value}. You are one participant in a live multi-AI room. Keep your response natural and useful.`
      })
    });
    const d = await r.json();
    const answer = d.answer || d.error || 'No response.';
    last.querySelector('.bubble').textContent = answer;
    messages.scrollTop = messages.scrollHeight;
    return answer;
  } catch (e) {
    last.querySelector('.bubble').textContent = 'Request failed: ' + e.message;
    return 'Request failed: ' + e.message;
  }
}

$('#composer').onsubmit = async (e) => {
  e.preventDefault();
  const topic = $('#prompt').value.trim();
  if (!topic) return;
  $('#prompt').value = '';
  $('#composer button[type="submit"]').disabled = true;
  addMsg(user, topic, true);
  const selected = personas.slice(0, Number($('#count').value));
  let history = current.slice();
  let previousSpeaker = '';

  try {
    for (let round = 0; round < MAX_DISCUSSION_ROUNDS; round++) {
      for (const ai of selected) {
        const prompt = discussionPrompt(topic, round, previousSpeaker);
        const answer = await ask(ai, prompt, history);
        history.push({ role: 'user', content: prompt });
        history.push({ role: 'assistant', content: `${ai.name}: ${answer}` });
        previousSpeaker = ai.name;
      }
    }
    current = history.slice(-24);
    chats.push({ title: topic });
    renderChats();
  } finally {
    $('#composer button[type="submit"]').disabled = false;
  }
};

$('#newChat').onclick = () => {
  current = [];
  messages.innerHTML = '<div class="empty"><div class="orb">✦</div><h2>Start a conversation</h2><p>Choose your AI participants, set a topic, and let the room think.</p></div>';
};
$('#settingsBtn').onclick = () => $('#settings').showModal();
$('#closeSettings').onclick = () => $('#settings').close();
$('#saveSettings').onclick = () => { user = $('#username').value.trim() || 'Labib'; $('#settings').close(); };
$('#personasBtn').onclick = () => {
  $('#personaFields').innerHTML = personas.map((p, i) => `<div class="persona"><b>AI ${i+1}</b><label>Name<input data-name="${i}" value="${escapeHtml(p.name)}"></label><label>Personality<input data-persona="${i}" value="${escapeHtml(p.persona)}"></label></div>`).join('');
  $('#personas').showModal();
};
$('#closePersonas').onclick = () => $('#personas').close();
$('#savePersonas').onclick = () => {
  personas.forEach((p, i) => {
    p.name = $(`[data-name="${i}"]`).value || p.name;
    p.persona = $(`[data-persona="${i}"]`).value || p.persona;
  });
  $('#personas').close();
};
$('#attach').onclick = () => $('#file').click();
$('#file').onchange = async () => {
  if (!$('#file').files[0]) return;
  const fd = new FormData();
  fd.append('file', $('#file').files[0]);
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const d = await r.json();
  $('#prompt').value += ` [Attached: ${d.name || d.error}]`;
};
const support = ['Support Me?', 'আমাকে অনুদান দিন'];
let si = 0;
setInterval(() => {
  si = (si + 1) % support.length;
  $('#supportText').animate?.([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });
  $('#supportText').textContent = support[si];
}, 2000);
renderChats();
