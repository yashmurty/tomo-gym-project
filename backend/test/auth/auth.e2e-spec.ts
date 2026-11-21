import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { ROLE } from '../../src/auth/constants/role.constant';
import { LoginInput } from '../../src/auth/dtos/auth-login-input.dto';
import { RefreshTokenInput } from '../../src/auth/dtos/auth-refresh-token-input.dto';
import { RegisterInput } from '../../src/auth/dtos/auth-register-input.dto';
import { AuthTokenOutput } from '../../src/auth/dtos/auth-token-output.dto';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { LOCALE } from '../../src/shared/constants/locale.constant';
import { WEIGHT_UNIT } from '../../src/shared/units/weight';
import { User } from '../../src/user/entities/user.entity';
import { AppModule } from './../../src/app.module';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
  seedAdminUser,
} from './../test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authTokenForAdmin: AuthTokenOutput;

  beforeAll(async () => {
    await resetDBBeforeTest();
    await createDBEntities();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();

    const adminUserTokens = await seedAdminUser(app);
    authTokenForAdmin = adminUserTokens.authTokenForAdmin;
  });

  describe('Admin User Auth Tokens', () => {
    it('should have Auth Tokens for admin', () => {
      expect(authTokenForAdmin).toHaveProperty('accessToken');
      expect(authTokenForAdmin).toHaveProperty('refreshToken');
    });
  });

  describe('Register a new user', () => {
    const registerInput: RegisterInput = {
      name: 'e2etester',
      password: '12345678',
      email: 'e2etester@random.com',
      timezone: 'Asia/Tokyo',
      locale: LOCALE.JA,
      ageConfirmed: true,
    };

    const registerOutput = {
      id: 2,
      name: 'e2etester',
      roles: [ROLE.USER],
      isAccountDisabled: false,
      email: 'e2etester@random.com',
      timezone: 'Asia/Tokyo',
      locale: LOCALE.JA,
      weightKg: null,
      weightUnit: WEIGHT_UNIT.KG,
    };

    it('should successfully register a new user', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerInput)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          const resp = res.body;
          expect(resp.data).toEqual(expect.objectContaining(registerOutput));
        });
    });

    it('should fail to register without Input DTO', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should fail to register with incorrect email format', async () => {
      const invalidRegisterInput = { ...registerInput, email: 'not-an-email' };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidRegisterInput)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it.each([
      ['an unknown time zone', { timezone: 'Mars/Base' }],
      ['a fixed UTC offset', { timezone: '+09:00' }],
      ['no time zone', { timezone: undefined }],
      ['the age box unticked', { ageConfirmed: false }],
      ['no age confirmation', { ageConfirmed: undefined }],
      ['an unsupported locale', { locale: 'fr' }],
      ['an implausible weight', { weight: 900 }],
    ])('rejects signup with %s', async (_label, override) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerInput, email: 'rejected@random.com', ...override })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('answers an email that is already registered with 409', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerInput, email: ' E2ETester@Random.com ' })
        .expect(HttpStatus.CONFLICT);
    });

    it('ignores a smuggled admin role', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerInput,
          email: 'smuggler@random.com',
          roles: [ROLE.ADMIN],
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.data.roles).toEqual([ROLE.USER]);
        });
    });

    it('stores an optional signup weight in kg', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerInput,
          email: 'pounds@random.com',
          weight: 160,
          weightUnit: WEIGHT_UNIT.LB,
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.data.weightKg).toBe(72.57);
          expect(res.body.data.weightUnit).toBe(WEIGHT_UNIT.LB);
        });
    });
  });

  describe('Login the registered user', () => {
    const loginInput: LoginInput = {
      email: 'e2etester@random.com',
      password: '12345678',
    };

    it('should successfully login the user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginInput)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const token = res.body.data;
          expect(token).toHaveProperty('accessToken');
          expect(token).toHaveProperty('refreshToken');
        });
    });

    it('should fail to login with wrong credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...loginInput, password: 'wrong-pass' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    // TODO: Should fail when isAccountDisabled is set to true.
  });

  describe('Refreshing JWT token', () => {
    const loginInput: LoginInput = {
      email: 'e2etester@random.com',
      password: '12345678',
    };

    it('logs in whatever the case or surrounding spaces of the email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...loginInput, email: ' E2ETester@Random.com' })
        .expect(HttpStatus.OK);
    });

    it('should successfully get new auth token using refresh token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginInput);

      const token: AuthTokenOutput = loginResponse.body.data;
      const refreshTokenInput: RefreshTokenInput = {
        refreshToken: token.refreshToken,
      };

      await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send(refreshTokenInput)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const data = res.body.data;
          expect(data).toHaveProperty('accessToken');
          expect(data).toHaveProperty('refreshToken');
        });
    });

    // Refresh tokens last 90 days, so refresh is where disabling bites.
    it('should refuse to refresh for a disabled account', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginInput);
      const token: AuthTokenOutput = loginResponse.body.data;

      const users = app.get(DataSource).getRepository(User);
      await users.update(
        { email: loginInput.email },
        { isAccountDisabled: true },
      );
      try {
        await request(app.getHttpServer())
          .post('/auth/refresh-token')
          .send({ refreshToken: token.refreshToken })
          .expect(HttpStatus.UNAUTHORIZED);
      } finally {
        await users.update(
          { email: loginInput.email },
          { isAccountDisabled: false },
        );
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
