import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, User, LogIn, LogOut, Menu, X, LayoutGrid } from 'lucide-react'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/api/errorMessage'

function userInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

function NavItem({ to, icon, label, end = false }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="q-nav-item"
      aria-current={undefined}
      style={({ isActive }) =>
        isActive
          ? { background: 'var(--brand-700)', color: '#ffffff', fontWeight: 600 }
          : undefined
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const signOut = useMutation({ mutationFn: logout })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 16px' }}>
      {/* Logo */}
      <Link
        to="/groups"
        onClick={onNavigate}
        style={{ textDecoration: 'none', paddingLeft: 12, paddingBottom: 28, display: 'block' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LayoutGrid size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#ffffff',
            }}
          >
            QISMA
          </span>
        </div>
      </Link>

      {/* Nav */}
      <nav aria-label={t('nav.main')} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }} onClick={onNavigate}>
        <NavItem
          to="/groups"
          end
          icon={<Users size={20} strokeWidth={2} aria-hidden="true" />}
          label={t('nav.groups')}
        />
        <NavItem
          to="/account"
          icon={<User size={20} strokeWidth={2} aria-hidden="true" />}
          label={t('nav.account')}
        />
        <NavItem
          to="/join"
          icon={<LogIn size={20} strokeWidth={2} aria-hidden="true" />}
          label={t('nav.join')}
        />
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Tagline */}
        <p className="q-sidebar-tagline">
          Split expenses.{' '}
          <span style={{ color: 'var(--sidebar-ink)' }}>Stay connected.</span>
        </p>

        {/* User + actions row */}
        {user?.fullName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {userInitials(user.fullName)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--sidebar-ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.fullName}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            aria-label={t('common.logout')}
            className="q-nav-item"
            style={{ gap: 6, fontSize: 13 }}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            {t('common.logout')}
          </button>
        </div>

        {signOut.isError && (
          <Alert variant="error">
            {t('common.logoutFailed')} {errorMessage(t, signOut.error)}
          </Alert>
        )}
      </div>
    </div>
  )
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar — fixed, hidden on mobile */}
      <aside
        aria-label={t('nav.main')}
        style={{
          position: 'fixed',
          insetBlock: 0,
          insetInlineStart: 0,
          width: 260,
          background: 'var(--brand-900)',
          color: 'var(--sidebar-ink)',
          zIndex: 30,
          overflowY: 'auto',
        }}
        className="hidden md:block shadow-sm "
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="flex items-center justify-between md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          insetInline: 0,
          zIndex: 40,
          background: 'var(--brand-900)',
          padding: '12px 16px',
        }}
      >
        <Link
          to="/groups"
          style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', color: '#ffffff', textDecoration: 'none' }}
        >
          QISMA
        </Link>
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{ color: 'var(--sidebar-ink)', background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, minHeight: 44 }}
        >
          <Menu size={22} strokeWidth={2} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
          className="md:hidden"
        >
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
          />
          <div
            style={{
              position: 'relative',
              width: 280,
              background: 'var(--brand-900)',
              color: 'var(--sidebar-ink)',
              zIndex: 1,
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'absolute', top: 12, right: 12, color: 'var(--sidebar-ink)', background: 'transparent', border: 0, cursor: 'pointer', padding: 8, minHeight: 44 }}
            >
              <X size={22} strokeWidth={2} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        className="md:ms-65"
      >
        {/* Mobile spacer */}
        <div className="block md:hidden" style={{ height: 56 }} />

        {/* Desktop top bar */}
        {user?.fullName && (
          <div className="q-topbar">
            <div className="q-topbar-user">
              <span className="q-topbar-name">{user.fullName}</span>
              <div className="q-topbar-avatar">{userInitials(user.fullName)}</div>
            </div>
          </div>
        )}

        <main style={{ flex: 1, background: 'var(--bg)', padding: '24px 16px', minHeight: '100vh' }} className="md:px-10 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
