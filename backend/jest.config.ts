import type { Config } from 'jest';

const config: Config = {
	testEnvironment: 'node',
	moduleFileExtensions: ['js', 'json', 'ts'],
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
	},
	transformIgnorePatterns: ['node_modules/(?!(@nestjs)/)'],
	moduleNameMapper: {
		'load-package\\.util(\\.js)?$': '<rootDir>/mock/load-package.util.mock.js',
	},
	collectCoverageFrom: ['src/**/*.(t|j)s'],
	coverageDirectory: './coverage',
};

export default config;
