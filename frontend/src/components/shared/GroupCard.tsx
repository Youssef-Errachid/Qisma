import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Calendar, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import type { GroupResponse } from '@/types/api'

type AccentTheme = {
  gradient: string
  rule: string
}

const ACCENT_THEMES: AccentTheme[] = [
  {
    gradient: 'linear-gradient(135deg, #104333 0%, #1f805b 100%)',
    rule: 'var(--accent-green)',
  },
  {
    gradient: 'linear-gradient(135deg, #c97a2a 0%, #fba846 100%)',
    rule: 'var(--accent-orange)',
  },
  {
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #b784df 100%)',
    rule: 'var(--accent-purple)',
  },
]

function accentTheme(id: string): AccentTheme {
  return ACCENT_THEMES[id.charCodeAt(0) % 3]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

export function GroupCard({ group }: { group: GroupResponse }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'
  const isArchived = group.status === 'ARCHIVED'
  const theme = accentTheme(group.id)

  return (
    <li>
      <Link
        to={`/groups/${encodeURIComponent(group.id)}`}
        className={`q-card q-card--link block${isArchived ? ' q-card--archived' : ''}`}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Colored accent rule at top */}
        {!isArchived && (
          <div
            style={{
              height: 4,
              background: theme.rule,
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            }}
          />
        )}

        {/* Card body */}
        <div style={{ padding: '20px 20px 16px' }}>
          {/* Media tile + info row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* Gradient media tile */}
            <div
              className="q-group-media"
              aria-hidden="true"
              style={{
                background: isArchived ? 'var(--surface-sunken)' : theme.gradient,
                color: isArchived ? 'var(--ink-muted)' : '#ffffff',
              }}
            >
              {initials(group.name)}
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}
                >
                  {group.name}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <Badge tone={group.myRole === 'OWNER' ? 'brand' : 'neutral'}>
                  {t(`groups.role.${group.myRole}`)}
                </Badge>
                {isArchived && <Badge tone="neutral">{t('groups.status.ARCHIVED')}</Badge>}
                {!isArchived && <Badge tone="active">{t('groups.status.ACTIVE')}</Badge>}
              </div>
            </div>
          </div>

          {/* Description */}
          {group.description && (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: 'var(--ink-muted)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.5',
              }}
            >
              {group.description}
            </p>
          )}

          {/* Meta row: currency + date */}
          <div className="q-group-meta" style={{ marginTop: 14 }}>
            <span className="q-group-chip">
              <Coins size={13} strokeWidth={2} aria-hidden="true" />
              {group.currency}
            </span>
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="q-group-chip">
              <Calendar size={13} strokeWidth={2} aria-hidden="true" />
              {formatDate(group.createdAt, locale)}
            </span>
          </div>
        </div>

        {/* Footer */}
        {!isArchived && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <span
              className="q-btn q-btn--primary"
              style={{ minHeight: 36, fontSize: 13, padding: '0 14px', borderRadius: 8 }}
            >
              {t('groups.view')}
              <ArrowRight size={15} className="q-arrow" aria-hidden="true" />
            </span>
          </div>
        )}
      </Link>
    </li>
  )
}
