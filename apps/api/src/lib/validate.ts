import type { z } from 'zod';
import { jsonError } from './http.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** parse or throw ValidationError (rendered as HTTP 400 `{ error }` by the app's error handler) */
export function parseOr400<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  throw new ValidationError(r.error.issues[0]?.message ?? '参数无效');
}

export const validationResponse = (e: ValidationError): Response => jsonError(400, e.message);
