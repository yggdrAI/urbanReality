import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from server/.env or process env
dotenv.config();

// IMPORTANT: install @google/generative-ai in server environment
// npm install @google/generative-ai
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Gemini backend will return fallback responses.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

app.post('/api/urban-analysis', async (req, res) => {
  try {
    const { data, year } = req.body;

    if (!genAI) {
      return res.json({ analysis: `Urban analysis not available (server GEMINI_API_KEY not set). Summary: ${data.people} people affected, loss ₹${data.loss} Cr, risk ${data.risk}.` });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `As an Urban Planning AI, analyze this data for a Delhi zone in the year ${year}:\n- People Affected: ${data.people}\n- Economic Loss: ₹${data.loss} Cr\n- Risk Level: ${data.risk}\n\nProvide a 2-sentence expert summary of the situation and one specific infrastructure recommendation.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ analysis: text });
  } catch (err) {
    console.error('Gemini backend error:', err);
    res.status(500).json({ error: 'Gemini analysis failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Gemini backend running on port ${port}`);
});
