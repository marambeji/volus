import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface DatabaseError {
  code?: string;
  detail?: string;
  message?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseMessage = (
          exceptionResponse as { message?: string | string[] }
        ).message;
        message = responseMessage || JSON.stringify(exceptionResponse);
      } else {
        message = exceptionResponse;
      }
    } else {
      this.logger.error(exception);
      const err = exception as DatabaseError;
      // Handle PostgreSQL unique constraint (23505) and foreign key constraint (23503)
      if (err.code === '23505' || err.code === '23503') {
        status = HttpStatus.CONFLICT;
        message =
          'Conflict: ' +
          (err.detail || err.message || 'database constraint violation');
      } else {
        message = err.message || 'Internal server error';
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message : [message],
    });
  }
}
