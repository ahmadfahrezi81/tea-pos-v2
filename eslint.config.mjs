import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/.turbo/**",
            "**/schema.d.ts",
            "**/routeTree.gen.ts",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    // Hook rules plus the React Compiler's: code it cannot optimise is flagged.
    reactHooks.configs.flat.recommended,
);
