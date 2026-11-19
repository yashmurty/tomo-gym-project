import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileToUsers1795100211897 implements MigrationInterface {
    name = 'AddProfileToUsers1795100211897'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // timezone and locale are required, but rows that already exist (local
        // dev databases) need a value: backfill via a temporary default, then
        // drop it so new users must always send both.
        await queryRunner.query(`ALTER TABLE "users" ADD "timezone" character varying(64) NOT NULL DEFAULT 'UTC'`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "timezone" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ADD "locale" character varying(5) NOT NULL DEFAULT 'en'`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "locale" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ADD "weightKg" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "weightUnit" character varying(2) NOT NULL DEFAULT 'kg'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "ageConfirmedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ageConfirmedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "weightUnit"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "weightKg"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "timezone"`);
    }

}
