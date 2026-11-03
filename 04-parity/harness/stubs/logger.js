// Stub for @bksLogger (rendererLogger/mainLogger): electron-log is not available outside Electron.
const noop = () => {};
const scoped = { debug: noop, info: noop, warn: noop, error: (...a) => { globalThis.__bksErrors = (globalThis.__bksErrors||[]); globalThis.__bksErrors.push(a); }, log: noop, verbose: noop, silly: noop };
export default { scope: () => scoped, ...scoped };
