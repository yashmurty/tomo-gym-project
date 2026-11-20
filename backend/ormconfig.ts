import './src/shared/typeorm/pg-date-parser';

import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

const typeOrmConfig = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  entities: [__dirname + '/src/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  migrationsRun: false,
  synchronize: false,
  // RDS requires TLS (rds.force_ssl=1 by default on modern Postgres).
  // Local docker Postgres doesn't, so gate on APP_ENV. `rejectUnauthorized:
  // false` skips RDS root-CA verification — connection is still encrypted,
  // just not authenticated end-to-end. MITM would require attacker on the
  // VPC path EC2↔RDS, which is closed off by SG rules. Tighten with the
  // Amazon RDS root cert bundle later if needed.
  ssl:
    process.env.APP_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default typeOrmConfig;
