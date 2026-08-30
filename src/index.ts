import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import { Server as SocketServer } from 'socket.io';

// DB
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';

// WEBSOCKET & SWAGGER
import { setupWebSocket } from './websocket/socket';
import { setupSwagger } from './config/swagger';

// IA
import { initializeOllama } from './services/ollama.service';

// ROUTES
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import adminRoutes from './routes/admin.routes';
import diarioRoutes from './routes/diario.routes';
import encuestasRoutes from './routes/encuestas.routes';
import evaluacionRoutes from './routes/evaluacion.routes';
import opcionesActividadesRoutes from './routes/opciones-actividades.routes';
import registroActividadesRoutes from './routes/registro-actividades.routes';
import encuestasRespuestasRoutes from './routes/encuestas-respuestas.routes';
import registroEmocionalRoutes from './routes/registro-emocional.routes';
import dashboardRoutes from './routes/dashboard.routes';
import settingsRoutes from './routes/settings.routes';
import premiosRoutes from './routes/premios.routes';

const app = express();
const server = http.createServer(app);

// ============================================================
// Middleware
// ============================================================

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// ============================================================
// Health Check
// ============================================================

app.get('/health', (_req: Request, res: Response) => {
  console.log('🔥 HEALTH RECIBIDO');
  res.status(200).json({ health: 'ok' });
});

// ============================================================
// WebSocket
// ============================================================

const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setupWebSocket(io);

// ============================================================
// Routes
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/evaluaciones', evaluacionRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/encuestas', encuestasRoutes);
app.use('/api/encuestas-respuestas', encuestasRespuestasRoutes);
app.use('/api/diario', diarioRoutes);
app.use('/api/opciones-actividades', opcionesActividadesRoutes);
app.use('/api/registro-actividades', registroActividadesRoutes);
app.use('/api/registro-emocional', registroEmocionalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/premios', premiosRoutes);

// ============================================================
// Swagger
// ============================================================

setupSwagger(app);

// ============================================================
// Global Error Handler
// ============================================================

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Error:', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================================
// Inicialización de DB + Ollama
// ============================================================

void (async () => {
  try {
    console.log('Initializing database...');
    await runMigrations();

    if (process.env.SEED_ON_START === 'true') {
      console.log('Running database seed...');
      await seed();
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  try {
    await initializeOllama();
  } catch (ollamaError) {
    console.warn('Warning: Could not initialize Ollama:', ollamaError);
    console.log('Server will continue without Ollama support');
  }
})();

// ============================================================
// SERVER
// ============================================================

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('*****************************************************');
  console.log(`* SERVIDOR (API) CORRIENDO EN EL PUERTO ${PORT} *`);
  console.log('*****************************************************');
  console.log('');
});

server.on('error', (error) => {
  console.error('Failed to start the server:', error);
  process.exit(1);
});

export default server;


