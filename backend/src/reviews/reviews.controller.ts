import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { SetRatingDto } from './dto/set-rating.dto.js';
import {
  APPLICATION_NOT_FOUND,
  NOTE_NOT_FOUND,
  ReviewsService,
} from './reviews.service.js';

/** A non-numeric id can't match an application, so treat it as not found. */
const applicationId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException(APPLICATION_NOT_FOUND),
  });

/** A non-numeric note id can't match a note. */
const noteId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException(NOTE_NOT_FOUND),
  });

/**
 * Shared notes and star ratings on one application (WBS 4.5.2.2).
 * Staff can read; managers and assigned recruiters can write. The author is
 * always the signed-in user, never a field in the body.
 */
@ApiTags('Notes and ratings')
@ApiBearerAuth()
@Roles('manager', 'recruiter')
@Controller('applications/:id')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** GET /api/applications/:id/notes — newest first, with the author. */
  @Get('notes')
  listNotes(@Param('id', applicationId()) id: number) {
    return this.reviews.listNotes(id);
  }

  /** POST /api/applications/:id/notes */
  @Post('notes')
  async addNote(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
    @Body() { body }: CreateNoteDto,
  ) {
    const note = await this.reviews.addNote(user, id, body);
    return { message: 'Note added.', note };
  }

  /**
   * DELETE /api/applications/:id/notes/:noteId — your own note, or any
   * note if you are a manager.
   */
  @Delete('notes/:noteId')
  async deleteNote(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
    @Param('noteId', noteId()) note: number,
  ) {
    await this.reviews.deleteNote(user, id, note);
    return { message: 'Note deleted.' };
  }

  /** GET /api/applications/:id/rating — average, count, and your rating. */
  @Get('rating')
  getRating(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
  ) {
    return this.reviews.getRating(user, id);
  }

  /** PUT /api/applications/:id/rating — sets or changes your rating. */
  @Put('rating')
  async setRating(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
    @Body() { rating }: SetRatingDto,
  ) {
    const summary = await this.reviews.setRating(user, id, rating);
    return { message: 'Rating saved.', rating: summary };
  }

  /** DELETE /api/applications/:id/rating — removes your rating. */
  @Delete('rating')
  async removeRating(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
  ) {
    const summary = await this.reviews.removeRating(user, id);
    return { message: 'Rating removed.', rating: summary };
  }
}
