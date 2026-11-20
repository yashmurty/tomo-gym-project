import { normalizeExerciseName } from './normalize-exercise-name';

describe('normalizeExerciseName', () => {
  it('folds spacing, hyphens and case onto one key', () => {
    for (const typed of [
      'Lat Pull-Down',
      'lat pulldown',
      'LAT PULL DOWN',
      ' lat_pull down ',
    ]) {
      expect(normalizeExerciseName(typed)).toBe('latpulldown');
    }
  });

  it('folds half-width katakana and Japanese separators', () => {
    expect(normalizeExerciseName('ﾗｯﾄﾌﾟﾙﾀﾞｳﾝ')).toBe('ラットプルダウン');
    expect(normalizeExerciseName('ラット・プルダウン')).toBe(
      'ラットプルダウン',
    );
  });

  it('folds full-width latin letters', () => {
    expect(normalizeExerciseName('ＲＤＬ')).toBe('rdl');
  });
});
