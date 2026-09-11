# Backend — Resumen Técnico para Frontend (Fases 1–7)

Documento de handoff para el equipo de frontend. Describe cada funcionalidad implementada en el backend, los endpoints disponibles y las acciones concretas que el frontend debe tomar para aprovecharlas.

---

## Fase 1 y 2 — Análisis de Sentimiento en Mensajes del Chat

### Qué hace
Cada mensaje que el estudiante envía al chatbot NOA es analizado automáticamente por un microservicio de sentimiento (Robertuito). El resultado se almacena junto al mensaje en la base de datos.

### Qué recibirá el frontend
Cuando consulte el historial de mensajes de un chat, cada mensaje del estudiante ahora incluye 3 campos adicionales:

```json
{
  "sentimiento": "NEG",
  "confianza": 0.972,
  "sentimiento_scores": { "NEG": 0.972, "NEU": 0.021, "POS": 0.007 }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `sentimiento` | `string \| null` | `"NEG"`, `"NEU"` o `"POS"`. Null si el mensaje es del psicólogo o del bot. |
| `confianza` | `number \| null` | Confianza de la clasificación (0 a 1). |
| `sentimiento_scores` | `object \| null` | Probabilidades individuales por clase. |

### Acción del frontend
- **Chat:** No es obligatorio mostrar el sentimiento al estudiante. Es información interna para el chatbot.
- **Panel del psicólogo / admin:** Se recomienda mostrar un indicador visual del sentimiento reciente del estudiante (ícono de color, barra de tendencia) para que el profesional pueda monitorear el estado emocional sin leer cada mensaje.
- **Dashboard de estadísticas:** Mostrar distribución de sentimientos (NEG/NEU/POS) en el tiempo como gráfica de línea o área.

### Notas importantes
- Los mensajes del bot (`isSendByAi = true`) y del psicólogo **no** tienen sentimiento (será `null`).
- Si el microservicio de sentimiento no está disponible, el sistema usa un fallback seguro con sentimiento `"NEU"`. Esto no afecta al frontend.

---

## Fase 3 — Catálogo de Estilos de Respuesta del Chatbot

### Qué hace
El chatbot NOA ya no rota respuestas genéricas. Ahora selecciona automáticamente un estilo de respuesta basándose en el sentimiento del estudiante, el semáforo y otros factores contextuales.

### Los 7 estilos disponibles

| # | Estilo | Cuándo se activa |
|---|---|---|
| 1 | `crisis_derivacion` | Palabras clave de crisis. Prioridad máxima. |
| 2 | `contencion_emocional` | Sentimiento negativo fuerte (≥ 0.6). |
| 3 | `apoyo_practico` | Negativo moderado (0.35–0.6). |
| 4 | `orientacion_por_dominio` | Semáforo amarillo/rojo en una dimensión + negativo moderado. |
| 5 | `refuerzo_positivo` | Sentimiento positivo fuerte (≥ 0.6). |
| 6 | `conversacion_neutral` | Sentimiento neutro dominante. |
| 7 | `check_in_seguimiento` | Más de 3 días sin hablar o sin registro emocional. |

### Acción del frontend
- **No se requiere cambios funcionales.** El backend gestiona todo internamente.
- **Opcional:** En el panel del psicólogo, mostrar el estilo que se usó en cada respuesta del bot (campo adicional en el mensaje si se habilita en el futuro).
- **UX:** Si el usuario lleva días sin usar la app, el chatbot le escribirá primero con un tono amable (`check_in_seguimiento`). El frontend debe permitir recibir estos mensajes proactivos si se implementa notificación push.

---

## Fase 4 — Contexto de Bienestar Consolidado

### Qué hace
Antes de generar cada respuesta, el chatbot construye un bloque de contexto con 4 fuentes de datos reales:

1. **Semáforo actual:** color, subcategoría y puntaje global.
2. **Registro emocional últimos 7 días:** promedio por dimensión.
3. **Resultados del onboarding:** línea base por dimensión (solo si el estudiante completó el onboarding).
4. **Perfil emocional:** emociones frecuentes, temas recurrentes, patrones, días sin conversación.

### Acción del frontend
- **No se requiere cambios funcionales.** El frontend no consume este servicio directamente; es interno del chatbot.
- **Importante:** Para que el contexto funcione al 100%, el estudiante **debe completar el onboarding** (Fase 7). Si no lo ha hecho, el contexto de bienestar funcionará con datos parciales.
- **UX recomendada:** After registro, redirigir al onboarding antes de permitir usar el chat.

---

## Fase 5 — Semáforo con Subcategorías y Dimensiones

### Qué hace
El sistema de semáforo (verde/amarillo/rojo) ahora se enriquece con 7 dimensiones específicas:

| Dimensión | Qué mide |
|---|---|
| `ansiedad` | Niveles de ansiedad y preocupación |
| `estres_academico` | Estrés por carga académica |
| `humor_depresivo` | Estado de ánimo y tristeza |
| `sueno` | Calidad del sueño |
| `relaciones_sociales` | Conexión con otros |
| `autoestima_autocuidado` | Valoración personal y autocuidado |
| `energia_motivacion` | Nivel de energía e interés |

### Qué recibirá el frontend

**Al consultar una evaluación** (`GET /api/evaluaciones` o `GET /api/evaluaciones/:id`), la respuesta ahora incluye:

```json
{
  "subcategoria_principal": "rojo_ansiedad",
  "dimensiones": [
    { "dimension": "ansiedad", "puntaje": 82, "nivel": "rojo" },
    { "dimension": "estres_academico", "puntaje": 55, "nivel": "amarillo" },
    { "dimension": "sueno", "puntaje": 30, "nivel": "verde" }
  ]
}
```

| Campo | Descripción |
|---|---|
| `subcategoria_principal` | Formato `<color>_<dimensión_dominante>`. Es la dimensión con peor nivel. |
| `dimensiones` | Array con el puntaje (0–100) y nivel de cada dimensión evaluada. |

### Acción del frontend
- **Pantalla de resultados de evaluación:** Mostrar un semáforo general + un desglose por dimensiones con indicadores de color por dimensión.
- **Dashboard del psicólogo:** Mostrar la evolución de dimensiones individuales en el tiempo (chart de líneas por dimensión).
- **Subcategoría principal:** Usarla como etiqueta o badge junto al semáforo general (ej: "Ansiedad" en rojo).

---

## Fase 6 — Encuesta Diaria Adaptativa (Registro Emocional)

### Qué hace
Las preguntas del registro emocional diario ya no son aleatorias. Ahora el backend prioriza preguntas de la dimensión dominante (la que tiene peor nivel en el semáforo) y rota las demás para mantener cobertura general.

### Algoritmo
1. Detecta la dimensión dominante del estudiante (del semáforo o de registros recientes).
2. Selecciona **3 preguntas** de esa dimensión.
3. Completa con **2 preguntas** de otras dimensiones que no se hayan respondido en los últimos 7 días.
4. Si no hay historial, elige 5 preguntas balanceadas al azar.

### Qué recibirá el frontend

**`GET /api/registro-emocional/preguntas`** ahora retorna preguntas con su categoría:

```json
[
  {
    "id": 1,
    "texto": "¿Con qué frecuencia sientes tensión física?",
    "categoria": "ansiedad",
    "opciones": [...]
  },
  {
    "id": 8,
    "texto": "¿Cómo ha sido la calidad de tu sueño?",
    "categoria": "sueno",
    "opciones": [...]
  }
]
```

### Acción del frontend
- **Mostrar la categoría de cada pregunta** como tag o label (ej: badge "Ansiedad", "Sueño", "Energía"). Esto ayuda al estudiante a entender qué se está evaluando.
- **Agrupar visualmente** las preguntas por dimensión si se desea una experiencia más estructurada.
- **No bloquear** si el estudiante no responde todas las dimensiones en un día; el sistema se encarga de la rotación automática al día siguiente.

---

## Fase 7 — Encuesta Inicial de Onboarding

### Qué hace
Al registrarse, el estudiante puede completar una encuesta de bienestar inicial (18 preguntas en las 7 dimensiones canónicas). Esta encuesta establece su línea base y alimenta el contexto del chatbot.

### Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/onboarding/preguntas` | Obtiene las preguntas del onboarding y el estado de completitud. |
| `POST` | `/api/onboarding/respuestas` | Guarda las respuestas y marca el onboarding como completado. |
| `GET` | `/api/onboarding/estado` | Consulta si el usuario ya completó el onboarding. |

**Autenticación:** Todos los endpoints requieren header `Authorization: Bearer <token>`.

### Detalle de cada endpoint

#### GET /api/onboarding/preguntas
Respuesta:
```json
{
  "encuesta_id": 1,
  "titulo": "Encuesta Inicial de Bienestar",
  "completado": false,
  "preguntas": [
    {
      "id": "onb_01",
      "texto": "¿Cómo describirías tu nivel de ansiedad en general?",
      "categoria": "ansiedad",
      "escala": "0-4"
    },
    {
      "id": "onb_02",
      "texto": "¿Con qué frecuencia sientes preocupación excesiva?",
      "categoria": "ansiedad",
      "escala": "0-4"
    }
  ]
}
```

#### POST /api/onboarding/respuestas
Body:
```json
{
  "respuestas": [
    { "pregunta_id": "onb_01", "puntaje": 2 },
    { "pregunta_id": "onb_02", "puntaje": 3 },
    { "pregunta_id": "onb_03", "puntaje": 1 }
  ]
}
```

Respuesta exitosa:
```json
{ "message": "Onboarding completado exitosamente" }
```

Errores posibles:
- `409` — El usuario ya completó el onboarding anteriormente.
- `400` — Datos inválidos (faltan respuestas o puntajes fuera de rango 0–4).

#### GET /api/onboarding/estado
Respuesta:
```json
{ "completado": true }
```

### Escala de respuesta (Likert 0–4)

| Puntaje | Significado |
|---|---|
| 0 | Muy mal |
| 1 | Mal |
| 2 | Normal |
| 3 | Bien |
| 4 | Excelente |

### Acción del frontend — Flujo de onboarding recomendado

1. **After registro:** Consultar `GET /api/onboarding/estado`.
2. **Si `completado: false`:**
   - Redirigir a la pantalla de onboarding.
   - Llamar `GET /api/onboarding/preguntas` para obtener las 18 preguntas.
   - Renderizar las preguntas con escala 0–4 (sliders, botones o estrellas).
   - Al enviar: `POST /api/onboarding/respuestas` con todas las respuestas.
3. **Si `completado: true`:** No mostrar onboarding. Ir directamente al home o chat.
4. **No bloquear la app:** El onboarding es recomendado, no obligatorio. Si el estudiante lo omite, puede acceder al chat pero el contexto del bot será menos preciso.

### UX recomendada para las preguntas
- Mostrar **2–3 preguntas por pantalla** con scroll horizontal (paginación).
- Incluir un **indicador de progreso** (ej: "Pregunta 5 de 18").
- Mostrar la **categoría** de cada pregunta como badge (ej: "Sueño", "Ansiedad").
- Permitir **guardar y continuar después** (opcional, si se implementa guardado parcial).
- Al finalizar, mostrar una pantalla de confirmación con animación de éxito.

---

## Resumen de endpoints para el frontend

| Módulo | Método | Ruta | Requiere auth |
|---|---|---|---|
| Onboarding | `GET` | `/api/onboarding/preguntas` | Sí |
| Onboarding | `POST` | `/api/onboarding/respuestas` | Sí |
| Onboarding | `GET` | `/api/onboarding/estado` | Sí |
| Chat | `POST` | `/api/chats/ia` | Sí |
| Chat | `GET` | `/api/chats/:id/mensajes` | Sí |
| Evaluaciones | `GET` | `/api/evaluaciones` | Sí |
| Evaluaciones | `GET` | `/api/evaluaciones/:id` | Sí |
| Registro Emocional | `GET` | `/api/registro-emocional/preguntas` | Sí |
| Registro Emocional | `POST` | `/api/registro-emocional` | Sí |

---

## Prioridad de implementación para el frontend

| Prioridad | Acción | Impacto |
|---|---|---|
| **Alta** | Implementar flujo de onboarding (3 endpoints) | Habilita el contexto completo del chatbot |
| **Alta** | Mostrar categorías en preguntas del registro emocional | Mejora la experiencia diaria |
| **Media** | Mostrar desglose de dimensiones en resultados de evaluación | Visualización rica del semáforo |
| **Media** | Mostrar indicadores de sentimiento en panel del psicólogo | Monitoreo profesional |
| **Baja** | Mostrar estilo de respuesta del bot (futuro) | Transparencia del sistema |
