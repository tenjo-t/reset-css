/**
 * postcss plugin
 */
import valueParser from "npm:postcss-value-parser";

const rootReg = /^(html|:root)$/i;

function collectCustomProperties(root, opts, map) {
  const check = opts.ignore.map((item) => {
    if (typeof item === "string") return (prop) => prop === item;
    return (prop) => item.test(prop);
  });
  const ignore = (prop) => check.some((cb) => cb(prop));

  root.each((node) => {
    if (node.type !== "rule") return;
    if (!node.selectors.some((s) => rootReg.test(s))) return;
    if (node.nodes.length === 0) return;

    node.each((decl) => {
      if (decl.type !== "decl") return;
      if (!decl.prop.startsWith("--")) return;
      if (ignore(decl.prop)) return;

      const preserve = typeof opts.preserve === "function"
        ? opts.preserve(decl)
        : opts.preserve;

      if (!preserve) decl.remove();

      map.set(decl.prop, valueParser(decl.value));
    });

    if (!node.nodes || node.nodes.length === 0) {
      node.remove();
    }
  });
}

const varReg = /^var$/i;

function transformValue(root, customProperties) {
  let i = 0;
  const rootNodes = root.nodes;
  while (i < rootNodes.length) {
    const child = rootNodes[i];

    if (child.type !== "function") {
      ++i;
      continue;
    }
    if (!varReg.test(child.value)) {
      transformValue(child, customProperties);
      ++i;
      continue;
    }
    if (child.nodes.length === 0) {
      ++i;
      continue;
    }

    const [propertyNode, ...fallbacks] = child.nodes;
    const name = propertyNode.value;

    if (customProperties.has(name)) {
      const nodes = customProperties.get(name).nodes;
      root.nodes.splice(i, 1, ...nodes);
      i += nodes.length;
    } else if (fallbacks.length) {
      root.nodes.splice(i, 1, ...fallbacks.splice(1));
    } else {
      ++i;
    }
  }
}

const defaults = {
  preserve: false,
  ignore: [],
  variables: {},
  preserveAtRulesOrder: false,
};

const creater = (options = {}) => {
  const opts = Object.assign({}, defaults, options);
  const customProperties = new Map();

  Object.entries(opts.variables).forEach(([prop, value]) => {
    prop = prop.startsWith("--") ? prop : "--" + prop;
    customProperties.set(prop, valueParser(value));
  });

  return {
    postcssPlugin: "postcss-assignvars",
    Once(root) {
      collectCustomProperties(root, opts, customProperties);

      customProperties.forEach((value, key) => {
        transformValue(value, customProperties);
        customProperties.set(key, value);
      });

      root.walkDecls((decl) => {
        const value = valueParser(decl.value);
        transformValue(value, customProperties);

        decl.value = value.toString();
      });
    },
    // Declaration(decl) {
    //   const value = valueParser(decl.value);
    //   transformValue(value, customProperties);

    //   decl.value = value.toString();
    // },
  };
};

creater.postcss = true;

export default creater;
