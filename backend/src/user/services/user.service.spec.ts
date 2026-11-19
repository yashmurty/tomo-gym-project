import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from './user.service';
import { UserAclService } from './user-acl.service';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;

  const mockedRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    getById: jest.fn(),
  };

  const mockedAclService = {
    forActor: () => ({ canDoAction: () => true }),
  };

  const user = {
    id: 6,
    email: 'jhon@example.com',
    name: 'Jhon doe',
    roles: [ROLE.USER],
  };

  const mockedLogger = { setContext: jest.fn(), log: jest.fn() };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: mockedRepository,
        },
        { provide: UserAclService, useValue: mockedAclService },
        { provide: AppLogger, useValue: mockedLogger },
      ],
    }).compile();

    service = moduleRef.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const ctx = new RequestContext();

  describe('createUser', () => {
    beforeEach(() => {
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(async () => 'hashed-password');

      jest
        .spyOn(mockedRepository, 'save')
        .mockImplementation(async (input) => ({ id: 6, ...input }));
    });

    it('should encrypt password before saving', async () => {
      const userInput = {
        name: user.name,
        password: 'plain-password',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
      };

      await service.createUser(ctx, userInput);
      expect(bcrypt.hash).toBeCalledWith(userInput.password, 10);
    });

    it('should save user with encrypted password', async () => {
      const userInput = {
        name: user.name,
        password: 'plain-password',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
      };

      await service.createUser(ctx, userInput);

      expect(mockedRepository.save).toBeCalledWith({
        name: user.name,
        password: 'hashed-password',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
      });
    });

    it('should return serialized user', async () => {
      jest.spyOn(mockedRepository, 'save').mockImplementation(async (input) => {
        input.id = 6;
        return input;
      });

      const userInput = {
        name: user.name,
        password: 'plain-password',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
      };

      const result = await service.createUser(ctx, userInput);

      expect(result).toEqual({
        id: user.id,
        name: userInput.name,
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
      });
      expect(result).not.toHaveProperty('password');
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });

  describe('findById', () => {
    beforeEach(() => {
      jest
        .spyOn(mockedRepository, 'findOne')
        .mockImplementation(async () => user);
    });

    it('should find user from DB using given id', async () => {
      await service.findById(ctx, user.id);
      expect(mockedRepository.findOne).toBeCalledWith({
        where: { id: user.id },
      });
    });

    it('should return serialized user', async () => {
      const result = await service.findById(ctx, user.id);

      expect(result).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [ROLE.USER],
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });

  describe('getSelfProfile', () => {
    it('returns the authenticated user without the password hash', async () => {
      const fullUser: User = {
        id: 42,
        name: 'Self User',
        password: 'hashed',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'self@example.com',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        articles: [],
      };
      mockedRepository.getById.mockResolvedValue(fullUser);

      const ctxWithUser = new RequestContext();
      ctxWithUser.user = {
        id: 42,
        email: 'self@example.com',
        roles: [ROLE.USER],
      };

      const result = await service.getSelfProfile(ctxWithUser);

      expect(mockedRepository.getById).toHaveBeenCalledWith(42);
      expect(result.email).toBe('self@example.com');
      // Hashed password must never make it into the output.
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('getUserById', () => {
    beforeEach(() => {
      jest
        .spyOn(mockedRepository, 'getById')
        .mockImplementation(async () => user);
    });

    it('should find user from DB using given id', async () => {
      await service.getUserById(ctx, user.id);
      expect(mockedRepository.getById).toBeCalledWith(user.id);
    });

    it('should return serialized user', async () => {
      const result = await service.getUserById(ctx, user.id);

      expect(result).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [ROLE.USER],
      });
    });

    it('throw not found exception if user is not found', async () => {
      mockedRepository.getById.mockRejectedValue(new NotFoundException());
      try {
        await service.getUserById(ctx, 100);
      } catch (error: any) {
        expect(error.constructor).toBe(NotFoundException);
      }
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });

  describe('validateLoginCredentials', () => {
    it('should fail when email is unknown', async () => {
      jest
        .spyOn(mockedRepository, 'findOne')
        .mockImplementation(async () => null);

      await expect(
        service.validateLoginCredentials(ctx, 'jhon@example.com', 'password'),
      ).rejects.toThrowError();
    });

    it('should fail when password is invalid', async () => {
      jest
        .spyOn(mockedRepository, 'findOne')
        .mockImplementation(async () => user);

      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(
        service.validateLoginCredentials(ctx, 'jhon@example.com', 'password'),
      ).rejects.toThrowError();
    });

    it('should return user when credentials are valid', async () => {
      jest
        .spyOn(mockedRepository, 'findOne')
        .mockImplementation(async () => user);

      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const result = await service.validateLoginCredentials(
        ctx,
        'jhon@example.com',
        'password',
      );

      expect(mockedRepository.findOne).toBeCalledWith({
        where: { email: 'jhon@example.com' },
      });
      expect(result).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [ROLE.USER],
      });
    });
  });

  describe('getUsers', () => {
    it('gets users as a list', async () => {
      const offset = 0;
      const limit = 0;
      mockedRepository.findAndCount.mockResolvedValue([[user], 1]);
      await service.getUsers(ctx, limit, offset);
      expect(mockedRepository.findAndCount).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    beforeEach(() => {
      jest
        .spyOn(mockedRepository, 'findOne')
        .mockImplementation(async () => user);
    });

    it('should find user from DB using given email', async () => {
      await service.findByEmail(ctx, user.email);
      expect(mockedRepository.findOne).toBeCalledWith({
        where: { email: user.email },
      });
    });

    it('should return serialized user', async () => {
      const result = await service.findByEmail(ctx, user.email);

      expect(result).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [ROLE.USER],
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });
  });

  describe('updateUser', () => {
    it('should call repository.save with correct input', async () => {
      const userId = 1;
      const input: UpdateUserInput = {
        name: 'Test',
        password: 'updated-password',
      };

      const currentDate = new Date();

      const foundUser: User = {
        id: userId,
        name: 'Default User',
        password: 'random-password',
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
        createdAt: currentDate,
        updatedAt: currentDate,
        articles: [],
      };

      mockedRepository.getById.mockResolvedValue(foundUser);

      const expected: User = {
        id: 1,
        name: input.name,
        password: input.password,
        roles: [ROLE.USER],
        isAccountDisabled: false,
        email: 'randomUser@random.com',
        createdAt: currentDate,
        updatedAt: currentDate,
        articles: [],
      };

      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(async () => 'updated-password');

      await service.updateUser(ctx, userId, input);
      expect(mockedRepository.save).toHaveBeenCalledWith(expected);
    });

    it('should throw not found exception if user not found', async () => {
      const userId = 1;
      const input: UpdateUserInput = {
        name: 'Test',
        password: 'updated-password',
      };

      mockedRepository.getById.mockRejectedValue(new NotFoundException());

      try {
        await service.updateUser(ctx, userId, input);
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundException);
      }
    });
  });
});
