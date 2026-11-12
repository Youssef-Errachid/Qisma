import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function GroupTabs({ showSettings = false }: { showSettings?: boolean }) {
  const { t } = useTranslation()
  return (
    <nav role="tablist" aria-label={t('tabs.main')} className="q-tabs">
      <NavLink to="." end role="tab" className="q-tab">
        {t('tabs.dashboard')}
      </NavLink>
      <NavLink to="expenses" role="tab" className="q-tab">
        {t('tabs.expenses')}
      </NavLink>
      <NavLink to="balances" role="tab" className="q-tab">
        {t('tabs.balances')}
      </NavLink>
      <NavLink to="settlements" role="tab" className="q-tab">
        {t('tabs.settlements')}
      </NavLink>
      <NavLink to="members" role="tab" className="q-tab">
        {t('tabs.members')}
      </NavLink>
      <NavLink to="activity" role="tab" className="q-tab">
        {t('tabs.activity')}
      </NavLink>
      {showSettings && (
        <NavLink to="settings" role="tab" className="q-tab">
          {t('tabs.settings')}
        </NavLink>
      )}
    </nav>
  )
}
