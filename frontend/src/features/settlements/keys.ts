export const settlementKeys = {
  group: (groupId: string) => ['settlements', groupId] as const,
  list: (groupId: string, query: Record<string, string | number>) => [...settlementKeys.group(groupId), 'list', query] as const,
  suggestions: (groupId: string) => [...settlementKeys.group(groupId), 'suggestions'] as const,
}
