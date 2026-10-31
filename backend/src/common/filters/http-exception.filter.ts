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
 * matching the FAIL responses in the API specification. Extra fields thrown
 * with the message (e.g. `status` and `retry_count` for a failed AI
 * screening) are sent along with it.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const {
        message,
        error: _error,
        statusCode: _statusCode,
        ...extra
      } = typeof body === 'string'
        ? { message: body }
        : (body as Record<string, unknown>);

      if (Array.isArray(message)) {
        res.status(status).json({ error: 'Some fields are invalid.', details: message });
      } else {
        res.status(status).json({ error: message ?? exception.message, ...extra });
      }
      return;
    }

    this.logger.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Something went wrong on the server.' });
  }
}
