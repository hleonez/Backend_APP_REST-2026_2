import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { StorageUriResolver } from '../src/services/ova/storage-uri-resolver.service';
import { OVA_STORAGE_SOURCE } from '../src/shared/const/ova.const';

const originalBase = process.env.R2_PUBLIC_BASE_URL;

afterEach(() => {
  if (originalBase === undefined) {
    delete process.env.R2_PUBLIC_BASE_URL;
  } else {
    process.env.R2_PUBLIC_BASE_URL = originalBase;
  }
});

describe('StorageUriResolver R2 público', () => {
  it('arma la URL pública con la key del catálogo y no le agrega firma', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://pub-example.r2.dev/';
    const resolved = StorageUriResolver.resolve(
      OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
      'ovas/11111111-1111-1111-1111-111111111111.mp4',
    );

    assert.equal(
      resolved.resolved_url,
      'https://pub-example.r2.dev/ovas/11111111-1111-1111-1111-111111111111.mp4',
    );
    assert.equal(resolved.resolved_url.includes('X-Amz-Signature'), false);
  });

  it('acepta una key ovas/ y rechaza un prefijo privado', () => {
    const key = StorageUriResolver.validateResourceUrl(
      OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
      'ovas/video.mp4',
    );
    const perfil = StorageUriResolver.validateResourceUrl(
      OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
      'usuarios/42/avatar.jpg',
    );
    const traversal = StorageUriResolver.validateResourceUrl(
      OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
      'ovas/../secret.txt',
    );

    assert.equal(key.isValid, true);
    assert.equal(perfil.isValid, false);
    assert.equal(traversal.isValid, false);
  });
});
