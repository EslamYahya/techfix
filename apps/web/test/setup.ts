/**
 * Node >= 26 installs a global `localStorage` accessor (backed by an on-disk file that is disabled
 * unless `--localstorage-file` is passed, which is why the runtime prints the "localStorage is not
 * available" warning). Inside Vitest's jsdom environment that accessor is installed on the very same
 * object as jsdom's own `window.localStorage`, so the jsdom storage — the one the app's token store
 * and the tests read and write — is shadowed and evaluates to `undefined`.
 *
 * Re-point the global at jsdom's storage. jsdom creates a fresh store per test environment, so this
 * is exactly the isolated storage the suite expects. Runs before every test file.
 */
const storage = (globalThis as { _localStorage?: Storage })._localStorage;
if (storage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}
