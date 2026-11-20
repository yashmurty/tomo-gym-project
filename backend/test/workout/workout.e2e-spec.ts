import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { addDays, todayIn } from '../../src/shared/time/calendar-date';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
} from '../test-utils';

describe('Workout (e2e)', () => {
  let app: INestApplication;
  const TZ = 'Asia/Tokyo';

  const register = async (email: string, extra: object = {}) => {
    const credentials = { email, password: 'password-123' };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: email,
        timezone: TZ,
        locale: 'en',
        ageConfirmed: true,
        ...credentials,
        ...extra,
      })
      .expect(HttpStatus.CREATED);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(HttpStatus.OK);
    return login.body.data.accessToken as string;
  };

  const as = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${token}`),
  });

  let alice: ReturnType<typeof as>;
  let bob: ReturnType<typeof as>;
  const twoSets = [
    { reps: 10, weight: 47 },
    { reps: 10, weight: 47 },
  ];

  beforeAll(async () => {
    await resetDBBeforeTest();
    await createDBEntities();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();

    alice = as(await register('alice@example.com', { weight: 72 }));
    bob = as(await register('bob@example.com'));
  });

  describe('logging strength work', () => {
    it.each([
      'lat pull down',
      'Lat Pull-Down',
      'ラットプルダウン',
      'ﾗｯﾄﾌﾟﾙﾀﾞｳﾝ',
    ])(
      'resolves "%s" to Lat pulldown and logs it for today in the user timezone',
      async (typed) => {
        const res = await alice
          .post('/entries', { exercise: typed, sets: twoSets })
          .expect(HttpStatus.CREATED);

        const entry = res.body.data;
        expect(entry.exercise.name).toBe('Lat pulldown');
        expect(entry.date).toBe(todayIn(TZ));
        expect(entry.sets).toEqual([
          { setIndex: 1, reps: 10, weightKg: 47 },
          { setIndex: 2, reps: 10, weightKg: 47 },
        ]);
        // 3.5 MET × 72 kg × (2 sets × 2 min) / 60
        expect(entry.estKcal).toBe(16.8);
        expect(entry.kcalIsRough).toBe(true);
        expect(entry.source).toBe('app');
      },
    );

    it('converts set weights from lb', async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'bench press',
          unit: 'lb',
          sets: [{ reps: 5, weight: 100 }],
        })
        .expect(HttpStatus.CREATED);
      expect(res.body.data.sets[0].weightKg).toBe(45.36);
    });

    it('ignores server-only fields a client tries to send', async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'leg press',
          sets: twoSets,
          source: 'chat',
          rawInput: 'forged',
          userId: 999,
          estKcal: 9999,
        })
        .expect(HttpStatus.CREATED);
      expect(res.body.data.source).toBe('app');
      expect(res.body.data.rawInput).toBeNull();
      expect(res.body.data.estKcal).toBe(16.8);
    });

    it('suggests candidates for an unknown exercise', async () => {
      const res = await alice
        .post('/entries', { exercise: 'pec flye', sets: twoSets })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(res.body.error.message).toContain("Unknown exercise 'pec flye'");
      expect(res.body.error.message).toContain('Pec fly');
    });
  });

  describe('cardio and bodyweight', () => {
    it("estimates the brief's walk with the ACSM equation", async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        })
        .expect(HttpStatus.CREATED);
      expect(res.body.data.exercise.name).toBe('Treadmill walk');
      expect(res.body.data.metValue).toBe(4.89);
      expect(res.body.data.estKcal).toBe(58.6);
      expect(res.body.data.kcalIsRough).toBe(false);
    });

    it('accepts a plank by duration', async () => {
      await alice
        .post('/entries', { exercise: 'plank', durationMin: 2 })
        .expect(HttpStatus.CREATED);
    });

    it.each([
      [
        'strength with a duration',
        { exercise: 'leg press', sets: twoSets, durationMin: 5 },
      ],
      ['strength without sets', { exercise: 'leg press' }],
      ['cardio without a duration', { exercise: 'walk', speedKmh: 6 }],
      [
        'cardio with sets',
        { exercise: 'walk', durationMin: 10, sets: twoSets },
      ],
      [
        'bodyweight with both sets and duration',
        { exercise: 'plank', durationMin: 1, sets: twoSets },
      ],
    ])('rejects %s', async (_label, body) => {
      await alice.post('/entries', body).expect(HttpStatus.BAD_REQUEST);
    });

    it('leaves kcal empty for a user without a body weight', async () => {
      const res = await bob
        .post('/entries', { exercise: 'walk', durationMin: 10, speedKmh: 6 })
        .expect(HttpStatus.CREATED);
      expect(res.body.data.estKcal).toBeNull();
      expect(res.body.data.metValue).not.toBeNull();
    });
  });

  describe('dates', () => {
    it("resolves 'yesterday' in the user timezone", async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'squat',
          date: 'yesterday',
          sets: twoSets,
        })
        .expect(HttpStatus.CREATED);
      expect(res.body.data.date).toBe(addDays(todayIn(TZ), -1));
    });

    it.each([
      ['a future date', addDays(todayIn(TZ), 2)],
      ['an impossible date', '2026-02-30'],
      ['an unknown keyword', 'tomorrow'],
    ])('rejects %s', async (_label, date) => {
      await alice
        .post('/entries', { exercise: 'squat', date, sets: twoSets })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('day numbers, moves and deletes', () => {
    let carol: ReturnType<typeof as>;
    const ids: Record<string, number> = {};

    beforeAll(async () => {
      carol = as(await register('carol@example.com', { weight: 60 }));
      for (const date of ['2026-10-01', '2026-10-03', '2026-10-05']) {
        const res = await carol
          .post('/entries', { exercise: 'leg press', date, sets: twoSets })
          .expect(HttpStatus.CREATED);
        ids[date] = res.body.data.id;
      }
    });

    const dayNumber = async (date: string) =>
      (await carol.get(`/days/${date}`).expect(HttpStatus.OK)).body.data
        .dayNumber;

    it('numbers days by position among days with entries', async () => {
      expect(await dayNumber('2026-10-01')).toBe(1);
      expect(await dayNumber('2026-10-03')).toBe(2);
      expect(await dayNumber('2026-10-05')).toBe(3);
      expect(await dayNumber('2026-10-02')).toBeNull();
    });

    it('renumbers after a move, without any stored number to drift', async () => {
      const res = await carol
        .post('/entries/move', {
          entryIds: [ids['2026-10-03']],
          date: '2026-10-05',
        })
        .expect(HttpStatus.OK);
      expect(res.body.data.date).toBe('2026-10-05');
      expect(res.body.data.entries).toHaveLength(2);
      expect(res.body.data.dayNumber).toBe(2);
      expect(await dayNumber('2026-10-03')).toBeNull();
    });

    it('renumbers after a delete, and hides the deleted entry', async () => {
      await carol
        .delete(`/entries/${ids['2026-10-01']}`)
        .expect(HttpStatus.NO_CONTENT);
      expect(await dayNumber('2026-10-05')).toBe(1);

      const day = (await carol.get('/days/2026-10-01')).body.data;
      expect(day.entries).toHaveLength(0);
      await carol
        .patch(`/entries/${ids['2026-10-01']}`, { sets: twoSets })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('keeps DATE values exact when the server runs east of UTC', async () => {
      // node-postgres would parse DATE to local midnight; in Tokyo that's the
      // previous day in UTC. The pg-date-parser must keep it a plain string,
      // including on the raw-SQL day-number path.
      const original = process.env.TZ;
      process.env.TZ = 'Asia/Tokyo';
      try {
        const day = (await carol.get('/days/2026-10-05').expect(HttpStatus.OK))
          .body.data;
        expect(day.date).toBe('2026-10-05');
        expect(day.dayNumber).toBe(1);
        expect(
          day.entries.every((e: { date: string }) => e.date === '2026-10-05'),
        ).toBe(true);

        const list = (await carol.get('/days?from=2026-10-01&to=2026-10-31'))
          .body.data;
        expect(list.map((d: { date: string }) => d.date)).toEqual([
          '2026-10-05',
        ]);
      } finally {
        process.env.TZ = original;
      }
    });

    it('lists training days newest first', async () => {
      await carol.post('/entries', {
        exercise: 'squat',
        date: '2026-10-09',
        sets: twoSets,
      });
      const list = (await carol.get('/days?from=2026-10-01&to=2026-10-31')).body
        .data;
      expect(
        list.map((d: { date: string; dayNumber: number }) => [
          d.date,
          d.dayNumber,
        ]),
      ).toEqual([
        ['2026-10-09', 2],
        ['2026-10-05', 1],
      ]);
    });
  });

  describe('editing', () => {
    let entryId: number;

    beforeAll(async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'seated row',
          date: '2026-11-01',
          sets: twoSets,
        })
        .expect(HttpStatus.CREATED);
      entryId = res.body.data.id;
    });

    it('replaces sets wholesale and recomputes calories', async () => {
      const res = await alice
        .patch(`/entries/${entryId}`, {
          sets: [
            { reps: 10, weight: 40 },
            { reps: 8, weight: 45 },
            { reps: 6, weight: 50 },
          ],
        })
        .expect(HttpStatus.OK);
      expect(res.body.data.sets.map((s: { reps: number }) => s.reps)).toEqual([
        10, 8, 6,
      ]);
      expect(res.body.data.estKcal).toBe(25.2); // 3 sets × 2 min
    });

    it('moves the entry when the date changes', async () => {
      const res = await alice
        .patch(`/entries/${entryId}`, { date: '2026-11-02' })
        .expect(HttpStatus.OK);
      expect(res.body.data.date).toBe('2026-11-02');
    });

    it('rejects switching to an exercise the measurements do not fit', async () => {
      await alice
        .patch(`/entries/${entryId}`, { exercise: 'walk' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('sets and clears a day note', async () => {
      const set = await alice.put('/days/2026-11-02/note', {
        note: 'Felt strong',
      });
      expect(set.body.data.note).toBe('Felt strong');
      const cleared = await alice.put('/days/2026-11-02/note', { note: null });
      expect(cleared.body.data.note).toBeNull();
    });
  });

  describe('privacy (constitution rule 16)', () => {
    let aliceEntryId: number;

    beforeAll(async () => {
      const res = await alice
        .post('/entries', {
          exercise: 'deadlift',
          date: '2026-11-03',
          sets: twoSets,
        })
        .expect(HttpStatus.CREATED);
      aliceEntryId = res.body.data.id;
    });

    it("another user cannot edit, delete or move someone's entry", async () => {
      await bob
        .patch(`/entries/${aliceEntryId}`, { sets: twoSets })
        .expect(HttpStatus.UNAUTHORIZED);
      await bob
        .delete(`/entries/${aliceEntryId}`)
        .expect(HttpStatus.UNAUTHORIZED);
      await bob
        .post('/entries/move', { entryIds: [aliceEntryId], date: '2026-11-01' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("another user's day views never include someone else's entries", async () => {
      const day = (await bob.get('/days/2026-11-03').expect(HttpStatus.OK)).body
        .data;
      expect(day.entries).toHaveLength(0);
    });
  });

  describe('exercises', () => {
    it('lists the shared catalog and searches EN or JP aliases', async () => {
      const all = (await alice.get('/exercises').expect(HttpStatus.OK)).body
        .data;
      expect(all.length).toBeGreaterThanOrEqual(32);

      const jp = (
        await alice.get(`/exercises?search=${encodeURIComponent('ペック')}`)
      ).body.data;
      expect(jp.map((e: { name: string }) => e.name)).toContain('Pec fly');
    });

    it('creates a custom exercise visible only to its owner', async () => {
      const created = await alice
        .post('/exercises', {
          name: 'Cable crossover',
          nameJa: 'ケーブルクロスオーバー',
          modality: 'strength',
          muscleGroup: 'chest',
        })
        .expect(HttpStatus.CREATED);
      expect(created.body.data.isCustom).toBe(true);

      await alice
        .post('/entries', { exercise: 'cable cross-over', sets: twoSets })
        .expect(HttpStatus.CREATED);

      const bobs = (await bob.get('/exercises?search=crossover')).body.data;
      expect(bobs).toHaveLength(0);
      await bob
        .post('/entries', { exerciseId: created.body.data.id, sets: twoSets })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('refuses a custom exercise that duplicates a catalog alias', async () => {
      await alice
        .post('/exercises', {
          name: 'Pec Deck',
          modality: 'strength',
          muscleGroup: 'chest',
        })
        .expect(HttpStatus.CONFLICT);
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
