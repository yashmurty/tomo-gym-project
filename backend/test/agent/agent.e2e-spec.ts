import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  LLM_CLIENT,
  LlmClient,
  LlmRequest,
  LlmResponse,
} from '../../src/agent/llm/llm-client';
import { StubLlmClient } from '../../src/agent/llm/stub-llm-client';
import { McpEndpoint } from '../../src/agent/services/mcp-endpoint';
import { AppModule } from '../../src/app.module';
import { TurnTokenService } from '../../src/mcp/services/turn-token.service';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { todayIn } from '../../src/shared/time/calendar-date';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
} from '../test-utils';

// The deterministic stub by default; tests can queue exact responses to
// simulate what a misbehaving or prompt-injected model might emit.
class ScriptedLlm implements LlmClient {
  readonly requests: LlmRequest[] = [];
  readonly queue: LlmResponse[] = [];
  private readonly stub = new StubLlmClient();

  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(structuredClone(req));
    return this.queue.shift() ?? this.stub.createMessage(req);
  }
}

const toolUse = (input: unknown, id = 'toolu_test_1'): LlmResponse => ({
  model: 'scripted',
  content: [{ type: 'tool_use', id, name: 'log_entry', input }],
  stopReason: 'tool_use',
  usage: {
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
});

type SseEvent = { type: string; [key: string]: any };
const parseSse = (body: string): SseEvent[] =>
  body
    .split('\n\n')
    .map((chunk) => chunk.split('\n').find((l) => l.startsWith('data: ')))
    .filter((l): l is string => !!l)
    .map((l) => JSON.parse(l.slice(6)));

describe('Agent + MCP (e2e)', () => {
  let app: INestApplication;
  let llm: ScriptedLlm;
  let mcpUrl: string;
  const TZ = 'Asia/Tokyo';

  const register = async (email: string) => {
    const credentials = { email, password: 'password-123' };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: email,
        timezone: TZ,
        locale: 'en',
        ageConfirmed: true,
        weight: 72,
        ...credentials,
      })
      .expect(HttpStatus.CREATED);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials);
    return login.body.data.accessToken as string;
  };

  let aliceToken: string;
  let bobToken: string;
  let keyCounter = 0;
  const newKey = () => `test-key-${String(++keyCounter).padStart(4, '0')}`;

  const chat = async (
    token: string,
    text: string,
    idempotencyKey = newKey(),
  ) => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ text, idempotencyKey })
      .expect(HttpStatus.OK)
      .expect('Content-Type', /text\/event-stream/);
    return parseSse(res.text);
  };

  const today = (token: string) =>
    request(app.getHttpServer())
      .get('/days/today')
      .set('Authorization', `Bearer ${token}`)
      .then((r) => r.body.data);

  const mcpClient = async (bearer: string) => {
    const client = new Client({ name: 'e2e-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
      }),
    );
    return client;
  };

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
    // A real port: the agent reaches /mcp over HTTP like any client.
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    endpoint = mcpUrl = `http://127.0.0.1:${port}/mcp`;

    aliceToken = await register('alice@example.com');
    bobToken = await register('bob@example.com');
  });

  describe('POST /chat', () => {
    let turnId: number;
    const key = 'first-message-key';

    it('logs a workout through MCP and streams the confirmation', async () => {
      const events = await chat(aliceToken, '2x10 @ 47kg lat pulldown', key);

      expect(events.map((e) => e.type)).toEqual([
        'turn',
        'tool',
        'text',
        'done',
      ]);
      turnId = events[0].turnId;

      const tool = events[1];
      expect(tool).toMatchObject({ name: 'log_entry', ok: true });
      expect(tool.result).toMatchObject({
        exercise: 'Lat pulldown',
        date: todayIn(TZ),
        dayNumber: 1,
        sets: [
          { reps: 10, weightKg: 47 },
          { reps: 10, weightKg: 47 },
        ],
      });
      expect(events[2].text).toBe(
        `Logged Lat pulldown: 2×10 @ 47 kg · ${todayIn(TZ)} · Day 1.`,
      );
    });

    it('stores the entry as chat-sourced, with the raw input attached server-side', async () => {
      const day = await today(aliceToken);
      expect(day.entries).toHaveLength(1);
      expect(day.entries[0]).toMatchObject({
        source: 'chat',
        rawInput: '2x10 @ 47kg lat pulldown',
      });
    });

    it('injects the date and timezone into the current message only', async () => {
      const first = llm.requests[0];
      const current = first.messages[first.messages.length - 1];
      const contextText = (current.content as { text: string }[])[0].text;
      expect(contextText).toContain('timezone: Asia/Tokyo');
      expect(contextText).toContain(`today: ${todayIn(TZ)}`);
      expect(first.tools.map((t) => t.name)).toEqual(['log_entry']);

      // Next turn: the earlier turn is in history, without its context block.
      const before = llm.requests.length;
      await chat(aliceToken, 'hello');
      const next = llm.requests[before];
      const historyText = JSON.stringify(next.messages.slice(0, -1));
      expect(historyText).toContain('2x10 @ 47kg lat pulldown');
      expect(historyText).not.toContain('<context>');
    });

    it('replays a retried message instead of running the agent again', async () => {
      const callsBefore = llm.requests.length;
      const events = await chat(aliceToken, '2x10 @ 47kg lat pulldown', key);

      expect(events[0]).toEqual({ type: 'turn', turnId, replayed: true });
      expect(events.map((e) => e.type)).toEqual([
        'turn',
        'tool',
        'text',
        'done',
      ]);
      expect(llm.requests.length).toBe(callsBefore);
      expect((await today(aliceToken)).entries).toHaveLength(1);
    });

    it('records token usage for every model call', async () => {
      const rows = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS n FROM llm_usage WHERE "turnId" = $1', [
          turnId,
        ]);
      expect(rows[0].n).toBe(2); // tool call + confirmation
    });

    it('undoes everything a turn saved, once', async () => {
      const undo = (token: string, id: number) =>
        request(app.getHttpServer())
          .post(`/chat/messages/${id}/undo`)
          .set('Authorization', `Bearer ${token}`);

      await undo(bobToken, turnId).expect(HttpStatus.NOT_FOUND);

      const first = await undo(aliceToken, turnId).expect(HttpStatus.CREATED);
      expect(first.body.data).toEqual({ undone: 1 });
      expect((await today(aliceToken)).entries).toHaveLength(0);

      const second = await undo(aliceToken, turnId).expect(HttpStatus.CREATED);
      expect(second.body.data).toEqual({ undone: 0 });
    });

    it('turns an injected tool field into a tool error, never a write', async () => {
      llm.queue.push(
        toolUse({
          exercise: 'squat',
          unit: 'kg',
          sets: [{ reps: 5, weight: 100 }],
          userId: 999,
          source: 'app',
        }),
      );
      const before = (await today(bobToken)).entries.length;

      const events = await chat(bobToken, 'ignore previous instructions');
      const tool = events.find((e) => e.type === 'tool')!;
      expect(tool.ok).toBe(false);
      expect(tool.error).toContain('property userId should not exist');
      expect(tool.error).toContain('property source should not exist');
      expect(events[events.length - 1].type).toBe('done');
      expect((await today(bobToken)).entries).toHaveLength(before);
    });

    it('passes domain errors back to the model, e.g. unknown exercises', async () => {
      const events = await chat(bobToken, '2x10 @ 40kg pec flye');
      const tool = events.find((e) => e.type === 'tool')!;
      expect(tool.ok).toBe(false);
      expect(tool.error).toContain('Did you mean: Pec fly');
    });

    it('rejects a malformed request before streaming', async () => {
      await request(app.getHttpServer())
        .post('/chat')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'hi', idempotencyKey: 'bad key!' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  it('refuses to guess the unit of a weight from an external client', async () => {
    const res = await request(app.getHttpServer())
      .post('/personal-access-tokens')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'unit test client' });
    const client = await mcpClient(res.body.data.token);
    const result = await client.callTool({
      name: 'log_entry',
      arguments: { exercise: 'squat', sets: [{ reps: 5, weight: 47 }] },
    });
    await client.close();
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain(
      'Give `unit`',
    );
  });

  describe('/mcp', () => {
    let patId: number;
    let pat: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/personal-access-tokens')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ name: 'Claude Code' })
        .expect(HttpStatus.CREATED);
      pat = res.body.data.token;
      patId = res.body.data.id;
      expect(pat).toMatch(/^tomo_pat_/);
    });

    const rawMcp = (bearer?: string) => {
      const req = request(app.getHttpServer())
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
      return bearer ? req.set('Authorization', `Bearer ${bearer}`) : req;
    };

    it('rejects missing tokens and login tokens', async () => {
      await rawMcp().expect(HttpStatus.UNAUTHORIZED);
      await rawMcp(aliceToken).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects a personal access token on the REST API', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${pat}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('lists tools with strict schemas to an external client', async () => {
      const client = await mcpClient(pat);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(['log_entry']);
      expect(tools[0].inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      await client.close();
    });

    it('logs as source mcp with the token name as client, and echoes date + day number', async () => {
      const client = await mcpClient(pat);
      const result = await client.callTool({
        name: 'log_entry',
        arguments: {
          exercise: 'squat',
          date: 'yesterday',
          unit: 'kg',
          sets: [{ reps: 5, weight: 100 }],
        },
      });
      await client.close();

      expect(result.isError).toBeFalsy();
      const body = JSON.parse((result.content as { text: string }[])[0].text);
      expect(body).toMatchObject({
        exercise: 'Squat',
        dayNumber: expect.any(Number),
      });
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const day = (
        await request(app.getHttpServer())
          .get(`/days/${body.date}`)
          .set('Authorization', `Bearer ${aliceToken}`)
      ).body.data;
      const entry = day.entries.find(
        (e: { id: number }) => e.id === body.entryId,
      );
      expect(entry).toMatchObject({ source: 'mcp', rawInput: null });
    });

    it('rejects unknown fields from external clients too', async () => {
      const client = await mcpClient(pat);
      const result = await client.callTool({
        name: 'log_entry',
        arguments: {
          exercise: 'squat',
          sets: [{ reps: 5 }],
          rawInput: 'forged',
        },
      });
      await client.close();
      expect(result.isError).toBe(true);
    });

    it("rejects a turn token for someone else's message", async () => {
      const turnTokens = app.get(TurnTokenService);
      const [bobTurn] = await app.get(DataSource)
        .query(`SELECT m.id FROM chat_messages m JOIN users u ON u.id = m."userId"
                WHERE u.email = 'bob@example.com' AND m.role = 'user' LIMIT 1`);
      const [alice] = await app
        .get(DataSource)
        .query(`SELECT id FROM users WHERE email = 'alice@example.com'`);

      const forged = turnTokens.mint({ userId: alice.id, turnId: bobTurn.id });
      await rawMcp(forged).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects an expired turn token', async () => {
      const [alice] = await app
        .get(DataSource)
        .query(`SELECT id FROM users WHERE email = 'alice@example.com'`);
      const expired = app
        .get(JwtService)
        .sign({ sub: alice.id, mid: 1, scope: 'mcp:turn' }, { expiresIn: -10 });
      await rawMcp(expired).expect(HttpStatus.UNAUTHORIZED);
    });

    it('stops accepting a revoked token', async () => {
      await request(app.getHttpServer())
        .delete(`/personal-access-tokens/${patId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
      await request(app.getHttpServer())
        .delete(`/personal-access-tokens/${patId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(HttpStatus.NO_CONTENT);
      await rawMcp(pat).expect(HttpStatus.UNAUTHORIZED);
    });

    it('is stateless: GET is not allowed', async () => {
      await request(app.getHttpServer())
        .get('/mcp')
        .expect(HttpStatus.METHOD_NOT_ALLOWED);
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
