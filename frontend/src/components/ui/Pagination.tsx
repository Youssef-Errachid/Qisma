import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface PaginationProps {
  /** zero-based */
  page: number
  totalPages: number
  onPage: (page: number) => void
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) {
    return null
  }
  return (
    <nav aria-label={t('pagination.label')} className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        {t('pagination.previous')}
      </Button>
      <span className="text-sm text-slate-600">{t('pagination.page', { page: page + 1, pages: totalPages })}</span>
      <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
        {t('pagination.next')}
      </Button>
    </nav>
  )
}
