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

Return a customer-facing app/web build blueprint only.

STRICT RULES:
- Do NOT output raw code.
- Do NOT output terminal commands.
- Do NOT output API keys, backend secrets, private IPs, or internal file paths.
- Do NOT explain hacking or offensive security.
- Only describe the app/website/system that will be built.
- Keep it professional like Replit/Vercel/AI Studio product planning.
- Mention that implementation files are prepared internally by UD Studio after approval.

Return in this exact format:

STATUS:
PROJECT NAME:
PRODUCT TYPE:
TARGET USERS:
BEST PACKAGE:
PRICE ESTIMATE AED:
DELIVERY TIME:

PROMOTED IDEA:
Explain the idea in 3 clear lines.

APP / WEBSITE SCREENS:
List pages/screens the customer will get.

MAIN FEATURES:
List practical product features.

DESIGN STYLE:
Describe look and feel.

AI / AUTOMATION:
Mention only safe useful AI features.

SECURITY / PRIVACY:
Mention defensive privacy-safe setup.

WHAT UD STUDIO WILL BUILD:
Explain what will be created internally, without showing code.

NEXT ACTION:
Tell user to approve or contact UD Studio.
";
    res.json({ output: text, model: KIMI_MODEL });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UD Studio server running: http://0.0.0.0:${PORT}`);
  console.log(`Build brain: ${KIMI_MODEL}`);
});
