import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'

/** One section of a page: its own loading and error state, so one failing report never blanks the others. */
export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  return <>{children(query.data)}</>
}
