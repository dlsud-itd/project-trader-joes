import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Formats every error as `{ "error": "...", "details"?: [...] }`,
 * matching the FAIL responses in the API specification.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: unknown }).message;

      if (Array.isArray(message)) {
        res.status(status).json({ error: 'Some fields are invalid.', details: message });
      } else {
        res.status(status).json({ error: message ?? exception.message });
      }
      return;
    }

    this.logger.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Something went wrong on the server.' });
  }
}
