/** Resolve hook: retry extensionless relative specifiers as .ts, then .tsx. */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try {
          return await next(specifier + ext, context);
        } catch {
          /* try the next extension */
        }
      }
    }
    throw err;
  }
}
