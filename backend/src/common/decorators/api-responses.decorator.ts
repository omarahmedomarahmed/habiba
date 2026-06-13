import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';

export function ApiStandardResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({ description: 'Missing or expired JWT token' }),
    ApiForbiddenResponse({ description: 'Insufficient role or organization mismatch' }),
    ApiBadRequestResponse({ description: 'Validation error in request body or params' }),
  );
}

export function ApiCrudResponses(entityName: string) {
  return applyDecorators(
    ApiResponse({ status: 200, description: `${entityName} retrieved successfully` }),
    ApiResponse({ status: 201, description: `${entityName} created successfully` }),
    ApiNotFoundResponse({ description: `${entityName} not found` }),
    ApiUnauthorizedResponse({ description: 'Missing or expired JWT token' }),
    ApiForbiddenResponse({ description: 'Insufficient role or organization mismatch' }),
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
