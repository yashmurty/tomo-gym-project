import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentTables1795184180969 implements MigrationInterface {
    name = 'CreateAgentTables1795184180969'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "turnId" integer, "role" character varying(12) NOT NULL, "content" jsonb NOT NULL, "text" text, "idempotencyKey" character varying(64), "status" character varying(12), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_user_created" ON "chat_messages" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_turn" ON "chat_messages" ("turnId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_chat_messages_user_idempotency" ON "chat_messages" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "agent_actions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "groupKey" character varying(64) NOT NULL, "tool" character varying(50) NOT NULL, "entityType" character varying(20) NOT NULL, "entityId" integer NOT NULL, "before" jsonb, "after" jsonb, "undoneAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0cff9bcbdc6e9555059903a3f10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_agent_actions_user_group" ON "agent_actions" ("userId", "groupKey") `);
        await queryRunner.query(`CREATE TABLE "llm_usage" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "turnId" integer NOT NULL, "model" character varying(64) NOT NULL, "inputTokens" integer NOT NULL, "outputTokens" integer NOT NULL, "cacheReadTokens" integer NOT NULL DEFAULT '0', "cacheWriteTokens" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_896db5280e4018d7bc7acd24294" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_llm_usage_user_created" ON "llm_usage" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "personal_access_tokens" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "name" character varying(100) NOT NULL, "tokenHash" character(64) NOT NULL, "tokenPrefix" character varying(20) NOT NULL, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b6dc462fa11dbbb897eb8419735" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_personal_access_tokens_hash" ON "personal_access_tokens" ("tokenHash") `);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_43d968962b9e24e1e3517c0fbff" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entries" ADD CONSTRAINT "FK_c02b6ac87000fe7e7995e42f4d1" FOREIGN KEY ("sourceMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "FK_39d8e8e9f17b1d4d4ebe0d88356" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal_access_tokens" DROP CONSTRAINT "FK_39d8e8e9f17b1d4d4ebe0d88356"`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_c02b6ac87000fe7e7995e42f4d1"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_43d968962b9e24e1e3517c0fbff"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_personal_access_tokens_hash"`);
        await queryRunner.query(`DROP TABLE "personal_access_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_llm_usage_user_created"`);
        await queryRunner.query(`DROP TABLE "llm_usage"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_agent_actions_user_group"`);
        await queryRunner.query(`DROP TABLE "agent_actions"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_chat_messages_user_idempotency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_turn"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_user_created"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
    }

}
