import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.{test,spec}.js'],
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['app.js', 'server.js'],
        },
        setupFiles: ['./tests/unit/setup.js'],
        testTimeout: 10000,
    },
})
