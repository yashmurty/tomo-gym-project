import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroups1795275399968 implements MigrationInterface {
    name = 'CreateGroups1795275399968'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "groups" ("id" SERIAL NOT NULL, "name" character varying(60) NOT NULL, "ownerUserId" integer NOT NULL, "inviteToken" character varying(32) NOT NULL, "inviteEnabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_groups_invite_token" ON "groups" ("inviteToken") `);
        await queryRunner.query(`CREATE TABLE "group_memberships" ("id" SERIAL NOT NULL, "groupId" integer NOT NULL, "userId" integer NOT NULL, "role" character varying(10) NOT NULL, "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a04ebe9f25ad41f45b2c0ca4b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_group_memberships_user" ON "group_memberships" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_group_memberships_one_owner" ON "group_memberships" ("groupId") WHERE "role" = 'owner'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_group_memberships_group_user" ON "group_memberships" ("groupId", "userId") `);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_57d8d3bcdb354e88c03d3d560e6" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_a434c0d46f4b97696924ecdd176" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_ae52b7a8e0e084d7945522ef762" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_ae52b7a8e0e084d7945522ef762"`);
        await queryRunner.query(`ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_a434c0d46f4b97696924ecdd176"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_57d8d3bcdb354e88c03d3d560e6"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_group_memberships_group_user"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_group_memberships_one_owner"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_group_memberships_user"`);
        await queryRunner.query(`DROP TABLE "group_memberships"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_groups_invite_token"`);
        await queryRunner.query(`DROP TABLE "groups"`);
    }

}
