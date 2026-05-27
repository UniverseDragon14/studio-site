#!/usr/bin/env bash
set -u

MISSION_DIR="/home/aslam/universal_dragon/studio_site"

echo "=== EVE STAGE 5 CHECK ==="

if [ "$(pwd)" != "$MISSION_DIR" ]; then
  echo "❌ Wrong directory:"
  pwd
  echo "Expected: $MISSION_DIR"
  exit 1
fi

echo "✅ Mission repo confirmed: $(pwd)"

if [ -f ".env" ]; then
  echo "✅ .env exists"
  grep -q "^GROQ_MODEL=openai/gpt-oss-120b" .env \
    && echo "✅ GROQ_MODEL=openai/gpt-oss-120b" \
    || echo "⚠️ GROQ_MODEL not set to openai/gpt-oss-120b"

  if grep -q "^GROQ_API_KEY=" .env; then
    echo "✅ GROQ_API_KEY exists, not printing"
  else
    echo "⚠️ GROQ_API_KEY missing"
  fi
else
  echo "⚠️ .env missing"
fi

if [ -f "server.js" ]; then
  echo "✅ server.js exists"
else
  echo "❌ server.js missing"
  exit 1
fi

echo "✅ Stage 5 check complete"
