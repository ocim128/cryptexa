import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "**/*.min.js",
            "dist/**",
            "public/**",
            ".vercel/**",
            "_archive/**",
            "coverage/**",
            "playwright-report/**",
            "test-results/**",
            "node_modules/**",
            "app.js",
            "app.js.map"
        ]
    },

    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            globals: { ...globals.browser, ...globals.node }
        }
    },
    {
        files: ["**/*.mjs", "tests/unit/**/*.js", "vitest.config.js", "src/**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: { ...globals.browser, ...globals.node }
        }
    },
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node }
        }
    },
    {
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
        }
    }
];
