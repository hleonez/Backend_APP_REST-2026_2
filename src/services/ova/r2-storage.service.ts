import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { OVA_R2_KEY_PREFIX } from '../../shared/const/ova.const';
import { trackOutbound } from '../../shared/utils/outbound-metrics';

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class R2StorageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'R2StorageError';
  }
}

export class R2StorageService {
  /**
   * Sube un archivo del catálogo OVA al bucket y devuelve la object key (`ovas/...`).
   * La lectura del estudiante sigue siendo la URL pública; este método no firma.
   */
  public static async putOvaObject(input: {
    body: Buffer;
    contentType: string;
  }): Promise<string> {
    const contentType = input.contentType.toLowerCase().split(';')[0].trim();
    const extension = CONTENT_TYPE_EXTENSION[contentType];
    if (!extension) {
      throw new R2StorageError(
        'Tipo de archivo no permitido. Usa video, audio, PDF o imagen (jpg, png, webp)',
        400,
      );
    }
    if (!input.body || input.body.length === 0) {
      throw new R2StorageError('El archivo está vacío', 400);
    }

    const { client, bucket } = this.client();
    const key = `${OVA_R2_KEY_PREFIX}${randomUUID()}.${extension}`;

    await trackOutbound('r2', 'put_object', () =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      ),
    );

    return key;
  }

  public static maxUploadBytes(): number {
    const mb = Number(process.env.R2_MAX_UPLOAD_MB || 80);
    if (!Number.isFinite(mb) || mb <= 0) return 80 * 1024 * 1024;
    return Math.floor(mb * 1024 * 1024);
  }

  private static client(): { client: S3Client; bucket: string } {
    const accountId = (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucket = (process.env.R2_BUCKET_NAME || '').trim();
    const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').trim();

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
      throw new R2StorageError(
        'R2 no está configurado. Definí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME y R2_PUBLIC_BASE_URL',
        503,
      );
    }

    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }
}
