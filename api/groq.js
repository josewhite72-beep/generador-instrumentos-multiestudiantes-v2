export const config = { maxDuration: 60 };

const MODELS = {
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
  'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
  'gemma2-9b-it': 'gemma2-9b-it',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, model = 'llama-3.3-70b-versatile', stream = true, response_format } = req.body;
    const selectedModel = MODELS[model] || 'llama-3.3-70b-versatile';

    const body = {
      model: selectedModel,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      stream,
    };
    if (response_format) body.response_format = response_format;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return res.status(502).json({ error: 'Groq error', details: err });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const reader = groqRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
        if (res.flush) res.flush();
      }
      res.end();
    } else {
      const data = await groqRes.json();
      res.status(200).json(data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
