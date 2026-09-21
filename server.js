import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const providers = {
  gemini: { key: 'GEMINI_API_KEY', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
  groq: { key: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b' },
  openrouter: { key: 'OPENROUTER_API_KEY', model: process.env.OPENROUTER_MODEL || 'openrouter/free' }
};

function messagesFor(prompt, history = [], persona = '') {
  return [
    { role: 'system', content: `${persona || 'You are a helpful, thoughtful AI.'}\nAnswer in the requested language. Be concise unless asked for detail.` },
    ...history.slice(-12).map(x => ({ role: x.role, content: x.content })),
    { role: 'user', content: prompt }
  ];
}

async function callProvider(provider, messages) {
  const cfg = providers[provider];
  const key = process.env[cfg.key];
  if (!key || key === 'replace_me') throw new Error(`${provider} API key is not configured on the server.`);

  if (provider === 'gemini') {
    const contents = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const system = messages.find(m => m.role === 'system')?.content || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${key}`;
    const r = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ systemInstruction: {parts:[{text:system}]}, contents }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Gemini request failed');
    return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'No response.';
  }

  const base = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const r = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${key}`, ...(provider === 'openrouter' ? {'HTTP-Referer':'http://localhost:3000','X-Title':'Labib AI Well'} : {})}, body: JSON.stringify({ model: cfg.model, messages, temperature: 0.7 }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `${provider} request failed`);
  return data.choices?.[0]?.message?.content || 'No response.';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { provider, prompt, history, persona } = req.body;
    if (!providers[provider]) return res.status(400).json({ error: 'Unknown provider.' });
    const answer = await callProvider(provider, messagesFor(prompt, history, persona));
    res.json({ answer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ name: req.file.originalname, size: req.file.size, note: 'File received. Add provider-specific document parsing before sending it to an AI.' });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log(`Labib AI Well running on http://localhost:${process.env.PORT || 3000}`));
