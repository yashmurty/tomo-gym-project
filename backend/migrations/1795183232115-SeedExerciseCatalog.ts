import { MigrationInterface, QueryRunner } from 'typeorm';

// The shared exercise catalog (userId NULL) with EN + JP names and common
// aliases. MET values: Compendium of Physical Activities (2011), approximate.
// Treadmill entries use the ACSM equations when a speed is given.

type Row = {
  name: string;
  nameJa: string;
  modality: 'strength' | 'bodyweight' | 'cardio';
  muscleGroup: string;
  met: number;
  calorieModel?: 'met' | 'treadmill';
  aliases?: string[];
};

const CATALOG: Row[] = [
  { name: 'Lat pulldown', nameJa: 'ラットプルダウン', modality: 'strength', muscleGroup: 'back', met: 3.5, aliases: ['lat pull down', 'lat pull', 'pulldown', 'ラットプル'] },
  { name: 'Seated row', nameJa: 'シーテッドロー', modality: 'strength', muscleGroup: 'back', met: 3.5, aliases: ['cable row', 'seated cable row', 'machine row', 'ロウイング'] },
  { name: 'Chest press', nameJa: 'チェストプレス', modality: 'strength', muscleGroup: 'chest', met: 3.5, aliases: ['machine chest press'] },
  { name: 'Pec fly', nameJa: 'ペックフライ', modality: 'strength', muscleGroup: 'chest', met: 3.5, aliases: ['pec fly machine', 'pec deck', 'chest pec fly', 'chest fly', 'butterfly', 'バタフライ', 'ペクトラルフライ'] },
  { name: 'Shoulder press', nameJa: 'ショルダープレス', modality: 'strength', muscleGroup: 'shoulders', met: 3.5, aliases: ['machine shoulder press'] },
  { name: 'Leg press', nameJa: 'レッグプレス', modality: 'strength', muscleGroup: 'legs', met: 3.5 },
  { name: 'Leg extension', nameJa: 'レッグエクステンション', modality: 'strength', muscleGroup: 'legs', met: 3.5 },
  { name: 'Seated leg curl', nameJa: 'シーテッドレッグカール', modality: 'strength', muscleGroup: 'legs', met: 3.5, aliases: ['leg curl', 'レッグカール'] },
  { name: 'Lying leg curl', nameJa: 'ライイングレッグカール', modality: 'strength', muscleGroup: 'legs', met: 3.5, aliases: ['prone leg curl'] },
  { name: 'Hip abduction', nameJa: 'アブダクション', modality: 'strength', muscleGroup: 'legs', met: 3.5, aliases: ['abductor', 'hip abductor', 'アウターサイ'] },
  { name: 'Hip adduction', nameJa: 'アダクション', modality: 'strength', muscleGroup: 'legs', met: 3.5, aliases: ['adductor', 'hip adductor', 'インナーサイ'] },
  { name: 'Bench press', nameJa: 'ベンチプレス', modality: 'strength', muscleGroup: 'chest', met: 5.0, aliases: ['barbell bench press', 'bench'] },
  { name: 'Incline bench press', nameJa: 'インクラインベンチプレス', modality: 'strength', muscleGroup: 'chest', met: 5.0, aliases: ['incline bench', 'incline press'] },
  { name: 'Squat', nameJa: 'スクワット', modality: 'strength', muscleGroup: 'legs', met: 5.0, aliases: ['back squat', 'barbell squat'] },
  { name: 'Deadlift', nameJa: 'デッドリフト', modality: 'strength', muscleGroup: 'back', met: 6.0 },
  { name: 'Romanian deadlift', nameJa: 'ルーマニアンデッドリフト', modality: 'strength', muscleGroup: 'legs', met: 5.0, aliases: ['rdl'] },
  { name: 'Barbell row', nameJa: 'ベントオーバーロウ', modality: 'strength', muscleGroup: 'back', met: 5.0, aliases: ['bent over row'] },
  { name: 'Overhead press', nameJa: 'オーバーヘッドプレス', modality: 'strength', muscleGroup: 'shoulders', met: 5.0, aliases: ['ohp', 'military press'] },
  { name: 'Biceps curl', nameJa: 'アームカール', modality: 'strength', muscleGroup: 'arms', met: 3.5, aliases: ['bicep curl', 'curl', 'dumbbell curl', 'バイセップカール'] },
  { name: 'Triceps pushdown', nameJa: 'トライセプスプッシュダウン', modality: 'strength', muscleGroup: 'arms', met: 3.5, aliases: ['tricep pushdown', 'pushdown'] },
  { name: 'Lateral raise', nameJa: 'サイドレイズ', modality: 'strength', muscleGroup: 'shoulders', met: 3.5, aliases: ['side raise', 'lateral raises'] },
  { name: 'Calf raise', nameJa: 'カーフレイズ', modality: 'strength', muscleGroup: 'legs', met: 3.5, aliases: ['calf raises'] },
  { name: 'Plank', nameJa: 'プランク', modality: 'bodyweight', muscleGroup: 'core', met: 3.8 },
  { name: 'Push-up', nameJa: '腕立て伏せ', modality: 'bodyweight', muscleGroup: 'chest', met: 3.8, aliases: ['pushups', 'press up', 'プッシュアップ'] },
  { name: 'Pull-up', nameJa: '懸垂', modality: 'bodyweight', muscleGroup: 'back', met: 3.8, aliases: ['pullups', 'chin up', 'チンニング'] },
  { name: 'Crunch', nameJa: 'クランチ', modality: 'bodyweight', muscleGroup: 'core', met: 2.8, aliases: ['crunches', 'sit up', 'abdominal crunch', '腹筋'] },
  { name: 'Back extension', nameJa: 'バックエクステンション', modality: 'bodyweight', muscleGroup: 'back', met: 3.5, aliases: ['hyperextension'] },
  { name: 'Treadmill walk', nameJa: 'ウォーキング', modality: 'cardio', muscleGroup: 'cardio', met: 3.5, calorieModel: 'treadmill', aliases: ['walk', 'walking', 'treadmill', 'トレッドミル'] },
  { name: 'Running', nameJa: 'ランニング', modality: 'cardio', muscleGroup: 'cardio', met: 8.3, calorieModel: 'treadmill', aliases: ['run', 'treadmill run', 'jog', 'jogging', 'ジョギング'] },
  { name: 'Stationary bike', nameJa: 'エアロバイク', modality: 'cardio', muscleGroup: 'cardio', met: 6.8, aliases: ['bike', 'exercise bike', 'cycling', 'spin bike', 'バイク'] },
  { name: 'Elliptical', nameJa: 'クロストレーナー', modality: 'cardio', muscleGroup: 'cardio', met: 5.0, aliases: ['cross trainer', 'elliptical trainer'] },
  { name: 'Rowing machine', nameJa: 'ローイングマシン', modality: 'cardio', muscleGroup: 'cardio', met: 7.0, aliases: ['rower', 'rowing', 'erg'] },
];

// Frozen copy of src/exercise/utils/normalize-exercise-name.ts as of this
// migration, so later changes to the app function can't change what this
// migration writes.
function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_・.,/'"()（）、。]+/g, '');
}

export class SeedExerciseCatalog1795183232115 implements MigrationInterface {
  name = 'SeedExerciseCatalog1795183232115';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const seen = new Map<string, string>();

    for (const row of CATALOG) {
      const [{ id }] = await queryRunner.query(
        `INSERT INTO exercises ("userId", "name", "nameJa", "modality", "muscleGroup", "defaultMet", "calorieModel")
         VALUES (NULL, $1, $2, $3, $4, $5, $6) RETURNING id`,
        [row.name, row.nameJa, row.modality, row.muscleGroup, row.met, row.calorieModel ?? 'met'],
      );

      for (const alias of [row.name, row.nameJa, ...(row.aliases ?? [])]) {
        const key = normalize(alias);
        const owner = seen.get(key);
        if (owner === row.name) continue; // same exercise, different spelling
        if (owner) {
          throw new Error(`Alias '${alias}' is claimed by both '${owner}' and '${row.name}'`);
        }
        seen.set(key, row.name);
        await queryRunner.query(
          `INSERT INTO exercise_aliases ("userId", "exerciseId", "alias", "normalizedAlias")
           VALUES (NULL, $1, $2, $3)`,
          [id, alias, key],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Aliases cascade with their exercises.
    await queryRunner.query(`DELETE FROM exercises WHERE "userId" IS NULL`);
  }
}
