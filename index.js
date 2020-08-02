const getAliases = resolve => {
  const exact = {};
  const wildcards = [];
  for (const [key, val] of Object.entries(resolve)) {
    if (key.endsWith('_')) {
      const name = key.slice(0, -1);
      wildcards.push([`${name}/`, `${val}/`]);
      exact[name] = val;
    } else if (key.endsWith('*')) {
      const name = key.slice(0, -1);
      wildcards.push([name, val]);
    } else {
      exact[key] = val;
    }
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

let aliases = null;

module.exports = function ({ types: t }) {
  return {
    visitor: {
      Program(nodePath, state) {
        const resolve = (state.opts && state.opts.resolve);
        if (!resolve) {
          aliases = null;
          return;
        }
        aliases = getAliases(resolve);
      },
      CallExpression(nodePath) {
        if (!aliases) return;
        const { node } = nodePath;
        if (notRequire(t, nodePath) && notImport(t, nodePath)) return;
        const [requireArg] = node.arguments;
        const { value: modName } = requireArg;
        if (notNameImport(modName)) return;
        requireArg.value = resolveModulePath(aliases, modName);
      },
      ExportNamedDeclaration(nodePath) {
        if (!aliases) return;
        const { source } = nodePath.node;
        if (source === null) return;
        const { value: modName } = source;
        if (notNameImport(modName)) return;
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
      ExportAllDeclaration(nodePath) {
        if (!aliases) return;
        const { source } = nodePath.node;
        if (source === null) return;
        const { value: modName } = source;
        if (notNameImport(modName)) return;
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
      ImportDeclaration(nodePath) {
        if (!aliases) return;
        const { value: modName } = nodePath.node.source;
        if (notNameImport(modName)) return;
        nodePath.node.source.value = resolveModulePath(aliases, modName);
      },
    },
  };
};
