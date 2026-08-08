import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * ValidationPipe global com saida orientada a formulario:
 * devolve `fieldErrors` por campo alem da mensagem principal.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors = flattenErrors(errors);
      const first = Object.values(fieldErrors)[0]?.[0] ?? 'Dados invalidos';

      return new BadRequestException({ message: first, fieldErrors });
    },
  });
}

/**
 * Quando um campo falha em varias regras ao mesmo tempo, a primeira mensagem e
 * a que o usuario le. Um campo vazio nao deve dizer "nao pode ser negativo":
 * erros de presenca e de tipo vem antes dos de faixa/formato.
 */
const CONSTRAINT_PRIORITY = [
  'isDefined',
  'isNotEmpty',
  'isString',
  'isNumber',
  'isInt',
  'isBoolean',
  'isEmail',
  'isUuid',
  'isArray',
];

function sortConstraints(constraints: Record<string, string>): string[] {
  return Object.entries(constraints)
    .sort(([a], [b]) => {
      const rankA = CONSTRAINT_PRIORITY.indexOf(a);
      const rankB = CONSTRAINT_PRIORITY.indexOf(b);

      return (
        (rankA === -1 ? CONSTRAINT_PRIORITY.length : rankA) -
        (rankB === -1 ? CONSTRAINT_PRIORITY.length : rankB)
      );
    })
    .map(([, message]) => message);
}

function flattenErrors(errors: ValidationError[], prefix = ''): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((acc, error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;

    if (error.constraints) {
      acc[path] = sortConstraints(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(acc, flattenErrors(error.children, path));
    }

    return acc;
  }, {});
}
