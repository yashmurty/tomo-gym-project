import { types } from 'pg';

// Postgres DATE (oid 1082) is a calendar day with no timezone. By default
// node-postgres parses it into a JS Date at *local* midnight, so raw queries
// (query(), getRawMany()) return a Date whose UTC form can be the previous
// day on a server east of UTC. TypeORM's entity hydration happens to return
// strings, but raw SQL (e.g. day-number window queries) doesn't.
//
// Return DATE values as the 'YYYY-MM-DD' string Postgres sends, everywhere.
// Imported for its side effect by shared.module.ts, ormconfig.ts and the e2e
// test utils, so it runs before any connection is made.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value: string) => value);
