import { Type } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BaseApiResponse<T> {
  public data: T; // Swagger Decorator is added in the extended class below, since that will override this one.

  @ApiProperty({ type: Object })
  public meta: any;
}

type ApiPropertyType =
  | Type<unknown>
  | [new (...args: any[]) => any];

export function SwaggerBaseApiResponse<T extends ApiPropertyType>(
  type: T,
): typeof BaseApiResponse {
  class ExtendedBaseApiResponse<T> extends BaseApiResponse<T> {
    @ApiProperty({ type }) // Casting `type` to `any` to bypass type checking for now
    public declare data: T;
  }
  // Overwrite the returned class name so Swagger emits a unique, stable schema
  // name per inner type. Must be derived from the type's `.name` — interpolating
  // `${type}` stringifies the class body (including whitespace), producing
  // unreadable names and collisions in consumers that normalize identifiers
  // (e.g. Orval).
  const isAnArray = Array.isArray(type);
  const typeName = isAnArray ? type[0].name : type.name;
  const arraySuffix = isAnArray ? 'Array' : '';
  Object.defineProperty(ExtendedBaseApiResponse, 'name', {
    value: `SwaggerBaseApiResponseFor${typeName}${arraySuffix}`,
  });

  return ExtendedBaseApiResponse;
}

export class BaseApiErrorObject {
  @ApiProperty({ type: Number })
  public statusCode: number;

  @ApiProperty({ type: String })
  public message: string;

  @ApiPropertyOptional({ type: String })
  public localizedMessage: string;

  @ApiProperty({ type: String })
  public errorName: string;

  @ApiProperty({ type: Object })
  public details: unknown;

  @ApiProperty({ type: String })
  public path: string;

  @ApiProperty({ type: String })
  public requestId: string;

  @ApiProperty({ type: String })
  public timestamp: string;
}

export class BaseApiErrorResponse {
  @ApiProperty({ type: BaseApiErrorObject })
  public error: BaseApiErrorObject;
}
