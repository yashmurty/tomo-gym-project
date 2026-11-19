import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AuthTokenOutput } from '../../src/auth/dtos/auth-token-output.dto';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { UserOutput } from '../../src/user/dtos/user-output.dto';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
  seedAdminUser,
} from '../test-utils';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let adminUser: UserOutput;
  let authTokenForAdmin: AuthTokenOutput;

  beforeAll(async () => {
    await resetDBBeforeTest();
    await createDBEntities();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();

    ({ adminUser, authTokenForAdmin } = await seedAdminUser(app));
  });

  describe('Get user me', () => {
    it('gets user me', async () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.OK);
    });

    it('Unauthorized error when BearerToken is not provided', async () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('Unauthorized error when BearerToken is wrong', async () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer ' + 'abcd')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('get all users', () => {
    it('returns all users', async () => {
      const expectedOutput = [adminUser];

      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.OK)
        .expect({ data: expectedOutput, meta: { count: 1 } });
    });
  });

  describe('get a user by Id', () => {
    it('should get a user by Id', async () => {
      const expectedOutput = adminUser;

      return request(app.getHttpServer())
        .get('/users/1')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.OK)
        .expect({ data: expectedOutput, meta: {} });
    });

    it('throws NOT_FOUND when user doesnt exist', () => {
      return request(app.getHttpServer())
        .get('/users/99')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  const updateUserInput = {
    name: 'New e2etestername',
    password: '12345678aA12',
  };

  describe('update a user', () => {
    it('successfully updates a user', async () => {
      const expectedOutput: UserOutput = {
        ...adminUser,
        ...{ name: 'New e2etestername' },
      };

      return request(app.getHttpServer())
        .patch('/users/1')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .send(updateUserInput)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const resp = res.body;
          expectedOutput.updatedAt = resp.data.updatedAt;
          expect(resp).toEqual({ data: expectedOutput, meta: {} });
        });
    });

    it('throws NOT_FOUND when user doesnt exist', () => {
      return request(app.getHttpServer())
        .patch('/users/99')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('update fails when incorrect password type', () => {
      updateUserInput.password = 12345 as any;
      return request(app.getHttpServer())
        .patch('/users/1')
        .set('Authorization', 'Bearer ' + authTokenForAdmin.accessToken)
        .expect(HttpStatus.BAD_REQUEST)
        .send(updateUserInput)
        .expect((res) => {
          const resp = res.body;

          expect(resp.error.details.message).toContain(
            'password must be a string',
          );
        });
    });
  });

  // Constitution rule 16: user records carry email, which is never visible
  // to other users, so a regular user can read only themself.
  describe('regular user privacy', () => {
    let regularUserId: number;
    let regularUserToken: string;

    beforeAll(async () => {
      const credentials = {
        name: 'Regular User',
        email: 'regular-user@example.com',
        password: 'regular-user-password',
        timezone: 'Asia/Tokyo',
        locale: 'en',
        ageConfirmed: true,
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(HttpStatus.CREATED);
      regularUserId = registerResponse.body.data.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(HttpStatus.OK);
      regularUserToken = loginResponse.body.data.accessToken;
    });

    it('can read their own profile by id', async () => {
      return request(app.getHttpServer())
        .get(`/users/${regularUserId}`)
        .set('Authorization', 'Bearer ' + regularUserToken)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data.email).toBe('regular-user@example.com');
        });
    });

    it("cannot read another user's profile", async () => {
      return request(app.getHttpServer())
        .get(`/users/${adminUser.id}`)
        .set('Authorization', 'Bearer ' + regularUserToken)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('cannot list users', async () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer ' + regularUserToken)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("cannot update another user's profile", async () => {
      return request(app.getHttpServer())
        .patch(`/users/${adminUser.id}`)
        .set('Authorization', 'Bearer ' + regularUserToken)
        .send({ timezone: 'Asia/Tokyo' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    describe('profile updates', () => {
      const patchSelf = (body: object) =>
        request(app.getHttpServer())
          .patch(`/users/${regularUserId}`)
          .set('Authorization', 'Bearer ' + regularUserToken)
          .send(body);

      it('updates timezone and locale', async () => {
        await patchSelf({ timezone: 'America/New_York', locale: 'ja' })
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body.data.timezone).toBe('America/New_York');
            expect(res.body.data.locale).toBe('ja');
          });
      });

      it('stores a timezone exactly as sent, without canonicalising it', async () => {
        await patchSelf({ timezone: 'Asia/Kolkata' })
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body.data.timezone).toBe('Asia/Kolkata');
          });
      });

      it('rejects an invalid timezone', async () => {
        await patchSelf({ timezone: 'Tokyo' }).expect(HttpStatus.BAD_REQUEST);
      });

      it('converts a weight sent in lb and returns it in kg', async () => {
        await patchSelf({ weight: 160, weightUnit: 'lb' })
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body.data.weightKg).toBe(72.57);
            expect(res.body.data.weightUnit).toBe('lb');
          });

        // Read back from the DB: numeric column comes back as a number.
        await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', 'Bearer ' + regularUserToken)
          .expect((res) => {
            expect(res.body.data.weightKg).toBe(72.57);
          });
      });

      it('rejects an implausible weight', async () => {
        await patchSelf({ weight: 5, weightUnit: 'kg' }).expect(
          HttpStatus.BAD_REQUEST,
        );
      });

      it('ignores fields a user may not change, such as roles', async () => {
        await patchSelf({
          name: 'Still a user',
          roles: ['ADMIN'],
          isAccountDisabled: true,
          email: 'hijacked@example.com',
        })
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body.data.roles).toEqual(['USER']);
            expect(res.body.data.isAccountDisabled).toBe(false);
            expect(res.body.data.email).toBe('regular-user@example.com');
            expect(res.body.data.name).toBe('Still a user');
          });

        // Log in again: a fresh token carries roles from the DB, so this
        // proves the escalation wasn't stored, not just absent from the
        // old token.
        const relogin = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'regular-user@example.com',
            password: 'regular-user-password',
          })
          .expect(HttpStatus.OK);
        expect(relogin.body.data.accessToken).toBeDefined();
        await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', 'Bearer ' + relogin.body.data.accessToken)
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('clears the weight with null', async () => {
        await patchSelf({ weight: null })
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body.data.weightKg).toBeNull();
          });
      });
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
