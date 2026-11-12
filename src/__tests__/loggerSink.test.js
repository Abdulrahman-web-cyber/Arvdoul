/**
 * @jest-environment jsdom
 *
 * Logger remote-sink (#15 observability). The console sink always existed;
 * these tests exercise the real batched transport path with a real sink
 * function (not a mock of the code under test).
 */

import { jest } from '@jest/globals';

async function freshLogger() {
  jest.resetModules();
  return import('../utils/Logger.js');
}

describe('Logger remote sink', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('is a no-op when no sink is installed', async () => {
    const mod = await freshLogger();
    const logger = new mod.Logger({ name: 'test', level: 'debug' });
    // Should not throw with no sink present.
    expect(() => logger.error('boom', { a: 1 })).not.toThrow();
  });

  test('batches warn+ entries and ships them to the sink', async () => {
    const mod = await freshLogger();
    const sink = jest.fn().mockResolvedValue(undefined);
    mod.setLogSink(sink, { minLevel: 'warn' });
    const logger = new mod.Logger({ name: 'test', level: 'debug' });

    logger.info('ignored by sink');   // below sink min level
    logger.warn('w1', { k: 'v' });
    logger.error('e1');
    mod.flushLogSink();

    expect(sink).toHaveBeenCalledTimes(1);
    const batch = sink.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch.map((e) => e.message)).toEqual(['w1', 'e1']);
    expect(batch[0]).toMatchObject({ level: 'warn', logger: 'test' });
  });

  test('redacts secrets before they reach the sink', async () => {
    const mod = await freshLogger();
    const sink = jest.fn().mockResolvedValue(undefined);
    mod.setLogSink(sink, { minLevel: 'warn' });
    const logger = new mod.Logger({ name: 'test', level: 'debug' });

    logger.error('auth failed', { password: 'hunter2', token: 'abc', userId: 'u1' });
    mod.flushLogSink();

    const [entry] = sink.mock.calls[0][0];
    expect(entry.password).toBe('[REDACTED]');
    expect(entry.token).toBe('[REDACTED]');
    expect(entry.userId).toBe('u1');
  });

  test('flushes automatically once the batch size is reached', async () => {
    const mod = await freshLogger();
    const sink = jest.fn().mockResolvedValue(undefined);
    mod.setLogSink(sink, { minLevel: 'warn' });
    const logger = new mod.Logger({ name: 'test', level: 'debug' });

    for (let i = 0; i < 25; i += 1) logger.error(`e${i}`);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toHaveLength(25);
  });

  test('a throwing sink never propagates to the caller', async () => {
    const mod = await freshLogger();
    const sink = jest.fn(() => { throw new Error('transport down'); });
    mod.setLogSink(sink, { minLevel: 'warn' });
    const logger = new mod.Logger({ name: 'test', level: 'debug' });

    expect(() => logger.error('e')).not.toThrow();
    expect(() => mod.flushLogSink()).not.toThrow();
  });

  test('clearing the sink stops delivery', async () => {
    const mod = await freshLogger();
    const sink = jest.fn().mockResolvedValue(undefined);
    mod.setLogSink(sink, { minLevel: 'warn' });
    const logger = new mod.Logger({ name: 'test', level: 'debug' });
    logger.error('before');
    mod.flushLogSink();
    mod.setLogSink(null);
    logger.error('after');
    mod.flushLogSink();
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
