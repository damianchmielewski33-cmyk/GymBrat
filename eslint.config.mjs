import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Osobny projekt Astro (landing/), ma własny package.json.
    "landing/**",
  ]),
  // Z85 - jawna lista wyjatkow. Reguly React Compiler (eslint-plugin-react-hooks v6) to wskazowki
  // optymalizacyjne, nie bledy poprawnosci; projekt nie uzywa React Compiler, a wzorzec
  // "setState w efekcie po montazu / zmianie propsow" jest tu swiadomy (hydracja z localStorage,
  // synchronizacja formularzy). Wlaczac po migracji na Compiler.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      // Nawigacja pelnym przeladowaniem (logowanie, aktualizacja PWA/APK) jest zamierzona.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  // Parametry/zmienne z prefiksem "_" sa celowo nieuzywane (sygnatury zgodne z interfejsem, mocki).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  // Skrypty Node (CommonJS): require() jest tu poprawny.
  {
    files: ["scripts/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
