import { z } from 'zod';

type NumericEnvOption = {
  defaultValue: number;
  min: number;
  max: number;
};

function parseNumberInput(value: unknown, defaultValue: number): unknown {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}

export function createOptionalIntWithDefault(
  option: NumericEnvOption,
): z.ZodOptional<z.ZodEffects<z.ZodNumber, number, unknown>> {
  return z
    .preprocess(
      value => parseNumberInput(value, option.defaultValue),
      z.number().int().min(option.min).max(option.max),
    )
    .optional();
}

export function createOptionalBooleanWithDefault(
  defaultValue: boolean,
): z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>> {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return defaultValue;
  }, z.boolean()).optional();
}

export function createOptionalPositiveNumberOrNull(): z.ZodOptional<
  z.ZodEffects<z.ZodNullable<z.ZodNumber>, number | null, unknown>
> {
  return z
    .preprocess((value) => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().positive().nullable())
    .optional();
}
