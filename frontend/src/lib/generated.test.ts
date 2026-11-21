import { authControllerLogin } from './generated/auth/auth';

test('Orval pipeline produces a callable client function', () => {
  expect(typeof authControllerLogin).toBe('function');
});
