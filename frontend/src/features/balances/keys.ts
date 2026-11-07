/** Key factories live apart from the hooks, so every feature can invalidate them without importing each other's code. */
export const balanceKeys = {
  group: (groupId: string) => ['balances', groupId] as const,
}
