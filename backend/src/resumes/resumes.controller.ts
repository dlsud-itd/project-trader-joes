import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { verifyUploadToken } from '../common/upload-token/upload-token.js';
import { UploadResumeDto } from './dto/upload-resume.dto.js';
import { RESUME_MAX_BYTES, type UploadedResumeFile } from './resume-file.js';
import { ResumesService } from './resumes.service.js';

/** A non-numeric id can't match a resume, so treat it as not found. */
const resumeId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException('Resume not found.'),
  });

/**
 * Resumes (API spec V).
 * Applicants upload right after applying; only signed-in staff can download.
 */
@ApiTags('Resumes')
@Controller('resumes')
export class ResumesController {
  constructor(
    private readonly resumes: ResumesService,
    private readonly config: ConfigService,
  ) {}

  /** POST /api/resumes — API spec V.A (multipart/form-data) */
  @Public()
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['application_id', 'upload_token', 'file'],
      properties: {
        application_id: { type: 'integer', example: 101 },
        upload_token: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer keeps the file in memory; this cap stops big uploads early.
      limits: { fileSize: RESUME_MAX_BYTES, files: 1 },
    }),
  )
  async upload(
    @Body() { application_id, upload_token }: UploadResumeDto,
    @UploadedFile() file?: UploadedResumeFile,
  ) {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    if (!verifyUploadToken(application_id, upload_token, secret)) {
      throw new ForbiddenException('This upload link is not valid.');
    }
    const resume = await this.resumes.upload(application_id, file);
    return { message: 'Resume uploaded successfully.', resume };
  }

  /** GET /api/resumes/:id/file — downloads the original file. Staff only. */
  @ApiBearerAuth()
  @Get(':id/file')
  async download(@Param('id', resumeId()) id: number) {
    const file = await this.resumes.getFile(id);
    const fileName = encodeURIComponent(file.file_name);
    return new StreamableFile(file.data, {
      type: file.mime_type,
      disposition: `attachment; filename*=UTF-8''${fileName}`,
      length: file.data.length,
    });
  }
}
