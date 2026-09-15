#!/bin/sh
# Checklist de validación NOA en Hostinger KVM8 (qwen3:8b).
# Uso: OLLAMA_HOST=http://127.0.0.1:11434 ./scripts/verify-noa-kvm8.sh

set -eu

OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
FAIL=0

echo "=== 1. Modelo qwen3:8b cargado ==="
TAGS=$(curl -sf "${OLLAMA_HOST}/api/tags" || true)
if echo "$TAGS" | grep -q 'qwen3:8b'; then
  echo "OK: qwen3:8b está en /api/tags"
else
  echo "FAIL: no aparece qwen3:8b. Ejecuta: ollama pull qwen3:8b"
  FAIL=1
fi

echo
echo "=== 2. RAM / CPU (revisión manual) ==="
echo "Esperado: contenedor ollama RSS <= 8.2 GB, CPU ~6 hilos (600%)."
if command -v docker >/dev/null 2>&1; then
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null || true
else
  echo "docker no está en PATH; usa htop / docker stats en la VPS."
fi

echo
echo "=== 3. Inferencia en caliente (P90 < 15s objetivo) ==="
START=$(date +%s)
if curl -sf "${OLLAMA_HOST}/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3:8b","stream":false,"think":false,"keep_alive":"30m","options":{"num_ctx":4096,"num_thread":6,"num_predict":40},"messages":[{"role":"user","content":"Responde en una frase: hola"}]}' \
  >/tmp/noa-ollama-smoke.json 2>/dev/null; then
  END=$(date +%s)
  echo "OK: respuesta en $((END - START))s"
  head -c 240 /tmp/noa-ollama-smoke.json; echo
else
  echo "FAIL: /api/chat no respondió. Primera carga en frío puede tardar 90-120s."
  FAIL=1
fi

echo
echo "=== 4. Crisis bypass ==="
echo "El filtro léxico en chatConIAUnificado corre ANTES de Ollama."
echo "Probar POST /api/chats/ia con un mensaje de crisis: no debe llamar al LLM."

echo
echo "=== 5. Perfil + historial ==="
echo "Con un usuario que ya habló con NOA, el log [NOA DEBUG] debe mostrar personalizacion=true"
echo "y turnosHistorial > 0. El system prompt debe incluir PERSONALIZACIÓN PARA ESTE USUARIO."

echo
if [ "$FAIL" -eq 0 ]; then
  echo "Checklist automático: PASS (completa los puntos 2, 4 y 5 a mano)."
  exit 0
fi
echo "Checklist automático: FAIL"
exit 1
