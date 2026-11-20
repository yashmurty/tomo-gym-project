import { ApiProperty } from '@nestjs/swagger';

import { MODALITY, MUSCLE_GROUP } from '../constants/exercise.constant';
import { Exercise } from '../entities/exercise.entity';

export class ExerciseOutput {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  nameJa: string | null;

  @ApiProperty({ enum: MODALITY })
  modality: MODALITY;

  @ApiProperty({ enum: MUSCLE_GROUP })
  muscleGroup: MUSCLE_GROUP;

  @ApiProperty({ description: "True for the user's own exercises." })
  isCustom: boolean;
}

// Explicit field mapping: no accidental exposure of entity fields.
export function toExerciseOutput(exercise: Exercise): ExerciseOutput {
  return {
    id: exercise.id,
    name: exercise.name,
    nameJa: exercise.nameJa,
    modality: exercise.modality,
    muscleGroup: exercise.muscleGroup,
    isCustom: exercise.userId !== null,
  };
}
