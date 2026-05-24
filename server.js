import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import { execFile } from "child_process";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;
const GROQ_MODEL = process.env.GROQ_MODEL || "";
const DISPLAY_MODEL_NAME = process.env.DISPLAY_MODEL_NAME || "Universal Dragon Studio Brain V1";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "videos_output");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "studio-app.html"));
});
app.use(express.static(__dirname));
app.use("/videos_output", express.static(OUTPUT_DIR));

function safeText(v) {
  return String(v || "").slice(0, 3000);
}

function safeName(name) {
  return String(name || "video")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function requireStudioBrain(res) {
  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "Studio Brain API key missing on server." });
    return false;
  }

  if (!GROQ_MODEL) {
    res.status(500).json({ error: "Studio Brain model missing on server." });
    return false;
  }

  return true;
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 1000 * 60 * 30 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    cb(null, `${stamp}_${safeName(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 * 3 }
});

app.get("/api/studio/health", (req, res) => {
  res.json({
    status: "ok",
    service: "universal-dragon-studio",
    video_core: "v1",
    ffmpeg: "enabled",
    brain: DISPLAY_MODEL_NAME
  });
});

app.post("/api/build", async (req, res) => {
  try {
    const idea = safeText(req.body.idea);

    if (!idea) {
      return res.status(400).json({ error: "Idea is required." });
    }

    if (!requireStudioBrain(res)) return;

    const prompt = `
You are UD Studio Builder, a practical AI product planning assistant.

Rules:
- Do not overhype.
- Do not mention private API keys, server secrets, or internal IPs.
- Focus on websites, web apps, AI tools, dashboards, automation, photo/video tools, creator tools, and defensive security systems.
- Output must be professional and useful for a customer.
- Give clear price estimate in AED.
- Keep it concise.

Customer idea:
${idea}

Return a customer-facing app/web build blueprint only.
`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are UD Studio Builder for Universal Dragon. Keep outputs safe, practical, and customer-facing." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 900
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Studio Brain API request failed."
      });
    }

    const text = data?.choices?.[0]?.message?.content || "No output returned.";
    res.json({ output: text, model: DISPLAY_MODEL_NAME });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/video/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No video uploaded." });

    res.json({
      status: "uploaded",
      file: req.file.filename,
      original: req.file.originalname,
      size_mb: Number((req.file.size / 1024 / 1024).toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/video/trim", async (req, res) => {
  try {
    const file = safeName(req.body.file);
    const start = String(req.body.start || "00:00:00");
    const duration = String(req.body.duration || "00:00:10");

    if (!file) return res.status(400).json({ error: "file is required." });

    const input = path.join(UPLOAD_DIR, file);
    if (!input.startsWith(UPLOAD_DIR) || !fs.existsSync(input)) {
      return res.status(404).json({ error: "Input video not found." });
    }

    const outputName = `trim_${Date.now()}_${file.replace(/\.[^.]+$/, "")}.mp4`;
    const output = path.join(OUTPUT_DIR, outputName);

    await runCmd("ffmpeg", [
      "-y",
      "-ss", start,
      "-i", input,
      "-t", duration,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      output
    ]);

    res.json({
      status: "trimmed",
      input: file,
      output: outputName,
      url: `/videos_output/${outputName}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message.slice(0, 1000) });
  }
});

app.post("/api/video/extract-audio", async (req, res) => {
  try {
    const file = safeName(req.body.file);

    if (!file) return res.status(400).json({ error: "file is required." });

    const input = path.join(UPLOAD_DIR, file);
    if (!input.startsWith(UPLOAD_DIR) || !fs.existsSync(input)) {
      return res.status(404).json({ error: "Input video not found." });
    }

    const outputName = `audio_${Date.now()}_${file.replace(/\.[^.]+$/, "")}.mp3`;
    const output = path.join(OUTPUT_DIR, outputName);

    await runCmd("ffmpeg", [
      "-y",
      "-i", input,
      "-vn",
      "-acodec", "libmp3lame",
      "-q:a", "4",
      output
    ]);

    res.json({
      status: "audio_extracted",
      input: file,
      output: outputName,
      url: `/videos_output/${outputName}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message.slice(0, 1000) });
  }
});

app.post("/api/video/ai-plan", async (req, res) => {
  try {
    const file = safeName(req.body.file);
    const goal = safeText(req.body.goal || "Create a YouTube creator package and shorts plan.");

    if (!file) return res.status(400).json({ error: "file is required." });
    if (!requireStudioBrain(res)) return;

    const input = path.join(UPLOAD_DIR, file);
    if (!input.startsWith(UPLOAD_DIR) || !fs.existsSync(input)) {
      return res.status(404).json({ error: "Input video not found." });
    }

    let meta = {};
    try {
      const probe = await runCmd("ffprobe", [
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        input
      ]);
      meta = JSON.parse(probe.stdout || "{}");
    } catch {
      meta = { note: "ffprobe metadata unavailable" };
    }

    const prompt = `
You are Universal Dragon Studio AI video editor.

This is NOT a simple converter. Create a useful creator/editor package.

Video file:
${file}

Video metadata JSON:
${JSON.stringify(meta).slice(0, 2500)}

User goal:
${goal}

Return:
1. Best title ideas
2. YouTube description
3. Tags / hashtags
4. Thumbnail concept prompt
5. Shorts clip ideas with timestamp suggestions
6. Editing style
7. Caption style
8. Export recommendation
9. Next manual action for editor

Keep it practical, professional, and creator-focused.
`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are Universal Dragon Studio, a practical AI video editing and creator package assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.45,
        max_tokens: 1100
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Studio Brain request failed." });
    }

    const output = data?.choices?.[0]?.message?.content || "No AI plan returned.";
    res.json({ status: "ai_plan_ready", file, model: DISPLAY_MODEL_NAME, output });

  } catch (err) {
    res.status(500).json({ error: err.message.slice(0, 1000) });
  }
});

app.post("/api/video/creator-package", async (req, res) => {
  try {
    const file = safeName(req.body.file || "");
    const request = safeText(req.body.request || "");
    const start = safeText(req.body.start || "00:00:00");
    const duration = safeText(req.body.duration || "00:00:30");

    if (!requireStudioBrain(res)) return;

    const prompt = `
You are Universal Dragon Studio Creator Package AI.

Create a practical YouTube Shorts / Reels / TikTok creator package.

Video file name:
${file || "not provided"}

Clip start:
${start}

Clip duration:
${duration}

User request:
${request}

Return:
1. Short video concept
2. Best title options
3. YouTube description
4. Hashtags
5. Thumbnail prompt
6. Hook text for first 3 seconds
7. Caption/subtitle style
8. Editing plan
9. Export recommendation
10. Next improvement suggestion

Keep it practical, creator-focused, and concise.
Do not mention private APIs, tokens, internal IPs, or server secrets.
`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are Universal Dragon Studio AI for creator video packaging. Be practical and useful." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 900
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Studio Brain API request failed."
      });
    }

    res.json({
      status: "creator_package_ready",
      model: DISPLAY_MODEL_NAME,
      output: data?.choices?.[0]?.message?.content || "No output returned."
    });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/ai/storyboard", async (req, res) => {
  try {
    const prompt = safeText(req.body.prompt || "");
    const scenes = Number(req.body.scenes || 8);
    const aspect = safeText(req.body.aspect || "9:16");

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (!requireStudioBrain(res)) return;

    const aiPrompt = `
You are Universal Dragon Studio AI Video Director.

Create an AI promo video plan from this user prompt:

PROMPT:
${prompt}

SCENE COUNT:
${scenes}

ASPECT RATIO:
${aspect}

Return a practical creator package with:

1. Video concept
2. ${scenes} scenes
3. For each scene:
   - scene title
   - image generation prompt
   - camera movement
   - text overlay
   - duration seconds
   - transition
4. Voiceover script
5. Background music style
6. Thumbnail prompt
7. YouTube Shorts title
8. Description
9. Hashtags
10. FFmpeg/video assembly plan

Rules:
- Make image prompts cinematic and detailed.
- Keep it usable for real AI image generation.
- Do not mention private API keys, internal IPs, tokens, or server secrets.
- Keep output clean and practical.
`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are Universal Dragon Studio AI Video Director. Generate practical storyboards, image prompts, and creator packages." },
          { role: "user", content: aiPrompt }
        ],
        temperature: 0.65,
        max_tokens: 1600
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Studio Brain API request failed."
      });
    }

    res.json({
      status: "storyboard_ready",
      model: DISPLAY_MODEL_NAME,
      output: data?.choices?.[0]?.message?.content || "No output returned."
    });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/images/upload", upload.array("images", 40), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "No images uploaded." });

    const images = files.map(f => ({
      file: f.filename,
      original: f.originalname,
      size_mb: Number((f.size / 1024 / 1024).toFixed(2))
    }));

    res.json({
      status: "images_uploaded",
      count: images.length,
      images
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/images/render-video", async (req, res) => {
  try {
    const files = Array.isArray(req.body.files) ? req.body.files.map(safeName) : [];
    const seconds = String(req.body.seconds || "2");
    const aspect = String(req.body.aspect || "9:16");

    if (!files.length) return res.status(400).json({ error: "files array is required." });

    const valid = [];
    for (const f of files) {
      const full = path.join(UPLOAD_DIR, f);
      if (full.startsWith(UPLOAD_DIR) && fs.existsSync(full)) valid.push(full);
    }

    if (!valid.length) return res.status(404).json({ error: "No valid uploaded images found." });

    const listName = `image_list_${Date.now()}.txt`;
    const listPath = path.join(OUTPUT_DIR, listName);

    let listText = "";
    for (const img of valid) {
      listText += `file '${img.replaceAll("'", "'\\''")}'\n`;
      listText += `duration ${seconds}\n`;
    }
    listText += `file '${valid[valid.length - 1].replaceAll("'", "'\\''")}'\n`;
    fs.writeFileSync(listPath, listText);

    const outputName = `ai_images_video_${Date.now()}.mp4`;
    const output = path.join(OUTPUT_DIR, outputName);

    let vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    if (aspect === "16:9") vf = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p";
    if (aspect === "1:1") vf = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,format=yuv420p";

    await runCmd("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-vf", vf,
      "-r", "30",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      output
    ]);

    res.json({
      status: "image_video_created",
      count: valid.length,
      output: outputName,
      url: `/videos_output/${outputName}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message.slice(0, 1000) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UD Studio server running: http://0.0.0.0:${PORT}`);
  console.log(`Build brain: ${DISPLAY_MODEL_NAME}`);
  console.log("Video Core V1: upload + trim enabled");
});
