import { Suspense, lazy, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GroupDetails } from '@/components/shared/GroupDetails'
import { Money } from '@/components/shared/Money'
import { QueryBoundary } from '@/components/shared/QueryBoundary'
import { ChartCard } from '@/components/ui/ChartCard'
import { SelectField } from '@/components/ui/SelectField'
import { EmptyState, LoadingState } from '@/components/ui/StateViews'
import { StatCard } from '@/components/ui/StatCard'
import { categoryChartData, contributionChartData, monthlyChartData, tooltipAmount } from '@/features/reports/chartData'
import { DEFAULT_PERIOD, PERIODS, type PeriodId, periodRange } from '@/features/reports/period'
import { useCategories, useContributions, useMonthly, useSummary } from '@/features/reports/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'

// the chart library is the heaviest part of the app: it is only downloaded when a dashboard is opened
const MonthlyChart = lazy(() => import('@/features/reports/charts/MonthlyChart'))
const CategoryChart = lazy(() => import('@/features/reports/charts/CategoryChart'))
const ContributionsChart = lazy(() => import('@/features/reports/charts/ContributionsChart'))

export function GroupDashboardPage() {
  const { t, i18n } = useTranslation()
  const group = useGroupContext()
  const language = i18n.resolvedLanguage ?? 'en'
  const [today] = useState(() => new Date())
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD)
  const range = periodRange(period, today)

  const summary = useSummary(group.id)
  const monthly = useMonthly(group.id, range)
  const categories = useCategories(group.id, range)
  const contributions = useContributions(group.id, range)
  const money = (minor: number) => tooltipAmount(minor, group.currency, language)

  return (
    <div className="space-y-8">
      <QueryBoundary query={summary}>
        {(s) => (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t('dashboard.stats.total')}>
              <Money minor={s.totalExpensesMinor} currency={s.currency} />
            </StatCard>
            <StatCard label={t('dashboard.stats.count')}>{s.expenseCount}</StatCard>
            <StatCard label={t('dashboard.stats.members')} hint={t('dashboard.stats.membersHint', { active: s.activeMemberCount })}>
              {s.memberCount}
            </StatCard>
            <StatCard label={t('dashboard.stats.debts')} hint={t('dashboard.stats.debtsHint')}>
              <Money minor={s.outstandingDebtsMinor} currency={s.currency} tone="debt" />
            </StatCard>
            <StatCard label={t('dashboard.stats.settled')} hint={t('dashboard.stats.settledHint')}>
              <Money minor={s.confirmedSettlementsMinor} currency={s.currency} tone="credit" />
            </StatCard>
            <StatCard label={t('dashboard.stats.pending')} hint={t('dashboard.stats.pendingHint', { count: s.pendingSettlementsCount })}>
              <Money minor={s.pendingSettlementsMinor} currency={s.currency} />
            </StatCard>
          </dl>
        )}
      </QueryBoundary>

      {summary.isSuccess && summary.data.expenseCount === 0 ? (
        <EmptyState title={t('dashboard.empty.title')}>{t('dashboard.empty.body')}</EmptyState>
      ) : (
        <>
          <div className="max-w-xs">
            <SelectField label={t('dashboard.period')} value={period} onChange={(event) => setPeriod(event.target.value as PeriodId)}>
              {PERIODS.map((id) => (
                <option key={id} value={id}>
                  {t(`dashboard.periods.${id}`)}
                </option>
              ))}
            </SelectField>
          </div>

          <QueryBoundary query={monthly}>
            {(report) => {
              const data = monthlyChartData(report.months, report.currency, language)
              return (
                <ChartCard
                  title={t('dashboard.charts.monthly')}
                  description={t('dashboard.charts.monthlyDesc')}
                  columns={[t('dashboard.tables.month'), t('dashboard.tables.amount'), t('dashboard.tables.expenses')]}
                  rows={data.map((d) => [d.label, money(d.minor), String(d.count)])}
                >
                  <Suspense fallback={<LoadingState />}>
                    <MonthlyChart data={data} currency={report.currency} language={language} />
                  </Suspense>
                </ChartCard>
              )
            }}
          </QueryBoundary>

          <div className="grid gap-6 lg:grid-cols-2">
            <QueryBoundary query={categories}>
              {(report) => {
                const data = categoryChartData(report.categories, report.currency, (c) => t(`categories.${c}`))
                return (
                  <ChartCard
                    title={t('dashboard.charts.categories')}
                    description={t('dashboard.charts.categoriesDesc')}
                    columns={[t('dashboard.tables.category'), t('dashboard.tables.amount'), t('dashboard.tables.share')]}
                    rows={data.map((d) => [d.label, money(d.minor), d.percent])}
                  >
                    {data.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-500">{t('dashboard.noData')}</p>
                    ) : (
                      <Suspense fallback={<LoadingState />}>
                        <CategoryChart data={data} currency={report.currency} language={language} />
                      </Suspense>
                    )}
                  </ChartCard>
                )
              }}
            </QueryBoundary>

            <QueryBoundary query={contributions}>
              {(report) => {
                const data = contributionChartData(report.members, report.currency)
                return (
                  <ChartCard
                    title={t('dashboard.charts.contributions')}
                    description={t('dashboard.charts.contributionsDesc')}
                    columns={[t('dashboard.tables.member'), t('dashboard.tables.paid'), t('dashboard.tables.theirShare')]}
                    rows={data.map((d) => [d.name, money(d.paidMinor), money(d.shareMinor)])}
                  >
                    <Suspense fallback={<LoadingState />}>
                      <ContributionsChart
                        data={data}
                        currency={report.currency}
                        language={language}
                        paidLabel={t('dashboard.tables.paid')}
                        shareLabel={t('dashboard.tables.theirShare')}
                      />
                    </Suspense>
                  </ChartCard>
                )
              }}
            </QueryBoundary>
          </div>
        </>
      )}

      <GroupDetails group={group} />
    </div>
  )
}
