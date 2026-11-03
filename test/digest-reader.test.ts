import { describe, expect, it } from 'vitest';
import { digest, parseLine, readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 2026-10-28 into 5 jobs and counts the bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night!.badLines).toBe(1);
    expect(night!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps retries, last status, last error and the log offset', () => {
    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    expect(night!.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, runs: 1 });
  });

  it('returns null for a night with no file or a bad night name', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('an empty file is a night with no rows', () => {
    expect(digest('2026-11-01', '')).toEqual({
      night: '2026-11-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });
});

describe('parseLine', () => {
  it('rejects lines that are not run lines', () => {
    expect(parseLine('{"at":"2026-10-28T23:00:02+01:00","job":"lane/sy')).toBeNull();
    expect(parseLine('[]')).toBeNull();
    expect(parseLine('{"at":"x","job":"a","status":"ok","owner":null}')).toBeNull();
    expect(parseLine('{"at":"2026-10-28T23:00:02+01:00","job":"a","status":"maybe","owner":null}')).toBeNull();
  });
});
