import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AuthTokenOutput } from '../../src/auth/dtos/auth-token-output.dto';
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
    app.useGlobalPipes(new ValidationPipe());
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
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
