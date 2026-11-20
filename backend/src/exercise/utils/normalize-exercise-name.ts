// The key aliases are matched on. Folds the spellings people actually type
// for one exercise onto the same string:
//   "Lat Pull-Down", "lat pulldown", "LAT PULL DOWN" → "latpulldown"
//   full-width "ﾗｯﾄﾌﾟﾙﾀﾞｳﾝ" / "ラット・プルダウン" → "ラットプルダウン"
// NFKC folds full-width and half-width forms (common in Japanese input);
// separators and punctuation are dropped entirely.
//
// NOTE: the seed migration (SeedExerciseCatalog) carries a frozen copy of
// this function. If you change it, add a migration that re-normalises
// existing alias rows.
export function normalizeExerciseName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_・.,/'"()（）、。]+/g, '');
}
