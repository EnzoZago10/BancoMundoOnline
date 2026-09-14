// Colyseus pode entregar o State em etapas durante a hidratação inicial.
// Estes helpers mantêm a renderização pura e tolerante enquanto MapSchema/ArraySchema
// ainda não foram materializados no cliente.
export function schemaGet(collection, key) {
  return collection?.get?.(key);
}

export function schemaValues(collection) {
  if (!collection) return [];
  try {
    if (typeof collection.values === "function") return [...collection.values()];
    if (typeof collection[Symbol.iterator] === "function") return [...collection];
  } catch {
    // Hidratação parcial: o próximo state change renderizará novamente.
  }
  return [];
}

export function schemaEntries(collection) {
  if (!collection) return [];
  try {
    if (typeof collection.entries === "function") return [...collection.entries()];
  } catch {
    // Hidratação parcial: o próximo state change renderizará novamente.
  }
  return [];
}

export function schemaKeys(collection) {
  if (!collection) return [];
  try {
    if (typeof collection.keys === "function") return [...collection.keys()];
  } catch {
    // Hidratação parcial: o próximo state change renderizará novamente.
  }
  return [];
}
