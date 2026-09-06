import { db } from './index';
import * as schema from './schema';
import { inArray, eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');
  
  try {
    // Seed de roles (idempotente). Se ejecuta siempre para garantizar integridad referencial.
    const rolesToSeed = [
      { id: 1, nombre: 'admin', descripcion: 'Administrador de la plataforma' },
      { id: 2, nombre: 'psicologo', descripcion: 'Profesional de psicología' },
      { id: 3, nombre: 'usuario', descripcion: 'Usuario general de la aplicación' },
      { id: 4, nombre: 'moderador', descripcion: 'Moderador de contenidos y soporte' },
      { id: 5, nombre: 'invitado', descripcion: 'Acceso limitado de solo consulta' },
    ];

    await db.insert(schema.roles)
      .values(rolesToSeed)
      .onConflictDoNothing({ target: schema.roles.id });

    console.log('Roles seeded successfully');
    
    // Seed de opciones de actividades
    const opcionesActividadesExistentes = await db
      .select({ id: schema.opciones_registro_actividades.id })
      .from(schema.opciones_registro_actividades)
      .limit(1);

    if (opcionesActividadesExistentes.length === 0) {
      const opcionesActividades = [
        {
          nombre: 'Meditación guiada',
          descripcion: 'Sesión de meditación de 10-20 minutos para calmar la mente',
          url_imagen: '/images/actividades/meditacion.png',
          is_active: true,
        },
        {
          nombre: 'Ejercicio físico moderado',
          descripcion: 'Caminar, trotar o ejercicio ligero durante 30 minutos',
          url_imagen: '/images/actividades/ejercicio.png',
          is_active: true,
        },
        {
          nombre: 'Respiración profunda',
          descripcion: 'Técnicas de respiración para reducir la ansiedad',
          url_imagen: '/images/actividades/respiracion.png',
          is_active: true,
        },
        {
          nombre: 'Diario reflexivo',
          descripcion: 'Escribir sobre tus emociones y pensamientos del día',
          url_imagen: '/images/actividades/diario.png',
          is_active: true,
        },
        {
          nombre: 'Relajación muscular progresiva',
          descripcion: 'Tensar y relajar grupos musculares progresivamente',
          url_imagen: '/images/actividades/relajacion.png',
          is_active: true,
        },
        {
          nombre: 'Yoga',
          descripcion: 'Sesión de yoga para mejorar flexibilidad y bienestar',
          url_imagen: '/images/actividades/yoga.png',
          is_active: true,
        },
        {
          nombre: 'Escuchar música relajante',
          descripcion: 'Música clásica, ambiental o natural para tranquilizarce',
          url_imagen: '/images/actividades/musica.png',
          is_active: true,
        },
        {
          nombre: 'Lectura',
          descripcion: 'Leer un libro o artículo sobre bienestar emocional',
          url_imagen: '/images/actividades/lectura.png',
          is_active: true,
        },
        {
          nombre: 'Paseo en la naturaleza',
          descripcion: 'Caminar al aire libre en un parque o zona verde',
          url_imagen: '/images/actividades/naturaleza.png',
          is_active: true,
        },
               
        {
          nombre: 'Conexión social',
          descripcion: 'Llamar o pasar tiempo con amigos y seres queridos',
          url_imagen: '/images/actividades/social.png',
          is_active: true,
        },
      ];

      await db.insert(schema.opciones_registro_actividades).values(opcionesActividades);
      console.log('Actividades seeded successfully');
    } else {
      console.log('Actividades already exist, skipping seed');
    }

    // Seed de premios
    const premiosExistentes = await db
      .select({ id: schema.premios.id })
      .from(schema.premios)
      .limit(1);

    if (premiosExistentes.length === 0) {
      const premiosIniciales = [
        {
          nombre: 'Snack saludable',
          descripcion: 'Canjeable en Bienestar Universitario por una opcion saludable.',
          estrellas_requeridas: 20,
          is_active: true,
        },
        {
          nombre: 'Kit antiestres',
          descripcion: 'Incluye libreta, stickers y elementos de apoyo emocional.',
          estrellas_requeridas: 45,
          is_active: true,
        },
        {
          nombre: 'Clase de bienestar',
          descripcion: 'Acceso prioritario a talleres y actividades de bienestar.',
          estrellas_requeridas: 80,
          is_active: true,
        },
        {
          nombre: 'Pack premium bienestar',
          descripcion: 'Beneficio especial para estudiantes constantes durante el mes.',
          estrellas_requeridas: 120,
          is_active: true,
        },
      ];

      await db.insert(schema.premios).values(premiosIniciales);
      console.log('Premios seeded successfully');
    } else {
      console.log('Premios already exist, skipping seed');
    }
    
    // Preguntas base (solo si no existen) - 20 preguntas psicológicas
    const preguntasBase = [
      '¿Cómo describirías tu estado de ánimo general durante la última semana?',
      '¿Cómo te has sentido respecto al interés o motivación para hacer actividades?',
      '¿Cómo ha sido la calidad de tu sueño recientemente?',
      '¿Cómo describirías tu nivel de energía en el día a día?',
      '¿Cómo percibes tu apetito en los últimos días?',
      '¿Cómo te has sentido contigo mismo (autoestima, autovaloración)?',
      '¿Cómo calificarías tu capacidad de concentración?',
      '¿Cómo te has sentido en términos de calma o relajación?',
      '¿Cómo describirías tu nivel de ansiedad o preocupación?',
      '¿Cómo ha sido tu capacidad para controlar tus preocupaciones?',
      '¿Cómo te has sentido respecto a la sensación de que algo malo podría pasar?',
      '¿Cómo te has sentido al enfrentar situaciones que te generan estrés o miedo?',
      '¿Cómo calificarías tu sensación de compañía o apoyo social?',
      '¿Cómo te has sentido al manejar el estrés diario?',
      '¿Cómo te has sentido en términos de motivación para tus actividades diarias?',
      '¿Cómo calificarías tu satisfacción con la vida en general?',
      '¿Cómo percibes tu manejo de emociones recientemente?',
      '¿Cómo te has sentido respecto al apoyo de las personas que te rodean?',
      '¿Cómo te has sentido respecto a tu visión del futuro (optimismo)?',
      '¿Cómo calificarías tu capacidad para disfrutar momentos cotidianos?',
    ];

    const preguntasExistentes = await db
      .select({
        id: schema.preguntas_registro_emocional.id,
        texto: schema.preguntas_registro_emocional.texto,
      })
      .from(schema.preguntas_registro_emocional)
      .where(inArray(schema.preguntas_registro_emocional.texto, preguntasBase));

    if (preguntasExistentes.length === 0) {
      await db.insert(schema.preguntas_registro_emocional).values(
        preguntasBase.map((texto) => ({
          texto,
          is_active: true,
        }))
      );
    }

    const preguntasCreadas = await db
      .select({
        id: schema.preguntas_registro_emocional.id,
        texto: schema.preguntas_registro_emocional.texto,
      })
      .from(schema.preguntas_registro_emocional)
      .where(inArray(schema.preguntas_registro_emocional.texto, preguntasBase));

    const preguntasPorTexto = new Map(preguntasCreadas.map((p) => [p.texto, p.id]));

    const opcionesBaseExistentes = await db
      .select({ id: schema.opciones_registro_emocional.id })
      .from(schema.opciones_registro_emocional)
      .limit(1);

    if (opcionesBaseExistentes.length === 0) {
      // Opciones estándar para TODAS las preguntas (Likert 0-4)
      const opcionesRegistroEmocionalBase: any[] = [];
      
      // 5 opciones estándar para cada pregunta
      const opcionesEstandar = [
        { nombre: 'Muy mal', descripcion: 'Muy insatisfecho o muy negativo', puntaje: 0 },
        { nombre: 'Mal', descripcion: 'Insatisfecho o algo negativo', puntaje: 1 },
        { nombre: 'Normal', descripcion: 'Neutral, sin cambios marcados', puntaje: 2 },
        { nombre: 'Bien', descripcion: 'Satisfecho, positivo', puntaje: 3 },
        { nombre: 'Excelente', descripcion: 'Muy satisfecho, muy positivo', puntaje: 4 },
      ];
      
      // Crear opciones para cada pregunta
      for (const preguntaTexto of preguntasBase) {
        const preguntaId = preguntasPorTexto.get(preguntaTexto)!;
        for (const opcion of opcionesEstandar) {
          opcionesRegistroEmocionalBase.push({
            pregunta_id: preguntaId,
            nombre: opcion.nombre,
            descripcion: opcion.descripcion,
            url_imagen: '/images/registro-emocional/opcion.png',
            puntaje: opcion.puntaje,
            is_active: true,
          });
        }
      }

      await db.insert(schema.opciones_registro_emocional).values(opcionesRegistroEmocionalBase);
      console.log('20 Preguntas y opciones de registro emocional seeded successfully');
    } else {
      console.log('Preguntas y opciones de registro emocional ya existen');
    }

    // ================================
    // CREAR USUARIOS DE PRUEBA
    // ================================
    console.log('Creando usuarios de prueba...');

    const usuariosDeTest = [
      {
        correo: 'admin@test.com',
        nombres: 'Administrador',
        apellidos: 'Prueba',
        contrasena: '12345678',
        id_rol: 1, // admin
        telefono: '3001234567',
        edad: 35,
        sexo: 'M',
        ciudad: 'Bogotá'
      },
      {
        correo: 'psicologo@test.com',
        nombres: 'Psicólogo',
        apellidos: 'Prueba',
        contrasena: '12345678',
        id_rol: 2, // psicologo
        telefono: '3007654321',
        edad: 40,
        sexo: 'M',
        ciudad: 'Medellín'
      },
      {
        correo: 'usuario@test.com',
        nombres: 'Usuario',
        apellidos: 'Prueba',
        contrasena: '12345678',
        id_rol: 3, // usuario
        telefono: '3009876543',
        edad: 25,
        sexo: 'M',
        ciudad: 'Cali'
      },
      {
        correo: 'bienestar@test.com',
        nombres: 'Bienestar',
        apellidos: 'Universitario',
        contrasena: '12345678',
        id_rol: 4, // moderador (panel bienestar)
        telefono: '3001112233',
        edad: 30,
        sexo: 'F',
        ciudad: 'Bogotá'
      }
    ];

    for (const usuarioData of usuariosDeTest) {
      // Verificar si el usuario ya existe
      const usuarioExistente = await db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.correo, usuarioData.correo))
        .limit(1);

      if (usuarioExistente.length === 0) {
        // Hash password
        const hashedPassword = await bcrypt.hash(usuarioData.contrasena, 10);

        // Crear usuario
        await db.insert(schema.usuarios).values({
          correo: usuarioData.correo,
          nombres: usuarioData.nombres,
          apellidos: usuarioData.apellidos,
          contrasena: hashedPassword,
          id_rol: usuarioData.id_rol,
          telefono: usuarioData.telefono,
          edad: usuarioData.edad,
          sexo: usuarioData.sexo,
          ciudad: usuarioData.ciudad,
        });

        console.log(`✓ Usuario creado: ${usuarioData.correo}`);
      } else {
        console.log(`✓ Usuario ya existe: ${usuarioData.correo}`);
      }
    }

    console.log('\n=== USUARIOS DE PRUEBA CREADOS ===');
    console.log('Admin: admin@test.com / 12345678');
    console.log('Psicólogo: psicologo@test.com / 12345678');
    console.log('Usuario: usuario@test.com / 12345678');
    console.log('Bienestar: bienestar@test.com / 12345678');
    console.log('==================================\n');
    
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// If this file is run directly (not imported), run seed
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

export { seed }; 