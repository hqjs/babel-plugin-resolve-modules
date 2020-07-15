const getAliases = resolve => {
  const exact = {};
  const wildcards = [];
  for (const [key, val] of Object.entries(resolve)) {
    const [ name, wildcard ] = key.split('*');
    if (wildcard === '') wildcards.push([name, val]);
    else exact[name] = val;
  }
  return {exact, wildcards};
};

const resolveModulePath = (aliases, value) => {
  if (aliases.exact[value]) return aliases.exact[value];
  for (const [key, val] of aliases.wildcards) {
    if (value.startsWith(key)) return value.replace(key, val);
  }
  return value;
};

const notNameImport = modName => (/^\.{0,2}\//).test(modName) ||
  (/^https?:\/\//).test(modName) ||
  (/^@\//).test(modName);

const notRequire = (t, nodePath) => {
  const [requireArg, ...rest] = nodePath.node.arguments;
  return nodePath.node.callee.name !== 'require' ||
    rest.length !== 0 ||
    !t.isStringLiteral(requireArg) ||
    nodePath.scope.hasBinding('require');
};

const notImport = (t, nodePath) => {
  const [requireArg, ...rest] = nodePath.node.arguments;
  return nodePath.node.callee.type !== 'Import' ||
    rest.length !== 0 ||
    !t.isStringLiteral(requireArg) ||
    nodePath.scope.hasBinding('import');
};

module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(nodePath, state) {
        const resolve = (state.opts && state.opts.resolve);
        if (!resolve) return;
        const { node } = nodePath;
        if (notRequire(t, nodePath) && notImport(t, nodePath)) return;
        const [requireArg] = node.arguments;
        const { value: modName } = requireArg;
        if (notNameImport(modName)) return;
        const aliases = getAliases(resolve);
        requireArg.value = resolveModulePath(aliases, modName);
      },
      ExportNamedDeclaration(nodePath, state) {
        const resolve = (state.opts && state.opts.resolve);
        if (!resolve) return;
        const { source } = nodePath.node;
        if (source === null) return;
        const { value: modName } = source;
        if (notNameImport(modName)) return;
        const aliases = getAliases(resolve);
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
      ExportAllDeclaration(nodePath, state) {
        const resolve = (state.opts && state.opts.resolve);
        if (!resolve) return;
        const { source } = nodePath.node;
        if (source === null) return;
        const { value: modName } = source;
        if (notNameImport(modName)) return;
        const aliases = getAliases(resolve);
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
      ImportDeclaration(nodePath, state) {
        const resolve = (state.opts && state.opts.resolve);
        if (!resolve) return;
        const { value: modName } = nodePath.node.source;
        if (notNameImport(modName)) return;
        const aliases = getAliases(resolve);
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
    },
  };
};
