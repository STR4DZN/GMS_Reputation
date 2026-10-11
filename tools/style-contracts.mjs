import postcss from "postcss";

/** Remove only an earlier identical declaration under the exact same root selector.
 * Keep differing values (including compatibility fallbacks), importance, all nested
 * conditions, keyframes and rule order. Unknown at-rules are conservative barriers.
 */
export function removeRepeatedRootDeclarations(css) {
  const root = postcss.parse(css);
  const seen = new Map();
  let removed = 0;
  for (const rule of [...root.nodes].reverse()) {
    if (rule.type === "comment") continue;
    if (rule.type !== "rule") {
      if (!/^(media|supports|container|(?:-webkit-)?keyframes|font-face)$/.test(rule.name ?? "")) seen.clear();
      continue;
    }
    for (const declaration of [...rule.nodes].reverse()) {
      if (declaration.type !== "decl") continue;
      const key = JSON.stringify([rule.selector, declaration.prop, Boolean(declaration.important)]);
      if (seen.get(key) === declaration.value) { declaration.remove(); removed++; }
      else if (!seen.has(key)) seen.set(key, declaration.value);
    }
    if (!rule.nodes.length) rule.remove();
  }
  return { css: root.toString(), removed };
}

export function styleStructure(css) {
  const nodeShape = node => {
    if (node.type === "comment") return null;
    if (node.type === "decl") return ["decl", node.prop, node.value, Boolean(node.important)];
    return [node.type, node.selector ?? node.name ?? "", node.params ?? "", (node.nodes ?? []).map(nodeShape).filter(Boolean)];
  };
  return nodeShape(postcss.parse(css));
}
