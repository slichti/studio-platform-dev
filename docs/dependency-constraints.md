# Dependency Constraints

Some dependencies are pinned or capped to avoid breaking the build. Do not upgrade these without checking compatibility.

## Vitest 3.x (api, web)

- **Constraint:** Keep `vitest` at `^3.2.x` in `packages/api` and `apps/web`.
- **Reason:** `@cloudflare/vitest-pool-workers` supports Vitest 2.0.x–3.2.x only. Vitest 4 is not yet supported.
- **When upgrading:** Check [@cloudflare/vitest-pool-workers](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers) for Vitest 4 support before bumping.

## Mobile: Tailwind 3 + react-native-css-interop (apps/mobile)

- **Constraint:** Keep `tailwindcss` at `^3.4.x` and `react-native-css-interop` at `^0.0.34` in `apps/mobile`.
- **Reason:** `react-native-css-interop@0.2.x` declares a peer dependency on `tailwindcss ~3`. Using Tailwind 4 here would cause install conflicts.
- **When upgrading:** To use Tailwind 4 on mobile, migrate to [NativeWind v5](https://www.nativewind.dev/v5/guides/migrate-from-v4), which uses a different CSS pipeline and does not depend on `react-native-css-interop`.

## ESLint 10 (web)

- **Constraint:** Use flat config only. ESLint 10 removed legacy `.eslintrc` support.
- **Config:** `apps/web/eslint.config.js` (ignores in config; no `.eslintignore`).
