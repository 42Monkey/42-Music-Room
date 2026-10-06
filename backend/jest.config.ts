import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import * as fs from 'fs';
import * as path from 'path';

const tsconfigRaw = fs.readFileSync(path.resolve(__dirname, './tsconfig.json'), 'utf8');
const tsconfig = JSON.parse(tsconfigRaw);
const compilerOptions = tsconfig?.compilerOptions ?? {};

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
};

export default config;
