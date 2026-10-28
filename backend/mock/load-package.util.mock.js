// NestJS uses internal loader utilities to check and import optional packages (WebSocket) at runtime
// During Jest tests, these dynamic imports can fail or cause error.
// Mock overrides it, fallback to standard Node requires, safe execution

const loadPackage = jest.fn((name, _context, loaderFn) => (loaderFn ? loaderFn() : require(name)));
const loadPackageCached = jest.fn((name, _context, loaderFn) => (loaderFn ? loaderFn() : require(name)));
const tryLoadPackage = jest.fn((name, _context, loaderFn) => {
  try {
    return loaderFn ? loaderFn() : require(name);
  } catch {
    return undefined;
  }
});

module.exports = {
  loadPackage,
  loadPackageCached,
  tryLoadPackage,
};
