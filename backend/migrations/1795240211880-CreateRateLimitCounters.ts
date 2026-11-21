import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRateLimitCounters1795240211880 implements MigrationInterface {
    name = 'CreateRateLimitCounters1795240211880'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rate_limit_counters" ("key" character varying(200) NOT NULL, "windowStart" TIMESTAMP WITH TIME ZONE NOT NULL, "count" integer NOT NULL, CONSTRAINT "PK_6a704e51877b5cfd82b57c79af6" PRIMARY KEY ("key", "windowStart"))`);
        await queryRunner.query(`CREATE INDEX "IDX_rate_limit_counters_window" ON "rate_limit_counters" ("windowStart") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_rate_limit_counters_window"`);
        await queryRunner.query(`DROP TABLE "rate_limit_counters"`);
    }

}
