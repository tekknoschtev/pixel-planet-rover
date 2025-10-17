import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['js/utils/**/*.js', 'js/core/**/*.js'],
            exclude: ['node_modules/', 'tests/'],
        },
    },
});
