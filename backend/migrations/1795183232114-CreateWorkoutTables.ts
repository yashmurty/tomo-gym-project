import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkoutTables1795183232114 implements MigrationInterface {
    name = 'CreateWorkoutTables1795183232114'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "exercises" ("id" SERIAL NOT NULL, "userId" integer, "name" character varying(100) NOT NULL, "nameJa" character varying(100), "modality" character varying(12) NOT NULL, "muscleGroup" character varying(12) NOT NULL, "defaultMet" numeric(4,2) NOT NULL, "calorieModel" character varying(12) NOT NULL DEFAULT 'met', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c4c46f5fa89a58ba7c2d894e3c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_exercises_user_name" ON "exercises" ("userId", "name") WHERE "userId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_exercises_global_name" ON "exercises" ("name") WHERE "userId" IS NULL`);
        await queryRunner.query(`CREATE TABLE "entry_sets" ("id" SERIAL NOT NULL, "entryId" integer NOT NULL, "setIndex" smallint NOT NULL, "reps" smallint NOT NULL, "weightKg" numeric(6,2), CONSTRAINT "UQ_entry_sets_entry_index" UNIQUE ("entryId", "setIndex"), CONSTRAINT "PK_d3a1cdc95949402d0748840ff06" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "entries" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "sessionId" integer NOT NULL, "exerciseId" integer NOT NULL, "durationMin" numeric(6,2), "distanceKm" numeric(6,2), "speedKmh" numeric(4,1), "inclinePct" numeric(4,1), "metValue" numeric(4,2), "estKcal" numeric(7,1), "rawInput" text, "source" character varying(8) NOT NULL, "sourceClient" character varying(100), "sourceMessageId" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_23d4e7e9b58d9939f113832915b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_entries_user_exercise" ON "entries" ("userId", "exerciseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_entries_session" ON "entries" ("sessionId") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "date" date NOT NULL, "note" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_sessions_user_date" UNIQUE ("userId", "date"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exercise_aliases" ("id" SERIAL NOT NULL, "userId" integer, "exerciseId" integer NOT NULL, "alias" character varying(100) NOT NULL, "normalizedAlias" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_32b1c5f66e3297ef12c07d6ae82" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_exercise_aliases_user" ON "exercise_aliases" ("userId", "normalizedAlias") WHERE "userId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_exercise_aliases_global" ON "exercise_aliases" ("normalizedAlias") WHERE "userId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "exercises" ADD CONSTRAINT "FK_6e37f37f422796d689a7b3952cf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entry_sets" ADD CONSTRAINT "FK_0e26c545f3732884fc179d55e14" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entries" ADD CONSTRAINT "FK_e186b0c87ddac0718d1f6783f98" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entries" ADD CONSTRAINT "FK_32834af350899b9e833954175c2" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entries" ADD CONSTRAINT "FK_d4b5164d67ead4074e3b77cc3b0" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exercise_aliases" ADD CONSTRAINT "FK_8e80bb59e0f418a77f9b135eb32" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exercise_aliases" ADD CONSTRAINT "FK_468ea3df09aa8d733b9e5306484" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exercise_aliases" DROP CONSTRAINT "FK_468ea3df09aa8d733b9e5306484"`);
        await queryRunner.query(`ALTER TABLE "exercise_aliases" DROP CONSTRAINT "FK_8e80bb59e0f418a77f9b135eb32"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_d4b5164d67ead4074e3b77cc3b0"`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_32834af350899b9e833954175c2"`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_e186b0c87ddac0718d1f6783f98"`);
        await queryRunner.query(`ALTER TABLE "entry_sets" DROP CONSTRAINT "FK_0e26c545f3732884fc179d55e14"`);
        await queryRunner.query(`ALTER TABLE "exercises" DROP CONSTRAINT "FK_6e37f37f422796d689a7b3952cf"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_exercise_aliases_global"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_exercise_aliases_user"`);
        await queryRunner.query(`DROP TABLE "exercise_aliases"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_entries_session"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_entries_user_exercise"`);
        await queryRunner.query(`DROP TABLE "entries"`);
        await queryRunner.query(`DROP TABLE "entry_sets"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_exercises_global_name"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_exercises_user_name"`);
        await queryRunner.query(`DROP TABLE "exercises"`);
    }

}
