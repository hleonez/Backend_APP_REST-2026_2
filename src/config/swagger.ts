import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Salud Mental API (Noa)',
      version: '1.0.0',
      description: 'Documentación interactiva de la API REST para la aplicación de Salud Mental con Sistema de Semáforo y Chatbot IA',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local (Docker / Dev)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu Token JWT obtenido en /api/auth/login',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  // Deshabilitar Swagger en producción a menos que se fuerce explícitamente con ENABLE_SWAGGER=true
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER !== 'true') {
    console.log('🔒 Swagger UI deshabilitado en producción.');
    return;
  }

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs-json', (_, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};
