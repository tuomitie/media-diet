function stableSortById<T extends { id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aKey = a.id ?? "";
    const bKey = b.id ?? "";
    return aKey.localeCompare(bKey);
  });
}

export function hasChanged<T>(oldData: T, newData: T): boolean {
  if (Array.isArray(oldData) && Array.isArray(newData)) {
    const oldSorted = stableSortById(oldData as { id?: string }[]);
    const newSorted = stableSortById(newData as { id?: string }[]);
    return JSON.stringify(oldSorted) !== JSON.stringify(newSorted);
  }
  return JSON.stringify(oldData) !== JSON.stringify(newData);
}
