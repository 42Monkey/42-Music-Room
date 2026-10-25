  const loadPackage = (name, _context, loaderFn) => (loaderFn ? loaderFn() : require(name));

  const tryLoadPackage = (name, _context, loaderFn) => {
  	try {
  		return loaderFn ? loaderFn() : require(name);
  	} catch {
  		return undefined;
  	}
  };

  module.exports = { loadPackage, tryLoadPackage };
