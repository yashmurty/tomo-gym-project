import { Injectable } from '@nestjs/common';

// The server's notion of "now". Services ask this instead of calling
// `new Date()` directly, so tests and the parsing eval can pin the date
// (e.g. "these three were actually Tuesday" on a known Thursday).
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
