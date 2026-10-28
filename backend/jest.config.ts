import type { Config } from 'jest';
import * as dotenv from 'dotenv';

dotenv.config();

// configues Jest
// maps TS path aliases and redirects heavy optional packages (like Swagger)
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@localhost:');
}

const config: Config = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
    },
    transformIgnorePatterns: ['node_modules/(?!(@nestjs)/)'],
    moduleNameMapper: {
        '^@nestjs/swagger$': '<rootDir>/mock/swagger.mock.ts',
        '^@nestjs/mapped-types$': '<rootDir>/mock/mapped-types.mock.ts',
        'load-package\\.util(\\.js)?$': '<rootDir>/mock/load-package.util.mock.js',
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: ['src/**/*.(t|j)s'],
    coverageDirectory: './coverage',
};

export default config;
