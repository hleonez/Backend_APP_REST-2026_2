# Mejoras del Chatbot NOA — Documentación Técnica

Documentación de referencia de las mejoras implementadas en el chatbot NOA a lo
largo de la Fase 2 (análisis de sentimiento), Fase 3 (catálogo de estilos y
selector determinista) y Fase 5 (semáforo con dimensiones), de acuerdo con el
código real del proyecto.

---

## 1. Pipeline completo del chatbot

El flujo de un mensaje del estudiante hasta la respuesta de NOA se implementa
en `chatConIAUnificado` (`src/controllers/chat.controller.ts:424`) y en su alias
`chatConIAAvanzado` (`src/controllers/chat.controller.ts:906`). Ambos apuntan al
mismo controlador, por lo que el pipeline es idéntico para los endpoints
`POST /api/chats/ia` y `POST /api/chats/ia/avanzado`.

Paso a paso:

1. **Recepción y validación del mensaje**
   - Se valida el cuerpo con `chatIASchema` (`zod`); requiere un campo `mensaje`
     no vacío.
   - Se obtiene el `chatIAId` con `getOrCreateIAChat` (`chat.controller.ts:211`):
     reutiliza un chat activo de IA del usuario (`isSendByAi = true`, `is_active
     = true`, `psicologo_id = null`) o crea uno nuevo si no existe.

2. **Detección de crisis (capa prioritaria)**
   - `detectarAlertaCritica` (`chat.controller.ts:198`) compara el mensaje
     normalizado (sin tildes, en minúsculas) contra `PALABRAS_ALERTA_CRITICA`
     (`chat.controller.ts:24`) — una lista de frases de riesgo suicida,
     autolesión, crisis, etc.
   - Si es crítico, el flujo **no depende del encoder de sentimiento**: responde
     con texto fijo de contención, guarda la interacción con
     `guardarInteraccionIA` y deriva el caso con `escalarASalvavidas`
     (`chat.controller.ts:328`) a un moderador (`id_rol = 4`) o psicólogo
     (`id_rol = 2`).

3. **Historial y modo**
   - `obtenerHistorialReciente` carga hasta 10 mensajes previos del chat para
     dar contexto (`chat.controller.ts:169`).
   - `detectarModoProfundo` clasifica el mensaje como `profundo` o `normal`
     según longitud o palabras clave (`chat.controller.ts:148`).

4. **Análisis de sentimiento (Fase 2)**
   - `analizarSentimiento` (`src/services/sentimiento.service.ts:78`) invoca al
     microservicio Python (pysentimiento/RoBERTuito) vía `POST /analyze` con la
     URL de `SENTIMENT_API_URL`.
   - Devuelve `{ label: 'NEG' | 'NEU' | 'POS', confianza, scores, origen }`.
   - **Nunca lanza excepción**: ante timeout (2 s), error de red o formato
     inesperado devuelve un `FALLBACK_SEGURO` neutral (`NEU`, confianza 0,
     origen `'fallback'`) para no interrumpir el chat.

5. **Construcción de contexto personal y estilo**
   - En paralelo (`Promise.all`, `chat.controller.ts:514`) se obtienen:
     - la última evaluación del usuario `obtenerUltimaEvaluacion`
       (`chat.controller.ts:795`);
     - el perfil emocional `analizarPatronesEmocionales`
       (`src/services/user-profile.service.ts:34`);
     - los últimos 5 registros emocionales `obtenerRegistrosEmocionales`
       (`chat.controller.ts:831`).
   - `elegirEstilo` (`src/services/selector-estilo.service.ts:97`) decide el
     estilo de respuesta de forma determinista (ver sección 3).

6. **Generación de la respuesta**
   - `chatWithOllama` (`src/services/ollama.service.ts`) construye el prompt a
     partir del estilo elegido (`prompts-enhanced.service.ts`) y lo envía al
     modelo local Ollama.
   - El estilo elegido se convierte en el system prompt mediante
     `construirPromptDinamico` y en el user prompt mediante
     `construirPromptFinal`, que inyecta la variante de fraseo del estilo
     (`obtenerEstiloRespuesta`).
   - La llamada está limitada por un `Promise.race` con timeout de 70 s
     (`chat.controller.ts:549`).

7. **Persistencia**
   - `guardarInteraccionIA` (`chat.controller.ts:245`) inserta **dos** filas en
     `mensajes_chat`: el mensaje del estudiante y la respuesta de NOA. Para el
     mensaje del estudiante, si hubo sentimiento, se persisten las columnas
     `sentimiento` (label), `confianza` y `sentimiento_scores` (JSON).
   - En el flujo de crisis el mensaje se guarda **sin** estos campos (el encoder
     nunca se usa).
   - Se actualiza `chats.ultima_actividad` y `isSendByAi = true`.

8. **Respuesta al usuario**
   - Se responde con `201` y el payload de `APISuccessResponse` incluyendo
     `usuario_id`, `chat_id`, `mensaje_usuario`, `respuesta_ia`, `timestamp` y
     los campos de alerta.
   - Errores de tiempo/externalización responden `503`; errores internos `500`.

---

## 2. Catálogo de estilos

El catálogo vive en `src/shared/const/estilos-respuesta.const.ts` (constante
`ESTILOS_RESPUESTA`). Está fuertemente tipado con el tipo `EstiloRespuestaId`,
que admite **exactamente 7 estilos**:

| ID | Nombre | Regla de selección (declarada) |
|---|---|---|
| `crisis_derivacion` | Derivación por crisis | Palabras clave de crisis (`PALABRAS_ALERTA_CRITICA`). Prioridad máxima; no depende del encoder. |
| `contencion_emocional` | Contención emocional | Sentimiento `NEG` con confianza ≥ 0.6. |
| `apoyo_practico` | Apoyo práctico | `NEG` con confianza entre 0.35 y < 0.6, o `NEU` con problema concreto detectado. |
| `orientacion_por_dominio` | Orientación por dominio | Semáforo amarillo/rojo en un dominio específico + `NEG` moderado. |
| `refuerzo_positivo` | Refuerzo positivo | `POS` con confianza ≥ 0.6. |
| `conversacion_neutral` | Conversación neutral | `NEU` dominante sin riesgo. |
| `check_in_seguimiento` | Check-in de seguimiento | Más de 3 días sin hablar con NOA, o registro emocional pendiente. |

Cada estilo define:
- `nombre`
- `reglas_de_seleccion` (texto descriptivo)
- `especificaciones_obligatorias` (instrucciones que se inyectan en el system
  prompt)
- `prohibiciones_extra`
- `longitud_palabras: { min, max }`

Además existen `REGLAS_GLOBALES_ESTILOS` (`estilos-respuesta.const.ts:35`), que
se refuerzan **siempre** e independientemente del estilo activo: no dar
diagnósticos clínicos, no usar viñetas ni listas numeradas, no decir "soy IA",
evitar frases genéricas y respetar la longitud del estilo activo.

El catálogo también expone `obtenerEstiloPorId`, que resuelve un ID al objeto de
estilo o lanza error si es desconocido.

---

## 3. Reglas de selección

La selección se implementa en `elegirEstilo`
(`src/services/selector-estilo.service.ts:97`). Es una función **pura y
determinista**: dado el mismo conjunto de entradas devuelve siempre el mismo
estilo.

Entradas (`ElegirEstiloParams`):
- `sentimiento`: `{ label: 'NEG'|'NEU'|'POS', confianza: number }`
- `semaforo`: `'verde' | 'amarillo' | 'rojo' | null`
- `subcategoria`: dominio específico alertado (`string | null`)
- `perfil`: emociones frecuentes, temas recurrentes, patrones, días sin
  comunicación, `tiene_historial`
- `ultimosRegistros`: registros emocionales recientes
- `onboarding`: `boolean`
- `esCritico`: `boolean`
- `problemaDetectado`: `boolean` opcional

Umbrales constantes (`selector-estilo.service.ts:45`):
- `UMBRAL_NEG_ALTO = 0.6`
- `UMBRAL_NEG_MODERADO = 0.35`
- `UMBRAL_POS_ALTO = 0.6`
- `DIAS_SIN_HABLAR_CHECKIN = 3`

Orden real de evaluación (prioridad) — **las que existen en el código**:

1. `esCritico` → **`crisis_derivacion`** (máxima prioridad, antes del encoder).
2. `label === 'NEG'` y `confianza >= 0.6` → **`contencion_emocional`**.
3. Semáforo en alerta (`amarillo`/`rojo`), `subcategoria` no vacía, `NEG` y
   `confianza >= 0.35` → **`orientacion_por_dominio`** (se evalúa antes que
   `apoyo_practico` aunque sea una condición más específica del mismo rango).
4. (`NEG` con `0.35 <= confianza < 0.6`) o (`NEU` con `problemaDetectado`) →
   **`apoyo_practico`**.
5. `label === 'POS'` y `confianza >= 0.6` → **`refuerzo_positivo`**.
6. Si **no** está en `onboarding`: `dias_sin_comunicacion > 3` o registro
   emocional pendiente (arreglo vacío) → **`check_in_seguimiento`**.
7. Catch-all → **`conversacion_neutral`**.

Notas de diseño documentadas en el propio selector: las reglas 3 y 6 se evalúan
antes de las 4 y 7, respectivamente, para evitar "reglas muertas". El resultado
final mantiene la prioridad de negocio: crisis > malestar emocional > refuerzo
positivo > seguimiento > conversación por defecto.

> **Pendiente relevante:** aunque la tabla BD tiene dimensiones de semáforo (ver
> sección 4), el pipeline actual del chat pasa `subcategoria: undefined` al
> selector (ver `chat.controller.ts:525-528`, comentario "No existe todavia un
> clasificador de dominio"). Por tanto, en la práctica **la regla 3
> (`orientacion_por_dominio`) no se activa hoy** en el flujo real del chat, pese
> a existir en el catálogo y en el selector. Solo la versión "testeable aislada"
> puede activarla si se le pasa `subcategoria`.

---

## 4. Dimensiones del semáforo

### Dimensiones implementadas

Las **siete dimensiones** están definidas en
`src/shared/utils/semaforo-dimensiones.utils.ts:18`
(`DIMENSIONES_SEMAFORO`):

- `ansiedad`
- `estres_academico`
- `humor_depresivo`
- `sueno`
- `relaciones_sociales`
- `autoestima_autocuidado`
- `energia_motivacion`

Existen además los valores `NivelSemaforo` (`verde`|`amarillo`|`rojo`) y la
dimensión de respaldo `general`.

### Almacenamiento en BD

- Tabla `semaforo_dimensiones` (`src/db/schema.ts:112`): guarda por cada
  evaluación el detalle `dimension`, `puntaje` (0–100) y `nivel`
  (`verde`|`amarillo`|`rojo`).
- En `evaluaciones` (`src/db/schema.ts:87`) existe `subcategoria_principal`, con
  formato `<color_global>_<dimension_dominante>` (ej. `"rojo_ansiedad"`), que se
  construye con `construirSubcategoriaPrincipal`.
- `preguntas_registro_emocional.categoria` (`src/db/schema.ts:276`): etiqueta la
  dimensión evaluada por cada pregunta del registro emocional (seed).
- Las preguntas de la **evaluación clásica** (`preguntas`) no tienen columna
  `categoria`; se clasifican por heurística de palabras clave
  (`clasificarDimensionPorTexto`) solo en `ollama.service.ts` /
  `asignacion-semaforo.controller.ts`.

### Cómo participan en el flujo

- `calcularNivelPorPuntaje` y `agruparPuntajesPorDimension`
  (`semaforo-dimensiones.utils.ts:49,104`) computan el nivel por dimensión a
  partir de puntajes normalizados 0–100.
- `determinarDimensionDominante` elige la dimensión con peor nivel (y, en
  empate, mayor puntaje, y luego orden alfabético para determinismo).
- Estos cálculos se usan en `ollama.service.ts` (análisis de la evaluación) y en
  `asignacion-semaforo.controller.ts` (asignación combinada con el registro
  emocional) para producir `evaluaciones.estado_semaforo` y
  `evaluaciones.subcategoria_principal`.

> **Pendiente:** en el chatbot NOA, el semáforo participa a través de
> `estado_semaforo` de la última evaluación (último semáforo), que se pasa al
> selector como `semaforo` (ver sección 5). Las **dimensiones por
> subcategoría** todavía no se consumen en el chat.

---

## 5. Onboarding

### Cuándo se activa

El `onboarding` es `true` **cuando el usuario no tiene ninguna evaluación
prevista**: en `chat.controller.ts:520`:

```
const onboarding = !evaluacion;
```

Es decir, un estudiante que aún no ha completado su evaluación inicial (tabla
`evaluaciones`) se considera en estado de onboarding.

### Qué información utiliza

En onboarding se pasa al selector (`chat.controller.ts:522`):
- `onboarding: true`
- `semaforo`: obtenido vía `normalizarSemaforo(evaluacion?.estado_semaforo)`.
  Como en onboarding no hay evaluación, `evaluacion` es `null`, por lo que este
  valor es `undefined`.
- `perfil`: construido desde `analizarPatronesEmocionales` (que requiere
  historial de mensajes; en un usuario nuevo suele estar vacío).
- `ultimosRegistros`: los últimos registros emocionales.
- `subcategoria`: `undefined` (ver sección 3).

### Efecto sobre la selección

En `selector-estilo.service.ts:150-158`, la regla `check_in_seguimiento` se
**omite durante el onboarding** (un usuario nuevo no tiene un "hace X días"
significativo ni registro previo). El resto de reglas deterministas aplican con
normalidad, y ante falta de información tiende a caer en `conversacion_neutral`.

---

## 6. Flujo determinista

### Cómo funciona

El corazón determinista del chatbot es `elegirEstilo`
(`src/services/selector-estilo.service.ts`): una función pura que, dado el
sentimiento, el semáforo, la subcategoría, el perfil, los registros y el flag de
onboarding, decide el estilo mediante una **cadena de `if`/`return` en orden
fijo**, sin aleatoriedad ni estado. Esto sustituyó a la anterior rotación
`numeroMensaje % 6`.

### Decisiones tomadas de forma determinista

1. **Estilo de respuesta** (sentimiento + semáforo + perfil + subcategoría +
   onboarding) — sección 3.
2. **Fraseo** dentro del estilo: `obtenerEstiloRespuesta`
   (`prompts-enhanced.service.ts:180`) elige variante por `numeroMensaje %
   variantes.length`. `numeroMensaje` **solo varía el fraseo y para debugging**;
   ya no participa en la elección del estilo.
3. **Derivación por crisis**: `detectarAlertaCritica` por coincidencia literal
   de palabras clave (`PALABRAS_ALERTA_CRITICA`), antes del encoder.

### Relación con sentimiento, semáforo y estilo

- **Sentimiento** (`analizarSentimiento`) y **semáforo** (última evaluación) son
  las **entradas** del selector: el primero califica el mensaje actual; el
  segundo aporta el contexto global del usuario.
- **El selector** convierte esas entradas en el **estilo de respuesta**.
- **El estilo** moldea el system prompt (`construirPromptDinamico` —
  especificaciones, prohibiciones y longitud) y el user prompt
  (`construirPromptFinal` — variante de fraseo), es decir, **condiciona la
  generación del LLM**, aunque la generación en sí (texto final) sigue siendo no
  determinista por naturaleza del modelo Ollama.

### Puntos no deterministas (a documentar con honestidad)

- El **texto final** producido por Ollama es generado por el LLM y no es
  determinista, aunque está fuertemente guiado por el estilo determinista.
- Las **respuestas fallback** de `generarRespuestaFallbackNatural`
  (`prompts-enhanced.service.ts:214`) usan `Math.random()` para elegir una
  variante si Ollama falla.

---

## Archivos de referencia

| Componente | Ruta |
|---|---|
| Pipeline del chat | `src/controllers/chat.controller.ts` |
| Selector determinista | `src/services/selector-estilo.service.ts` |
| Catálogo de estilos | `src/shared/const/estilos-respuesta.const.ts` |
| Prompts y variantes de fraseo | `src/services/prompts-enhanced.service.ts` |
| Cliente de sentimiento (Robertuito) | `src/services/sentimiento.service.ts` |
| Análisis de perfil emocional | `src/services/user-profile.service.ts` |
| Utilidades de dimensiones del semáforo | `src/shared/utils/semaforo-dimensiones.utils.ts` |
| Microservicio de sentimiento (FastAPI) | `sentiment/app/main.py` |
| Esquema de BD | `src/db/schema.ts` |
| Endpoints del chatbot | `src/routes/chat.routes.ts` |