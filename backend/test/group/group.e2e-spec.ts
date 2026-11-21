import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { GROUP_LIMITS } from '../../src/group/constants/group.constant';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
  seedAdminUser,
} from '../test-utils';

describe('Groups and invites (e2e)', () => {
  let app: INestApplication;

  const register = async (name: string) => {
    const credentials = {
      email: `${name.toLowerCase()}@example.com`,
      password: 'password-123',
    };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name,
        timezone: 'Asia/Tokyo',
        locale: 'en',
        ageConfirmed: true,
        ...credentials,
      })
      .expect(HttpStatus.CREATED);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(HttpStatus.OK);
    return as(login.body.data.accessToken as string);
  };

  const as = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${token}`),
  });

  let ken: ReturnType<typeof as>;
  let ami: ReturnType<typeof as>;
  let outsider: ReturnType<typeof as>;
  let groupId: number;
  let token: string;

  beforeAll(async () => {
    await resetDBBeforeTest();
    await createDBEntities();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();

    ken = await register('Ken');
    ami = await register('Ami');
    outsider = await register('Outsider');
  });

  describe('creating a group', () => {
    it('makes the creator its owner, with an invite link', async () => {
      const res = await ken
        .post('/groups', { name: '  Morning Lifters  ' })
        .expect(HttpStatus.CREATED);

      expect(res.body.data).toEqual({
        id: expect.any(Number),
        name: 'Morning Lifters',
        role: 'owner',
        memberCount: 1,
        inviteEnabled: true,
        inviteToken: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      });
      groupId = res.body.data.id;
      token = res.body.data.inviteToken;
    });

    it.each([
      ['blank', '   '],
      ['too long', 'x'.repeat(GROUP_LIMITS.nameLength + 1)],
    ])('rejects a %s name', async (_label, name) => {
      await ken.post('/groups', { name }).expect(HttpStatus.BAD_REQUEST);
    });

    it("lists only the caller's groups", async () => {
      const mine = await ken.get('/groups').expect(HttpStatus.OK);
      expect(mine.body.data.map((g: { id: number }) => g.id)).toEqual([
        groupId,
      ]);

      const theirs = await ami.get('/groups').expect(HttpStatus.OK);
      expect(theirs.body.data).toEqual([]);
    });
  });

  describe('joining by invite link', () => {
    it('previews the group before joining', async () => {
      const res = await ami.get(`/invites/${token}`).expect(HttpStatus.OK);
      expect(res.body.data).toEqual({
        groupId,
        name: 'Morning Lifters',
        memberCount: 1,
        alreadyMember: false,
      });
    });

    it('joins as a member, and joining again changes nothing', async () => {
      const first = await ami
        .post(`/invites/${token}/join`)
        .expect(HttpStatus.OK);
      expect(first.body.data).toMatchObject({
        id: groupId,
        role: 'member',
        memberCount: 2,
        inviteToken: token,
      });

      const again = await ami
        .post(`/invites/${token}/join`)
        .expect(HttpStatus.OK);
      expect(again.body.data.memberCount).toBe(2);

      const preview = await ami.get(`/invites/${token}`).expect(HttpStatus.OK);
      expect(preview.body.data.alreadyMember).toBe(true);
    });

    it('answers 404 for unknown and malformed links', async () => {
      await ami
        .get('/invites/AAAAAAAAAAAAAAAAAAAAAA')
        .expect(HttpStatus.NOT_FOUND);
      await ami.get('/invites/not-a-token').expect(HttpStatus.NOT_FOUND);
      await ami
        .post('/invites/AAAAAAAAAAAAAAAAAAAAAA/join')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('members and non-members', () => {
    it('shows members names and roles, owner first, never emails', async () => {
      const res = await ami
        .get(`/groups/${groupId}/members`)
        .expect(HttpStatus.OK);
      expect(res.body.data).toEqual([
        {
          userId: expect.any(Number),
          name: 'Ken',
          role: 'owner',
          joinedAt: expect.any(String),
        },
        {
          userId: expect.any(Number),
          name: 'Ami',
          role: 'member',
          joinedAt: expect.any(String),
        },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });

    it('answers 404 to non-members, the same as for a group that does not exist', async () => {
      for (const url of [`/groups/${groupId}`, `/groups/${groupId}/members`]) {
        const res = await outsider.get(url).expect(HttpStatus.NOT_FOUND);
        expect(JSON.stringify(res.body)).not.toContain('Morning Lifters');
      }
      await outsider.get('/groups/999999').expect(HttpStatus.NOT_FOUND);
      await outsider
        .patch(`/groups/${groupId}`, { name: 'Mine now' })
        .expect(HttpStatus.NOT_FOUND);
      await outsider.delete(`/groups/${groupId}`).expect(HttpStatus.NOT_FOUND);
    });

    it('answers 403 when a member tries an owner-only action', async () => {
      await ami
        .patch(`/groups/${groupId}`, { name: 'Ami’s group' })
        .expect(HttpStatus.FORBIDDEN);
      await ami
        .post(`/groups/${groupId}/invite/reset`)
        .expect(HttpStatus.FORBIDDEN);
      await ami
        .put(`/groups/${groupId}/invite`, { enabled: false })
        .expect(HttpStatus.FORBIDDEN);
      await ami.delete(`/groups/${groupId}`).expect(HttpStatus.FORBIDDEN);
    });

    it('gives system admins no way in', async () => {
      const { authTokenForAdmin } = await seedAdminUser(app);
      const admin = as(authTokenForAdmin.accessToken);
      await admin.get(`/groups/${groupId}`).expect(HttpStatus.NOT_FOUND);
      await admin.get('/groups').expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('owner controls', () => {
    it('renames the group for everyone', async () => {
      await ken
        .patch(`/groups/${groupId}`, { name: 'Evening Lifters' })
        .expect(HttpStatus.OK);
      const seen = await ami.get(`/groups/${groupId}`).expect(HttpStatus.OK);
      expect(seen.body.data.name).toBe('Evening Lifters');
    });

    it('resetting the link kills the old one', async () => {
      const res = await ken
        .post(`/groups/${groupId}/invite/reset`)
        .expect(HttpStatus.OK);
      const fresh = res.body.data.inviteToken;
      expect(fresh).not.toBe(token);

      await outsider.get(`/invites/${token}`).expect(HttpStatus.NOT_FOUND);
      await outsider
        .post(`/invites/${token}/join`)
        .expect(HttpStatus.NOT_FOUND);
      await outsider.get(`/invites/${fresh}`).expect(HttpStatus.OK);
      token = fresh;
    });

    it('turning the link off hides it, and on again brings back the same link', async () => {
      const off = await ken
        .put(`/groups/${groupId}/invite`, { enabled: false })
        .expect(HttpStatus.OK);
      expect(off.body.data).toMatchObject({
        inviteEnabled: false,
        inviteToken: null,
      });

      const memberView = await ami
        .get(`/groups/${groupId}`)
        .expect(HttpStatus.OK);
      expect(memberView.body.data.inviteToken).toBeNull();

      const preview = await outsider
        .get(`/invites/${token}`)
        .expect(HttpStatus.NOT_FOUND);
      expect(JSON.stringify(preview.body)).not.toContain('Evening Lifters');
      await outsider
        .post(`/invites/${token}/join`)
        .expect(HttpStatus.NOT_FOUND);

      const on = await ken
        .put(`/groups/${groupId}/invite`, { enabled: true })
        .expect(HttpStatus.OK);
      expect(on.body.data.inviteToken).toBe(token);
      await outsider.get(`/invites/${token}`).expect(HttpStatus.OK);
    });
  });

  describe('caps', () => {
    it(`stops a group at ${GROUP_LIMITS.membersPerGroup} members`, async () => {
      const res = await ken
        .post('/groups', { name: 'Big group' })
        .expect(HttpStatus.CREATED);
      const bigToken = res.body.data.inviteToken;

      // The owner is the first member; fill the rest. One at a time:
      // supertest against an app that isn't listening resets connections
      // under parallel load.
      for (let i = 1; i < GROUP_LIMITS.membersPerGroup; i++) {
        const member = await register(`Filler${i}`);
        await member.post(`/invites/${bigToken}/join`).expect(HttpStatus.OK);
      }

      const full = await outsider
        .post(`/invites/${bigToken}/join`)
        .expect(HttpStatus.CONFLICT);
      expect(full.body.error.details.code).toBe('group_full');
    }, 60_000);

    it(`stops a user at ${GROUP_LIMITS.groupsPerUser} groups, created or joined`, async () => {
      const busy = await register('Busy');
      // Busy joins Ken's first group, then creates the rest up to the cap.
      await busy.post(`/invites/${token}/join`).expect(HttpStatus.OK);
      for (let i = 1; i < GROUP_LIMITS.groupsPerUser; i++) {
        await busy
          .post('/groups', { name: `Group ${i}` })
          .expect(HttpStatus.CREATED);
      }

      const created = await busy
        .post('/groups', { name: 'One too many' })
        .expect(HttpStatus.CONFLICT);
      expect(created.body.error.details.code).toBe('group_limit');

      const other = await ami
        .post('/groups', { name: "Ami's group" })
        .expect(HttpStatus.CREATED);
      const joined = await busy
        .post(`/invites/${other.body.data.inviteToken}/join`)
        .expect(HttpStatus.CONFLICT);
      expect(joined.body.error.details.code).toBe('group_limit');
    });
  });

  describe('deleting a group', () => {
    it('removes it for everyone', async () => {
      await ken.delete(`/groups/${groupId}`).expect(HttpStatus.NO_CONTENT);

      await ami.get(`/groups/${groupId}`).expect(HttpStatus.NOT_FOUND);
      const left = await ami.get('/groups').expect(HttpStatus.OK);
      expect(left.body.data.map((g: { id: number }) => g.id)).not.toContain(
        groupId,
      );
      await outsider.get(`/invites/${token}`).expect(HttpStatus.NOT_FOUND);
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
  });
});
