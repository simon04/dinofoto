/** Run `fn` for all items, at most `concurrency` at a time. */
export async function pool<T>(
  items: Iterable<T>,
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const iterator = items[Symbol.iterator]();
  const worker = async () => {
    for (let next = iterator.next(); !next.done; next = iterator.next())
      await fn(next.value);
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
