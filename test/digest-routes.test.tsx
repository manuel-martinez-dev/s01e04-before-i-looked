import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD = '2026-01-10';
const EMPTY = '2026-01-11';
const BAD = '2026-01-12';
const MISSING = '2026-01-13';

const line = (o: object) => JSON.stringify(o);
const good = [
  line({ at: '2026-01-10T01:00:00+01:00', job: 'job-b-sync', status: 'ok', owner: null }),
  line({ at: '2026-01-10T02:00:00+01:00', job: 'job-a-nightly', status: 'retry', owner: 'ana' }),
  line({ at: '2026-01-10T03:00:00+01:00', job: 'job-a-nightly', status: 'ok', owner: 'ana' }),
].join('\n');

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, `${GOOD}.jsonl`), `${good}\n`);
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(join(dir, `${BAD}.jsonl`), `${good}\nnot json at all\n`);
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders a good night with rows sorted by job', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`<h1>digest · ${GOOD}</h1>`);
    expect(html.indexOf('job-a-nightly')).toBeGreaterThan(-1);
    expect(html.indexOf('job-a-nightly')).toBeLessThan(html.indexOf('job-b-sync'));
  });

  it('renders a null owner as a dash', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(html).toMatch(/<td>job-b-sync<\/td>\s*<td>—<\/td>/);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('keeps good rows and reports a bad line', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('job-a-nightly');
    expect(html).toContain('job-b-sync');
    expect(html).toContain('1 line did not parse');
  });

  it('404s for a bad night name', async () => {
    expect((await app.request('/digest/..%2Fpackage')).status).toBe(404);
  });
});

describe('digest json', () => {
  it('returns the Night for a good night', async () => {
    const res = await app.request(`/api/digest/${GOOD}`);
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe(GOOD);
    expect(body.rows.map((r) => r.job)).toEqual(['job-a-nightly', 'job-b-sync']);
    expect(body.rows[1]?.owner).toBeNull();
    expect(body.counts).toEqual({ ok: 2, retry: 1, fail: 0 });
    expect(body.badLines).toBe(0);
  });

  it('404s with an error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line and keeps the good rows', async () => {
    const body = (await (await app.request(`/api/digest/${BAD}`)).json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['job-a-nightly', 'job-b-sync']);
  });

  it('404s for a bad night name', async () => {
    expect((await app.request('/api/digest/..%2Fpackage')).status).toBe(404);
  });
});

describe('page and json agree', () => {
  it('lists the same jobs in the same order', async () => {
    const body = (await (await app.request(`/api/digest/${GOOD}`)).json()) as Night;
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
