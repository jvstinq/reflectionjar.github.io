// api/summary.js
const axios = require('axios');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reflections } = req.body;

    if (!reflections || reflections.length === 0) {
      return res.status(400).json({ error: 'No reflections provided' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const reflectionTexts = reflections.map((r, i) => 
      `${i + 1}. ${r.text} (${r.date || 'recent'})`
    ).join('\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a supportive mental health companion for men. Analyze their reflections, but you are only allowed to list their reflections in brief sentences, as a way to reflect what they wrote.'
        }, {
          role: 'user',
          content: `Here are my recent reflections:\n\n${reflectionTexts}\n\nProvide a 1-2 sentence short summary of what I wrote, then give me an encouraging message to keep going.`
        }],
        max_tokens: 200,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    res.status(200).json({ summary: response.data.choices[0].message.content });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      details: error.response?.data?.error?.message || error.message 
    });
  }
};