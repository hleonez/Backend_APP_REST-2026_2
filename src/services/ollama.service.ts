import { construirPromptDinamico, construirPromptFinal, generarRespuestaFallbackNatural, esRespuestaAceptable } from './prompts-enhanced.service';
import { analizarPatronesEmocionales, construirResumenPerfil } from './user-profile.service';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2:1.5b'; // Modelo balanceado para CPU

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface MentalHealthResponse {
  estado: 'verde' | 'amarillo' | 'rojo';
  puntaje: number;
  observaciones: string;
  recomendaciones: string[];
}

interface ChatResponse {
  respuesta: string;
  timestamp: string;
}

const MENSAJE_CRITICO_FALLBACK =
  'Gracias por contarmelo. Lo que estas viviendo es importante y no estas solo. Te recomiendo contactar ahora mismo al equipo de Salvavidas o a un profesional de confianza para acompanarte de inmediato.';

const RESPUESTAS_DESECHABLES = [
  'no puedo asistir',
  'no puedo ayudarte con eso',
  'como noa, no puedo',
  'no puedo apoyar en eso',
  'no puedo responder a eso',
  'fuera de mi alcance',
  'no tengo permitido',
  'hay algo mas en lo que pueda apoyarte hoy',
];

const detectarRiesgoEnTexto = (texto: string): boolean => {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const clavesAltas = [
    'suicid',
    'matarme',
    'me quiero morir',
    'no quiero vivir',
    'autoles',
    'hacerme dano',
    'lastimarme',
    'cortarme',
    'desaparecer',
    'no aguanto mas',
    'ya no puedo',
    'no tiene solucion',
  ];

  return clavesAltas.some((clave) => normalizado.includes(clave));
};

// Detecta tipo de emoción principal
const detectarEmocion = (texto: string): string => {
  const n = normalizar(texto);
  
  const emociones = {
    ansiedad: ['ansioso', 'ansiedad', 'nervios', 'nervioso', 'presion', 'preocup', 'tengo miedo'],
    tristeza: ['triste', 'tristeza', 'llor', 'deprim', 'vacio', 'sin senti', 'melanc'],
    estres: ['estres', 'agobiad', 'abrumad', 'sobrecargad', 'parcial', 'examen', 'trabajos'],
    estrés_académico: ['parcial', 'examen', 'trabajos', 'tareas', 'calificacion', 'nota', 'estudiante'],
    desmotivacion_academica: [
      'desmotiv',
      'sin interes',
      'perdiendo el interes',
      'perdi el interes',
      'no me interesa',
      'no quiero estudiar',
      'me aburre estudiar',
      'no quiero ir a clases',
      'me aburre la universidad',
    ],
    soledad: ['solo', 'aislad', 'sin nadie', 'no tengo con quien', 'alejaron', 'solitario'],
    agotamiento: ['cansado', 'agotad', 'sin energia', 'sin ganas', 'fatigad'],
    fracaso: ['fracaso', 'no sirvo', 'no puedo', 'incapaz'],
    alegria: ['feliz', 'bien', 'mejora', 'logre', 'consegui', 'orgulloso'],
    relaciones: ['familia', 'amigos', 'relacion', 'peleando', 'compañero', 'novio'],
  };
  
  for (const [emocion, palabras] of Object.entries(emociones)) {
    if (palabras.some(p => n.includes(p))) {
      return emocion;
    }
  }
  
  return 'neutral';
};

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const esRespuestaDesechable = (respuesta: string): boolean => {
  const r = normalizar(respuesta);
  return RESPUESTAS_DESECHABLES.some((patron) => r.includes(patron));
};

const construirRespuestaFallback = (mensaje: string): string => {
  if (detectarRiesgoEnTexto(mensaje)) {
    return 'Escúchame: lo que sientes es real y importante. Pero necesitas ayuda ahora mismo. Por favor llama al 123 (Salvavidas) o habla con tu familia, un profesor o consejería. Yo puedo acompañarte, pero necesitas apoyo profesional urgente. ¿Estás en un lugar seguro?';
  }

  const emocion = detectarEmocion(mensaje);
  const n = normalizar(mensaje);

  // Respuestas específicas por emoción
  if (emocion === 'estres_académico' || emocion === 'estres') {
    return 'Entiendo que te sientas abrumado. Lo primero es respirar: inhala 4, sostén 4, exhala 6. Luego, ¿cuál de esos exámenes/trabajos te preocupa más ahora? Podemos hacer un plan paso a paso.';
  }

  if (emocion === 'ansiedad') {
    return 'Esa ansiedad que sientes es real. Aquí va algo que funciona: siéntate, nota 5 cosas que ves, 4 que tocas, 3 que oyes, 2 que hueles, 1 que saboreas. ¿Hace cuánto sientes esto?';
  }

  if (emocion === 'tristeza') {
    return 'La tristeza que expreso es válida. No necesitas estar bien todo el tiempo. ¿Hay algo específico que te duele hoy, o es como un vacío general?';
  }

  if (emocion === 'agotamiento') {
    return 'Ese cansancio que describes es tu cuerpo pidiendo pausa. Hoy: descansa 20 minutos, hidratate, y después hablamos. ¿Qué es lo más urgente ahora?';
  }

  if (emocion === 'soledad') {
    return 'Estar rodeado pero sentirse solo es una soledad real. ¿Hay alguien en quien confíes para una conversación genuina? A veces basta una persona.';
  }

  if (emocion === 'fracaso') {
    return 'Entiendo que te sientas así, pero una calificación o un error no define tu valor. ¿Qué aprendiste de esto? ¿Cuál fue la parte más difícil?';
  }

  if (emocion === 'alegria') {
    return '¡Me alegra saber eso! Eso merece celebrarse. ¿Cómo te sentiste en el momento? ¿Qué hiciste bien?';
  }

  if (emocion === 'relaciones') {
    return 'Los conflictos con familia o amigos pesan mucho. ¿Qué fue lo que más te molestó? Podemos pensar cómo manejarlo.';
  }

  if (emocion === 'desmotivacion_academica') {
    return 'Perder el interés por la universidad puede ser señal de cansancio o desconexión con la carrera. ¿Qué parte te pesa más hoy: las materias, el ritmo o el sentido de lo que estudias? Si quieres, elegimos una cosa pequeña para retomar esta semana.';
  }

  // Fallback neutral empático
  return 'Te leo. Gracias por confiar en mí. ¿Cuál es la parte que más te duele o que más peso tiene en esto?';
};

const contarPalabras = (texto: string): number =>
  normalizar(texto)
    .split(/\s+/)
    .filter(Boolean).length;

const contieneRastroIA = (respuesta: string): boolean => {
  const r = normalizar(respuesta);
  return (
    r.includes('como ia') ||
    r.includes('como inteligencia artificial') ||
    r.includes('no puedo') ||
    r.includes('no tengo permitido') ||
    r.includes('noa:') ||
    respuesta.includes('**') ||
    respuesta.includes('*validacion') ||
    respuesta.includes('*respuesta') ||
    respuesta.includes('*1.') ||
    respuesta.includes('*2.') ||
    respuesta.includes('- **') ||
    respuesta.includes('**divid')
  );
};

const respuestaDemasiadoGenerica = (respuesta: string): boolean => {
  const r = normalizar(respuesta);
  
  const patronesGenericos = [
    'estoy aqui para ayudarte',
    'lamento lo que sientes',
    'entiendo como te sientes',
    'gracias por compartir',
    'cuentame mas',
    'estoy aqui contigo',
    'cuentame un poco mas',
    'si quieres podemos ir paso a paso'
  ];
  
  const coincidencias = patronesGenericos.filter(p => r.includes(p)).length;
  if (coincidencias >= 3) return true;
  if (respuesta.length < 60 && coincidencias >= 2) return true;
  
  return false;
};

const limpiarRespuestaEstructura = (respuesta: string): string => {
  // Eliminar asteriscos, guiones con estructura, números con puntos
  let limpia = respuesta
    .replace(/\*\*/g, '')
    .replace(/\* /g, '')
    .replace(/^-\s+\*\*/gm, '')
    .replace(/^\d+\)\s+\*\*/gm, '')
    .replace(/^\d+\.\s+\*\*/gm, '')
    .replace(/^-\s+\d+\./gm, '')
    .replace(/^- /gm, '');
  
  const lineas = limpia.split('\n').filter(l => l.trim().length > 5);
  if (lineas.length > 8) {
    return limpia.split('\n').slice(0, 3).join(' ').trim();
  }
  
  return limpia.trim();
};

const esRespuestaBajaCalidad = (respuesta: string, mensaje: string): boolean => {
  if (!respuesta) return true;
  if (respuesta.length < 25) return true;
  if (contarPalabras(respuesta) < 10) return true;
  if (esRespuestaDesechable(respuesta)) return true;
  if (contieneRastroIA(respuesta)) return true;
  if (respuestaDemasiadoGenerica(respuesta)) return true;

  const mensajeNormalizado = normalizar(mensaje);
  const respuestaNormalizada = normalizar(respuesta);
  const palabrasClave = mensajeNormalizado
    .split(/\s+/)
    .filter((p) => p.length >= 5)
    .slice(0, 6);

  const coincideAlgo = palabrasClave.some((p) => respuestaNormalizada.includes(p));
  return !coincideAlgo && respuesta.length < 120 && !detectarRiesgoEnTexto(mensaje);
};

const construirPromptReintento = (mensaje: string, contexto?: string): string => {
  const base = `Tu respuesta anterior fue vaga o poco util.
Reintenta con una respuesta natural y concreta.
Formato interno (NO lo escribas como lista ni lo cites):
- Validacion emocional breve (1 frase)
- Respuesta directa al problema (1-2 frases)
- 2 acciones pequenas y concretas en vinetas
- 1 pregunta corta para continuar

Reglas estrictas:
- No repitas el mensaje del usuario.
- No uses etiquetas ni numeros del formato.
- No digas "Hola! Soy NOA" ni presentes tu identidad.
- No uses frases como "estoy aqui para ayudarte" sin contenido.
- Manten enfoque en el tema del usuario.
Evita frases genericas. No menciones que eres IA.`;

  if (!contexto) {
    return `${base}\n\nMensaje del usuario: ${mensaje}`;
  }

  return `${base}\n\nContexto: ${contexto}\nMensaje del usuario: ${mensaje}`;
};

/**
 * Verifica si Ollama está disponible y el modelo está cargado
 */
export const checkOllamaHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout

    const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return false;
    
    const data = await response.json() as { models?: { name: string }[] };
    const models = data.models || [];
    return models.some((model: any) => model.name.includes(OLLAMA_MODEL.split(':')[0]));
  } catch (error) {
    console.error('Error checking Ollama health:', error);
    return false;
  }
};

/**
 * Descarga el modelo si no está disponible
 */
export const downloadModel = async (): Promise<boolean> => {
  try {
    console.log(`Descargando modelo ${OLLAMA_MODEL}...`);
    const response = await fetch(`${OLLAMA_API_URL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: OLLAMA_MODEL }),
    });

    if (!response.ok) {
      throw new Error(`Error descargando modelo: ${response.statusText}`);
    }

    // Leer la respuesta de streaming
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No se pudo leer la respuesta');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.status) {
            console.log(`Estado: ${data.status}`);
          }
        } catch (e) {
          // Ignorar líneas que no son JSON válido
        }
      }
    }

    console.log(`Modelo ${OLLAMA_MODEL} descargado exitosamente`);
    return true;
  } catch (error) {
    console.error('Error descargando modelo:', error);
    return false;
  }
};

/**
 * Consulta a Ollama con timeout de 60 segundos
 */
export const queryOllama = async (prompt: string, systemPrompt?: string): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 segundos de timeout

    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.95,
          top_k: 50,
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Error en Ollama API: ${response.statusText}`);
    }

    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content || 'No se pudo generar respuesta';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Timeout: Ollama tardó más de 60 segundos en responder');
      throw new Error('Ollama no responde. Por favor, intenta nuevamente.');
    }
    console.error('Error consultando Ollama:', error);
    throw error;
  }
};

/**
 * Analiza respuestas de salud mental usando Ollama
 */
export const analizarRespuestasOllama = async (
  preguntas: { id: number; texto: string; peso: number }[],
  respuestas: { pregunta_id: number; respuesta: number }[]
): Promise<MentalHealthResponse> => {
  try {
    // Formatear datos para el modelo
    const preguntasRespuestas = respuestas.map(resp => {
      const pregunta = preguntas.find(p => p.id === resp.pregunta_id);
      return {
        pregunta: pregunta?.texto || 'Pregunta no encontrada',
        peso: pregunta?.peso || 1,
        respuesta: resp.respuesta
      };
    });
    
    // Algoritmo avanzado de semáforo para evitar filtraciones
    let rawScore = 0;
    let respuestasAltas = 0; // Contador de respuestas 4-5
    let respuestasBajas = 0; // Contador de respuestas 1-2
    const totalPreguntas = preguntasRespuestas.length;
    
    preguntasRespuestas.forEach(item => {
      const puntajePonderado = item.respuesta * item.peso;
      rawScore += puntajePonderado;
      
      if (item.respuesta >= 4) respuestasAltas++;
      if (item.respuesta <= 2) respuestasBajas++;
    });
    
    const porcentajeAltas = (respuestasAltas / totalPreguntas) * 100;
    const puntajePromedio = rawScore / totalPreguntas;
    
    // Criterios más estrictos para evitar filtraciones
    let fallbackState: 'verde' | 'amarillo' | 'rojo' = 'verde';
    
    if (rawScore > 50 && porcentajeAltas > 60) {
      // Solo ROJO si puntaje alto Y más del 60% de respuestas son altas (4-5)
      fallbackState = 'rojo';
    } else if (rawScore > 35 || porcentajeAltas > 40) {
      // AMARILLO si puntaje moderado O más del 40% de respuestas altas
      fallbackState = 'amarillo';
    } else if (rawScore > 20 || porcentajeAltas > 25) {
      // AMARILLO suave si hay indicadores moderados
      fallbackState = 'amarillo';
    } else {
      // VERDE por defecto
      fallbackState = 'verde';
    }

    const systemPrompt = `Eres un psicólogo clínico experto especializado en evaluaciones de salud mental y bienestar emocional. Tu función es analizar respuestas de cuestionarios psicológicos y proporcionar evaluaciones precisas y profesionales. Debes responder ÚNICAMENTE en formato JSON válido, sin comentarios adicionales.`;

    const prompt = `
    Analiza las siguientes respuestas de una evaluación de salud mental (escala 1-5, donde 5 indica mayor gravedad):
    
    ${preguntasRespuestas.map(pr => 
      `- Pregunta: "${pr.pregunta}" (Peso: ${pr.peso})
       - Respuesta: ${pr.respuesta}/5`
    ).join('\n\n')}
    
    CRITERIOS DE EVALUACIÓN:
    - VERDE: Puntaje 0-30 - Estado emocional estable, bienestar general, sin signos de alerta significativos
    - AMARILLO: Puntaje 31-60 - Alerta moderada, algunos síntomas de malestar emocional, requiere atención y seguimiento
    - ROJO: Puntaje 61-100 - Alerta grave, múltiples síntomas de malestar emocional, requiere intervención profesional inmediata
    
    IMPORTANTE: Sé conservador en la evaluación. Solo asigna ROJO si hay evidencia clara de múltiples síntomas graves. 
    Prefiere AMARILLO cuando haya dudas razonables.
    
    Determina:
    1. Un estado de semáforo basado en los criterios anteriores
    2. Un puntaje numérico (0-100) que represente la gravedad general
    3. Una observación clínica profesional y empática sobre el estado mental
    4. Tres recomendaciones prácticas y específicas para el bienestar emocional
    
    Responde SOLO en este formato JSON:
    {
      "estado": "verde/amarillo/rojo",
      "puntaje": 0-100,
      "observaciones": "análisis clínico profesional y empático",
      "recomendaciones": ["recomendación específica 1", "recomendación específica 2", "recomendación específica 3"]
    }`;

    const response = await queryOllama(prompt, systemPrompt);
    
    try {
      // Intentar parsear la respuesta JSON
      const cleanResponse = response.replace(/```json|```/g, '').trim();
      const parsedResponse: MentalHealthResponse = JSON.parse(cleanResponse);
      
      // Validar que tenga los campos requeridos
      if (!parsedResponse.estado || !parsedResponse.puntaje || !parsedResponse.observaciones || !parsedResponse.recomendaciones) {
        throw new Error('Respuesta incompleta del modelo');
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Error parseando respuesta de Ollama:', parseError);
      
      // Fallback con datos calculados
      return {
        estado: fallbackState,
        puntaje: Math.min(rawScore * 2, 100),
        observaciones: `Evaluación basada en ${respuestas.length} respuestas. Puntaje calculado: ${rawScore}`,
        recomendaciones: [
          'Mantén rutinas saludables de sueño y ejercicio',
          'Busca apoyo en familiares y amigos cercanos',
          'Considera hablar con un profesional si persisten las molestias'
        ]
      };
    }
  } catch (error) {
    console.error('Error en análisis con Ollama:', error);
    
    // Fallback completo con algoritmo avanzado
    const rawScore = respuestas.reduce((sum, resp) => {
      const pregunta = preguntas.find(p => p.id === resp.pregunta_id);
      return sum + (resp.respuesta * (pregunta?.peso || 1));
    }, 0);

    // Calcular estadísticas para fallback
    let respuestasAltas = 0;
    const totalPreguntas = respuestas.length;
    
    respuestas.forEach(resp => {
      if (resp.respuesta >= 4) respuestasAltas++;
    });
    
    const porcentajeAltas = (respuestasAltas / totalPreguntas) * 100;
    
    // Aplicar criterios estrictos
    let estado: 'verde' | 'amarillo' | 'rojo' = 'verde';
    
    if (rawScore > 50 && porcentajeAltas > 60) {
      estado = 'rojo';
    } else if (rawScore > 35 || porcentajeAltas > 40) {
      estado = 'amarillo';
    } else if (rawScore > 20 || porcentajeAltas > 25) {
      estado = 'amarillo';
    } else {
      estado = 'verde';
    }
    
    return {
      estado,
      puntaje: Math.min(rawScore * 2, 100),
      observaciones: `Evaluación realizada con sistema de respaldo avanzado. Puntaje: ${rawScore}, Respuestas altas: ${porcentajeAltas.toFixed(1)}%`,
      recomendaciones: [
        'Mantén rutinas saludables de sueño y ejercicio',
        'Busca apoyo en familiares y amigos cercanos',
        'Considera hablar con un profesional si persisten las molestias'
      ]
    };
  }
};

/**
 * Chat general con IA usando Ollama
 */
/**
 * Chat general con IA usando Ollama
 */
type ModoRespuesta = 'normal' | 'profundo';

export const chatWithOllama = async (params: {
  mensaje: string;
  contexto?: string;
  modo?: ModoRespuesta;
  userId?: number;
  numeroMensaje?: number;
}): Promise<ChatResponse> => {
  const { mensaje, contexto, modo, userId, numeroMensaje = 0 } = params;

  try {
    // Obtener perfil del usuario si disponible
    let perfilContexto = undefined;
    let resumenPerfil = '';
    
    if (userId) {
      try {
        const perfil = await analizarPatronesEmocionales(userId, 25);
        resumenPerfil = await construirResumenPerfil(userId, perfil);
        perfilContexto = {
          emociones_frecuentes: perfil.emociones_frecuentes,
          temas_recurrentes: perfil.temas_recurrentes,
          patrones: perfil.patrones_comportamiento,
          dias_sin_comunicacion: perfil.dias_sin_comunicacion,
          tiene_historial: perfil.emociones_frecuentes.length > 0,
        };
      } catch (e) {
        console.log('No se pudo cargar perfil del usuario:', e);
      }
    }

    // Construir system prompt dinámico basado en perfil
    const systemPrompt = construirPromptDinamico(perfilContexto);

    // Construir prompts con variación
    let userPrompt = mensaje;
    let contextoDinamico = resumenPerfil;

    if (contexto) {
      contextoDinamico = `${resumenPerfil ? resumenPerfil + ' ' : ''}${contexto}`;
    }

    const promspts = construirPromptFinal(mensaje, systemPrompt, numeroMensaje, contextoDinamico);

    if (process.env.NODE_ENV !== 'production') {
      const estiloNum = numeroMensaje % 6;
      console.log(`[NOA DEBUG] Estilo #${estiloNum} (mensaje #${numeroMensaje})`);
    }

    const respuestaCruda = await queryOllama(promspts.user, promspts.system);
    let respuesta = respuestaCruda.trim();

    if (!esRespuestaAceptable(respuesta, mensaje)) {
      const fallbackEmocional = detectarEmocion(mensaje);
      respuesta = generarRespuestaFallbackNatural(fallbackEmocional, mensaje);
    }

    return {
      respuesta,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error en chat con Ollama:', error);

    // Fallback más natural
    const emocion = detectarEmocion(params.mensaje);
    return {
      respuesta: generarRespuestaFallbackNatural(emocion, params.mensaje),
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Inicializa Ollama - descarga el modelo si no está disponible
 */
export const initializeOllama = async (): Promise<boolean> => {
  try {
    console.log('Inicializando Ollama...');
    
    // Verificar si Ollama está disponible
    const isHealthy = await checkOllamaHealth();
    
    if (!isHealthy) {
      console.log('Modelo no encontrado, descargando...');
      const downloaded = await downloadModel();
      
      if (!downloaded) {
        console.error('No se pudo descargar el modelo');
        return false;
      }
    }
    
    console.log('Ollama inicializado correctamente');
    return true;
  } catch (error) {
    console.error('Error inicializando Ollama:', error);
    return false;
  }
};
