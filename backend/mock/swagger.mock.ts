// @nest/swagger is great for generating API documentation
// but cause issues and slow things down during Jest unit/integration test.
// this file is dummy mock, lets our controllers and DTO keep using Swagger decoration
// without actually loading the real Swagger library or breaking the test suite.

const dummyDecorator = () => () => {};

export const ApiTags = dummyDecorator;
export const ApiOperation = dummyDecorator;
export const ApiResponse = dummyDecorator;
export const ApiParam = dummyDecorator;
export const ApiQuery = dummyDecorator;
export const ApiBody = dummyDecorator;
export const ApiBearerAuth = dummyDecorator;
export const ApiProperty = dummyDecorator;
export const ApiPropertyOptional = dummyDecorator;
export const ApiUnauthorizedResponse = dummyDecorator;
export const ApiForbiddenResponse = dummyDecorator;
export const ApiBadRequestResponse = dummyDecorator;
export const ApiNotFoundResponse = dummyDecorator;
export const ApiConflictResponse = dummyDecorator;

export class SwaggerModule {
  static createDocument = () => ({});
  static setup = () => {};
}
