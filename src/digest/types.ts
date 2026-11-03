// Plan morning-digest § 1. The contract every part of § 2 builds against.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the log's offset.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  counts: Record<RunStatus, number>; // lines per status
  badLines: number; // lines that did not parse; counted, never thrown
};

// null: no file for that night (or not a YYYY-MM-DD night).
export type ReadNight = (runsDir: string, night: string) => Night | null;
