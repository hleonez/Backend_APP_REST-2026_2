# 🚀 GUÍA DE IMPLEMENTACIÓN - NOA Mejorado

## ✅ Pasos para Desplegar

### 1. **Compilar el código**
```bash
cd Backend_APP_REST
npm run build
# O si prefieres desarrollo:
npm run dev
```

### 2. **Asegurar que Ollama está corriendo**
```bash
# En tu máquina local o servidor
ollama serve

# En otra terminal, verificar modelo
ollama pull qwen2:1.5b
```

### 3. **Verificar que Docker está activo**
```bash
# En la raíz del proyecto
docker-compose up -d
# Esto levanta: app, ollama, postgres
```

### 4. **Probar con Postman o cURL**

**Enviar 5 mensajes seguidos** (para ver los 6 estilos de respuesta):

```bash
# Mensaje 1 - Estilo "Pregunta Provocadora"
curl -X POST http://localhost:3000/api/chats/ia \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mensaje":"Tengo mucho estrés por los exámenes"}'

# Respuesta esperada:
# - Pregunta inesperada pero relevante
# - No empieza con "Hola"
```

```bash
# Mensaje 2 - Estilo "Dato Curioso"
curl -X POST http://localhost:3000/api/chats/ia \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mensaje":"¿Cómo puedo manejar mejor la ansiedad?"}'

# Respuesta esperada:
# - Incluye un dato interesante o tip
# - Conecta con la situación
```

**Y así sucesivamente...**

---

## 🔍 Cómo Verificar que Funciona

### Test 1: **Variedad de Respuestas**
✅ Envía el mismo mensaje 3 veces
- Debe variar la respuesta
- No debería sonar idéntico

### Test 2: **Perfil del Usuario**
✅ Habla de temas académicos en 3+ mensajes
- Luego espera 1 minuto
- Envía otro mensaje
- NOA debería mencionar o recordar el patrón (si el perfil está cargado)

### Test 3: **Variedad sin "Hola"**
✅ Busca en los logs que NOA no diga siempre "Hola"
- Mensaje 1: Puede empezar diferente
- Mensaje 2: Otro inicio
- Etc.

### Test 4: **Tips y Datos Curiosos**
✅ Cuando preguntes sobre ansiedad, estrés, o cansancio
- Debería ocasionalmente ofrecer un tip
- "Técnica 4-7-8", "70% de estudiantes", etc.

### Test 5: **Fallbacks Naturales**
✅ Si Ollama se cae o tarda mucho
- Respuesta debe ser natural
- No debe parecer robótica
- Ejemplo: "La ansiedad es incómoda. ¿Hace cuánto la sientes?"

---

## 📊 Archivos Modificados/Creados

| Archivo | Tipo | Cambios |
|---------|------|---------|
| `src/services/prompts-enhanced.service.ts` | ✨ NUEVO | 6 estilos de respuesta dinámicos |
| `src/services/user-profile.service.ts` | ✨ NUEVO | Perfil y análisis de usuario |
| `src/services/ollama.service.ts` | 🔧 MODIFICADO | Nueva función chatWithOllama mejorada |
| `src/controllers/chat.controller.ts` | 🔧 MODIFICADO | Pasar userId y numeroMensaje |
| `MEJORAS_NOA.md` | 📝 NUEVO | Documentación completa |

---

## ⚙️ Debugging

### Si las respuestas siguen siendo robóticas:
1. Verifica que `prompts-enhanced.service.ts` se esté usando
2. Comprueba logs para ver qué estilo se selecciona
3. Asegúrate que `numeroMensaje` está siendo contado correctamente

### Si no detecta el perfil:
1. Revisa que `user-profile.service.ts` no tenga errores
2. Verifica que hay al menos 6 mensajes previos en el chat
3. Comprueba logs de `analizarPatronesEmocionales`

### Si Ollama no responde:
1. Ollama debe estar corriendo: `ollama serve`
2. URL debe ser: `http://localhost:11434`
3. Modelo debe ser: `qwen2:1.5b`

### Si hay timeout (70 segundos):
1. Ollama puede estar lento
2. Reduce la complejidad del prompt
3. Aumenta timeout si hardware es limitado

---

## 🎯 KPIs de Éxito

Después de desplegar, verifica:

| Métrica | Meta | Cómo verificar |
|---------|------|----------------|
| **Variedad de respuestas** | 6 estilos diferentes | 6+ mensajes iguales → deben variar |
| **Ausencia de repetición "Hola"** | <20% de "Hola" | Revisar 10 respuestas, contar inicios |
| **Perfil del usuario funciona** | Menciona datos previos | 5 mensajes sobre estrés → debería reconocer patrón |
| **Tips incluidos** | 1 cada 5 respuestas | Envía 5 mensajes, busca datos curiosos |
| **Fallbacks naturales** | Parecen reales | Apaga Ollama, verifica respuesta |

---

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
docker logs -f backend_app_n1  # O el nombre de tu contenedor

# Reiniciar solo la app
docker-compose restart app

# Reiniciar todo
docker-compose down
docker-compose up -d

# Compilar sin Docker
npm install
npm run build

# Ejecutar en desarrollo
npm run dev

# Ver estado de Ollama
curl http://localhost:11434/api/tags
```

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs (`docker logs`)
2. Verifica que Ollama esté corriendo
3. Confirma que PostgreSQL tiene datos
4. Prueba un mensaje simple sin contexto

---

## ✨ Próximos Pasos (Opcionales)

1. **Entrenar mejor el perfil**
   - Aumentar límite de mensajes analizados de 30 a 50

2. **Agregar memoria emocional**
   - Guardar "emoción principal del día" en tabla especial
   - Mostrar "Has estado mejor/peor últimamente"

3. **Integrar más modelos**
   - Probar `llama2:7b` si hardware lo permite
   - A/B testing: qué modelo suena más natural

4. **Dashboard de perfil**
   - Mostrar al usuario su perfil emocional
   - Gráficos de evolución

