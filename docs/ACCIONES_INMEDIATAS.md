# ⚡ ACCIONES INMEDIATAS - NOA Mejorado

## 🚀 PASO A PASO PARA ACTIVAR LAS MEJORAS

### PASO 1: Compilar y Desplegar (5 min)

```bash
# Ve a la carpeta del backend
cd Backend_APP_REST

# Instala dependencias (si aún no lo hiciste)
npm install

# Compila
npm run build

# Reinicia con Docker
docker-compose down
docker-compose up -d

# Espera 30 segundos a que levante
```

**Verifica que esté funcionando:**
```bash
# Debería mostrar: "listening on port 3000"
docker logs backend_app_n1 | tail -20
```

---

### PASO 2: Prueba Rápida con Postman (3 min)

1. **Abre Postman**
2. **Crea una solicitud POST:**
   - URL: `http://localhost:3000/api/chats/ia`
   - Headers:
     - `Authorization: Bearer {TU_JWT_TOKEN}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "mensaje": "Tengo mucho estrés por los exámenes"
     }
     ```

3. **Envía 5 mensajes seguidos**
   - **ESPERA:** Cada respuesta debería ser DIFERENTE en estilo
   - **BUSCA:** No siempre empieza con "Hola"

---

### PASO 3: Monitoreo (Opcional pero recomendado)

```bash
# En una terminal, ver logs en tiempo real
docker logs -f backend_app_n1

# Busca líneas como:
# - "Estilo actual: 1" (varía por mensaje)
# - "Perfil cargado: [emociones]"
# - Errores si hay
```

---

### PASO 4: Validación Completa (10 min)

**Test 1 - Variedad de Respuestas**
```bash
# Envía el MISMO mensaje 3 veces
mensaje: "Estoy ansioso"

Respuesta 1: Debería ser diferente a...
Respuesta 2: que debería ser diferente a...
Respuesta 3:

✅ PASS: 3 respuestas distintas
❌ FAIL: Respuestas iguales → revisar prompts
```

**Test 2 - Sin repetir "Hola"**
```bash
# Envía 5 mensajes diferentes
# Revisa que "Hola" aparezca en menos del 20% de inicios

Ejemplo: 
- "Escúchame, eso que..."
- "Eso del estrés..."
- "Hola, veo que..."
- "Cuando dices..."
- "Eso que mencionas..."

✅ PASS: Variedad en inicios
❌ FAIL: Siempre "Hola" → problema con estilos
```

**Test 3 - Perfil del Usuario**
```bash
# Envía 3+ mensajes sobre ESTRÉS ACADÉMICO
# Luego espera 1 minuto
# Envía otro mensaje DIFERENTE (no sobre estrés)

NOA debería:
✅ PASS: Mencionar o recordar que hablaron de estrés
✅ PASS: No repetir la misma validación
❌ FAIL: Ignorar conversaciones previas
```

**Test 4 - Tips & Datos Curiosos**
```bash
# En al menos 1 de 5 respuestas debería haber:
- Un dato interesante ("73% de estudiantes")
- Una técnica ("4-7-8")
- Un consejo nuevo

✅ PASS: Ofrece tips ocasionalmente
❌ FAIL: Nunca ofrece tips → revisar prompts-enhanced
```

**Test 5 - Fallbacks Naturales**
```bash
# Detén Ollama: docker-compose stop ollama
# Envía un mensaje a NOA
# Debería dar respuesta NATURAL aunque falle

✅ PASS: "La ansiedad es incómoda. ¿Hace cuánto...?"
❌ FAIL: "Error de conexión" → revisar fallback

# Reinicia Ollama
docker-compose start ollama
```

---

## 📋 CHECKLIST DE ÉXITO

```
[ ] Código compilado sin errores
[ ] Docker está corriendo: backend, ollama, postgres
[ ] Prueba 1: 5 mensajes → respuestas diferentes
[ ] Prueba 2: Sin "Hola" repetitivo
[ ] Prueba 3: Reconoce historial del usuario
[ ] Prueba 4: Ofrece tips ocasionalmente
[ ] Prueba 5: Fallback natural cuando falla
```

Si todos marcan ✅ → **¡ÉXITO! Las mejoras funcionan**

---

## 🐛 TROUBLESHOOTING

### Problema: "Las respuestas siguen siendo robóticas"

**Causa probable:** `prompts-enhanced.service.ts` no se está usando

**Solución:**
```bash
# 1. Verifica que el archivo existe
ls Backend_APP_REST/src/services/prompts-enhanced.service.ts

# 2. Recompila
npm run build

# 3. Reinicia
docker-compose restart app

# 4. Revisa logs
docker logs backend_app_n1 | grep "Estilo"
```

---

### Problema: "No ve el perfil del usuario"

**Causa probable:** `user-profile.service.ts` tiene error o no hay historial

**Solución:**
```bash
# 1. Verifica archivo
ls Backend_APP_REST/src/services/user-profile.service.ts

# 2. Envía 6+ mensajes (necesita historial)

# 3. Revisa logs
docker logs backend_app_n1 | grep "analizarPatronesEmocionales"

# 4. Si hay error, revisa la conexión a BD
```

---

### Problema: "Ollama no responde"

**Solución:**
```bash
# 1. Verifica que esté corriendo
curl http://localhost:11434/api/tags

# Si no funciona:
docker-compose restart ollama
ollama pull qwen2:1.5b

# Espera 2-3 minutos
```

---

### Problema: "Timeout de 70 segundos"

**Causa probable:** Ollama es muy lento

**Solución:**
```bash
# 1. Reduce complejidad del prompt
# (En prompts-enhanced.service.ts, reduce líneas)

# 2. O aumenta timeout en chat.controller.ts:
// De: 70000 a 90000

# 3. Reinicia
npm run build && docker-compose restart app
```

---

## 📞 Si Nada Funciona

1. **Verifica que todos los archivos existen:**
   ```bash
   ls -la Backend_APP_REST/src/services/
   # Debe incluir:
   # - prompts-enhanced.service.ts ✅
   # - user-profile.service.ts ✅
   # - ollama.service.ts ✅
   ```

2. **Verifica que chat.controller.ts tiene los cambios:**
   ```bash
   grep "userId" Backend_APP_REST/src/controllers/chat.controller.ts
   # Debe encontrar: "userId: req.user.id"
   ```

3. **Mira los logs completos:**
   ```bash
   docker logs backend_app_n1 -n 100
   # Busca errores al importar servicios
   ```

4. **Nuclear option - rebuild everything:**
   ```bash
   docker-compose down
   rm -rf node_modules
   npm install
   npm run build
   docker-compose up -d
   ```

---

## ✅ PRÓXIMAS MEJORAS (Opcionales)

Después de validar que esto funciona, puedes:

1. **Entrenar con más datos**
   - Aumentar `limit` de 25 a 50 en `user-profile.service.ts`
   - Detecta patrones más complejos

2. **Agregar más estilos**
   - Crear 2-3 estilos nuevos en `prompts-enhanced.service.ts`
   - Mayor variedad

3. **Dashboard emocional**
   - Mostrar al usuario su perfil
   - Gráficos de evolución

4. **A/B Testing**
   - Probar otros modelos (llama2, mistral)
   - Medir cuál suena más natural

---

## 📊 Métricas a Monitorear

Después de 1 semana, debería ver:

| Métrica | Ahora | Esperado |
|---------|-------|----------|
| Respuestas únicas | ~2-3 estilos | 6 estilos |
| Repetición de "Hola" | ~60% | <20% |
| Menciones de historial | 0% | >30% |
| Tips/datos curiosos | 0% | >15% |
| Satisfacción usuario | ? | ↑ +20% |

---

## 🎓 Resumen para tu Equipo

Si alguien pregunta qué hiciste:

> "Implementé un sistema dinámico de prompts que varía las respuestas de NOA según el mensaje número (6 estilos diferentes). Además, creé un servicio de perfil del usuario que aprende sus patrones emocionales (qué emociones tiene frecuentemente, temas recurrentes, etc.) y personaliza las respuestas. Ahora NOA no repite constantemente 'Hola' o la misma validación, sino que ofrece tips, datos curiosos y preguntas variadas. El fallback también es más natural."

**En una línea:** *"NOA pasó de sonar como chatbot a sonar como amigo real, con memoria y variedad."*

---

## 🚀 ¡Ahora a Probar!

```bash
# Copy-paste rápido:
cd Backend_APP_REST
npm run build
docker-compose down && docker-compose up -d
sleep 5
docker logs backend_app_n1 | tail -20
```

**Luego prueba en Postman y reporta cómo fue!**

