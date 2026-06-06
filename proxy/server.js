const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API keys are secure on the backend server environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDYQCyBoWZNC7Y0OV7SceZlYd92cF20t0o";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Insights Proxy endpoint
app.post('/api/insights', async (req, res) => {
  const { cycleDay, phase, diet, pcos, optInTimestamp } = req.body;
  
  if (!optInTimestamp) {
    return res.status(400).json({ error: "Missing medical consent timestamp verification." });
  }

  const pcosText = pcos ? "with PCOS (requiring low-GI anti-inflammatory focus)" : "without PCOS";
  const systemPrompt = `You are LUNARA, an expert holistic wellness and women's health assistant. Keep insights extremely warm, empowering, poetic, and succinct (max 3 sentences). Also supply a customized short positive affirmation (max 1 sentence). Output MUST be valid JSON matching this format: {"title": "Phase title", "body": "Advice text content", "affirmation": "Short positive affirmation"}`;
  const prompt = `Construct cycle wellness advice for Day ${cycleDay} of a cycle, in the ${phase} phase, for a user who is ${diet} and ${pcosText}. Ensure suggestions reference specific nutritional minerals (e.g. Iron, Zinc, Magnesium) relevant to the phase.`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser request:\n${prompt}` }] }]
      })
    });
    
    if (!response.ok) throw new Error("Gemini API error status");
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Clean JSON formatting
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error("Insights proxy failure:", err.message);
    res.status(502).json({ error: "Failed to query Gemini AI endpoint" });
  }
});

// Journal Analyst Proxy endpoint
app.post('/api/journal', async (req, res) => {
  const { text, phase } = req.body;
  if (!text) return res.status(400).json({ error: "Text entry is required" });

  const systemPrompt = `You are LUNARA, an AI cycle wellness coach. Read the user's journal entry and provide a supportive, empathetic, and actionable analytical coaching response (max 3 sentences) relating to their cycle phase: ${phase}. Output is plain text.`;
  
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser entry:\n${text}` }] }]
      })
    });
    
    if (!response.ok) throw new Error("Gemini API error");
    const data = await response.json();
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "Warm thoughts. Rest well today.";
    res.json({ analysis });
  } catch (err) {
    console.error("Journal proxy failure:", err.message);
    res.status(502).json({ error: "Failed to parse journal reflections" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LUNARA Secure API Proxy running on http://localhost:${PORT}`);
});