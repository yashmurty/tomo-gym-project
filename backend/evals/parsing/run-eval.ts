/* eslint-disable no-console */
// Parsing eval runner (constitution rule 15).
//
//   npm run eval:parsing                 # uses LLM_PROVIDER / LLM_MODEL from env
//   npm run eval:parsing -- --only=pounds,pyramid
//
// Boots the real app against a throwaway database (`tomo_gym_eval`), pins
// the clock to FIXED_NOW, and for each case: creates a fresh user, logs the
// setup entries through the REST API, sends the prior turns and the input
// through POST /chat (the real agent loop and MCP path), then grades the
// resulting days. Writes a JSON report to evals/parsing/results/.
//
// It spends real money with a real model: run it deliberately, not in CI.
import '../../src/shared/typeorm/pg-date-parser';

import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdirSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { McpEndpoint } from '../../src/agent/services/mcp-endpoint';
import { AppModule } from '../../src/app.module';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { Clock } from '../../src/shared/time/clock';
import { costUsd, MODEL_PRICES } from '../../src/usage/pricing';
import { CASES, EVAL_TIMEZONE, EvalCase, EvalEntry, FIXED_NOW } from './cases';
import { DayGrade, gradeDay } from './grader';

const EVAL_DB = 'tomo_gym_eval';

interface CaseResult {
  id: string;
  pass: boolean;
  days: DayGrade[];
  error?: string;
}

function connection(database: string, extra: object = {}): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database,
    ...extra,
  });
}

// A fresh eval database built by the real migrations (incl. the catalog).
async function resetDatabase(): Promise<void> {
  const admin = await connection('postgres').initialize();
  await admin.query(`DROP DATABASE IF EXISTS ${EVAL_DB}`);
  await admin.query(`CREATE DATABASE ${EVAL_DB}`);
  await admin.destroy();

  const db = await connection(EVAL_DB, {
    migrations: [join(__dirname, '../../migrations/*{.ts,.js}')],
  }).initialize();
  await db.runMigrations();
  await db.destroy();
}

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
  process.env.DB_NAME = EVAL_DB;
  // Every case signs up and logs in a fresh user from this one IP, so lift
  // the per-IP and per-user signup-gate limits. The global daily cap stays,
  // as a ceiling on what an eval run can spend.
  Object.assign(process.env, {
    SIGNUP_MODE: 'open',
    SIGNUP_RATE_PER_HOUR: '100000',
    LOGIN_RATE_PER_MINUTE: '100000',
    CHAT_RATE_PER_MINUTE: '100000',
    CHAT_RATE_PER_DAY: '100000',
    USER_DAILY_BUDGET_USD: '100000',
    USER_MONTHLY_BUDGET_USD: '100000',
  });

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;

  await resetDatabase();

  let endpoint = '';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue({ now: () => new Date(FIXED_NOW) })
    .overrideProvider(McpEndpoint)
    .useValue({ url: () => endpoint })
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  endpoint = `http://127.0.0.1:${port}/mcp`;

  const provider = process.env.LLM_PROVIDER ?? 'stub';
  const model = process.env.LLM_MODEL ?? '(default)';
  console.log(
    `Parsing eval: ${cases.length} cases, provider=${provider}, model=${model}, now=${FIXED_NOW}\n`,
  );

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    const result = await runCase(app, evalCase);
    results.push(result);
    const mark = result.pass ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${evalCase.id.padEnd(26)} ${evalCase.description}`);
    if (!result.pass) {
      if (result.error) console.log(`      error: ${result.error}`);
      for (const d of result.days.filter((g) => !g.pass)) {
        for (const m of d.missing)
          console.log(`      ${d.day}: missing    ${m}`);
        for (const u of d.unexpected)
          console.log(`      ${d.day}: unexpected ${u}`);
      }
    }
  }

  const usage: {
    model: string;
    input: number;
    output: number;
    calls: number;
  }[] = await app.get(DataSource).query(
    `SELECT model, sum("inputTokens")::int AS input,
                sum("outputTokens")::int AS output, count(*)::int AS calls
           FROM llm_usage GROUP BY model`,
  );
  await app.close();

  const passed = results.filter((r) => r.pass).length;
  const pct = Math.round((passed / results.length) * 100);
  console.log(`\n${passed}/${results.length} passed (${pct}%)`);
  for (const u of usage) {
    // Same price table as the budgets; the stub is free.
    const usd = costUsd(u.model, {
      inputTokens: u.input,
      outputTokens: u.output,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    const cost = MODEL_PRICES[u.model]
      ? ` ~ $${usd.toFixed(4)} at list price (cache discounts ignored)`
      : '';
    console.log(
      `  ${u.model}: ${u.calls} calls, ${u.input} input / ${u.output} output tokens${cost}`,
    );
  }

  const dir = join(__dirname, 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().split(':').join('-');
  const file = join(dir, `${stamp}.json`);
  const report = {
    provider,
    model,
    fixedNow: FIXED_NOW,
    passed,
    total: results.length,
    usage,
    results,
  };
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${file}`);
}

async function runCase(
  app: INestApplication,
  evalCase: EvalCase,
): Promise<CaseResult> {
  const http = () => request(app.getHttpServer());
  const email = `${evalCase.id}@eval.local`;
  const password = 'eval-password';

  try {
    await http()
      .post('/auth/register')
      .send({
        name: evalCase.id,
        email,
        password,
        timezone: EVAL_TIMEZONE,
        locale: evalCase.locale ?? 'en',
        weightUnit: evalCase.weightUnit ?? 'kg',
        weight: 72,
        ageConfirmed: true,
      })
      .expect(HttpStatus.CREATED);
    const login = await http().post('/auth/login').send({ email, password });
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    for (const { date, entry } of evalCase.setup ?? []) {
      await http()
        .post('/entries')
        .set(auth)
        .send({ ...toLogInput(entry), date })
        .expect(HttpStatus.CREATED);
    }

    const turns = [...(evalCase.priorTurns ?? []), evalCase.input];
    for (const [i, text] of turns.entries()) {
      await http()
        .post('/chat')
        .set(auth)
        .send({ text, idempotencyKey: `${evalCase.id}-turn-${i}` })
        .expect(HttpStatus.OK);
    }

    const days: DayGrade[] = [];
    for (const [day, expected] of Object.entries(evalCase.expect)) {
      const res = await http()
        .get(`/days/${day}`)
        .set(auth)
        .expect(HttpStatus.OK);
      days.push(gradeDay(day, expected, res.body.data.entries));
    }
    return { id: evalCase.id, pass: days.every((d) => d.pass), days };
  } catch (err) {
    return {
      id: evalCase.id,
      pass: false,
      days: [],
      error: (err as Error).message,
    };
  }
}

// Setup entries go through the REST API by exercise name, always in kg.
function toLogInput(entry: EvalEntry) {
  const input: Record<string, unknown> = {
    exercise: entry.exercise,
    unit: 'kg',
  };
  if (entry.sets) {
    input.sets = entry.sets.map(([reps, weight]) =>
      weight === null ? { reps } : { reps, weight },
    );
  }
  for (const field of [
    'durationMin',
    'speedKmh',
    'inclinePct',
    'distanceKm',
  ] as const) {
    if (entry[field] !== undefined) input[field] = entry[field];
  }
  return input;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
