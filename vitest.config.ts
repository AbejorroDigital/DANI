import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Simula un entorno DOM completo (window, document, navigator, etc.)
        environment: 'happy-dom',
        // Archivos de test
        include: ['tests/**/*.test.ts'],
        // Cobertura de código
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
        },
        // Reporter legible en consola
        reporter: 'verbose',
    },
});
