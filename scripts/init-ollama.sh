#!/bin/sh
# Wait for Ollama to be available
echo "Starting Ollama initialization..."

ATTEMPT=0
MAX_ATTEMPTS=36

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]
do
  if curl -f http://ollama:11434/api/tags >/dev/null 2>&1
  then
    echo "Ollama is available"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - Waiting for Ollama..."
  sleep 5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]
then
  echo "Ollama not available after 3 minutes"
  exit 1
fi

MODEL_NAME="qwen3:8b"
echo "Checking if model $MODEL_NAME is already downloaded..."

MODELS=$(curl -s http://ollama:11434/api/tags 2>/dev/null || echo "")

if echo "$MODELS" | grep -q "$MODEL_NAME"
then
  echo "Model $MODEL_NAME is already available"
else
  echo "Downloading model $MODEL_NAME..."
  echo "This process may take several minutes on first run..."
  
  curl -X POST http://ollama:11434/api/pull -H "Content-Type: application/json" -d "{\"name\": \"$MODEL_NAME\"}" --no-buffer 2>/dev/null || true
  
  echo "Model $MODEL_NAME ready"
fi

echo "Ollama initialization completed"
echo "Ollama available at: http://ollama:11434"
echo "Chat AI available at: http://localhost:3000/api/chats/ia"
