# Dependency Constraints

Some dependencies are pinned or capped to avoid breaking the build. Do not upgrade these without checking compatibility.

## Vitest 3.x (api, web)

- **Constraint:** Keep `vitest` at `^3.2.x` in `packages/api` and `apps/web`.
- **Reason:** `@cloudflare/vitest-pool-workers` supports Vitest 2.0.x–3.2.x only. Vitest 4 is not yet supported.
- **When upgrading:** Check [@cloudflare/vitest-pool-workers](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers) for Vitest 4 support before bumping.

## Mobile: Tailwind 3 + react-native-css-interop (apps/mobile)

- **Constraint:** Keep `tailwindcss` at `^3.4.x` and `react-native-css-interop` at `^0.0.34` in `apps/mobile`.
- **Reason:** `react-native-css-interop@0.2.x` declares a peer dependency on `tailwindcss ~3`. Using Tailwind 4 here would cause install conflicts.
- **Known Issue:** `react-native-css-interop@0.0.34` type augmentations do not fully extend RN component types with `className`. This causes ~341 TS errors in the mobile workspace. These are cosmetic (runtime works fine). The CI pipeline excludes mobile from typecheck (`--filter=!mobile`).
- **When upgrading:** To use Tailwind 4 on mobile, migrate to [NativeWind v5](https://www.nativewind.dev/v5/guides/migrate-from-v4), which uses a different CSS pipeline and does not depend on `react-native-css-interop`.

## ESLint 10 (web)

- **Constraint:** Use flat config only. ESLint 10 removed legacy `.eslintrc` support.
- **Config:** `apps/web/eslint.config.js` (ignores in config; no `.eslintignore`).

## Stripe API Version

- **Pinned version:** `2026-01-28.clover` in all SDK initializations across `packages/api`.
- **Reason:** `stripe-node v12+` pins TypeScript types to the API version specified at initialization. Mismatched versions cause TS type errors.
- **Files:** `src/services/stripe.ts`, `src/routes/pos.ts`, `src/routes/webhooks.ts`.
- **When upgrading:** Also update webhook endpoints in Stripe Dashboard to match (`2026-01-28.clover`).

## Expo SDK 55 (apps/mobile)

- **Constraint:** Expo SDK 55 pins `react-native` at `0.83.2` and `jest` at `~29.7.0`.
- **Reason:** Each Expo SDK version locks companion versions of react-native, jest, and all `expo-*` modules. Upgrading RN or jest independently will cause peer dep conflicts.
- **When upgrading:** Use `npx expo install expo@^<next> && npx expo install --fix` to migrate all companion packages together. Check the [Expo SDK changelog](https://expo.dev/changelog) for breaking changes.

## npm Audit (dev-only vulnerabilities)

- **Status:** 6 vulnerabilities (4 moderate, 2 high) in dev/build tools.
- **Risk:** None of these packages are included in the Cloudflare Worker runtime bundle.
- **Fix:** All require `--force` (major breaking version upgrades). Do not auto-apply. Resolve manually when upgrading those packages in a dedicated upgrade branch.
