# Universal Dragon Studio

Local-first web studio for project notes, image/video interfaces, FFmpeg media operations, and Groq-assisted planning.

## Current contents

- main Studio browser application
- image, video, timeline, and AI-video pages
- installable web-app manifests and service worker
- Express API server
- local JSON profile and recent-project storage
- uploaded and generated media directories created at runtime

## API capabilities

| Area | Routes/behavior |
|---|---|
| Studio state | read/update profile and recent projects; clear project list |
| Health | reports Studio/FFmpeg configuration state |
| Build planning | sends a bounded request to Groq when configured |
| Upload | accepts one video file |
| Video trim | runs FFmpeg with fixed argument construction |
| Audio extraction | runs FFmpeg |
| Text overlay | creates an ASS subtitle file and runs FFmpeg |
| AI plan | requests a model-generated editing plan; it does not edit the file by itself |

## Run locally

Requirements:

- Node.js and npm
- FFmpeg available on PATH
- optional Groq API key for AI routes

~~~bash
npm install
cp .env.example .env
npm start
~~~

The default port is 8089.

Environment settings include SESSION_SECRET, GROQ_API_KEY, optional GROQ_MODEL, optional DISPLAY_MODEL_NAME, and PORT.

## Data and output

Runtime state is stored under a private local data directory. Uploaded videos and generated outputs remain on the host until an operator removes them. Back up important work and define retention limits before regular use.

## Security boundary

This is not ready for direct public exposure.

- API routes do not currently enforce a logged-in user.
- A session cookie is configured, but it is not used as route authorization.
- CORS headers are not authentication.
- Upload size is currently very large, and media processing can consume substantial disk, CPU, and memory.
- Add authenticated ownership, CSRF protection, content-type validation, quotas, cleanup, isolated FFmpeg workers, rate limits, and audit logs before internet or multi-user deployment.

AI output is a plan/code suggestion, not proof of a successful media edit or deployment.
