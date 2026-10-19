import { NextFunction, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from './auth.middleware';
import { R2StorageService } from '../services/ova/r2-storage.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: R2StorageService.maxUploadBytes(),
  },
});

export function recibirArchivoOva(req: AuthRequest, res: Response, next: NextFunction): void {
  upload.single('archivo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        message: `El archivo supera el máximo de ${process.env.R2_MAX_UPLOAD_MB || 80} MB`,
      });
      return;
    }
    if (err) {
      const message = err instanceof Error ? err.message : 'No se pudo leer el archivo';
      res.status(400).json({ message });
      return;
    }
    next();
  });
}
