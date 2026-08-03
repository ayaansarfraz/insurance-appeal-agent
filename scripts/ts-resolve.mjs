/**
 * Minimal ESM resolve hook so the verify scripts can import the app's .ts
 * modules directly under node's native type stripping.
 *
 * OWNER: Agent B. Next/TypeScript resolve extensionless relative imports
 * ("./fire-source"); node's ESM loader does not. This hook adds the .ts
 * extension back so no app source has to be written for the test runner.
 *
 * Register with: node --import ./scripts/ts-resolve.mjs <script>
 */

import { register } from 'node:module';

register(new URL('./ts-resolve-hooks.mjs', import.meta.url));
