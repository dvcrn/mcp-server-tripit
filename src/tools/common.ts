export function requireExactlyOneSelector(selectors: Array<boolean>, message: string): void {
  const count = selectors.filter(Boolean).length;
  if (count !== 1) {
    throw new Error(message);
  }
}
