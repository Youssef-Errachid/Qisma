import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GroupLayout } from '@/components/layout/GroupLayout'
import { CreateGroupPage } from '@/pages/CreateGroupPage'
import { BalancesPage } from '@/pages/BalancesPage'
import { ExpenseDetailPage } from '@/pages/ExpenseDetailPage'
import { ExpenseFormPage } from '@/pages/ExpenseFormPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { GroupDashboardPage } from '@/pages/GroupDashboardPage'
import { GroupSettingsPage } from '@/pages/GroupSettingsPage'
import { GroupsPage } from '@/pages/GroupsPage'
import { JoinGroupPage } from '@/pages/JoinGroupPage'
import { LoginPage } from '@/pages/LoginPage'
import { MembersPage } from '@/pages/MembersPage'
import { NewSettlementPage } from '@/pages/NewSettlementPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SettlementsPage } from '@/pages/SettlementsPage'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'

export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/groups" replace /> },
          { path: '/groups', element: <GroupsPage /> },
          { path: '/groups/new', element: <CreateGroupPage /> },
          { path: '/groups/:groupId', element: <GroupLayout />, children: [
              { index: true, element: <GroupDashboardPage /> },
              { path: 'expenses', element: <ExpensesPage /> },
              { path: 'expenses/new', element: <ExpenseFormPage /> },
              { path: 'expenses/:expenseId', element: <ExpenseDetailPage /> },
              { path: 'expenses/:expenseId/edit', element: <ExpenseFormPage /> },
              { path: 'balances', element: <BalancesPage /> },
              { path: 'settlements', element: <SettlementsPage /> },
              { path: 'settlements/new', element: <NewSettlementPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'settings', element: <GroupSettingsPage /> },
            ] },
          { path: '/join', element: <JoinGroupPage /> },
          { path: '/join/:secret', element: <JoinGroupPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
