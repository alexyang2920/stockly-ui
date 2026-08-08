import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { getDividendCalendar, getHoldings, getPortfolios } from '../api/portfolios'
import { getInstrument, getQuote } from '../api/instruments'
import InstrumentMark from '../components/InstrumentMark'
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
const localDate = (value: string) => new Date(`${value}T00:00:00`)
const money = (value: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(localDate(value))

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
    const eventDate = localDate(event.calendarDate)
    return eventDate.getFullYear() === month.getFullYear() && eventDate.getMonth() === month.getMonth()
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
  const payDates = events.filter((event) => !event.estimated && event.dateType === 'PAY_DATE')
  const symbols = new Set(events.map((event) => event.symbol)).size
  const marketValue = holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0)
  const forecastMonths = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() + index, 1))
  const monthlyBreakdown = forecastMonths.map((forecastMonth) => events.filter((event) => {
    const eventDate = localDate(event.calendarDate)
    return eventDate.getFullYear() === forecastMonth.getFullYear() && eventDate.getMonth() === forecastMonth.getMonth()
  }).reduce((amounts, event) => {
    const bucket = event.estimated ? 'estimated' : localDate(event.calendarDate).getTime() <= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() ? 'received' : 'announced'
    amounts[bucket] += event.projectedAmount
    return amounts
  }, { received: 0, announced: 0, estimated: 0 }))
  const monthlyIncome = monthlyBreakdown.map((amounts) => amounts.received + amounts.announced + amounts.estimated)
  const monthOffset = (month.getFullYear() - now.getFullYear()) * 12 + month.getMonth() - now.getMonth()
  const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month)

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#dfe4df] bg-white px-7 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf1ec] text-2xl">◫</span><h1 className="mt-5 text-2xl font-semibold">Your dividend calendar</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77837b]">Sign in to see expected payments for the instruments you hold.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white">Sign in to continue</button></section></main>

  return <main className="mx-auto max-w-[1380px] px-5 py-8 lg:px-8 lg:py-11">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Income planning</p><h1 className="mt-2 text-[36px] font-semibold tracking-[-.045em] md:text-[46px]">Dividend calendar</h1><p className="mt-2 text-sm text-[#738078]">Distributions calculated from the shares you owned before each ex-dividend date.</p></div>
      <button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="self-start rounded-xl border border-[#dfe4df] bg-white px-4 py-2.5 text-sm font-bold shadow-sm">Today</button>
    </div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {portfolios.length === 0 && !loading ? <section className="rounded-[22px] border border-dashed border-[#cfd7d1] bg-white py-20 text-center"><h2 className="text-xl font-semibold">No portfolio selected</h2><p className="mt-2 text-sm text-[#7b867f]">Create a portfolio and add a position to start planning dividend income.</p></section> : <>
      <AnnualIncomeOverview total={total} currency={selected?.currency} marketValue={marketValue} months={forecastMonths} monthlyIncome={monthlyIncome} monthlyBreakdown={monthlyBreakdown} confirmed={payDates.length} sources={symbols} />
      <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e9e5] px-4 py-4 sm:px-6">
          <button disabled={monthOffset <= 0} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-10 place-items-center rounded-xl border border-[#dfe4df] hover:bg-[#f7f9f7] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous month">←</button>
          <div className="text-center"><div className="flex items-center justify-center gap-2"><h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">+{money(monthlyTotal, selected?.currency)}</span></div><p className="mt-0.5 text-[11px] text-[#7b867f]">Announced payments · projected distributions</p></div>
          <button disabled={monthOffset >= 11} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-10 place-items-center rounded-xl border border-[#dfe4df] hover:bg-[#f7f9f7] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next month">→</button>
        </div>
        {loading ? <div className="h-[520px] animate-pulse bg-[#f7f9f7]" /> : <>
          <div className="hidden grid-cols-7 border-b border-[#e5e9e5] bg-[#fafbf9] md:grid">{weekdays.map((day) => <div key={day} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[.12em] text-[#849088]">{day}</div>)}</div>
          <div className="hidden grid-cols-7 md:grid">{calendarDays.map((day) => {
            const key = dateKey(day); const dayEvents = eventsByDate.get(key) ?? []; const inMonth = day.getMonth() === month.getMonth(); const today = key === dateKey(new Date())
            return <div key={key} className={`min-h-32 border-b border-r border-[#e9ede9] p-2.5 ${inMonth ? '' : 'bg-[#fafbf9] opacity-55'}`}><div className={`mb-2 grid size-7 place-items-center rounded-full text-xs font-semibold ${today ? 'bg-[#173c2c] text-white' : ''}`}>{day.getDate()}</div><div className="space-y-1.5">{dayEvents.slice(0, 3).map((event) => <button key={`${event.symbol}-${event.exDividendDate}`} onClick={() => setActiveEvent(event)} className={`block w-full rounded-lg border-l-[3px] px-2 py-1.5 text-left ${event.dateType === 'PAY_DATE' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-400 bg-amber-50'}`}><span className="flex justify-between gap-1 text-[10px] font-bold"><span>{event.symbol}</span><span>{money(event.projectedAmount, event.currency)}</span></span></button>)}{dayEvents.length > 3 && <p className="px-1 text-[10px] font-semibold text-[#758179]">+{dayEvents.length - 3} more</p>}</div></div>
          })}</div>
          <div className="divide-y divide-[#e9ede9] md:hidden">{monthEvents.length ? monthEvents.map((event) => <EventRow key={`${event.symbol}-${event.exDividendDate}`} event={event} onSelect={() => setActiveEvent(event)} />) : <EmptyMonth />}</div>
          {!monthEvents.length && <div className="hidden md:block"><EmptyMonth /></div>}
        </>}
      </section>
      <p className="mt-4 text-xs leading-5 text-[#7b867f]">Income uses your eligible quantity immediately before each ex-dividend date and the reported dividend per share. Later purchases and sales do not change an earlier entitlement. Events without a published payment date appear on their ex-dividend date and are marked estimated.</p>
    </>}
    {activeEvent && <DividendEventDialog event={activeEvent} onClose={() => setActiveEvent(null)} onViewInstrument={() => onSelectInstrument(activeEvent.symbol)} />}
  </main>
}

function AnnualIncomeOverview({ total, currency, marketValue, months, monthlyIncome, monthlyBreakdown, confirmed, sources }: { total: number, currency?: string, marketValue: number, months: Date[], monthlyIncome: number[], monthlyBreakdown: { received: number, announced: number, estimated: number }[], confirmed: number, sources: number }) {
  const maximum = Math.max(...monthlyIncome, 1)
  const yieldPercent = marketValue > 0 ? total / marketValue * 100 : null
  return <section className="mb-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
    <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#173c2c] to-[#284e3c] p-6 text-white shadow-[0_16px_40px_rgba(23,60,44,.14)]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/55">Estimated yearly income</p><p className="mt-2 text-[32px] font-semibold tracking-[-.045em]">{money(total, currency)}</p><p className="mt-1 text-xs text-white/55">Next 12 months, including this month</p><div className="mt-6 rounded-2xl bg-white/10 p-4"><IncomeStat label="Monthly average" value={money(total / 12, currency)} /><IncomeStat label="Daily average" value={money(total / 365, currency)} /><IncomeStat label="Forward yield" value={yieldPercent == null ? '—' : `${yieldPercent.toFixed(2)}%`} last /></div><div className="mt-4 flex gap-4 text-[10px] text-white/55"><span>{confirmed} announced</span><span>{sources} income sources</span></div></div>
    <div className="rounded-[22px] border border-[#dfe4df] bg-white p-5 sm:p-6"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="font-semibold tracking-[-.02em]">12-month income forecast</h2><p className="mt-1 text-xs text-[#7b867f]">Payment status by month</p></div><div className="flex flex-wrap gap-3 text-[10px] font-semibold text-[#6f7c74]"><Legend color="bg-emerald-500" label="Received" /><Legend color="bg-[#3b91bc]" label="Announced" /><Legend color="bg-amber-400" label="Estimated" /></div></div><div className="flex h-44 items-end gap-2 sm:gap-3">{months.map((forecastMonth, index) => <div key={dateKey(forecastMonth)} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end text-center"><BarTooltip month={forecastMonth} total={monthlyIncome[index]} amounts={monthlyBreakdown[index]} currency={currency} /><span className="mb-1 truncate text-[9px] font-semibold text-[#708078]">{monthlyIncome[index] ? compactMoney(monthlyIncome[index], currency) : ''}</span><div className="mx-auto flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md bg-[#edf1ee]" style={{ height: `${Math.max(monthlyIncome[index] ? monthlyIncome[index] / maximum * 100 : 2, 2)}%` }}><BarSegment value={monthlyBreakdown[index].received} total={monthlyIncome[index]} color="bg-emerald-500" /><BarSegment value={monthlyBreakdown[index].announced} total={monthlyIncome[index]} color="bg-[#3b91bc]" /><BarSegment value={monthlyBreakdown[index].estimated} total={monthlyIncome[index]} color="bg-amber-400" /></div><span className="mt-2 text-[9px] text-[#7b867f]">{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(forecastMonth)}</span></div>)}</div></div>
  </section>
}

function IncomeStat({ label, value, last = false }: { label: string, value: string, last?: boolean }) { return <div className={`flex items-center justify-between py-2 text-xs ${last ? '' : 'border-b border-white/10'}`}><span className="text-white/55">{label}</span><strong>{value}</strong></div> }
function Legend({ color, label }: { color: string, label: string }) { return <span className="flex items-center gap-1.5"><i className={`size-2 rounded-sm ${color}`} />{label}</span> }
function BarSegment({ value, total, color }: { value: number, total: number, color: string }) { return value > 0 && total > 0 ? <div className={`w-full ${color}`} style={{ height: `${value / total * 100}%` }} /> : null }
function BarTooltip({ month, total, amounts, currency }: { month: Date, total: number, amounts: { received: number, announced: number, estimated: number }, currency?: string }) { return <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-44 -translate-x-1/2 rounded-xl bg-[#15231d] p-3 text-left text-white shadow-[0_12px_32px_rgba(20,35,29,.28)] group-hover:block"><div className="flex items-center justify-between border-b border-white/15 pb-2"><strong className="text-xs">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month)}</strong><strong className="text-xs">{money(total, currency)}</strong></div><TooltipAmount color="bg-emerald-500" label="Received" value={money(amounts.received, currency)} /><TooltipAmount color="bg-[#3b91bc]" label="Announced" value={money(amounts.announced, currency)} /><TooltipAmount color="bg-amber-400" label="Estimated" value={money(amounts.estimated, currency)} /></div> }
function TooltipAmount({ color, label, value }: { color: string, label: string, value: string }) { return <div className="mt-2 flex items-center gap-2 text-[10px]"><i className={`size-2 rounded-sm ${color}`} /><span className="flex-1 text-white/65">{label}</span><strong>{value}</strong></div> }
function compactMoney(value: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value) }

function EventRow({ event, onSelect }: { event: DividendCalendarEvent, onSelect: () => void }) {
  return <button onClick={onSelect} className="flex w-full items-center gap-3 px-4 py-4 text-left"><div className="w-11 text-center"><strong className="block text-lg">{localDate(event.calendarDate).getDate()}</strong><span className="text-[10px] uppercase text-[#7b867f]">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(localDate(event.calendarDate))}</span></div><InstrumentMark symbol={event.symbol} size="small" /><div className="min-w-0 flex-1"><strong className="text-sm">{event.symbol}</strong><span className="ml-2 text-[10px] font-bold uppercase text-[#7b867f]">{event.estimated ? 'Estimated' : event.dateType === 'PAY_DATE' ? 'Pay date' : 'Ex-date'}</span><p className="truncate text-xs text-[#7b867f]">{event.name} · Ex {shortDate(event.exDividendDate)}</p></div><div className="text-right"><strong className="block text-sm">{money(event.projectedAmount, event.currency)}</strong><span className="text-[10px] text-[#7b867f]">{event.quantity} × {money(event.amountPerShare, event.currency)}</span></div></button>
}

function EmptyMonth() { return <div className="px-6 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef2ee] text-xl">◫</div><h3 className="mt-4 font-semibold">No dividends this month</h3><p className="mt-1 text-sm text-[#7b867f]">Try another month or synchronize the latest dividend data.</p></div> }

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
    <section role="dialog" aria-modal="true" aria-labelledby="dividend-dialog-title" className="max-h-[calc(100vh-7rem)] w-full max-w-[620px] overflow-y-auto rounded-[24px] border border-[#dce3dd] bg-white shadow-[0_24px_80px_rgba(20,38,29,.24)] dark:border-[#35463d]">
      <div className="flex items-start gap-4 border-b border-[#e5e9e5] px-5 py-5 sm:px-6">
        <InstrumentMark symbol={event.symbol} size="medium" />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 id="dividend-dialog-title" className="text-xl font-semibold tracking-[-.03em]">{event.symbol} dividend</h2><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${event.dateType === 'PAY_DATE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{event.dateType === 'PAY_DATE' ? 'Pay date' : 'Estimated'}</span></div><p className="mt-1 truncate text-sm text-[#748078]">{instrument?.name ?? event.name}</p></div>
        <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl text-xl text-[#748078] hover:bg-[#f3f5f2]" aria-label="Close dividend details">×</button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="rounded-[20px] bg-[#173c2c] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/60">Your dividend</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl tracking-[-.04em]">{money(event.projectedAmount, event.currency)}</strong><span className="pb-1 text-xs text-white/65">{event.quantity} eligible shares</span></div><div className="mt-4 border-t border-white/15 pt-3 text-xs text-white/70">{event.quantity} shares × {money(event.amountPerShare, event.currency)} per share</div></div>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Detail label="Declared" value={event.declarationDate ? shortDate(event.declarationDate) : '—'} />
          <Detail label="Ex-dividend" value={shortDate(event.exDividendDate)} />
          <Detail label="Record date" value={event.recordDate ? shortDate(event.recordDate) : '—'} />
          <Detail label="Pay date" value={event.payDate ? shortDate(event.payDate) : 'Not announced'} />
        </div>
        <div className="my-5 border-t border-[#e5e9e5]" />
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#859088]">Stock details</p><h3 className="mt-1 font-semibold">{instrument?.name ?? event.name}</h3></div>{quote && <div className="text-right"><strong className="block text-lg">{money(quote.price, quote.currency)}</strong><span className="text-[10px] text-[#7b867f]">As of {shortDate(quote.marketDate)}</span></div>}</div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#eef2ee] px-2.5 py-1.5 font-semibold">{instrument?.exchange ?? '—'}</span><span className="rounded-lg bg-[#eef2ee] px-2.5 py-1.5 font-semibold">{instrument?.instrumentType ?? 'Security'}</span>{instrument && <span className="rounded-lg bg-[#eef2ee] px-2.5 py-1.5 font-semibold">{instrument.instrumentType === 'ETF' ? 'Funds' : instrument.sector || 'Not classified'}</span>}{event.frequency && <span className="rounded-lg bg-[#eef2ee] px-2.5 py-1.5 font-semibold">{frequencyName(event.frequency)}</span>}</div>
        <button onClick={onViewInstrument} className="mt-6 w-full rounded-xl bg-[#d8f768] px-4 py-3 text-sm font-bold text-[#1c2d24] hover:bg-[#c9ed4d]">View full {event.symbol} details →</button>
      </div>
    </section>
  </div>
}

function Detail({ label, value }: { label: string, value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#859088]">{label}</p><p className="mt-1.5 text-sm font-semibold">{value}</p></div> }
function frequencyName(value: number) { return value === 12 ? 'Monthly' : value === 4 ? 'Quarterly' : value === 2 ? 'Semiannual' : value === 1 ? 'Annual' : `${value}× yearly` }

export default DividendCalendarPage
