import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k2.6";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function safeText(v) {
  return String(v || "").slice(0, 3000);
}

app.post("/api/build", async (req, res) => {
  try {
    const idea = safeText(req.body.idea);

    if (!idea) {
      return res.status(400).json({ error: "Idea is required." });
    }

    if (!process.env.MOONSHOT_API_KEY) {
      return res.status(500).json({ error: "Kimi API key missing on server." });
    }

    const prompt = `
You are UD Studio Builder, a practical AI product planning assistant.

Rules:
- Do not overhype.
- Do not mention private API keys, server secrets, or internal IPs.
- Focus on websites, web apps, AI tools, dashboards, automation, and defensive security systems.
- Output must be professional and useful for a customer.
- Give clear price estimate in AED.
- Keep it concise.

Customer idea:
${idea}

Return a real build blueprint in this exact format:

STATUS:
PROJECT NAME:
PROJECT TYPE:
TARGET USER:
BEST PACKAGE:
PRICE ESTIMATE AED:
DELIVERY TIME:

PROMOTED IDEA:
Explain the idea in 3 clear lines.

TECH STACK:
List the best technologies.

PROJECT STRUCTURE:
Show folders and files.

FILES TO CREATE:
List every file needed.

CORE FEATURES:
List practical features.

BUILD COMMANDS:
Give terminal-ready commands.

RUN COMMANDS:
Give terminal-ready commands.

DEPLOY COMMANDS:
Give GitHub/Cloudflare deployment steps.

RPi5 / MOBILE NOTES:
Give optimization notes if useful.

SAFETY RULES:
- No API keys in frontend
- No private IPs in public site
- Include .gitignore
- Include errorHandler.js
- Include rollback.js
- Approval before risky actions

NEXT ACTION:
Tell the customer/Aslam what to do next.
`;

    const r = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MOONSHOT_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: "system", content: "You are UD Studio Builder." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "Kimi API error"
      });
    }

    const text = data?.choices?.[0]?.message?.content || "No output.";
    res.json({ output: text, model: KIMI_MODEL });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UD Studio server running: http://0.0.0.0:${PORT}`);
  console.log(`Build brain: ${KIMI_MODEL}`);
});
