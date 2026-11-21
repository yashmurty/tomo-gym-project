import '../src/shared/typeorm/pg-date-parser';

import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createConnection, getConnection } from 'typeorm';

import { ROLE } from '../src/auth/constants/role.constant';
import { LoginInput } from '../src/auth/dtos/auth-login-input.dto';
import { AuthTokenOutput } from '../src/auth/dtos/auth-token-output.dto';
import { LOCALE } from '../src/shared/constants/locale.constant';
import { RequestContext } from '../src/shared/request-context/request-context.dto';
import { CreateUserInput } from '../src/user/dtos/user-create-input.dto';
import { UserOutput } from '../src/user/dtos/user-output.dto';
import { UserService } from '../src/user/services/user.service';

// Every e2e request comes from 127.0.0.1 and suites register many users, so
// default the signup-gate limits high here. test/usage/limits.e2e-spec.ts
// sets low values explicitly to test the limits themselves.
for (const [name, value] of Object.entries({
  CHAT_RATE_PER_MINUTE: '1000',
  CHAT_RATE_PER_DAY: '100000',
  MCP_RATE_PER_MINUTE: '1000',
  MCP_RATE_PER_DAY: '100000',
  LOGIN_RATE_PER_MINUTE: '1000',
  SIGNUP_RATE_PER_HOUR: '1000',
  USER_DAILY_BUDGET_USD: '1000',
  USER_MONTHLY_BUDGET_USD: '1000',
  GLOBAL_DAILY_BUDGET_USD: '1000',
  SIGNUP_MODE: 'open',
})) {
  process.env[name] ??= value;
}

const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
// tomo's docker-compose publishes Postgres on 5433 so it can run alongside
// denwa-alert's (5432).
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '5433', 10);
const TEST_DB_CONNECTION_NAME = 'e2e_test_connection';
export const TEST_DB_NAME = 'e2e_test_db';

export const resetDBBeforeTest = async (): Promise<void> => {
  // This overwrites the DB_NAME used in the SharedModule's TypeORM init.
  // All the tests will run against the e2e db due to this overwrite.
  process.env.DB_NAME = TEST_DB_NAME;

  console.log(`Dropping ${TEST_DB_NAME} database and recreating it`);
  const connection = await createConnection({
    name: TEST_DB_CONNECTION_NAME,
    type: 'postgres',
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    username: 'root',
    password: 'example',
    database: 'postgres',
  });

  await connection.query(`drop database if exists ${TEST_DB_NAME}`);
  await connection.query(`create database ${TEST_DB_NAME}`);

  await connection.close();
};

export const createDBEntities = async (): Promise<void> => {
  console.log(`Running migrations in ${TEST_DB_NAME} database`);
  await createConnection({
    name: TEST_DB_CONNECTION_NAME,
    type: 'postgres',
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    username: 'root',
    password: 'example',
    database: TEST_DB_NAME,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    // Build the schema with the real migrations (not synchronize), so e2e
    // runs exercise them and get the seeded exercise catalog.
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: true,
    synchronize: false,
  });
};

export const seedAdminUser = async (
  app: INestApplication,
): Promise<{ adminUser: UserOutput; authTokenForAdmin: AuthTokenOutput }> => {
  const defaultAdmin: CreateUserInput = {
    name: 'Default Admin User',
    password: 'default-admin-password',
    roles: [ROLE.ADMIN],
    isAccountDisabled: false,
    email: 'default-admin@example.com',
    timezone: 'UTC',
    locale: LOCALE.EN,
  };

  const ctx = new RequestContext();

  // Creating Admin User
  const userService = app.get(UserService);
  const userOutput = await userService.createUser(ctx, defaultAdmin);

  const loginInput: LoginInput = {
    email: defaultAdmin.email,
    password: defaultAdmin.password,
  };

  // Logging in Admin User to get AuthToken
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send(loginInput)
    .expect(HttpStatus.OK);

  const authTokenForAdmin: AuthTokenOutput = loginResponse.body.data;

  const adminUser: UserOutput = JSON.parse(JSON.stringify(userOutput));

  return { adminUser, authTokenForAdmin };
};

export const closeDBAfterTest = async (): Promise<void> => {
  console.log(`Closing connection to ${TEST_DB_NAME} database`);
  const connection = await getConnection(TEST_DB_CONNECTION_NAME);

  await connection.close();
};
