
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'

import { GroupDetails } from '@/components/shared/GroupDetails'
import { Money } from '@/components/shared/Money'
import { QueryBoundary } from '@/components/shared/QueryBoundary'
import { ChartCard } from '@/components/ui/ChartCard'
import { SelectField } from '@/components/ui/SelectField'
import { EmptyState, LoadingState } from '@/components/ui/StateViews'
import { StatCard } from '@/components/ui/StatCard'

import {
  categoryChartData,
  contributionChartData,
  monthlyChartData,
  tooltipAmount,
} from '@/features/reports/chartData'

import {
  DEFAULT_PERIOD,
  PERIODS,
  type PeriodId,
  periodRange,
} from '@/features/reports/period'

import {
  useCategories,
  useContributions,
  useMonthly,
  useSummary,
} from '@/features/reports/queries'

import { useGroupContext } from '@/features/groups/useGroupContext'

// Charts are loaded only when the dashboard is opened.
const MonthlyChart = lazy(
    () => import('@/features/reports/charts/MonthlyChart'),
)

const CategoryChart = lazy(
    () => import('@/features/reports/charts/CategoryChart'),
)

const ContributionsChart = lazy(
    () => import('@/features/reports/charts/ContributionsChart'),
)

export function GroupDashboardPage() {
  const { t, i18n } = useTranslation()
  const group = useGroupContext()

  const language = i18n.resolvedLanguage ?? 'en'

  const [today] = useState(() => new Date())
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD)

  const dashboardRef = useRef<HTMLDivElement>(null)

  const range = periodRange(period, today)

  const summary = useSummary(group.id)
  const monthly = useMonthly(group.id, range)
  const categories = useCategories(group.id, range)
  const contributions = useContributions(group.id, range)

  const money = (minor: number) =>
      tooltipAmount(minor, group.currency, language)

  // Animate the dashboard when it mounts and when the report period changes.
  useEffect(() => {
    const root = dashboardRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      gsap.from('.dashboard-header', {
        opacity: 0,
        y: 18,
        duration: 0.65,
        ease: 'power3.out',
      })

      gsap.from('.dashboard-stat', {
        opacity: 0,
        y: 22,
        duration: 0.55,
        stagger: 0.08,
        delay: 0.12,
        ease: 'power3.out',
        clearProps: 'all',
      })

      gsap.from('.dashboard-panel', {
        opacity: 0,
        y: 24,
        duration: 0.65,
        stagger: 0.12,
        delay: 0.25,
        ease: 'power3.out',
        clearProps: 'all',
      })
    }, root)

    return () => ctx.revert()
  }, [period])

  return (
      <div ref={dashboardRef} className="dashboard-page space-y-8 pb-10 pt-6">

        {/* Dashboard heading */}
        <header className="dashboard-header relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
          <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                {group.status === 'ACTIVE' ? 'Group overview' : 'Archived group'}
              </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {group.name}
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100/80 sm:text-base">
                Track shared expenses, understand spending, and keep everyone's
                contributions organized.
              </p>
            </div>

            <div className="flex w-fit items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-4 4" />
                </svg>
              </div>

              <div>
                <p className="text-xs text-emerald-100/70">
                  Reporting currency
                </p>
                <p className="font-semibold tracking-wide">
                  {group.currency}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Statistics */}
        <section aria-label="Group statistics">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Financial overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A snapshot of your group's finances.
              </p>
            </div>
          </div>

          <QueryBoundary query={summary}>
            {(s) => (
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

                  <div className="dashboard-stat">
                    <StatCard label={t('dashboard.stats.total')}>
                      <div className="text-slate-950">
                        <Money
                            minor={s.totalExpensesMinor}
                            currency={s.currency}
                        />
                      </div>
                    </StatCard>
                  </div>

                  <div className="dashboard-stat">
                    <StatCard label={t('dashboard.stats.count')}>
                  <span className="text-slate-950">
                    {s.expenseCount}
                  </span>
                    </StatCard>
                  </div>

                  <div className="dashboard-stat">
                    <StatCard
                        label={t('dashboard.stats.members')}
                        hint={t('dashboard.stats.membersHint', {
                          active: s.activeMemberCount,
                        })}
                    >
                  <span className="text-slate-950">
                    {s.memberCount}
                  </span>
                    </StatCard>
                  </div>

                  <div className="dashboard-stat">
                    <StatCard
                        label={t('dashboard.stats.debts')}
                        hint={t('dashboard.stats.debtsHint')}
                    >
                  <span className="font-semibold text-debt">
                    <Money
                        minor={s.outstandingDebtsMinor}
                        currency={s.currency}
                        tone="debt"
                    />
                  </span>
                    </StatCard>
                  </div>

                  <div className="dashboard-stat">
                    <StatCard
                        label={t('dashboard.stats.settled')}
                        hint={t('dashboard.stats.settledHint')}
                    >
                  <span className="font-semibold text-credit">
                    <Money
                        minor={s.confirmedSettlementsMinor}
                        currency={s.currency}
                        tone="credit"
                    />
                  </span>
                    </StatCard>
                  </div>

                  <div className="dashboard-stat">
                    <StatCard
                        label={t('dashboard.stats.pending')}
                        hint={t('dashboard.stats.pendingHint', {
                          count: s.pendingSettlementsCount,
                        })}
                    >
                  <span className="text-slate-950">
                    <Money
                        minor={s.pendingSettlementsMinor}
                        currency={s.currency}
                    />
                  </span>
                    </StatCard>
                  </div>

                </dl>
            )}
          </QueryBoundary>
        </section>

        {/* Reports */}
        {summary.isSuccess && summary.data.expenseCount === 0 ? (
            <div className="dashboard-panel rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <EmptyState
                  title={t('dashboard.empty.title')}
              >
                {t('dashboard.empty.body')}
              </EmptyState>
            </div>
        ) : (
            <>
              {/* Period filter */}
              <section className="dashboard-panel flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Spending analytics
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Explore how your group spends over time.
                  </p>
                </div>

                <div className="w-full sm:max-w-xs">
                  <SelectField
                      label={t('dashboard.period')}
                      value={period}
                      onChange={(event) =>
                          setPeriod(event.target.value as PeriodId)
                      }
                  >
                    {PERIODS.map((id) => (
                        <option key={id} value={id}>
                          {t(`dashboard.periods.${id}`)}
                        </option>
                    ))}
                  </SelectField>
                </div>
              </section>

              {/* Monthly spending */}
              <section className="dashboard-panel">
                <QueryBoundary query={monthly}>
                  {(report) => {
                    const data = monthlyChartData(
                        report.months,
                        report.currency,
                        language,
                    )

                    return (
                        <ChartCard
                            title={t('dashboard.charts.monthly')}
                            description={t('dashboard.charts.monthlyDesc')}
                            columns={[
                              t('dashboard.tables.month'),
                              t('dashboard.tables.amount'),
                              t('dashboard.tables.expenses'),
                            ]}
                            rows={data.map((d) => [
                              d.label,
                              money(d.minor),
                              String(d.count),
                            ])}
                        >
                          <Suspense fallback={<LoadingState />}>
                            <MonthlyChart
                                data={data}
                                currency={report.currency}
                                language={language}
                            />
                          </Suspense>
                        </ChartCard>
                    )
                  }}
                </QueryBoundary>
              </section>

              {/* Category and member analytics */}
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

                <div className="dashboard-panel min-w-0">
                  <QueryBoundary query={categories}>
                    {(report) => {
                      const data = categoryChartData(
                          report.categories,
                          report.currency,
                          (category) => t(`categories.${category}`),
                      )

                      return (
                          <ChartCard
                              title={t('dashboard.charts.categories')}
                              description={t('dashboard.charts.categoriesDesc')}
                              columns={[
                                t('dashboard.tables.category'),
                                t('dashboard.tables.amount'),
                                t('dashboard.tables.share'),
                              ]}
                              rows={data.map((d) => [
                                d.label,
                                money(d.minor),
                                d.percent,
                              ])}
                          >
                            {data.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-500">
                                  {t('dashboard.noData')}
                                </p>
                            ) : (
                                <Suspense fallback={<LoadingState />}>
                                  <CategoryChart
                                      data={data}
                                      currency={report.currency}
                                      language={language}
                                  />
                                </Suspense>
                            )}
                          </ChartCard>
                      )
                    }}
                  </QueryBoundary>
                </div>

                <div className="dashboard-panel min-w-0">
                  <QueryBoundary query={contributions}>
                    {(report) => {
                      const data = contributionChartData(
                          report.members,
                          report.currency,
                      )

                      return (
                          <ChartCard
                              title={t('dashboard.charts.contributions')}
                              description={t('dashboard.charts.contributionsDesc')}
                              columns={[
                                t('dashboard.tables.member'),
                                t('dashboard.tables.paid'),
                                t('dashboard.tables.theirShare'),
                              ]}
                              rows={data.map((d) => [
                                d.name,
                                money(d.paidMinor),
                                money(d.shareMinor),
                              ])}
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

              </section>
            </>
        )}

        {/* Group information */}
        <section className="dashboard-panel">
          <GroupDetails group={group} />
        </section>
      </div>
  )
}
