import { ValueTransformer } from 'typeorm';

// Postgres `numeric` comes back from the pg driver as a string (to avoid
// float precision loss). Our numeric columns hold small values (body weight,
// kg lifted) where a JS number is exact enough, so convert on read.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};
