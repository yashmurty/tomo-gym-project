import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// Fixed-window request counters, in Postgres so a deploy or restart doesn't
// reset them and no extra infrastructure is needed (constitution rule 6).
// Rows older than two days are pruned opportunistically.
@Entity('rate_limit_counters')
@Index('IDX_rate_limit_counters_window', ['windowStart'])
export class RateLimitCounter {
  // e.g. 'chat:user:42:minute', 'login:ip:203.0.113.7:minute'
  @PrimaryColumn({ length: 200 })
  key: string;

  @PrimaryColumn({ type: 'timestamptz' })
  windowStart: Date;

  @Column({ type: 'int' })
  count: number;
}
