import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
    isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
  }`

/** The sections of a group. Relative links: they work under whatever address the group is mounted at. */
export function GroupTabs({ showSettings = false }: { showSettings?: boolean }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('tabs.main')} className="-mb-px flex gap-6 overflow-x-auto border-b border-slate-200">
      <NavLink to="." end className={tabClass}>
        {t('tabs.dashboard')}
      </NavLink>
      <NavLink to="expenses" className={tabClass}>
        {t('tabs.expenses')}
      </NavLink>
      <NavLink to="balances" className={tabClass}>
        {t('tabs.balances')}
      </NavLink>
      <NavLink to="settlements" className={tabClass}>
        {t('tabs.settlements')}
      </NavLink>
      <NavLink to="members" className={tabClass}>
        {t('tabs.members')}
      </NavLink>
      <NavLink to="activity" className={tabClass}>
        {t('tabs.activity')}
      </NavLink>
      {showSettings && (
        <NavLink to="settings" className={tabClass}>
          {t('tabs.settings')}
        </NavLink>
      )}
    </nav>
  )
}
