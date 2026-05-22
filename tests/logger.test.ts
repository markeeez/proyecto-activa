import test from 'node:test';
import assert from 'node:assert/strict';

// Simulamos __DEV__ via NODE_ENV (logger.ts cae a process.env.NODE_ENV
// cuando __DEV__ no esta definido).

async function freshLogger(): Promise<typeof import('../lib/logger.ts').logger> {
  // node:test reusa modulos. Importamos por URL nueva para forzar evaluacion fresca.
  const url = `../lib/logger.ts?ts=${Math.random()}`;
  const mod = await import(url);
  return mod.logger as typeof import('../lib/logger.ts').logger;
}

function capturarConsola(): { restore: () => void; lines: string[] } {
  const lines: string[] = [];
  const origError = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  console.error = (msg: unknown) => lines.push(`error:${String(msg)}`);
  console.warn = (msg: unknown) => lines.push(`warn:${String(msg)}`);
  console.info = (msg: unknown) => lines.push(`info:${String(msg)}`);
  return {
    lines,
    restore: () => {
      console.error = origError;
      console.warn = origWarn;
      console.info = origInfo;
    },
  };
}

test('logger emite en NODE_ENV != production', async () => {
  (process.env as Record<string, string>).NODE_ENV = 'development';
  const logger = await freshLogger();
  const cap = capturarConsola();
  try {
    logger.error('scope-a', new Error('boom'));
    logger.warn('scope-b', { message: 'aviso' });
    logger.info('scope-c', 'detalle');
  } finally {
    cap.restore();
  }
  assert.equal(cap.lines.length, 3);
  assert.match(cap.lines[0], /scope-a.*boom/);
  assert.match(cap.lines[1], /scope-b.*aviso/);
  assert.match(cap.lines[2], /scope-c.*detalle/);
});

test('logger no emite en NODE_ENV=production', async () => {
  (process.env as Record<string, string>).NODE_ENV = 'production';
  const logger = await freshLogger();
  const cap = capturarConsola();
  try {
    logger.error('scope', new Error('algo'));
    logger.warn('scope', 'x');
    logger.info('scope', 'y');
  } finally {
    cap.restore();
  }
  assert.equal(cap.lines.length, 0);
});
