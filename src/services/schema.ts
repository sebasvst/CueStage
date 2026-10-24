/**
 * A very small schema validation library.
 *
 * CueStage persists user-authored JSON, so every file it reads is validated
 * before it reaches the application state. This module provides the handful
 * of combinators needed for that, without pulling in an external dependency.
 */

export class SchemaError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'SchemaError';
    this.path = path;
  }
}

export interface Schema<T> {
  parse(value: unknown, path?: string): T;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

type ParseFn<T> = (value: unknown, path: string) => T;

function make<T>(parse: ParseFn<T>): Schema<T> {
  return {
    parse: (value: unknown, path = '$') => parse(value, path),
  };
}

interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export function string(options: StringOptions = {}): Schema<string> {
  return make((value, path) => {
    if (typeof value !== 'string') {
      throw new SchemaError(path, 'se esperaba una cadena de texto');
    }
    if (options.min !== undefined && value.length < options.min) {
      throw new SchemaError(path, `la cadena debe tener al menos ${options.min} caracteres`);
    }
    if (options.max !== undefined && value.length > options.max) {
      throw new SchemaError(path, `la cadena no puede superar ${options.max} caracteres`);
    }
    if (options.pattern && !options.pattern.test(value)) {
      throw new SchemaError(path, 'la cadena tiene un formato no válido');
    }
    return value;
  });
}

interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function number(options: NumberOptions = {}): Schema<number> {
  return make((value, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new SchemaError(path, 'se esperaba un número válido');
    }
    if (options.integer && !Number.isInteger(value)) {
      throw new SchemaError(path, 'se esperaba un número entero');
    }
    if (options.min !== undefined && value < options.min) {
      throw new SchemaError(path, `el número no puede ser menor que ${options.min}`);
    }
    if (options.max !== undefined && value > options.max) {
      throw new SchemaError(path, `el número no puede ser mayor que ${options.max}`);
    }
    return value;
  });
}

export function boolean(): Schema<boolean> {
  return make((value, path) => {
    if (typeof value !== 'boolean') {
      throw new SchemaError(path, 'se esperaba un valor booleano');
    }
    return value;
  });
}

export function enumValues<T extends string>(values: readonly T[]): Schema<T> {
  return make((value, path) => {
    if (typeof value !== 'string' || !values.includes(value as T)) {
      throw new SchemaError(path, `valor no válido (se esperaba uno de: ${values.join(', ')})`);
    }
    return value as T;
  });
}

export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return make((value, path) => {
    if (value === null) return null;
    return inner.parse(value, path);
  });
}

export function optional<T>(inner: Schema<T>): Schema<T | undefined> {
  return make((value, path) => {
    if (value === undefined) return undefined;
    return inner.parse(value, path);
  });
}

export function withDefault<T>(inner: Schema<T>, fallback: () => T): Schema<T> {
  return make((value, path) => {
    if (value === undefined || value === null) return fallback();
    return inner.parse(value, path);
  });
}

export function arrayOf<T>(inner: Schema<T>): Schema<T[]> {
  return make((value, path) => {
    if (!Array.isArray(value)) {
      throw new SchemaError(path, 'se esperaba una lista');
    }
    return value.map((item, index) => inner.parse(item, `${path}[${index}]`));
  });
}

export function object<S extends Record<string, Schema<unknown>>>(
  shape: S,
): Schema<{ [K in keyof S]: Infer<S[K]> }> {
  return make((value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new SchemaError(path, 'se esperaba un objeto');
    }
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const fieldSchema = shape[key];
      if (fieldSchema === undefined) continue;
      result[key] = fieldSchema.parse(source[key], `${path}.${key}`);
    }
    return result as { [K in keyof S]: Infer<S[K]> };
  });
}

export function safeParse<T>(
  schema: Schema<T>,
  value: unknown,
): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: schema.parse(value) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'valor no válido';
    return { ok: false, error: message };
  }
}
