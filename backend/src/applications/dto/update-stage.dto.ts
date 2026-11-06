import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { kanbanStageEnum, type KanbanStage } from '../../database/schema.js';

const STAGES = kanbanStageEnum.enumValues;

/** Body for PATCH /api/applications/:id/stage (API spec IV.B). */
export class UpdateStageDto {
  @ApiProperty({ enum: STAGES, example: 'Interview' })
  @IsIn(STAGES, { message: `Choose a stage: ${STAGES.join(', ')}.` })
  kanban_stage!: KanbanStage;
}
