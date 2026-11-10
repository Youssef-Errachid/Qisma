
import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { gsap } from 'gsap'
import {
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    CreditCard,
    Sparkles,
    Users,
    Wallet,
} from 'lucide-react'

import { Money } from '@/components/shared/Money'
import { QueryBoundary } from '@/components/shared/QueryBoundary'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/useAuth'
import { useBalances } from '@/features/balances/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { positionOf, sortBalances } from '@/features/settlements/rules'
import { usePendingSettlements, useSuggestions } from '@/features/settlements/queries'
import type { BalancesResponse, MemberBalance } from '@/types/api'

function Avatar({ name, index }: { name: string; index: number }) {
    const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()

    return (
        <div className={`q-avatar q-avatar-${index % 5}`} aria-hidden="true">
            {initials || '?'}
        </div>
    )
}

function PositionCard({
                          me,
                          currency,
                      }: {
    me: MemberBalance
    currency: string
}) {
    const { t } = useTranslation()
    const position = positionOf(me)
    const waiting = me.pendingOutMinor !== 0 || me.pendingInMinor !== 0
    const after = positionOf({ netMinor: me.effectiveNetMinor })

    return (
        <article className={`q-hero q-hero-${position.kind} gsap-reveal`}>
            <div className="q-hero-noise" />
            <div className="q-hero-orb q-hero-orb-one" />
            <div className="q-hero-orb q-hero-orb-two" />

            <div className="q-hero-main">
                <div className="q-hero-label">
          <span className="q-hero-label-icon">
            <Wallet size={16} />
          </span>
                    YOUR FINANCIAL POSITION
                </div>

                <p className="q-hero-caption">
                    {position.kind === 'settled'
                        ? t('balances.settledUp')
                        : t(position.kind === 'receive'
                            ? 'balances.youShouldReceive'
                            : 'balances.youOwe')}
                </p>

                <h2 className="q-hero-amount">
                    {position.kind === 'settled' ? (
                        <span className="q-hero-settled">
              <CheckCircle2 size={30} />
                            {t('balances.settledUp')}
            </span>
                    ) : (
                        <Money minor={position.amountMinor} currency={currency} />
                    )}
                </h2>

                <div className="q-hero-bottom">
          <span className="q-hero-status">
            <span className="q-live-dot" />
              {position.kind === 'receive'
                  ? 'You are owed money'
                  : position.kind === 'owe'
                      ? 'Outstanding payment'
                      : 'All balances are clear'}
          </span>
                </div>

                {waiting && (
                    <div className="q-pending">
                        <Clock3 size={15} />
                        <span>
              {t('balances.afterPending')}:{' '}
                            {after.kind === 'settled'
                                ? t('balances.settledUp')
                                : (
                                    <>
                                        {t(after.kind === 'receive'
                                            ? 'balances.youShouldReceive'
                                            : 'balances.youOwe')}{' '}
                                        <Money minor={after.amountMinor} currency={currency} />
                                    </>
                                )}
            </span>
                    </div>
                )}
            </div>

            <div className="q-hero-art" aria-hidden="true">
                <div className="q-art-ring q-art-ring-one" />
                <div className="q-art-ring q-art-ring-two" />
                <div className="q-art-center">
                    <span>Q</span>
                    <div className="q-art-sparkle">
                        <Sparkles size={23} />
                    </div>
                </div>
                <div className="q-art-floating q-art-floating-one">
                    <ArrowUpRight size={20} />
                </div>
                <div className="q-art-floating q-art-floating-two">
                    <Wallet size={18} />
                </div>
            </div>
        </article>
    )
}

function MemberTable({
                         balances,
                         meId,
                     }: {
    balances: BalancesResponse
    meId: string | undefined
}) {
    const { t } = useTranslation()
    const members = sortBalances(balances.members)

    return (
        <section className="q-panel gsap-reveal">
            <div className="q-panel-heading">
                <div>
                    <div className="q-eyebrow">YOUR COMMUNITY</div>
                    <h2>Member balances</h2>
                    <p>See exactly how expenses are distributed.</p>
                </div>

                <div className="q-count">
                    <Users size={15} />
                    {members.length}
                </div>
            </div>

            <div className="q-table-wrap">
                <table className="q-table">
                    <caption className="sr-only">{t('balances.tableTitle')}</caption>
                    <thead>
                    <tr>
                        <th scope="col">{t('balances.member')}</th>
                        <th scope="col">{t('balances.paid')}</th>
                        <th scope="col">{t('balances.share')}</th>
                        <th scope="col">{t('balances.balance')}</th>
                    </tr>
                    </thead>

                    <tbody>
                    {members.map((member, index) => {
                        const name = member.fullName || member.username
                        const isMe = member.userId === meId

                        return (
                            <tr key={member.userId} className={isMe ? 'q-current-member' : ''}>
                                <th scope="row">
                                    <div className="q-member">
                                        <Avatar name={name} index={index} />

                                        <div className="q-member-details">
                                            <div className="q-member-name">
                                                {name}
                                                {isMe && (
                                                    <span className="q-you">
                              {t('settlements.you')}
                            </span>
                                                )}
                                                {member.membershipStatus === 'INACTIVE' && (
                                                    <Badge>{t('balances.left')}</Badge>
                                                )}
                                            </div>

                                            {(member.pendingOutMinor > 0 || member.pendingInMinor > 0) && (
                                                <div className="q-member-pending">
                                                    {member.pendingOutMinor > 0 && (
                                                        <span>
                                {t('balances.pendingOut')}:{' '}
                                                            <Money minor={member.pendingOutMinor} currency={balances.currency} />
                              </span>
                                                    )}
                                                    {member.pendingInMinor > 0 && (
                                                        <span>
                                {t('balances.pendingIn')}:{' '}
                                                            <Money minor={member.pendingInMinor} currency={balances.currency} />
                              </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>

                                <td data-label={t('balances.paid')}>
                                    <Money minor={member.paidMinor} currency={balances.currency} />
                                </td>

                                <td data-label={t('balances.share')}>
                                    <Money minor={member.shareMinor} currency={balances.currency} />
                                </td>

                                <td data-label={t('balances.balance')}>
                    <span className={`q-money ${
                        member.netMinor > 0
                            ? 'q-positive'
                            : member.netMinor < 0
                                ? 'q-negative'
                                : 'q-zero'
                    }`}>
                      <Money
                          minor={member.netMinor}
                          currency={balances.currency}
                          tone="balance"
                      />
                    </span>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>

            <div className="q-table-footer">
                <span><i className="q-dot q-dot-green" /> To receive</span>
                <span><i className="q-dot q-dot-red" /> To pay</span>
                <span><i className="q-dot q-dot-gray" /> Balanced</span>
            </div>
        </section>
    )
}

function SettlementSection({
                               groupId,
                               groupStatus,
                               userId,
                               transfers,
                               currency,
                               nameOf,
                           }: {
    groupId: string
    groupStatus: string
    userId: string | undefined
    transfers: Array<{
        fromUserId: string
        fromUsername: string
        toUserId: string
        toUsername: string
        amountMinor: number
    }>
    currency: string
    nameOf: (id: string, username: string) => string
}) {
    const { t } = useTranslation()
    const base = `/groups/${encodeURIComponent(groupId)}/settlements`

    return (
        <section className="q-settlement-section gsap-reveal">
            <div className="q-section-heading">
                <div>
                    <div className="q-eyebrow">THE NEXT STEP</div>
                    <h2>{t('balances.howToSettle')}</h2>
                    <p>Clear outstanding balances with simple payments.</p>
                </div>
                <div className="q-section-icon">
                    <CreditCard size={21} />
                </div>
            </div>

            {transfers.length === 0 ? (
                <div className="q-empty">
                    <div className="q-empty-icon">
                        <Check size={25} />
                    </div>
                    <h3>{t('balances.nothingToSettle')}</h3>
                    <p>Your group is all caught up. Enjoy the good balance!</p>
                </div>
            ) : (
                <div className="q-settlement-list">
                    {transfers.map((transfer) => {
                        const mine = transfer.fromUserId === userId
                        const forMe = transfer.toUserId === userId

                        return (
                            <article
                                key={`${transfer.fromUserId}-${transfer.toUserId}`}
                                className="q-settlement-card"
                            >
                                <div className="q-transfer-left">
                                    <div className="q-transfer-avatars">
                                        <div className={`q-transfer-avatar ${mine ? 'q-transfer-me' : ''}`}>
                                            {(mine
                                                    ? t('settlements.you')
                                                    : nameOf(transfer.fromUserId, transfer.fromUsername)
                                            ).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="q-transfer-direction">
                                            <ArrowRight size={15} />
                                        </div>
                                        <div className={`q-transfer-avatar ${forMe ? 'q-transfer-me' : ''}`}>
                                            {(forMe
                                                    ? t('settlements.you')
                                                    : nameOf(transfer.toUserId, transfer.toUsername)
                                            ).charAt(0).toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="q-transfer-details">
                                        <div className="q-transfer-names">
                                            <strong>
                                                {mine
                                                    ? t('settlements.you')
                                                    : nameOf(transfer.fromUserId, transfer.fromUsername)}
                                            </strong>
                                            <span> pays </span>
                                            <strong>
                                                {forMe
                                                    ? t('settlements.you')
                                                    : nameOf(transfer.toUserId, transfer.toUsername)}
                                            </strong>
                                        </div>
                                        <span className="q-transfer-subtitle">
                      {mine
                          ? 'Your payment is ready'
                          : forMe
                              ? 'Payment expected from this member'
                              : 'Suggested group settlement'}
                    </span>
                                    </div>
                                </div>

                                <div className="q-transfer-right">
                                    <div className="q-transfer-amount">
                                        <Money minor={transfer.amountMinor} currency={currency} />
                                    </div>

                                    {mine && groupStatus === 'ACTIVE' ? (
                                        <Link
                                            className="q-pay-link"
                                            to={`${base}/new?to=${encodeURIComponent(transfer.toUserId)}&amount=${transfer.amountMinor}`}
                                        >
                                            <Button className="q-pay-button">
                                                {t('balances.payNow')}
                                                <ArrowUpRight size={16} />
                                            </Button>
                                        </Link>
                                    ) : forMe ? (
                                        <span className="q-waiting">
                      <Clock3 size={13} />
                                            {t('balances.waitingForThem')}
                    </span>
                                    ) : null}
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

export function BalancesPage() {
    const root = useRef<HTMLElement>(null)

    const group = useGroupContext()
    const { user } = useAuth()

    const balances = useBalances(group.id)
    const suggestions = useSuggestions(group.id)
    const pending = usePendingSettlements(group.id)

    const waitingForMe =
        pending.data?.items.filter((s) => s.toUserId === user?.id).length ?? 0

    const fullNames = new Map(
        (balances.data?.members ?? []).map((m) => [
            m.userId,
            m.fullName || m.username,
        ]),
    )

    const nameOf = (id: string, username: string) =>
        fullNames.get(id) ?? username

    useLayoutEffect(() => {
        const element = root.current
        if (!element) return

        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia()

            mm.add('(prefers-reduced-motion: no-preference)', () => {
                const timeline = gsap.timeline({
                    defaults: {
                        ease: 'power3.out',
                    },
                })

                timeline
                    .fromTo(
                        '.gsap-reveal',
                        {
                            y: 28,
                            opacity: 0,
                        },
                        {
                            y: 0,
                            opacity: 1,
                            duration: 0.75,
                            stagger: 0.13,
                            clearProps: 'transform,opacity',
                        },
                    )
                    .fromTo(
                        '.q-hero-art',
                        {
                            scale: 0.7,
                            rotation: -15,
                            opacity: 0,
                        },
                        {
                            scale: 1,
                            rotation: 0,
                            opacity: 1,
                            duration: 1,
                            ease: 'back.out(1.5)',
                        },
                        '-=0.65',
                    )
                    .fromTo(
                        '.q-hero-orb',
                        {
                            scale: 0,
                        },
                        {
                            scale: 1,
                            duration: 1.1,
                            stagger: 0.12,
                            ease: 'elastic.out(1, 0.7)',
                        },
                        '-=0.7',
                    )

                gsap.to('.q-art-center', {
                    rotation: 8,
                    duration: 5,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                })

                gsap.to('.q-hero-orb-one', {
                    x: 12,
                    y: -10,
                    duration: 4,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                })

                gsap.to('.q-hero-orb-two', {
                    x: -10,
                    y: 12,
                    duration: 5,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                })

                gsap.fromTo(
                    '.q-table tbody tr',
                    { opacity: 0, x: -12 },
                    {
                        opacity: 1,
                        x: 0,
                        duration: 0.4,
                        stagger: 0.07,
                        delay: 0.45,
                        ease: 'power2.out',
                        clearProps: 'all',
                    },
                )

                gsap.fromTo(
                    '.q-settlement-card',
                    { opacity: 0, y: 16 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.5,
                        stagger: 0.12,
                        delay: 0.25,
                        ease: 'power2.out',
                        clearProps: 'all',
                    },
                )

                return () => {
                    timeline.kill()
                    gsap.killTweensOf([
                        '.q-art-center',
                        '.q-hero-orb-one',
                        '.q-hero-orb-two',
                        '.q-table tbody tr',
                        '.q-settlement-card',
                    ])
                }
            })

            return () => mm.revert()
        }, element)

        return () => ctx.revert()
    }, [balances.isSuccess, suggestions.isSuccess])

    return (
        <>
            <style>{`
        .q-balances {
          --q-forest: #103d32;
          --q-forest-dark: #0a2d25;
          --q-green: #13a477;
          --q-lime: #b9ed85;
          --q-muted: #82918b;
          --q-line: #e9eeea;
          --q-paper: #ffffff;
          color: #19372d;
          padding: 24px 0 55px;
        }

        .q-balances * { box-sizing: border-box; }

        .q-balances h2,
        .q-balances h3,
        .q-balances p { overflow-wrap: anywhere; }

        .q-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 285px;
          padding: 38px 42px;
          border-radius: 25px;
          color: white;
          background:
            radial-gradient(ellipse at 80% 15%, rgba(42,133,97,.4), transparent 42%),
            linear-gradient(118deg, #0b3028, #164d3c 62%, #0c3a30);
          box-shadow: 0 18px 55px rgba(16,61,50,.13);
        }

        .q-hero-owe {
          background:
            radial-gradient(ellipse at 80% 15%, rgba(173,102,112,.28), transparent 42%),
            linear-gradient(118deg, #173a35, #27443e 62%, #19352f);
        }

        .q-hero-settled {
          background:
            radial-gradient(ellipse at 80% 15%, rgba(80,149,123,.3), transparent 42%),
            linear-gradient(118deg, #102f32, #174d47 62%, #103b35);
        }

        .q-hero-noise {
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: .12;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");
        }

        .q-hero-main { position: relative; z-index: 2; max-width: 520px; }

        .q-hero-label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #b2d5c6;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 2px;
        }

        .q-hero-label-icon {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 10px;
          background: rgba(255,255,255,.08);
          color: #d0f1dc;
        }

        .q-hero-caption {
          margin: 27px 0 5px;
          color: #c2d8ce;
          font-size: 14px;
          font-weight: 450;
        }

        .q-hero-amount {
          margin: 0;
          color: #fff;
          font-size: clamp(34px, 5vw, 49px);
          font-weight: 750;
          letter-spacing: -2px;
          line-height: 1.2;
        }

        .q-hero-settled {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .q-hero-bottom { margin-top: 21px; }

        .q-hero-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 30px;
          background: rgba(255,255,255,.07);
          color: #d8e9e0;
          font-size: 11px;
        }

        .q-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #b9ed85;
          box-shadow: 0 0 0 4px rgba(185,237,133,.12);
        }

        .q-pending {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
          color: #d3e2da;
          font-size: 12px;
        }

        .q-hero-art {
          position: relative;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          width: 235px;
          height: 235px;
          margin-right: 35px;
        }

        .q-art-ring {
          position: absolute;
          border: 1px solid rgba(190,237,205,.13);
          border-radius: 50%;
        }

        .q-art-ring-one { inset: 15px; }
        .q-art-ring-two { inset: -12px; border-style: dashed; }

        .q-art-center {
          position: relative;
          display: grid;
          place-items: center;
          width: 132px;
          height: 132px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 42px;
          background: linear-gradient(145deg, rgba(255,255,255,.19), rgba(255,255,255,.035));
          box-shadow: 0 20px 60px rgba(0,0,0,.15), inset 0 1px rgba(255,255,255,.2);
          backdrop-filter: blur(12px);
        }

        .q-art-center > span {
          color: #d4f3dc;
          font-size: 83px;
          font-weight: 850;
          letter-spacing: -10px;
          line-height: 1;
          transform: translateX(-5px);
        }

        .q-art-sparkle {
          position: absolute;
          top: 8px;
          right: 7px;
          color: #c8ef9c;
        }

        .q-art-floating {
          position: absolute;
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 14px;
          background: rgba(255,255,255,.12);
          color: #d9f0df;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 25px rgba(0,0,0,.12);
        }

        .q-art-floating-one { top: 22px; right: 15px; }
        .q-art-floating-two { bottom: 24px; left: 12px; }

        .q-hero-orb {
          position: absolute;
          z-index: -1;
          border-radius: 50%;
          pointer-events: none;
        }

        .q-hero-orb-one {
          top: -90px;
          left: 48%;
          width: 220px;
          height: 220px;
          background: rgba(109,196,146,.09);
          filter: blur(2px);
        }

        .q-hero-orb-two {
          bottom: -110px;
          left: 38%;
          width: 240px;
          height: 240px;
          background: rgba(185,237,133,.07);
          filter: blur(5px);
        }

        .q-panel {
          overflow: hidden;
          border: 1px solid var(--q-line);
          border-radius: 21px;
          background: white;
          box-shadow: 0 5px 25px rgba(20,60,45,.035);
        }

        .q-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 25px;
        }

        .q-eyebrow {
          margin-bottom: 8px;
          color: #9aa9a1;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .q-panel-heading h2,
        .q-section-heading h2 {
          margin: 0;
          color: #19372d;
          font-size: 19px;
          font-weight: 750;
          letter-spacing: -.55px;
        }

        .q-panel-heading p,
        .q-section-heading p {
          margin: 6px 0 0;
          color: #899890;
          font-size: 12px;
        }

        .q-count {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border: 1px solid #e4eee8;
          border-radius: 12px;
          background: #f6faf7;
          color: #198a64;
          font-size: 13px;
          font-weight: 750;
        }

        .q-table-wrap { width: 100%; overflow-x: auto; }

        .q-table {
          width: 100%;
          border-collapse: collapse;
          text-align: start;
          font-size: 13px;
        }

        .q-table thead { background: #f8faf8; }

        .q-table thead th {
          padding: 14px 22px;
          color: #8a9991;
          text-align: end;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 1px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .q-table thead th:first-child { text-align: start; }

        .q-table tbody tr {
          border-top: 1px solid #f0f3f0;
          transition: background .2s ease;
        }

        .q-table tbody tr:hover { background: #f7fbf8; }
        .q-table tbody tr.q-current-member { background: #f5faf6; }

        .q-table tbody th {
          padding: 15px 22px;
          text-align: start;
          font-weight: 500;
        }

        .q-table tbody td {
          padding: 15px 22px;
          text-align: end;
          color: #687a71;
          white-space: nowrap;
          font-size: 12px;
        }

        .q-member {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 190px;
        }

        .q-avatar {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 39px;
          height: 39px;
          border-radius: 13px;
          background: #e5f4e9;
          color: #16805b;
          font-size: 11px;
          font-weight: 800;
        }

        .q-avatar-1 { background: #e9efff; color: #5976b7; }
        .q-avatar-2 { background: #fff0e3; color: #bb7741; }
        .q-avatar-3 { background: #f1eaff; color: #8c69b5; }
        .q-avatar-4 { background: #ffe9ed; color: #bd6379; }

        .q-member-details { min-width: 0; }

        .q-member-name {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          color: #254238;
          font-size: 12px;
          font-weight: 700;
        }

        .q-you {
          padding: 3px 7px;
          border-radius: 20px;
          background: #e1f5e8;
          color: #13845d;
          font-size: 9px;
          font-weight: 800;
        }

        .q-member-pending {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 5px;
          color: #8b9992;
          font-size: 10px;
        }

        .q-money { font-weight: 750; }
        .q-positive { color: #0a9a6c; }
        .q-negative { color: #e14d68; }
        .q-zero { color: #94a29a; }

        .q-table-footer {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          padding: 14px 22px;
          border-top: 1px solid #edf1ed;
          background: #fcfdfc;
        }

        .q-table-footer span {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #829188;
          font-size: 10px;
        }

        .q-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .q-dot-green { background: #10a477; }
        .q-dot-red { background: #e14d68; }
        .q-dot-gray { background: #aab5ae; }

        .q-settlement-section { margin-top: 4px; }

        .q-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 17px;
        }

        .q-section-icon {
          display: grid;
          place-items: center;
          width: 45px;
          height: 45px;
          border: 1px solid #e3eee7;
          border-radius: 14px;
          background: #f0f8f2;
          color: #15825e;
        }

        .q-settlement-list {
          overflow: hidden;
          border: 1px solid var(--q-line);
          border-radius: 21px;
          background: white;
          box-shadow: 0 5px 25px rgba(20,60,45,.035);
        }

        .q-settlement-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          transition: background .2s ease;
        }

        .q-settlement-card + .q-settlement-card {
          border-top: 1px solid #edf1ed;
        }

        .q-settlement-card:hover { background: #f8fbf8; }

        .q-transfer-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .q-transfer-avatars {
          display: flex;
          align-items: center;
        }

        .q-transfer-avatar {
          display: grid;
          place-items: center;
          width: 39px;
          height: 39px;
          border: 2px solid white;
          border-radius: 13px;
          background: #e7f3e9;
          color: #147a58;
          font-size: 12px;
          font-weight: 800;
        }

        .q-transfer-me {
          background: #e4edff;
          color: #5471b0;
        }

        .q-transfer-direction {
          z-index: 1;
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          margin: 0 -5px;
          border: 2px solid white;
          border-radius: 50%;
          background: #edf6ef;
          color: #12845e;
        }

        .q-transfer-details { min-width: 0; }

        .q-transfer-names {
          color: #41574c;
          font-size: 12px;
          line-height: 1.6;
        }

        .q-transfer-names strong {
          color: #1e3b30;
          font-weight: 750;
        }

        .q-transfer-subtitle {
          display: block;
          margin-top: 4px;
          color: #98a49d;
          font-size: 10px;
        }

        .q-transfer-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .q-transfer-amount {
          color: #16875f;
          font-size: 16px;
          font-weight: 800;
          white-space: nowrap;
        }

        .q-pay-link { text-decoration: none; }

        .q-pay-button {
          border-radius: 11px !important;
          background: #103d32 !important;
          padding: 11px 16px !important;
          box-shadow: 0 5px 12px rgba(16,61,50,.13) !important;
          transition: transform .2s ease, background .2s ease !important;
        }

        .q-pay-button:hover {
          transform: translateY(-2px);
          background: #17634c !important;
        }

        .q-waiting {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 12px;
          border-radius: 10px;
          background: #fff6e9;
          color: #a67b35;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .q-empty {
          display: flex;
          align-items: center;
          flex-direction: column;
          padding: 42px 20px;
          border: 1px solid #e8eee9;
          border-radius: 20px;
          background: white;
          text-align: center;
        }

        .q-empty-icon {
          display: grid;
          place-items: center;
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: #eaf7ed;
          color: #159668;
        }

        .q-empty h3 {
          margin: 16px 0 5px;
          color: #19372d;
          font-size: 16px;
          font-weight: 750;
        }

        .q-empty p {
          margin: 0;
          color: #8b9992;
          font-size: 12px;
        }

        .q-balances .gsap-reveal { will-change: transform, opacity; }

        .q-balances a:focus-visible,
        .q-balances button:focus-visible {
          outline: 3px solid #8ac9a5;
          outline-offset: 3px;
        }

        @media (max-width: 760px) {
          .q-hero {
            min-height: 250px;
            padding: 29px 25px;
          }

          .q-hero-art {
            width: 155px;
            height: 155px;
            margin-right: 5px;
            transform: scale(.8);
          }

          .q-art-center {
            width: 100px;
            height: 100px;
            border-radius: 32px;
          }

          .q-art-center > span { font-size: 65px; }

          .q-panel-heading { padding: 21px 19px; }
          .q-table thead th,
          .q-table tbody th,
          .q-table tbody td { padding-left: 15px; padding-right: 15px; }
        }

        @media (max-width: 560px) {
          .q-balances { padding-top: 15px; }

          .q-hero {
            min-height: 230px;
            padding: 25px 20px;
            border-radius: 20px;
          }

          .q-hero-art {
            position: absolute;
            right: -54px;
            bottom: -24px;
            opacity: .45;
            transform: scale(.8);
          }

          .q-hero-main { max-width: 100%; }
          .q-hero-amount { font-size: 34px; }
          .q-hero-caption { margin-top: 24px; }

          .q-panel,
          .q-settlement-list { border-radius: 16px; }

          .q-panel-heading { padding: 19px 17px; }
          .q-panel-heading h2,
          .q-section-heading h2 { font-size: 17px; }

          .q-table { min-width: 630px; }

          .q-settlement-card {
            align-items: flex-start;
            flex-direction: column;
            gap: 17px;
            padding: 19px 16px;
          }

          .q-transfer-right {
            width: 100%;
            justify-content: space-between;
            padding-left: 52px;
          }

          .q-pay-link { flex: 1; }
          .q-pay-link button { width: 100%; }

          .q-section-heading { margin-bottom: 13px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .q-balances *,
          .q-balances *::before,
          .q-balances *::after {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

            <section className="q-balances space-y-7" ref={root}>
                {waitingForMe > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 gsap-reveal" role="status">
            <span className="flex items-center gap-2 font-medium">
              <Clock3 size={17} />
                {useTranslation().t('balances.waitingForYou', { count: waitingForMe })}
            </span>
                        <Link
                            to={`/groups/${encodeURIComponent(group.id)}/settlements`}
                            className="font-bold underline underline-offset-4"
                        >
                            {useTranslation().t('balances.review')}
                            <ChevronRight size={14} className="inline" />
                        </Link>
                    </div>
                )}

                <QueryBoundary query={balances}>
                    {(data) => {
                        const me = data.members.find((m) => m.userId === user?.id)

                        return (
                            <div className="space-y-6">
                                {data.sumMinor !== 0 && (
                                    <Alert variant="error">
                                        {useTranslation().t('balances.unbalanced')}
                                    </Alert>
                                )}

                                {me && (
                                    <PositionCard me={me} currency={data.currency} />
                                )}

                                <MemberTable balances={data} meId={user?.id} />
                            </div>
                        )
                    }}
                </QueryBoundary>

                <QueryBoundary query={suggestions}>
                    {(data) => (
                        <SettlementSection
                            groupId={group.id}
                            groupStatus={group.status}
                            userId={user?.id}
                            transfers={data.transfers}
                            currency={data.currency}
                            nameOf={nameOf}
                        />
                    )}
                </QueryBoundary>
            </section>
        </>
    )
}
