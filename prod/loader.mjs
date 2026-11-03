export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        try {
          return await nextResolve(`${specifier}.js`, context);
        } catch (jsErr) {
          if (jsErr.code === 'ERR_MODULE_NOT_FOUND') {
            return await nextResolve(`${specifier}/index.js`, context);
          }
          throw jsErr;
        }
      }
    }
    throw err;
  }
}