import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    { ignores: ["**/*.min.js", "dist/**", "_archive/**"] },

    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            globals: { ...globals.browser, ...globals.node }
        }
    },
    {
        files: ["tests/unit/**/*.js", "vitest.config.js", "src/**/*.js"],
        languageOptions: {
            sourceType: "module"
        }
    },
    pluginJs.configs.recommended,
    {
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^next$" }]
        }
    }
];
