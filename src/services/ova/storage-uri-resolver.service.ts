import { OVA_R2_KEY_PREFIX, OVA_STORAGE_SOURCE, OvaStorageSource } from '../../shared/const/ova.const';

export interface ResolvedResource {
  storage_source: OvaStorageSource;
  original_url: string;
  video_id?: string;
  watch_url?: string;
  embed_url?: string;
  resolved_url: string;
}

export class StorageUriResolver {
  /**
   * Extrae el ID de un video de YouTube a partir de varios formatos:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://www.youtube.com/embed/VIDEO_ID
   * - https://www.youtube.com/shorts/VIDEO_ID
   */
  public static extractYouTubeId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // Regex para variantes comunes de YouTube
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  /**
   * Valida la URL de acuerdo a su storage source al crear/editar un OVA.
   */
  public static validateResourceUrl(source: string, url: string): { isValid: boolean; error?: string } {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { isValid: false, error: 'La URL del recurso es requerida' };
    }

    const trimmed = url.trim();

    switch (source) {
      case OVA_STORAGE_SOURCE.YOUTUBE: {
        const id = this.extractYouTubeId(trimmed);
        if (!id) {
          return {
            isValid: false,
            error: 'La URL de YouTube no es válida o no contiene un ID reconocible (formatos soportados: watch?v=, youtu.be, embed, shorts)',
          };
        }
        return { isValid: true };
      }

      case OVA_STORAGE_SOURCE.CLOUDFLARE_R2: {
        if (this.isHttpUrl(trimmed)) {
          return { isValid: true };
        }
        if (!this.isSafeOvaObjectKey(trimmed)) {
          return {
            isValid: false,
            error: `La clave de R2 debe empezar por "${OVA_R2_KEY_PREFIX}" y no puede contener rutas relativas`,
          };
        }
        return { isValid: true };
      }

      case OVA_STORAGE_SOURCE.EXTERNAL_URL: {
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { isValid: false, error: 'La URL externa debe iniciar con http o https' };
          }
          return { isValid: true };
        } catch {
          return { isValid: false, error: 'La URL externa no es una dirección web válida' };
        }
      }

      default:
        return { isValid: false, error: `Fuente de almacenamiento no soportada: ${source}` };
    }
  }

  /**
   * URL pública del catálogo OVA. No firma: el estudiante abre R2_PUBLIC_BASE_URL + key.
   * Las URLs firmadas quedan para prefijos privados (por ejemplo fotos de perfil) y no se generan aquí.
   */
  public static signR2Url(keyOrUrl: string): string {
    const trimmed = keyOrUrl.trim();
    if (this.isHttpUrl(trimmed)) {
      return trimmed;
    }
    const baseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const cleanKey = trimmed.replace(/^\/+/, '');
    return baseUrl ? `${baseUrl}/${cleanKey}` : cleanKey;
  }

  public static isHttpUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
  }

  /** Key de catálogo: ovas/..., sin .. ni barras invertidas. */
  public static isSafeOvaObjectKey(value: string): boolean {
    if (!value.startsWith(OVA_R2_KEY_PREFIX)) return false;
    if (value.includes('..') || value.includes('\\') || value.includes('//')) return false;
    return /^ovas\/[a-zA-Z0-9][a-zA-Z0-9/_\-.]*$/.test(value);
  }

  /**
   * Resuelve el recurso para consumo del frontend.
   */
  public static resolve(source: string, resourceUrl: string): ResolvedResource {
    const trimmed = (resourceUrl || '').trim();

    if (source === OVA_STORAGE_SOURCE.YOUTUBE) {
      const videoId = this.extractYouTubeId(trimmed) || '';
      const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : trimmed;
      const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : trimmed;

      return {
        storage_source: OVA_STORAGE_SOURCE.YOUTUBE,
        original_url: trimmed,
        video_id: videoId,
        watch_url: watchUrl,
        embed_url: embedUrl,
        resolved_url: embedUrl,
      };
    }

    if (source === OVA_STORAGE_SOURCE.CLOUDFLARE_R2) {
      const resolved = this.signR2Url(trimmed);
      return {
        storage_source: OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
        original_url: trimmed,
        resolved_url: resolved,
      };
    }

    // EXTERNAL_URL u otros
    return {
      storage_source: OVA_STORAGE_SOURCE.EXTERNAL_URL,
      original_url: trimmed,
      resolved_url: trimmed,
    };
  }
}
