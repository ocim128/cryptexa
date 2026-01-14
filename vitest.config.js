import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,js}', 'server.ts', 'app.ts'],
        },
        setupFiles: ['./tests/unit/setup.ts'],
        testTimeout: 10000,
    },
})
