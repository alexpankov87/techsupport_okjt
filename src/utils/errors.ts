export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Доступ запрещен') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Ошибка валидации') {
    super(message, 400);
  }
}

export class TicketStatusError extends AppError {
  constructor(message = 'Недопустимый переход статуса') {
    super(message, 422);
  }
}