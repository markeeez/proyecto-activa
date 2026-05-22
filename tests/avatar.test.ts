import test from 'node:test';
import assert from 'node:assert/strict';

import { extensionDesdeMime, validarAvatar } from '../lib/avatarValidation.ts';

const valid = { mime: 'image/jpeg', width: 512, height: 512, bytes: 200_000 };

test('extensionDesdeMime mapea formatos comunes', () => {
  assert.equal(extensionDesdeMime('image/jpeg'), 'jpg');
  assert.equal(extensionDesdeMime('image/jpg'), 'jpg');
  assert.equal(extensionDesdeMime('image/png'), 'png');
  assert.equal(extensionDesdeMime('image/webp'), 'webp');
  assert.equal(extensionDesdeMime('image/heic'), 'heic');
  assert.equal(extensionDesdeMime('image/heif'), 'heic');
  assert.equal(extensionDesdeMime('application/octet-stream'), 'jpg');
});

test('validarAvatar acepta imagen tipica', () => {
  assert.doesNotThrow(() => validarAvatar(valid));
});

test('validarAvatar rechaza MIME no permitido', () => {
  assert.throws(() => validarAvatar({ ...valid, mime: 'image/gif' }), /Formato/);
});

test('validarAvatar rechaza dimensiones menores a 64px', () => {
  assert.throws(() => validarAvatar({ ...valid, width: 32, height: 32 }), /entre 64px/);
});

test('validarAvatar rechaza dimensiones mayores a 4096px', () => {
  assert.throws(() => validarAvatar({ ...valid, width: 5000, height: 5000 }), /entre 64px/);
});

test('validarAvatar rechaza una sola dimension fuera de rango', () => {
  assert.throws(() => validarAvatar({ ...valid, width: 5000, height: 512 }), /entre 64px/);
  assert.throws(() => validarAvatar({ ...valid, width: 512, height: 32 }), /entre 64px/);
});

test('validarAvatar rechaza buffer vacio', () => {
  assert.throws(() => validarAvatar({ ...valid, bytes: 0 }), /vacía/);
});

test('validarAvatar rechaza buffer mayor a 5 MB', () => {
  assert.throws(() => validarAvatar({ ...valid, bytes: 6 * 1024 * 1024 }), /5 MB/);
});
