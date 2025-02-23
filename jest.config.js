/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    verbose: true,
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1'
    },
    setupFilesAfterEnv: ['jest-expect-message'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    globals: {
        'ts-jest': {
            diagnostics: false
        }
    },
    roots: ["<rootDir>/src/", "<rootDir>/tests/unit/"],
    collectCoverageFrom: ["src/**"],
    coveragePathIgnorePatterns: [
        // node modules & build output
        "build/",
        "node_modules/",

        // GUI & Obsidian coupled code
        "src/core.ts",
        "src/file.ts",
        "src/gui/",
        "src/icons/",
        "src/main.ts",
        "src/next-note-review-handler.ts",
        "src/plugin-data.ts",
        "src/utils/renderers.ts",

        // debugging utils
        "src/utils/debug.ts",

        // don't include in results
        "src/declarations.d.ts",
        "src/lang/locale/",
    ],
    coverageDirectory: "coverage",
    collectCoverage: true,
    coverageProvider: "v8",
    coverageThreshold: {
        global: {
            // TODO: Bring coverage back up to 98%+
            // TODO: Figure out why coverage on the GitHub runner
            // is lower than the local coverage
            statements: 92,
            branches: 88,
        },
    },
};
