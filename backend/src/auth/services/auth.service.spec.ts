import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { LOCALE } from '../../shared/constants/locale.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { UserService } from '../../user/services/user.service';
import { ROLE } from '../constants/role.constant';
import { RegisterInput } from '../dtos/auth-register-input.dto';
import {
  AuthTokenOutput,
  UserAccessTokenClaims,
} from '../dtos/auth-token-output.dto';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const accessTokenClaims: UserAccessTokenClaims = {
    id: 6,
    email: 'randomUser@random.com',
    roles: [ROLE.USER],
  };

  const registerInput: RegisterInput = {
    name: 'Jhon doe',
    password: 'any password',
    email: 'randomUser@random.com',
    timezone: 'Asia/Tokyo',
    locale: LOCALE.JA,
    ageConfirmed: true,
  };

  const currentDate = new Date().toString();

  const userOutput: UserOutput = {
    name: 'John doe',
    isAccountDisabled: false,
    timezone: 'Asia/Tokyo',
    locale: LOCALE.JA,
    weightKg: null,
    weightUnit: WEIGHT_UNIT.KG,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...accessTokenClaims,
  };

  const authToken: AuthTokenOutput = {
    accessToken: 'random_access_token',
    refreshToken: 'random_refresh_token',
  };

  const mockedUserService = {
    findById: jest.fn(),
    createUser: jest.fn(),
    validateLoginCredentials: jest.fn(),
  };

  const mockedJwtService = {
    sign: jest.fn(),
  };

  const mockedConfigService = { get: jest.fn() };

  const mockedLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockedUserService },
        { provide: JwtService, useValue: mockedJwtService },
        { provide: ConfigService, useValue: mockedConfigService },
        { provide: AppLogger, useValue: mockedLogger },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const ctx = new RequestContext();

  describe('validateUser', () => {
    it('should success when email/password valid', async () => {
      jest
        .spyOn(mockedUserService, 'validateLoginCredentials')
        .mockImplementation(() => userOutput);

      expect(await service.validateUser(ctx, 'jhon', 'somepass')).toEqual(
        userOutput,
      );
      expect(mockedUserService.validateLoginCredentials).toBeCalledWith(
        ctx,
        'jhon',
        'somepass',
      );
    });

    it('should fail when email/password invalid', async () => {
      jest
        .spyOn(mockedUserService, 'validateLoginCredentials')
        .mockImplementation(() => {
          throw new UnauthorizedException();
        });

      await expect(
        service.validateUser(ctx, 'jhon', 'somepass'),
      ).rejects.toThrowError(UnauthorizedException);
    });

    it('should fail when user account is disabled', async () => {
      jest
        .spyOn(mockedUserService, 'validateLoginCredentials')
        .mockImplementation(() => ({ ...userOutput, isAccountDisabled: true }));

      await expect(
        service.validateUser(ctx, 'jhon', 'somepass'),
      ).rejects.toThrowError(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return auth token for valid user', async () => {
      jest.spyOn(service, 'getAuthToken').mockImplementation(() => authToken);

      const result = service.login(ctx);

      expect(service.getAuthToken).toBeCalledWith(ctx, accessTokenClaims);
      expect(result).toEqual(authToken);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      mockedUserService.createUser.mockReset();
      mockedUserService.createUser.mockImplementation(async () => userOutput);
    });

    it('creates a USER with the profile fields and records age confirmation', async () => {
      const result = await service.register(ctx, registerInput);

      expect(mockedUserService.createUser).toBeCalledWith(ctx, {
        name: registerInput.name,
        email: registerInput.email,
        password: registerInput.password,
        roles: [ROLE.USER],
        isAccountDisabled: false,
        timezone: 'Asia/Tokyo',
        locale: LOCALE.JA,
        weightUnit: WEIGHT_UNIT.KG,
        weightKg: null,
        ageConfirmedAt: expect.any(Date),
      });
      expect(result).toEqual(userOutput);
    });

    it('converts an optional signup weight to kg in the chosen unit', async () => {
      await service.register(ctx, {
        ...registerInput,
        weight: 160,
        weightUnit: WEIGHT_UNIT.LB,
      });

      expect(mockedUserService.createUser).toBeCalledWith(
        ctx,
        expect.objectContaining({
          weightKg: 72.57,
          weightUnit: WEIGHT_UNIT.LB,
        }),
      );
    });

    it('ignores fields signup does not allow, such as roles', async () => {
      const smuggled = {
        ...registerInput,
        roles: [ROLE.ADMIN],
        isAccountDisabled: true,
      } as unknown as RegisterInput;

      await service.register(ctx, smuggled);

      expect(mockedUserService.createUser).toBeCalledWith(
        ctx,
        expect.objectContaining({
          roles: [ROLE.USER],
          isAccountDisabled: false,
        }),
      );
    });
  });

  describe('refreshToken', () => {
    ctx.user = accessTokenClaims;

    it('should generate auth token', async () => {
      jest
        .spyOn(mockedUserService, 'findById')
        .mockImplementation(async () => userOutput);

      jest.spyOn(service, 'getAuthToken').mockImplementation(() => authToken);

      const result = await service.refreshToken(ctx);

      expect(service.getAuthToken).toBeCalledWith(ctx, userOutput);
      expect(result).toMatchObject(authToken);
    });

    it('should throw exception when user is not valid', async () => {
      jest
        .spyOn(mockedUserService, 'findById')
        .mockImplementation(async () => null);

      await expect(service.refreshToken(ctx)).rejects.toThrowError(
        'Invalid user id',
      );
    });

    it('should throw exception when the account is disabled', async () => {
      jest
        .spyOn(mockedUserService, 'findById')
        .mockImplementation(async () => ({
          ...userOutput,
          isAccountDisabled: true,
        }));
      jest.spyOn(service, 'getAuthToken').mockImplementation(() => authToken);

      await expect(service.refreshToken(ctx)).rejects.toThrowError(
        'This user account has been disabled',
      );
      expect(service.getAuthToken).not.toHaveBeenCalled();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });

  describe('getAuthToken', () => {
    const accessTokenExpiry = 100;
    const refreshTokenExpiry = 200;
    const user: UserAccessTokenClaims = {
      id: 5,
      email: 'tokenuser@example.com',
      roles: [ROLE.USER],
    };

    const subject = { sub: user.id };
    const payload = {
      email: user.email,
      sub: user.id,
      roles: [ROLE.USER],
    };

    beforeEach(() => {
      jest.spyOn(mockedConfigService, 'get').mockImplementation((key) => {
        let value = null;
        switch (key) {
          case 'jwt.accessTokenExpiresInSec':
            value = accessTokenExpiry;
            break;
          case 'jwt.refreshTokenExpiresInSec':
            value = refreshTokenExpiry;
            break;
        }
        return value;
      });

      jest
        .spyOn(mockedJwtService, 'sign')
        .mockImplementation(() => 'signed-response');
    });

    it('should generate access token with payload', () => {
      const result = service.getAuthToken(ctx, user);

      expect(mockedJwtService.sign).toBeCalledWith(
        { ...payload, ...subject },
        { expiresIn: accessTokenExpiry },
      );

      expect(result).toMatchObject({
        accessToken: 'signed-response',
      });
    });

    it('should generate refresh token with subject', () => {
      const result = service.getAuthToken(ctx, user);

      expect(mockedJwtService.sign).toBeCalledWith(subject, {
        expiresIn: refreshTokenExpiry,
      });

      expect(result).toMatchObject({
        refreshToken: 'signed-response',
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });
});
