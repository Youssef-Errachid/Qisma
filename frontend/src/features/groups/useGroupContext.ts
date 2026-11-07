import { useOutletContext } from 'react-router-dom'
import type { GroupResponse } from '@/types/api'

/** The group loaded by GroupLayout, for the screens rendered inside it. */
export function useGroupContext(): GroupResponse {
  return useOutletContext<GroupResponse>()
}
