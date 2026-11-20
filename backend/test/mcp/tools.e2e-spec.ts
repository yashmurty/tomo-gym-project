import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import request from 'supertest';

import {
  LLM_CLIENT,
  LlmClient,
  LlmRequest,
  LlmResponse,
} from '../../src/agent/llm/llm-client';
import { StubLlmClient } from '../../src/agent/llm/stub-llm-client';
import { McpEndpoint } from '../../src/agent/services/mcp-endpoint';
import { AppModule } from '../../src/app.module';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { addDays, todayIn } from '../../src/shared/time/calendar-date';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
} from '../test-utils';

class ScriptedLlm implements LlmClient {
  readonly queue: LlmResponse[] = [];
  private readonly stub = new StubLlmClient();
  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    return this.queue.shift() ?? this.stub.createMessage(req);
  }
}

type ToolResult = { ok: boolean; body: any; text: string };

describe('MCP tools (e2e)', () => {
  let app: INestApplication;
  let mcpUrl: string;
  let llm: ScriptedLlm;
  const TZ = 'Asia/Tokyo';
  const today = () => todayIn(TZ);
  const yesterday = () => addDays(todayIn(TZ), -1);

  let login: string;
  let patA: string;
  let patB: string;

  const http = () => request(app.getHttpServer());

  const call = async (
    pat: string,
    name: string,
    args: object = {},
  ): Promise<ToolResult> => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: { headers: { Authorization: `Bearer ${pat}` } },
      }),
    );
    const result = await client.callTool({
      name,
      arguments: args as Record<string, unknown>,
    });
    await client.close();
    const text = (result.content as { text: string }[])[0].text;
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* error text */
    }
    return { ok: result.isError !== true, body, text };
  };

  const dayEntries = async (date: string) =>
    (await http().get(`/days/${date}`).set('Authorization', `Bearer ${login}`))
      .body.data.entries;

  beforeAll(async () => {
    await resetDBBeforeTest();
    await createDBEntities();

    llm = new ScriptedLlm();
    let endpoint = '';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_CLIENT)
      .useValue(llm)
      .overrideProvider(McpEndpoint)
      .useValue({ url: () => endpoint })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.listen(0, '127.0.0.1');
    endpoint =
      mcpUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/mcp`;

    const credentials = {
      email: 'tools@example.com',
      password: 'password-123',
    };
    await http()
      .post('/auth/register')
      .send({
        name: 'T',
        timezone: TZ,
        locale: 'en',
        ageConfirmed: true,
        weight: 72,
        ...credentials,
      })
      .expect(HttpStatus.CREATED);
    login = (await http().post('/auth/login').send(credentials)).body.data
      .accessToken;

    const mint = async (name: string) =>
      (
        await http()
          .post('/personal-access-tokens')
          .set('Authorization', `Bearer ${login}`)
          .send({ name })
      ).body.data.token as string;
    patA = await mint('client A');
    patB = await mint('client B');
  });

  const twoSets = [
    { reps: 10, weight: 40 },
    { reps: 10, weight: 40 },
  ];

  it('get_profile tells external clients the date and units', async () => {
    const { ok, body } = await call(patA, 'get_profile');
    expect(ok).toBe(true);
    expect(body).toEqual({
      timezone: TZ,
      locale: 'en',
      weightUnit: 'kg',
      weightKg: 72,
      today: today(),
    });
  });

  describe('corrections, each undone by undo_last', () => {
    let ids: Record<string, number>;

    beforeAll(async () => {
      ids = {};
      for (const exercise of ['lat pulldown', 'pec fly', 'leg press']) {
        const r = await call(patA, 'log_entry', {
          exercise,
          unit: 'kg',
          sets: twoSets,
        });
        ids[exercise] = r.body.entryId;
      }
    });

    it('get_day lists the entries with their ids', async () => {
      const { body } = await call(patA, 'get_day');
      expect(body.date).toBe(today());
      expect(body.entries.map((e: any) => e.entryId).sort()).toEqual(
        Object.values(ids).sort(),
      );
    });

    it('update_entry replaces sets and recomputes calories; undo restores both', async () => {
      const updated = await call(patA, 'update_entry', {
        entryId: ids['pec fly'],
        unit: 'kg',
        sets: [...twoSets, { reps: 8, weight: 45 }],
      });
      expect(updated.body.sets).toHaveLength(3);
      expect(updated.body.estKcal).toBe(25.2);

      const undo = await call(patA, 'undo_last');
      expect(undo.body).toEqual({ undone: 1, skipped: [] });
      const pecFly = (await dayEntries(today())).find(
        (e: any) => e.id === ids['pec fly'],
      );
      expect(pecFly.sets).toHaveLength(2);
      expect(pecFly.estKcal).toBe(16.8);
    });

    it('delete_entry removes; undo brings it back', async () => {
      await call(patA, 'delete_entry', { entryId: ids['leg press'] });
      expect(await dayEntries(today())).toHaveLength(2);

      await call(patA, 'undo_last');
      expect(await dayEntries(today())).toHaveLength(3);
    });

    it('move_entries moves several at once; undo moves them back', async () => {
      const moved = await call(patA, 'move_entries', {
        entryIds: [ids['lat pulldown'], ids['pec fly']],
        date: yesterday(),
      });
      expect(moved.body.date).toBe(yesterday());
      expect(moved.body.entries).toHaveLength(2);
      expect(await dayEntries(today())).toHaveLength(1);

      const undo = await call(patA, 'undo_last');
      expect(undo.body.undone).toBe(2);
      expect(await dayEntries(today())).toHaveLength(3);
      expect(await dayEntries(yesterday())).toHaveLength(0);
    });

    it('never overwrites a later edit: undo skips a changed entry', async () => {
      await call(patA, 'update_entry', {
        entryId: ids['leg press'],
        unit: 'kg',
        sets: [{ reps: 12, weight: 50 }],
      });
      // The user then edits it in the app.
      await http()
        .patch(`/entries/${ids['leg press']}`)
        .set('Authorization', `Bearer ${login}`)
        .send({ sets: [{ reps: 15, weight: 55 }] })
        .expect(HttpStatus.OK);

      const undo = await call(patA, 'undo_last');
      expect(undo.body.undone).toBe(0);
      expect(undo.body.skipped).toEqual([
        {
          entityType: 'entry',
          entityId: ids['leg press'],
          reason: 'changed since; left as is',
        },
      ]);
      const legPress = (await dayEntries(today())).find(
        (e: any) => e.id === ids['leg press'],
      );
      expect(legPress.sets).toEqual([{ setIndex: 1, reps: 15, weightKg: 55 }]);
    });

    it("undo_last from one client never reverses another client's changes", async () => {
      const before = await dayEntries(today());
      await call(patA, 'log_entry', {
        exercise: 'squat',
        unit: 'kg',
        sets: twoSets,
      });
      // Client B has nothing of its own to undo.
      const undoB = await call(patB, 'undo_last');
      expect(undoB.body).toEqual({ undone: 0, skipped: [] });
      expect(await dayEntries(today())).toHaveLength(before.length + 1);
      await call(patA, 'undo_last');
      expect(await dayEntries(today())).toHaveLength(before.length);
    });
  });

  describe('reading history', () => {
    beforeAll(async () => {
      await call(patA, 'log_entry', {
        exercise: 'seated leg curl',
        date: yesterday(),
        unit: 'kg',
        sets: [
          { reps: 10, weight: 19 },
          { reps: 10, weight: 19 },
        ],
      });
      await call(patA, 'log_entry', {
        exercise: 'walk',
        date: yesterday(),
        durationMin: 10,
        speedKmh: 6,
        inclinePct: 2,
      });
    });

    it('get_last_entry returns the most recent one, for "same as last time"', async () => {
      const { body } = await call(patA, 'get_last_entry', {
        exercise: 'leg curl',
      });
      expect(body.found).toBe(true);
      expect(body.entry).toMatchObject({
        exercise: 'Seated leg curl',
        date: yesterday(),
        sets: [
          { reps: 10, weightKg: 19 },
          { reps: 10, weightKg: 19 },
        ],
      });
    });

    it('get_last_entry reports when there is none', async () => {
      expect(
        (await call(patA, 'get_last_entry', { exercise: 'deadlift' })).body,
      ).toEqual({ found: false });
    });

    it('query_history filters by muscle group and date range', async () => {
      const legs = await call(patA, 'query_history', {
        muscleGroup: 'legs',
        from: yesterday(),
        to: yesterday(),
      });
      expect(legs.body.entries.map((e: any) => e.exercise)).toEqual([
        'Seated leg curl',
      ]);

      const all = await call(patA, 'query_history', { limit: 2 });
      expect(all.body.count).toBe(2);
    });
  });

  describe('notes, exercises, aliases and profile', () => {
    it('set_day_note sets a note and undo clears it', async () => {
      const set = await call(patA, 'set_day_note', { note: 'Felt strong' });
      expect(set.body).toEqual({ date: today(), note: 'Felt strong' });
      await call(patA, 'undo_last');
      expect((await call(patA, 'get_day')).body.note).toBeNull();
    });

    it('create_exercise is undoable while unused', async () => {
      const created = await call(patA, 'create_exercise', {
        name: 'Sled push',
        modality: 'cardio',
        muscleGroup: 'full_body',
      });
      expect(created.body).toMatchObject({ name: 'Sled push', isCustom: true });
      expect((await call(patA, 'undo_last')).body.undone).toBe(2); // exercise + its alias

      const search = await http()
        .get('/exercises?search=sled')
        .set('Authorization', `Bearer ${login}`);
      expect(search.body.data).toHaveLength(0);
    });

    it('keeps a created exercise that entries use, and says so', async () => {
      await call(patA, 'create_exercise', {
        name: 'Battle ropes',
        modality: 'cardio',
        muscleGroup: 'full_body',
      });
      await call(patA, 'log_entry', {
        exercise: 'battle ropes',
        durationMin: 5,
      });

      await call(patA, 'undo_last'); // the entry
      const second = await call(patA, 'undo_last'); // the exercise
      expect(second.body.skipped).toEqual([
        expect.objectContaining({
          entityType: 'exercise',
          reason: 'kept: entries use this exercise',
        }),
      ]);
    });

    it("add_exercise_alias teaches the user's own name; undo forgets it", async () => {
      expect(
        (
          await call(patA, 'log_entry', {
            exercise: 'flies',
            unit: 'kg',
            sets: twoSets,
          })
        ).ok,
      ).toBe(false);

      const added = await call(patA, 'add_exercise_alias', {
        alias: 'flies',
        exercise: 'pec fly',
      });
      expect(added.body).toMatchObject({
        alias: 'flies',
        created: true,
        exercise: { name: 'Pec fly' },
      });

      const logged = await call(patA, 'log_entry', {
        exercise: 'flies',
        unit: 'kg',
        sets: twoSets,
      });
      expect(logged.body.exercise).toBe('Pec fly');

      await call(patA, 'undo_last'); // the entry
      await call(patA, 'undo_last'); // the alias
      expect(
        (
          await call(patA, 'log_entry', {
            exercise: 'flies',
            unit: 'kg',
            sets: twoSets,
          })
        ).ok,
      ).toBe(false);
    });

    it('update_profile changes weight (undoable) and refuses password changes', async () => {
      expect(
        (await call(patA, 'update_profile', { password: 'hijacked-123' })).ok,
      ).toBe(false);

      const updated = await call(patA, 'update_profile', {
        weight: 80,
        weightUnit: 'kg',
      });
      expect(updated.body.weightKg).toBe(80);
      await call(patA, 'undo_last');
      expect((await call(patA, 'get_profile')).body.weightKg).toBe(72);

      // The password is untouched: login still works with the original.
      await http()
        .post('/auth/login')
        .send({ email: 'tools@example.com', password: 'password-123' })
        .expect(HttpStatus.OK);
    });
  });

  describe('undo_last from chat', () => {
    const chat = (text: string, key: string) =>
      http()
        .post('/chat')
        .set('Authorization', `Bearer ${login}`)
        .send({ text, idempotencyKey: key })
        .expect(HttpStatus.OK);

    it("undoes the user's previous turn, never the current one", async () => {
      const before = (await dayEntries(today())).length;
      await chat('3x5 @ 100kg deadlift', 'chat-undo-0001');
      expect(await dayEntries(today())).toHaveLength(before + 1);

      llm.queue.push({
        model: 'scripted',
        content: [
          { type: 'tool_use', id: 'toolu_undo', name: 'undo_last', input: {} },
        ],
        stopReason: 'tool_use',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      });
      const res = await chat('undo that', 'chat-undo-0002');
      const tool = res.text
        .split('\n\n')
        .map((c) => c.split('\n').find((l) => l.startsWith('data: ')))
        .filter(Boolean)
        .map((l) => JSON.parse(l!.slice(6)))
        .find((e) => e.type === 'tool');
      expect(tool).toMatchObject({
        name: 'undo_last',
        ok: true,
        result: { undone: 1, skipped: [] },
      });
      expect(await dayEntries(today())).toHaveLength(before);
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
