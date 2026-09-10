import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { getDividendCalendar, getHoldings, getPortfolios } from '../api/portfolios'
import { getInstrument, getQuote } from '../api/instruments'
import InstrumentMark from '../components/InstrumentMark'
import { formatMarketDate, marketDateDay } from '../utils/date'
import type { AuthResponse } from '../types/auth'
import type { DividendCalendarEvent, Holding, Portfolio } from '../types/portfolio'
import type { Instrument, InstrumentQuote } from '../types/instrument'

type Props = {
  auth: AuthResponse | null
  requestedPortfolioId?: string
  onNeedAuth: () => void
  onSelectInstrument: (symbol: string) => void
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const money = (value: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
const shortDate = (value: string) => formatMarketDate(value, { month: 'short', day: 'numeric' })

function DividendCalendarPage({ auth, requestedPortfolioId, onNeedAuth, onSelectInstrument }: Props) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [events, setEvents] = useState<DividendCalendarEvent[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(Boolean(auth))
  const [error, setError] = useState('')
  const [activeEvent, setActiveEvent] = useState<DividendCalendarEvent | null>(null)
  const selected = portfolios.find((portfolio) => portfolio.id === selectedId)
  const now = new Date()
  const forecastStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1))
  const forecastEnd = dateKey(new Date(now.getFullYear(), now.getMonth() + 12, 0))

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getPortfolios(auth, controller.signal).then((data) => {
      setPortfolios(data)
      setSelectedId(data.some((portfolio) => portfolio.id === requestedPortfolioId) ? requestedPortfolioId! : data[0]?.id ?? '')
    }).catch((reason: unknown) => setError(apiErrorMessage(reason, 'Unable to load your portfolios.')))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, requestedPortfolioId])

  useEffect(() => {
    if (!auth || !selectedId) return
    const controller = new AbortController()
    Promise.all([
      getDividendCalendar(auth, selectedId, forecastStart, forecastEnd, controller.signal),
      getHoldings(auth, selectedId, controller.signal),
    ]).then(([calendarEvents, holdingData]) => { setEvents(calendarEvents); setHoldings(holdingData) })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(apiErrorMessage(reason, 'Unable to load the dividend calendar.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, selectedId, forecastStart, forecastEnd])

  const monthEvents = useMemo(() => events.filter((event) => {
    return Number(event.calendarDate.slice(0, 4)) === month.getFullYear()
      && Number(event.calendarDate.slice(5, 7)) === month.getMonth() + 1
  }), [events, month])
  const eventsByDate = useMemo(() => monthEvents.reduce((grouped, event) => {
    grouped.set(event.calendarDate, [...(grouped.get(event.calendarDate) ?? []), event])
    return grouped
  }, new Map<string, DividendCalendarEvent[]>()), [monthEvents])
  const calendarDays = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
  }, [month])
  const total = events.reduce((sum, event) => sum + event.projectedAmount, 0)
  const monthlyTotal = monthEvents.reduce((sum, event) => sum + event.projectedAmount, 0)
  const scheduledEvents = events.filter((event) => !event.estimated)
  const symbols = new Set(events.map((event) => event.symbol)).size
  const marketValue = holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0)
  const forecastMonths = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() + index, 1))
  const monthlyBreakdown = forecastMonths.map((forecastMonth) => events.filter((event) => {
    return Number(event.calendarDate.slice(0, 4)) === forecastMonth.getFullYear()
      && Number(event.calendarDate.slice(5, 7)) === forecastMonth.getMonth() + 1
  }).reduce((amounts, event) => {
    const bucket = event.estimated ? 'estimated' : 'scheduled'
    amounts[bucket] += event.projectedAmount
    return amounts
  }, { scheduled: 0, estimated: 0 }))
  const monthlyIncome = monthlyBreakdown.map((amounts) => amounts.scheduled + amounts.estimated)
  const monthOffset = (month.getFullYear() - now.getFullYear()) * 12 + month.getMonth() - now.getMonth()
  const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month)

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4effb] text-2xl">◫</span><h1 className="mt-5 text-2xl font-semibold">Your dividend calendar</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#536d86]">Sign in to see expected payments for the instruments you hold.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#0b3b66] px-5 py-3 text-sm font-bold text-white">Sign in to continue</button></section></main>

  return <main className="page-shell">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="page-eyebrow">Income planning</p><h1 className="page-title">Dividend calendar</h1><p className="page-description">Distributions calculated from the shares you owned before each ex-dividend date. Market dates follow U.S. Eastern Time.</p></div>
      <button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="self-start rounded-xl border border-[#c4d5e8] bg-white px-4 py-2.5 text-sm font-bold shadow-sm">Today</button>
    </div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {portfolios.length === 0 && !loading ? <section className="rounded-[22px] border border-dashed border-[#b9cce0] bg-white py-20 text-center"><h2 className="text-xl font-semibold">No portfolio selected</h2><p className="mt-2 text-sm text-[#526b84]">Create a portfolio and add a position to start planning dividend income.</p></section> : <>
      <AnnualIncomeOverview total={total} currency={selected?.currency} marketValue={marketValue} months={forecastMonths} monthlyIncome={monthlyIncome} monthlyBreakdown={monthlyBreakdown} scheduled={scheduledEvents.length} sources={symbols} events={events} />
      <section className="surface-card surface-card--flush">
        <div className="flex items-center justify-between border-b border-[#dbe6f2] px-4 py-4 sm:px-6">
          <button disabled={monthOffset <= 0} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-10 place-items-center rounded-xl border border-[#c4d5e8] hover:bg-[#f4f8fd] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous month">←</button>
          <div className="text-center"><div className="flex items-center justify-center gap-2"><h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">+{money(monthlyTotal, selected?.currency)}</span></div><p className="mt-0.5 text-[11px] text-[#526b84]">Announced payments · projected distributions</p></div>
          <button disabled={monthOffset >= 11} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-10 place-items-center rounded-xl border border-[#c4d5e8] hover:bg-[#f4f8fd] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next month">→</button>
        </div>
        {loading ? <div className="h-[520px] animate-pulse bg-[#f4f8fd]" /> : <>
          <div className="hidden grid-cols-7 border-b border-[#dbe6f2] bg-[#f9fbff] md:grid">{weekdays.map((day) => <div key={day} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[.12em] text-[#5d768f]">{day}</div>)}</div>
          <div className="hidden grid-cols-7 md:grid">{calendarDays.map((day) => {
            const key = dateKey(day); const dayEvents = eventsByDate.get(key) ?? []; const inMonth = day.getMonth() === month.getMonth(); const today = key === dateKey(new Date())
            return <div key={key} className={`min-h-32 border-b border-r border-[#e9ede9] p-2.5 ${inMonth ? '' : 'bg-[#f9fbff] opacity-55'}`}><div className={`mb-2 grid size-7 place-items-center rounded-full text-xs font-semibold ${today ? 'bg-[#0b3b66] text-white' : ''}`}>{day.getDate()}</div><div className="space-y-1.5">{dayEvents.slice(0, 3).map((event) => <button key={`${event.symbol}-${event.exDividendDate}`} onClick={() => setActiveEvent(event)} className={`block w-full rounded-lg border-l-[3px] px-2 py-1.5 text-left transition ${event.dateType === 'PAY_DATE' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/55 dark:text-emerald-100 dark:hover:bg-emerald-900/60' : 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/55 dark:text-amber-100 dark:hover:bg-amber-900/60'}`}><span className="flex justify-between gap-1 text-[10px] font-bold"><span>{event.symbol}</span><span>{money(event.projectedAmount, event.currency)}</span></span></button>)}{dayEvents.length > 3 && <p className="px-1 text-[10px] font-semibold text-[#536c85]">+{dayEvents.length - 3} more</p>}</div></div>
          })}</div>
          <div className="divide-y divide-[#e9ede9] md:hidden">{monthEvents.length ? monthEvents.map((event) => <EventRow key={`${event.symbol}-${event.exDividendDate}`} event={event} onSelect={() => setActiveEvent(event)} />) : <EmptyMonth />}</div>
          {!monthEvents.length && <div className="hidden md:block"><EmptyMonth /></div>}
        </>}
      </section>
      <p className="mt-4 text-xs leading-5 text-[#526b84]">Income uses your eligible quantity immediately before each ex-dividend date and the reported dividend per share. Later purchases and sales do not change an earlier entitlement. Events without a published payment date appear on their ex-dividend date and are marked estimated.</p>
    </>}
    {activeEvent && <DividendEventDialog event={activeEvent} onClose={() => setActiveEvent(null)} onViewInstrument={() => onSelectInstrument(activeEvent.symbol)} />}
  </main>
}

function AnnualIncomeOverview({ total, currency, marketValue, months, monthlyIncome, monthlyBreakdown, scheduled, sources, events }: { total: number, currency?: string, marketValue: number, months: Date[], monthlyIncome: number[], monthlyBreakdown: { scheduled: number, estimated: number }[], scheduled: number, sources: number, events: DividendCalendarEvent[] }) {
  const maximum = Math.max(...monthlyIncome, 1)
  const yieldPercent = marketValue > 0 ? total / marketValue * 100 : null
  return <section className="mb-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
    <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0b3b66] to-[#0b5b9e] p-6 text-white shadow-[0_16px_40px_rgba(11,59,102,.22)]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/65">Projected yearly income</p><p className="mt-2 text-[32px] font-semibold tracking-[-.045em]">{money(total, currency)}</p><p className="mt-1 text-xs text-white/65">Next 12 months, including this month</p><div className="mt-6 rounded-2xl bg-white/10 p-4"><IncomeStat label="Monthly average" value={money(total / 12, currency)} /><IncomeStat label="Daily average" value={money(total / 365, currency)} /><IncomeStat label="Forward yield" value={yieldPercent == null ? '—' : `${yieldPercent.toFixed(2)}%`} last /></div><div className="mt-4 flex gap-4 text-[10px] text-white/65"><span>{scheduled} scheduled</span><span>{sources} income sources</span></div></div>
    <div className="space-y-5"><div className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 sm:p-6"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="font-semibold tracking-[-.02em]">12-month income forecast</h2><p className="mt-1 text-xs text-[#526b84]">Scheduled payments and estimates by month</p></div><div className="flex flex-wrap gap-3 text-[10px] font-semibold text-[#506981]"><Legend color="bg-[#0b5b9e]" label="Scheduled" /><Legend color="bg-amber-400" label="Estimated" /></div></div><div className="flex h-44 items-end gap-2 sm:gap-3">{months.map((forecastMonth, index) => <div key={dateKey(forecastMonth)} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end text-center"><BarTooltip month={forecastMonth} total={monthlyIncome[index]} amounts={monthlyBreakdown[index]} currency={currency} /><span className="mb-1 truncate text-[9px] font-semibold text-[#506a84]">{monthlyIncome[index] ? compactMoney(monthlyIncome[index], currency) : ''}</span><div className="mx-auto flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md bg-[#e6f0fb]" style={{ height: `${Math.max(monthlyIncome[index] ? monthlyIncome[index] / maximum * 100 : 2, 2)}%` }}><BarSegment value={monthlyBreakdown[index].scheduled} total={monthlyIncome[index]} color="bg-[#0b5b9e]" /><BarSegment value={monthlyBreakdown[index].estimated} total={monthlyIncome[index]} color="bg-amber-400" /></div><span className="mt-2 text-[9px] text-[#526b84]">{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(forecastMonth)}</span></div>)}</div></div><IncomeReliability events={events} total={total} currency={currency} /></div>
  </section>
}

function IncomeStat({ label, value, last = false }: { label: string, value: string, last?: boolean }) { return <div className={`flex items-center justify-between py-2 text-xs ${last ? '' : 'border-b border-white/10'}`}><span className="text-white/55">{label}</span><strong>{value}</strong></div> }
function Legend({ color, label }: { color: string, label: string }) { return <span className="flex items-center gap-1.5"><i className={`size-2 rounded-sm ${color}`} />{label}</span> }
function BarSegment({ value, total, color }: { value: number, total: number, color: string }) { return value > 0 && total > 0 ? <div className={`w-full ${color}`} style={{ height: `${value / total * 100}%` }} /> : null }
function BarTooltip({ month, total, amounts, currency }: { month: Date, total: number, amounts: { scheduled: number, estimated: number }, currency?: string }) { return <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-44 -translate-x-1/2 rounded-xl bg-[#0d243d] p-3 text-left text-white shadow-[0_12px_32px_rgba(13,36,61,.28)] group-hover:block"><div className="flex items-center justify-between border-b border-white/15 pb-2"><strong className="text-xs">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month)}</strong><strong className="text-xs">{money(total, currency)}</strong></div><TooltipAmount color="bg-[#0b5b9e]" label="Scheduled" value={money(amounts.scheduled, currency)} /><TooltipAmount color="bg-amber-400" label="Estimated" value={money(amounts.estimated, currency)} /></div> }
function TooltipAmount({ color, label, value }: { color: string, label: string, value: string }) { return <div className="mt-2 flex items-center gap-2 text-[10px]"><i className={`size-2 rounded-sm ${color}`} /><span className="flex-1 text-white/65">{label}</span><strong>{value}</strong></div> }
function compactMoney(value: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value) }

function IncomeReliability({ events, total, currency }: { events: DividendCalendarEvent[], total: number, currency?: string }) {
  const sources = Array.from(events.reduce((values, event) => values.set(event.symbol, (values.get(event.symbol) ?? 0) + event.projectedAmount), new Map<string, number>()).entries()).map(([symbol, amount]) => ({ symbol, amount })).sort((left, right) => right.amount - left.amount)
  const topSource = sources[0]
  const topThreeAmount = sources.slice(0, 3).reduce((sum, source) => sum + source.amount, 0)
  const estimatedAmount = events.filter((event) => event.estimated).reduce((sum, event) => sum + event.projectedAmount, 0)
  const topSourceShare = total > 0 && topSource ? topSource.amount / total * 100 : 0
  const topThreeShare = total > 0 ? topThreeAmount / total * 100 : 0
  const scheduledShare = total > 0 ? (total - estimatedAmount) / total * 100 : 0
  return <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#0b5b9e]">Income reliability</p><h2 className="mt-1 font-semibold tracking-[-.02em]">Know what needs attention</h2></div><span className="rounded-full bg-[#e4effb] px-3 py-1.5 text-xs font-bold text-[#0b4f89]">{scheduledShare.toFixed(0)}% scheduled</span></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><ReliabilityMetric label="Largest income source" value={topSource ? topSource.symbol : '—'} detail={topSource ? `${money(topSource.amount, currency)} · ${topSourceShare.toFixed(0)}% of income` : 'Add dividend holdings to calculate'} tone={topSourceShare >= 25 ? 'attention' : 'good'} /><ReliabilityMetric label="Top 3 concentration" value={total ? `${topThreeShare.toFixed(0)}%` : '—'} detail={total ? 'of projected income' : 'No projected income yet'} tone={topThreeShare >= 50 ? 'attention' : 'good'} /><ReliabilityMetric label="Still estimated" value={money(estimatedAmount, currency)} detail={estimatedAmount > 0 ? 'Amounts may change before declaration' : 'All forecasted amounts are scheduled'} tone={estimatedAmount > 0 ? 'neutral' : 'good'} /></div></section>
}

function ReliabilityMetric({ label, value, detail, tone }: { label: string, value: string, detail: string, tone: 'good' | 'attention' | 'neutral' }) { const color = tone === 'attention' ? 'text-amber-700' : tone === 'good' ? 'text-[#0b5b9e]' : 'text-[#506981]'; return <div className="rounded-xl border border-[#dbe6f2] bg-[#f9fbff] p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#607991]">{label}</p><p className={`mt-2 text-xl font-semibold tracking-[-.02em] ${color}`}>{value}</p><p className="mt-1 text-xs leading-5 text-[#526b84]">{detail}</p></div> }

function EventRow({ event, onSelect }: { event: DividendCalendarEvent, onSelect: () => void }) {
  return <button onClick={onSelect} className="flex w-full items-center gap-3 px-4 py-4 text-left"><div className="w-11 text-center"><strong className="block text-lg">{marketDateDay(event.calendarDate)}</strong><span className="text-[10px] uppercase text-[#526b84]">{formatMarketDate(event.calendarDate, { weekday: 'short' })}</span></div><InstrumentMark symbol={event.symbol} size="small" /><div className="min-w-0 flex-1"><strong className="text-sm">{event.symbol}</strong><span className="ml-2 text-[10px] font-bold uppercase text-[#526b84]">{event.estimated ? 'Estimated' : event.dateType === 'PAY_DATE' ? 'Pay date' : 'Ex-date'}</span><p className="truncate text-xs text-[#526b84]">{event.name} · Ex {shortDate(event.exDividendDate)}</p></div><div className="text-right"><strong className="block text-sm">{money(event.projectedAmount, event.currency)}</strong><span className="text-[10px] text-[#526b84]">{event.quantity} × {money(event.amountPerShare, event.currency)}</span></div></button>
}

function EmptyMonth() { return <div className="px-6 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e8f1fb] text-xl">◫</div><h3 className="mt-4 font-semibold">No dividends this month</h3><p className="mt-1 text-sm text-[#526b84]">Try another month or synchronize the latest dividend data.</p></div> }

function DividendEventDialog({ event, onClose, onViewInstrument }: { event: DividendCalendarEvent, onClose: () => void, onViewInstrument: () => void }) {
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [quote, setQuote] = useState<InstrumentQuote | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled([getInstrument(event.symbol, controller.signal), getQuote(event.symbol, controller.signal)])
      .then(([instrumentResult, quoteResult]) => {
        if (instrumentResult.status === 'fulfilled') setInstrument(instrumentResult.value)
        if (quoteResult.status === 'fulfilled') setQuote(quoteResult.value)
      })
    const onKeyDown = (keyboardEvent: KeyboardEvent) => { if (keyboardEvent.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => { controller.abort(); window.removeEventListener('keydown', onKeyDown) }
  }, [event.symbol, onClose])

  return <div className="fixed inset-0 z-60 flex items-start justify-center px-4 pt-24 backdrop-blur-sm" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="dividend-dialog-title" className="max-h-[calc(100vh-7rem)] w-full max-w-[620px] overflow-y-auto rounded-[24px] border border-[#c3d5e8] bg-white shadow-[0_24px_80px_rgba(20,38,29,.24)] dark:border-[#304258]">
      <div className="flex items-start gap-4 border-b border-[#dbe6f2] px-5 py-5 sm:px-6">
        <InstrumentMark symbol={event.symbol} size="medium" />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 id="dividend-dialog-title" className="text-xl font-semibold tracking-[-.03em]">{event.symbol} dividend</h2><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${event.dateType === 'PAY_DATE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/55 dark:text-amber-200'}`}>{event.dateType === 'PAY_DATE' ? 'Pay date' : 'Estimated'}</span></div><p className="mt-1 truncate text-sm text-[#526d87]">{instrument?.name ?? event.name}</p></div>
        <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl text-xl text-[#526d87] hover:bg-[#edf4fb]" aria-label="Close dividend details">×</button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="rounded-[20px] bg-[#0b3b66] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/60">Your dividend</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl tracking-[-.04em]">{money(event.projectedAmount, event.currency)}</strong><span className="pb-1 text-xs text-white/65">{event.quantity} eligible shares</span></div><div className="mt-4 border-t border-white/15 pt-3 text-xs text-white/70">{event.quantity} shares × {money(event.amountPerShare, event.currency)} per share</div></div>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Detail label="Declared" value={event.declarationDate ? shortDate(event.declarationDate) : '—'} />
          <Detail label="Ex-dividend" value={shortDate(event.exDividendDate)} />
          <Detail label="Record date" value={event.recordDate ? shortDate(event.recordDate) : '—'} />
          <Detail label="Pay date" value={event.payDate ? shortDate(event.payDate) : 'Not announced'} />
        </div>
        <div className="my-5 border-t border-[#dbe6f2]" />
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#5e7790]">Stock details</p><h3 className="mt-1 font-semibold">{instrument?.name ?? event.name}</h3></div>{quote && <div className="text-right"><strong className="block text-lg">{money(quote.price, quote.currency)}</strong><span className="text-[10px] text-[#526b84]">As of {shortDate(quote.marketDate)}</span></div>}</div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#e8f1fb] px-2.5 py-1.5 font-semibold">{instrument?.exchange ?? '—'}</span><span className="rounded-lg bg-[#e8f1fb] px-2.5 py-1.5 font-semibold">{instrument?.instrumentType ?? 'Security'}</span>{instrument && <span className="rounded-lg bg-[#e8f1fb] px-2.5 py-1.5 font-semibold">{instrument.instrumentType === 'ETF' ? 'Funds' : instrument.sector || 'Not classified'}</span>}{event.frequency && <span className="rounded-lg bg-[#e8f1fb] px-2.5 py-1.5 font-semibold">{frequencyName(event.frequency)}</span>}</div>
        <button onClick={onViewInstrument} className="mt-6 w-full rounded-xl bg-[#38bdf8] px-4 py-3 text-sm font-bold text-[#162b45] hover:bg-[#22b4ee]">View full {event.symbol} details →</button>
      </div>
    </section>
  </div>
}

function Detail({ label, value }: { label: string, value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#5e7790]">{label}</p><p className="mt-1.5 text-sm font-semibold">{value}</p></div> }
function frequencyName(value: number) { return value === 12 ? 'Monthly' : value === 4 ? 'Quarterly' : value === 2 ? 'Semiannual' : value === 1 ? 'Annual' : `${value}× yearly` }

export default DividendCalendarPage
