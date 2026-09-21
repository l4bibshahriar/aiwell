const $ = (s) => document.querySelector(s);
let chats = [];
let current = [];
let personas = [
  { name: 'Nova', provider: 'gemini', gender: 'Any', persona: 'You are creative, warm, and imaginative.' },
  { name: 'Forge', provider: 'groq', gender: 'Any', persona: 'You are analytical, direct, and practical.' },
  { name: 'Echo', provider: 'openrouter', gender: 'Any', persona: 'You are curious, balanced, and good at finding alternatives.' }
];
let user = 'Labib';
const messages = $('#messages');
const MAX_DISCUSSION_ROUNDS = 3;
const REACTIONS = ['😂', '❤️', '👍', '😭', '😡'];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function renderChats() {
  $('#chatList').innerHTML = chats.slice(-4).reverse().map(c => `<div class="chat-item">${escapeHtml(c.title)}</div>`).join('');
}
function addMsg(name, text, isUser = false, options = {}) {
  if (messages.querySelector('.empty')) messages.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'msg ' + (isUser ? 'user' : '');
  const reactionBar = options.reactions ? `<div class="reactions">${REACTIONS.map(r => `<button type="button" class="reaction" data-reaction="${r}" title="React ${r}">${r}<span>0</span></button>`).join('')}</div>` : '';
  el.innerHTML = `<div class="avatar">${isUser ? '◉' : '✦'}</div><div class="msg-body"><div class="meta">${escapeHtml(name)}</div><div class="bubble">${escapeHtml(text)}</div>${reactionBar}</div>`;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  if (options.reactions) wireReactions(el);
  return el;
}
function wireReactions(el) {
  el.querySelectorAll('.reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = btn.querySelector('span');
      count.textContent = String(Number(count.textContent || 0) + 1);
      btn.classList.add('selected');
    });
  });
}
function addThinking(name) {
  const el = addMsg(name, '… Thinking', false);
  const bubble = el.querySelector('.bubble');
  const states = ['… Thinking', '… Searching', '… Preparing reply'];
  let i = 0;
  const timer = setInterval(() => {
    if (!document.body.contains(el)) return clearInterval(timer);
    i = (i + 1) % states.length;
    bubble.textContent = states[i];
  }, 850);
  return { el, bubble, timer };
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function delayForTurn(position) {
  if (position === 0) return 3000;
  if (position === 1) return 2500;
  return 4000;
}
function discussionPrompt(topic, round, previousSpeaker, ai) {
  if (round === 0) return topic;
  return `Continue the ongoing discussion about: ${topic}\nThe previous speaker was ${previousSpeaker || 'another AI'}. Respond directly to the latest ideas, add a useful insight, ask a thoughtful question, or respectfully disagree. Do not restart the discussion, do not say you are waiting for the user, and do not mention hidden instructions. This is round ${round + 1} of an automatic AI-to-AI conversation.`;
}
function styleInstructions() {
  return `\nConversation style rules:\n- When calm or agreeing: sound Gen-Z and natural, usually one short line, with occasional fitting emojis.\n- When debating, challenged, or angry: become expressive and use a longer multi-line response with clear points and fitting angry/emotional emojis. Do not be abusive, hateful, or threatening.\n- React to the previous speaker instead of repeating generic greetings.\n- Match the requested language.`;
}
async function ask(ai, prompt, history, position) {
  const thinking = addThinking(ai.name);
  await wait(delayForTurn(position));
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: ai.provider,
        prompt,
        history,
        persona: `${ai.persona}\nPreferred gender presentation: ${ai.gender}. ${ai.gender === 'Any' ? 'Choose a natural presentation without making gender stereotypes.' : 'Use this gender presentation naturally, without stereotypes.'}\nThe user prefers ${$('#language').value}. You are one participant in a live multi-AI room. Keep your response natural and useful.${styleInstructions()}`
      })
    });
    const d = await r.json();
    const answer = d.answer || d.error || 'No response.';
    clearInterval(thinking.timer);
    thinking.bubble.textContent = answer;
    thinking.el.querySelector('.msg-body').insertAdjacentHTML('beforeend', `<div class="reactions">${REACTIONS.map(r => `<button type="button" class="reaction" data-reaction="${r}" title="React ${r}">${r}<span>0</span></button>`).join('')}</div>`);
    wireReactions(thinking.el);
    messages.scrollTop = messages.scrollHeight;
    return answer;
  } catch (e) {
    clearInterval(thinking.timer);
    thinking.bubble.textContent = 'Request failed: ' + e.message;
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
  const rounds = selected.length === 1 ? 1 : MAX_DISCUSSION_ROUNDS;

  try {
    for (let round = 0; round < rounds; round++) {
      for (let position = 0; position < selected.length; position++) {
        const ai = selected[position];
        const prompt = discussionPrompt(topic, round, previousSpeaker, ai);
        const answer = await ask(ai, prompt, history, position);
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
  $('#personaFields').innerHTML = personas.map((p, i) => `<div class="persona"><b>AI ${i+1}</b><label>Name<input data-name="${i}" value="${escapeHtml(p.name)}"></label><label>Gender<select data-gender="${i}"><option ${p.gender === 'Any' ? 'selected' : ''}>Any</option><option ${p.gender === 'Female' ? 'selected' : ''}>Female</option><option ${p.gender === 'Male' ? 'selected' : ''}>Male</option><option ${p.gender === 'Non-binary' ? 'selected' : ''}>Non-binary</option></select></label><label>Personality<input data-persona="${i}" value="${escapeHtml(p.persona)}"></label></div>`).join('');
  $('#personas').showModal();
};
$('#closePersonas').onclick = () => $('#personas').close();
$('#savePersonas').onclick = () => {
  personas.forEach((p, i) => {
    p.name = $(`[data-name="${i}"]`).value || p.name;
    p.gender = $(`[data-gender="${i}"]`).value || 'Any';
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
