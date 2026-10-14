import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { getDividends, getInstrument, getQuote, getQuoteHistory, getSplits, refreshQuoteHistory, repairQuoteHistory } from '../api/instruments'
import InstrumentMark from '../components/InstrumentMark'
import type { DailyQuote, DividendEvent, Instrument, InstrumentQuote, StockSplitEvent } from '../types/instrument'
import type { AuthResponse } from '../types/auth'

type DividendPeriod = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY'
type DetailTab = 'dividends' | 'splits'
type PriceRange = '1M' | '3M' | '1Y' | '5Y' | 'MAX'
type DividendChartPoint = { key: string, label: string, year: number, quarter?: number, month?: number, amount: number, change: number | null }
type DividendYieldPoint = { year: number, label: string, asOfDate: string, dividends: number, closingPrice: number, yieldPercent: number }

type InstrumentPageProps = {
  symbol: string
  auth: AuthResponse | null
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase())
}

function priceRangeDates(range: PriceRange) {
  const to = new Date()
  const from = new Date(to)
  if (range === '1M') from.setMonth(from.getMonth() - 1)
  else if (range === '3M') from.setMonth(from.getMonth() - 3)
  else if (range === '1Y') from.setFullYear(from.getFullYear() - 1)
  else if (range === '5Y') from.setFullYear(from.getFullYear() - 5)
  else from.setFullYear(from.getFullYear() - 20)
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { from: dateKey(from), to: dateKey(to) }
}

function InstrumentPage({ symbol, auth }: InstrumentPageProps) {
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quote, setQuote] = useState<InstrumentQuote | null>(null)
  const [quoteHistory, setQuoteHistory] = useState<DailyQuote[]>([])
  const [dividendYieldPrices, setDividendYieldPrices] = useState<DailyQuote[]>([])
  const [priceRange, setPriceRange] = useState<PriceRange>('1Y')
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(true)
  const [priceHistoryError, setPriceHistoryError] = useState('')
  const [historySyncing, setHistorySyncing] = useState<'latest' | 'repair' | null>(null)
  const [historySyncMessage, setHistorySyncMessage] = useState('')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [dividends, setDividends] = useState<DividendEvent[]>([])
  const [dividendPeriod, setDividendPeriod] = useState<DividendPeriod>('QUARTERLY')
  const [splits, setSplits] = useState<StockSplitEvent[]>([])
  const [marketLoading, setMarketLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DetailTab>('dividends')

  useEffect(() => {
    const controller = new AbortController()
    getInstrument(symbol, controller.signal)
      .then(setInstrument)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(apiErrorMessage(reason, 'Unable to load instrument'))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [symbol])

  useEffect(() => {
    const controller = new AbortController()
    const range = priceRangeDates(priceRange)
    setPriceHistoryLoading(true)
    setPriceHistoryError('')
    getQuoteHistory(symbol, range.from, range.to, controller.signal)
      .then(setQuoteHistory)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setPriceHistoryError(apiErrorMessage(reason, 'Unable to load price history.'))
      })
      .finally(() => { if (!controller.signal.aborted) setPriceHistoryLoading(false) })
    return () => controller.abort()
  }, [symbol, priceRange, historyRefreshKey])

  useEffect(() => {
    const controller = new AbortController()
    const to = new Date()
    const from = new Date(to)
    from.setFullYear(from.getFullYear() - 15)
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    getQuoteHistory(symbol, dateKey(from), dateKey(to), controller.signal)
      .then(setDividendYieldPrices)
      .catch(() => setDividendYieldPrices([]))
    return () => controller.abort()
  }, [symbol, historyRefreshKey])

  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled([getQuote(symbol, controller.signal), getDividends(symbol, controller.signal), getSplits(symbol, controller.signal)])
      .then(([quoteResult, dividendResult, splitResult]) => {
        if (quoteResult.status === 'fulfilled') setQuote(quoteResult.value)
        if (dividendResult.status === 'fulfilled') setDividends(dividendResult.value)
        if (splitResult.status === 'fulfilled') setSplits(splitResult.value)
      })
      .finally(() => { if (!controller.signal.aborted) setMarketLoading(false) })
    return () => controller.abort()
  }, [symbol])

  const paysMonthlyDividends = dividends.some((event) => event.frequency === 12)
  const effectiveDividendPeriod: DividendPeriod = dividendPeriod === 'ANNUAL' ? 'ANNUAL' : paysMonthlyDividends ? 'MONTHLY' : 'QUARTERLY'

  const dividendChartData = useMemo(() => {
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentQuarter = Math.floor(today.getMonth() / 3) + 1
    const totals = new Map<string, { year: number, quarter?: number, month?: number, amount: number }>()
    dividends.forEach((event) => {
      if (event.exDividendDate > todayKey) return
      const year = Number(event.exDividendDate.slice(0, 4))
      const month = Number(event.exDividendDate.slice(5, 7))
      const quarter = Math.floor((month - 1) / 3) + 1
      const key = effectiveDividendPeriod === 'ANNUAL' ? String(year) : effectiveDividendPeriod === 'MONTHLY' ? `${year}-${month}` : `${year}-Q${quarter}`
      const current = totals.get(key) ?? { year, quarter: effectiveDividendPeriod === 'QUARTERLY' ? quarter : undefined, month: effectiveDividendPeriod === 'MONTHLY' ? month : undefined, amount: 0 }
      current.amount += event.splitAdjustedCashAmount ?? event.cashAmount
      totals.set(key, current)
    })
    const ordered = [...totals.entries()].sort(([, left], [, right]) => left.year - right.year || (left.month ?? left.quarter ?? 0) - (right.month ?? right.quarter ?? 0))
    const firstVisibleYear = new Date().getFullYear() - 14
    return ordered.map(([key, value]): DividendChartPoint => {
      const priorKey = effectiveDividendPeriod === 'ANNUAL' ? String(value.year - 1) : effectiveDividendPeriod === 'MONTHLY' ? `${value.year - 1}-${value.month}` : `${value.year - 1}-Q${value.quarter}`
      const isIncomplete = value.year === currentYear
              && (effectiveDividendPeriod === 'ANNUAL' || (effectiveDividendPeriod === 'MONTHLY' ? value.month === currentMonth : value.quarter === currentQuarter))
      const prior = isIncomplete
        ? dividends.filter((event) => {
            const eventYear = Number(event.exDividendDate.slice(0, 4))
            const eventMonth = Number(event.exDividendDate.slice(5, 7))
            const eventQuarter = Math.floor((Number(event.exDividendDate.slice(5, 7)) - 1) / 3) + 1
            const matchedCutoff = `${currentYear - 1}-${todayKey.slice(5)}`
            return eventYear === currentYear - 1
              && (effectiveDividendPeriod === 'ANNUAL' || (effectiveDividendPeriod === 'MONTHLY' ? eventMonth === currentMonth : eventQuarter === currentQuarter))
              && event.exDividendDate <= matchedCutoff
          }).reduce((sum, event) => sum + (event.splitAdjustedCashAmount ?? event.cashAmount), 0)
        : totals.get(priorKey)?.amount
      return {
        key,
        label: effectiveDividendPeriod === 'ANNUAL'
          ? `${value.year}${isIncomplete ? ' YTD' : ''}`
          : effectiveDividendPeriod === 'MONTHLY'
            ? `${new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(value.year, (value.month ?? 1) - 1, 1))} '${String(value.year).slice(-2)}${isIncomplete ? ' MTD' : ''}`
            : `Q${value.quarter} '${String(value.year).slice(-2)}${isIncomplete ? ' QTD' : ''}`,
        year: value.year,
        quarter: value.quarter,
        month: value.month,
        amount: value.amount,
        change: prior && prior !== 0 ? (value.amount - prior) / Math.abs(prior) * 100 : null,
      }
    }).filter((point) => point.year >= firstVisibleYear)
  }, [dividends, effectiveDividendPeriod])

  const displayedDividends = useMemo(() => {
    const firstVisibleYear = new Date().getFullYear() - 14
    return dividends.filter((event) => Number(event.exDividendDate.slice(0, 4)) >= firstVisibleYear)
  }, [dividends])

  const dividendYieldHistory = useMemo(() => {
    const closingPriceByYear = new Map<number, DailyQuote>()
    dividendYieldPrices.forEach((price) => {
      const year = Number(price.date.slice(0, 4))
      const current = closingPriceByYear.get(year)
      if (!current || price.date > current.date) closingPriceByYear.set(year, price)
    })
    const currentYear = new Date().getFullYear()
    const firstVisibleYear = currentYear - 14
    return [...closingPriceByYear.entries()].sort(([left], [right]) => left - right).flatMap(([year, closingQuote]): DividendYieldPoint[] => {
      if (year < firstVisibleYear || closingQuote.close <= 0) return []
      const end = new Date(`${closingQuote.date}T00:00:00Z`)
      const start = new Date(end)
      start.setUTCFullYear(start.getUTCFullYear() - 1)
      const startDate = start.toISOString().slice(0, 10)
      const trailingDividends = dividends
        .filter((event) => event.exDividendDate > startDate && event.exDividendDate <= closingQuote.date)
        .reduce((sum, event) => sum + (event.splitAdjustedCashAmount ?? event.cashAmount), 0)
      return trailingDividends > 0 ? [{ year, label: `${year}${year === currentYear ? ' TTM' : ''}`, asOfDate: closingQuote.date, dividends: trailingDividends, closingPrice: closingQuote.close, yieldPercent: trailingDividends / closingQuote.close * 100 }] : []
    })
  }, [dividends, dividendYieldPrices])

  const runHistorySync = async (mode: 'latest' | 'repair') => {
    if (!auth || auth.user.role !== 'ADMIN') return
    setHistorySyncing(mode)
    setHistorySyncMessage('')
    setPriceHistoryError('')
    try {
      const range = priceRangeDates(priceRange)
      const result = mode === 'latest'
        ? await refreshQuoteHistory(auth, symbol)
        : await repairQuoteHistory(auth, symbol, range.from, range.to)
      setHistorySyncMessage(result.recordsUpserted
        ? `${result.recordsUpserted.toLocaleString()} missing trading ${result.recordsUpserted === 1 ? 'day was' : 'days were'} added${result.latestMarketDate ? ` through ${result.latestMarketDate}` : ''}.`
        : mode === 'latest' ? 'Price history is already current.' : 'No missing trading days were found in this range.')
      setHistoryRefreshKey((key) => key + 1)
    } catch (reason) {
      setPriceHistoryError(apiErrorMessage(reason, 'Unable to synchronize price history.'))
    } finally {
      setHistorySyncing(null)
    }
  }

  if (loading) return <main className="mx-auto max-w-[1560px] px-5 py-12 lg:px-8"><div className="h-52 animate-pulse rounded-[24px] bg-white" /></main>
  if (error || !instrument) return <main className="mx-auto max-w-[900px] px-5 py-16 text-center"><div className="rounded-[24px] border border-rose-200 bg-white p-10"><h1 className="text-2xl font-semibold">Instrument unavailable</h1><p className="mt-2 text-[#566f88]">{error || `We could not find ${symbol}.`}</p></div></main>
  return <main className="page-shell">

    <section className="rounded-[24px] border border-[#c3d5e8] bg-white p-6 shadow-[0_12px_40px_rgba(23,39,30,.035)] md:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4"><InstrumentMark symbol={instrument.symbol} size="large" /><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[32px] font-semibold tracking-[-.04em]">{instrument.symbol}</h1><span className="rounded-md bg-[#e6f0fb] px-2 py-1 text-[10px] font-bold text-[#4a657f]">{instrument.instrumentType}</span></div><p className="mt-1 text-[#67736c]">{instrument.name}</p></div></div>
      </div>
      <div className="mt-7">
        {marketLoading ? <div className="h-[74px] animate-pulse rounded-xl bg-[#f4f8fd]" aria-label="Loading daily quote" /> : quote ? <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><QuoteDetail label="Close" value={formatMoney(quote.price, quote.currency)} emphasis /><QuoteDetail label="Open" value={formatOptionalMoney(quote.open, quote.currency)} /><QuoteDetail label="High" value={formatOptionalMoney(quote.high, quote.currency)} /><QuoteDetail label="Low" value={formatOptionalMoney(quote.low, quote.currency)} /><QuoteDetail label="Volume" value={quote.volume == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(quote.volume)} /><QuoteDetail label="Market date (ET)" value={quote.marketDate} /></div> : <div className="rounded-xl bg-[#f4f8fd] px-4 py-3"><p className="text-sm font-semibold">No daily quote synchronized</p><p className="mt-1 text-xs text-[#556c84]">The latest end-of-day market data is not available yet.</p></div>}
      </div>
      <div className="mt-7 grid gap-3 border-t border-[#e8f0fa] pt-6 sm:grid-cols-3"><Detail label="Exchange" value={instrument.exchange} /><Detail label="Sector" value={instrument.instrumentType === 'ETF' ? 'Funds' : instrument.sector || 'Not classified'} /><Detail label="SEC CIK" value={instrument.cik || 'Not available'} /></div>
    </section>

    <section className="surface-card surface-card--flush mt-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#dbe6f2] p-5 lg:flex-row lg:items-center md:px-7"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Daily price history</h2><p className="mt-1 text-sm text-[#556c84]">Stored end-of-day OHLC prices and trading volume</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Segmented values={['1M', '3M', '1Y', '5Y', 'MAX']} active={priceRange} onChange={(value) => setPriceRange(value as PriceRange)} />{auth?.user.role === 'ADMIN' && <div className="flex gap-2"><button type="button" onClick={() => runHistorySync('latest')} disabled={historySyncing !== null} className="rounded-xl bg-[#0b3b66] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{historySyncing === 'latest' ? 'Refreshing…' : 'Refresh latest'}</button><button type="button" onClick={() => runHistorySync('repair')} disabled={historySyncing !== null} className="rounded-xl border border-[#b8cce0] bg-white px-3.5 py-2.5 text-xs font-bold text-[#315879] transition hover:bg-[#edf4fb] disabled:cursor-wait disabled:opacity-60">{historySyncing === 'repair' ? 'Repairing…' : 'Repair range'}</button></div>}</div></div>
      {historySyncMessage && <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-800">{historySyncMessage}</div>}
      {priceHistoryLoading ? <div className="h-80 animate-pulse bg-[#f4f8fd]" /> : priceHistoryError ? <div className="px-6 py-10 text-center"><p className="font-semibold text-rose-700">Price history unavailable</p><p className="mt-1 text-sm text-[#556c84]">{priceHistoryError}</p></div> : quoteHistory.length ? <PriceHistoryChart data={quoteHistory} /> : <div className="px-6 py-10 text-center"><p className="font-semibold">No daily prices found</p><p className="mt-1 text-sm text-[#556c84]">Historical prices for this range have not been synchronized.</p></div>}
    </section>

      <nav className="mb-6 mt-6 flex overflow-x-auto border-b border-[#c4d5e8]" aria-label="Instrument details">
        {([['dividends', 'Dividend history'], ['splits', 'Split history']] as const).map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`relative min-w-max px-4 py-4 text-sm font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition ${activeTab === key ? 'text-[#0b3b66] after:bg-[#0b5b9e] dark:text-[#bddcff]' : 'text-[#566f88] after:bg-transparent hover:bg-[#f4f8fd] hover:text-[#0b5b9e]'}`} aria-current={activeTab === key ? 'page' : undefined}>{label}</button>)}
      </nav>

    {activeTab === 'dividends' && <section className="surface-card surface-card--flush">
      <div className="flex flex-col justify-between gap-4 border-b border-[#dbe6f2] p-5 sm:flex-row sm:items-center md:px-7"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Dividend history</h2><p className="mt-1 text-sm text-[#556c84]">Latest 15 calendar years · split-adjusted distributions · U.S. market dates (ET)</p></div><Segmented values={['ANNUAL', paysMonthlyDividends ? 'MONTHLY' : 'QUARTERLY']} active={effectiveDividendPeriod} onChange={(value) => setDividendPeriod(value as DividendPeriod)} /></div>
      {marketLoading ? <div className="h-72 animate-pulse bg-[#f4f8fd]" /> : displayedDividends.length ? <><DividendHistoryChart data={dividendChartData} currency={displayedDividends[0]?.currency ?? 'USD'} period={effectiveDividendPeriod} />{dividendYieldHistory.length > 0 && <AnnualDividendYieldChart data={dividendYieldHistory} currency={displayedDividends[0]?.currency ?? 'USD'} />}<div className="overflow-x-auto border-t border-[#dbe6f2]"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f9fbff] text-[10px] font-bold uppercase tracking-[.12em] text-[#5d768f]"><tr><th className="px-6 py-3">Ex-dividend</th><th className="px-4 py-3">Pay date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Frequency</th><th className="px-4 py-3 text-right">Reported</th><th className="px-6 py-3 text-right">Split-adjusted</th></tr></thead><tbody>{displayedDividends.map((event) => <tr key={`${event.exDividendDate}-${event.cashAmount}`} className="border-t border-[#ecefec] hover:bg-[#fafcff] dark:hover:bg-[#172b40]"><td className="px-6 py-4 text-sm font-semibold">{event.exDividendDate}</td><td className="px-4 py-4 text-sm text-[#506981]">{event.payDate ?? '—'}</td><td className="px-4 py-4 text-sm">{event.dividendType ? humanize(event.dividendType.toLowerCase()) : 'Cash'}</td><td className="px-4 py-4 text-sm text-[#506981]">{frequencyLabel(event.frequency)}</td><td className="px-4 py-4 text-right text-sm tabular-nums text-[#506981]">{formatMoney(event.cashAmount, event.currency)}</td><td className="px-6 py-4 text-right text-sm font-bold tabular-nums">{formatMoney(event.splitAdjustedCashAmount ?? event.cashAmount, event.currency)}</td></tr>)}</tbody></table></div></> : <div className="px-6 py-10 text-center"><p className="font-semibold">No dividend events found</p><p className="mt-1 text-sm text-[#556c84]">This instrument may not pay a dividend, or its history has not been synchronized.</p></div>}
    </section>}

    {activeTab === 'splits' && <section className="surface-card surface-card--flush">
      <div className="border-b border-[#dbe6f2] p-5 md:px-7"><h2 className="text-xl font-semibold tracking-[-.025em]">Split history</h2><p className="mt-1 text-sm text-[#556c84]">Corporate actions used to adjust portfolio quantities and average cost</p></div>
      {marketLoading ? <div className="h-32 animate-pulse bg-[#f4f8fd]" /> : splits.length ? <div className="divide-y divide-[#ecefec]">{splits.map((split) => <div key={split.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm font-semibold">{humanize(split.adjustmentType)}</p><p className="mt-1 text-xs text-[#556c84]">Effective {split.executionDate}</p></div><span className="rounded-xl bg-[#edf3ee] px-3 py-2 text-sm font-bold tabular-nums">{split.splitTo}:{split.splitFrom}</span></div>)}</div> : <div className="px-6 py-9 text-center text-sm text-[#556c84]">No stock splits found.</div>}
    </section>}

  </main>
}

function PriceHistoryChart({ data }: { data: DailyQuote[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 1000
  const height = 340
  const left = 72
  const right = 24
  const top = 24
  const bottom = 48
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const prices = data.flatMap((quote) => [quote.low, quote.high])
  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)
  const padding = Math.max((maximum - minimum) * .08, maximum * .005, .01)
  const low = minimum - padding
  const high = maximum + padding
  const range = high - low || 1
  const x = (index: number) => left + index / Math.max(data.length - 1, 1) * plotWidth
  const y = (value: number) => top + (high - value) / range * plotHeight
  const path = data.map((quote, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(quote.close).toFixed(2)}`).join(' ')
  const areaPath = `${path} L ${x(data.length - 1)} ${top + plotHeight} L ${left} ${top + plotHeight} Z`
  const first = data[0]
  const last = data[data.length - 1]
  const change = last.close - first.close
  const changePercent = first.close ? change / first.close * 100 : 0
  const positive = change >= 0
  const currency = last.currency || 'USD'
  const compactVolume = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  const tickIndexes = [...new Set([0, Math.round((data.length - 1) / 4), Math.round((data.length - 1) / 2), Math.round((data.length - 1) * .75), data.length - 1])]

  return <div className="p-5 md:p-7">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#607991]">Closing price</p><div className="mt-1 flex flex-wrap items-baseline gap-3"><strong className="text-3xl tracking-[-.04em]">{formatMoney(last.close, currency)}</strong><span className={`text-sm font-bold ${positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{positive ? '+' : ''}{formatMoney(change, currency)} · {positive ? '+' : ''}{changePercent.toFixed(2)}%</span></div></div><p className="text-xs text-[#607991]">{first.date} – {last.date} · {data.length.toLocaleString()} trading days</p></div>
    <div className="relative w-full" onMouseLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[700px]" role="img" aria-label={`Daily closing price history from ${first.date} to ${last.date}`}>
        <defs><linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b91bc" stopOpacity=".24" /><stop offset="100%" stopColor="#3b91bc" stopOpacity="0" /></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((ratio) => { const value = low + range * ratio; const lineY = y(value); return <g key={ratio}><line x1={left} x2={width - right} y1={lineY} y2={lineY} className="stroke-[#dce8f4] dark:stroke-[#354b63]" strokeDasharray="3 5" /><text x={left - 10} y={lineY + 4} textAnchor="end" className="fill-[#526b84] text-[10px]">{new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}</text></g> })}
        <path d={areaPath} fill="url(#price-area)" />
        <path d={path} fill="none" className="stroke-[#1976a7] dark:stroke-[#55a9d2]" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {tickIndexes.map((index) => <text key={index} x={x(index)} y={height - 15} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} className="fill-[#536c85] text-[10px]">{new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data[index].date}T00:00:00Z`))}</text>)}
        {hoveredIndex !== null && <g><line x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1={top} y2={top + plotHeight} className="stroke-[#7291ad]" strokeDasharray="4 4" /><circle cx={x(hoveredIndex)} cy={y(data[hoveredIndex].close)} r="5" className="fill-[#1976a7] stroke-white dark:stroke-[#132235]" strokeWidth="2" /></g>}
        {data.map((quote, index) => <rect key={quote.date} x={Math.max(left, x(index) - plotWidth / data.length / 2)} y={top} width={Math.max(plotWidth / data.length, 1)} height={plotHeight} fill="transparent" onMouseEnter={() => setHoveredIndex(index)} />)}
      </svg>
      {hoveredIndex !== null && (() => { const point = data[hoveredIndex]; const position = x(hoveredIndex) / width * 100; return <div className="pointer-events-none absolute top-3 z-20 w-52 -translate-x-1/2 rounded-xl bg-[#0d243d] p-3 text-white shadow-[0_12px_32px_rgba(20,35,29,.3)]" style={{ left: `${Math.max(12, Math.min(position, 88))}%` }}><p className="border-b border-white/15 pb-2 text-xs font-bold">{point.date}</p><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]"><span className="text-white/60">Open</span><strong className="text-right">{formatMoney(point.open, currency)}</strong><span className="text-white/60">High</span><strong className="text-right">{formatMoney(point.high, currency)}</strong><span className="text-white/60">Low</span><strong className="text-right">{formatMoney(point.low, currency)}</strong><span className="text-white/60">Close</span><strong className="text-right">{formatMoney(point.close, currency)}</strong><span className="text-white/60">Volume</span><strong className="text-right">{compactVolume(point.volume)}</strong></div></div> })()}
    </div>
  </div>
}

function AnnualDividendYieldChart({ data, currency }: { data: DividendYieldPoint[], currency: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = Math.max(720, data.length * 76 + 90)
  const height = 260
  const left = 58
  const right = 68
  const top = 22
  const bottom = 44
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maximum = Math.max(...data.map((point) => point.yieldPercent), 1)
  const minimumPrice = Math.min(...data.map((point) => point.closingPrice))
  const maximumPrice = Math.max(...data.map((point) => point.closingPrice))
  const pricePadding = Math.max((maximumPrice - minimumPrice) * .08, maximumPrice * .02, .01)
  const priceLow = Math.max(0, minimumPrice - pricePadding)
  const priceHigh = maximumPrice + pricePadding
  const priceRange = priceHigh - priceLow || 1
  const slotWidth = plotWidth / data.length
  const baseline = top + plotHeight
  const x = (index: number) => left + slotWidth * index + slotWidth / 2
  const y = (value: number) => baseline - value / maximum * plotHeight
  const priceY = (value: number) => top + (priceHigh - value) / priceRange * plotHeight
  const path = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(point.yieldPercent).toFixed(2)}`).join(' ')
  const pricePath = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${priceY(point.closingPrice).toFixed(2)}`).join(' ')
  const compactPrice = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)

  return <section className="border-t border-[#dbe6f2] px-4 py-6 sm:px-6">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-base font-semibold">Annual dividend yield history</h3><p className="mt-1 text-xs text-[#607991]">Trailing-12-month split-adjusted dividends ÷ the final available closing price for each year</p></div><div className="flex flex-wrap gap-4 text-[11px] font-semibold text-[#506a84]"><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-emerald-500" />TTM yield</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#368bc0]" />Closing price</span></div></div>
    <div className="overflow-x-auto"><div className="relative" style={{ width: `${width}px`, height: `${height}px` }} onMouseLeave={() => setHoveredIndex(null)}><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Annual dividend yield history" className="max-w-none">
      {[0, .25, .5, .75, 1].map((ratio) => { const value = maximum * ratio; const y = baseline - plotHeight * ratio; return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-[#dce8f4] dark:stroke-[#354b63]" strokeDasharray={ratio ? '3 4' : undefined} /><text x={left - 8} y={y + 4} textAnchor="end" className="fill-[#526b84] text-[10px]">{value.toFixed(2)}%</text></g> })}
      {[0, .5, 1].map((ratio) => { const value = priceLow + priceRange * ratio; const axisY = priceY(value); return <text key={`price-${ratio}`} x={width - right + 9} y={axisY + 4} textAnchor="start" className="fill-[#368bc0] text-[10px]">{compactPrice(value)}</text> })}
      <path d={path} fill="none" className="stroke-emerald-500 dark:stroke-emerald-400" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
      <path d={pricePath} fill="none" className="stroke-[#368bc0] dark:stroke-[#62b1de]" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((point, index) => <g key={point.year}>{hoveredIndex === index && <line x1={x(index)} x2={x(index)} y1={top} y2={baseline} className="stroke-[#7890a6]" strokeDasharray="4 4" />}<circle cx={x(index)} cy={y(point.yieldPercent)} r={hoveredIndex === index ? 6 : 4} className={`fill-emerald-500 stroke-white transition-all dark:fill-emerald-400 dark:stroke-[#132235] ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-55' : ''}`} strokeWidth="2" /><circle cx={x(index)} cy={priceY(point.closingPrice)} r={hoveredIndex === index ? 5 : 3.5} className={`fill-[#368bc0] stroke-white transition-all dark:fill-[#62b1de] dark:stroke-[#132235] ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-55' : ''}`} strokeWidth="2" /><text x={x(index)} y={baseline + 20} textAnchor="middle" className="fill-[#536c85] text-[10px]">{point.label}</text><rect x={left + slotWidth * index} y={top} width={slotWidth} height={plotHeight} fill="transparent" onMouseEnter={() => setHoveredIndex(index)} /></g>)}
    </svg>{hoveredIndex !== null && (() => { const point = data[hoveredIndex]; const center = left + slotWidth * hoveredIndex + slotWidth / 2; const tooltipLeft = Math.max(8, Math.min(center - 96, width - 200)); return <div className="pointer-events-none absolute top-7 z-20 w-48 rounded-xl border border-[#a9bfd2]/70 bg-white/65 p-3 text-[#17324a] shadow-[0_8px_22px_rgba(35,62,84,.12)] backdrop-blur-md dark:border-[#6b7f92]/60 dark:bg-[#1a2d40]/60 dark:text-[#f2f7fb]" style={{ left: `${tooltipLeft}px` }}><p className="border-b border-[#bfcfdd]/70 pb-2 text-xs font-bold dark:border-[#728598]/55">{point.label} · {point.asOfDate}</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]"><span className="text-[#526d85] dark:text-[#c5d2dd]">TTM yield</span><strong className="text-right text-emerald-700 dark:text-emerald-300">{point.yieldPercent.toFixed(2)}%</strong><span className="text-[#526d85] dark:text-[#c5d2dd]">TTM dividends</span><strong className="text-right">{formatMoney(point.dividends, currency)}</strong><span className="text-[#526d85] dark:text-[#c5d2dd]">Closing price</span><strong className="text-right">{formatMoney(point.closingPrice, currency)}</strong></div></div> })()}</div></div>
    <p className="mt-2 text-[11px] text-[#5d768f]">Each point uses dividends with ex-dates in the 12 months ending on the displayed closing-price date.</p>
  </section>
}

function DividendHistoryChart({ data, currency, period }: { data: DividendChartPoint[], currency: string, period: DividendPeriod }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = Math.max(760, data.length * (period === 'ANNUAL' ? 92 : period === 'MONTHLY' ? 38 : 48) + 120)
  const height = 300
  const left = 64
  const right = 64
  const top = 28
  const bottom = 54
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const baseline = top + plotHeight
  const maximumAmount = Math.max(...data.map((point) => point.amount), 1)
  const changes = data.flatMap((point) => point.change == null ? [] : [point.change])
  const minimumChange = Math.min(0, ...changes)
  const maximumChange = Math.max(0, ...changes)
  const changeRange = maximumChange - minimumChange || 1
  const slotWidth = plotWidth / Math.max(data.length, 1)
  const barWidth = Math.min(period === 'ANNUAL' ? 46 : period === 'MONTHLY' ? 16 : 22, slotWidth * .58)
  const x = (index: number) => left + slotWidth * index + slotWidth / 2
  const changeY = (value: number) => top + (maximumChange - value) / changeRange * plotHeight
  const compactCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)

  return <div className="px-4 py-5 sm:px-6">
    <div className="mb-3 flex flex-wrap items-center gap-5 text-[11px] font-semibold text-[#506a84]"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#3b91bc]" />Dividend per share</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-amber-500" />Year-over-year change</span></div>
    <div className="overflow-x-auto"><div className="relative" style={{ width: `${width}px`, height: `${height}px` }}><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${period === 'ANNUAL' ? 'Annual' : period === 'MONTHLY' ? 'Monthly' : 'Quarterly'} dividend history and year-over-year change`} className="max-w-none">
      {[0, .25, .5, .75, 1].map((ratio) => { const y = top + plotHeight * (1 - ratio); return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-[#dce8f4] dark:stroke-[#354b63]" strokeDasharray={ratio ? '3 4' : undefined} /><text x={left - 9} y={y + 4} textAnchor="end" className="fill-[#526b84] text-[10px]">{compactCurrency(maximumAmount * ratio)}</text></g> })}
      {data.map((point, index) => { const center = x(index); const barHeight = point.amount / maximumAmount * plotHeight; return <g key={point.key}><rect x={center - barWidth / 2} y={baseline - barHeight} width={barWidth} height={barHeight} rx="4" className={`fill-[#3b91bc] transition-opacity dark:fill-[#55a9d2] ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-45' : ''}`} /><text x={center} y={baseline + 20} textAnchor="middle" className="fill-[#536c85] text-[10px]">{point.label}</text></g> })}
      {data.slice(1).map((point, index) => { const previous = data[index]; return previous.change != null && point.change != null ? <line key={`${previous.key}-${point.key}`} x1={x(index)} y1={changeY(previous.change)} x2={x(index + 1)} y2={changeY(point.change)} className="stroke-amber-500" strokeWidth="2.5" /> : null })}
      {data.map((point, index) => point.change == null ? null : <circle key={`${point.key}-change`} cx={x(index)} cy={changeY(point.change)} r={hoveredIndex === index ? 6 : 4} className="fill-amber-500 stroke-white transition-all dark:stroke-[#132235]" strokeWidth="2" />)}
      <text x={width - right + 10} y={top + 4} className="fill-amber-600 text-[10px]">{maximumChange.toFixed(2)}%</text><text x={width - right + 10} y={baseline + 4} className="fill-amber-600 text-[10px]">{minimumChange.toFixed(2)}%</text>
    </svg>{data.map((point, index) => <button key={`${point.key}-target`} type="button" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} className="absolute top-7 z-10 bg-transparent outline-none" style={{ left: `${left + slotWidth * index}px`, width: `${slotWidth}px`, height: `${plotHeight}px` }} aria-label={`${point.label}, dividend ${formatMoney(point.amount, currency)}, year-over-year change ${point.change == null ? 'not available' : `${point.change.toFixed(2)} percent`}`} />)}{hoveredIndex !== null && (() => { const point = data[hoveredIndex]; const tooltipLeft = Math.max(8, Math.min(x(hoveredIndex) - 88, width - 184)); return <div className="pointer-events-none absolute top-9 z-20 w-44 rounded-xl bg-[#0d243d] p-3 text-white shadow-[0_12px_32px_rgba(20,35,29,.3)]" style={{ left: `${tooltipLeft}px` }}><p className="border-b border-white/15 pb-2 text-xs font-bold">{point.label}</p><div className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-white/65">Dividend</span><strong>{formatMoney(point.amount, currency)}</strong></div><div className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-white/65">YoY change</span><strong className={point.change == null ? 'text-white/55' : point.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{point.change == null ? 'Not available' : `${point.change >= 0 ? '+' : ''}${point.change.toFixed(2)}%`}</strong></div></div> })()}</div></div>
    <p className="mt-2 text-[11px] text-[#5d768f]">{period === 'ANNUAL' ? 'Completed years use full-year change; the current year compares YTD dividends with the same prior-year dates.' : period === 'MONTHLY' ? 'Each month compares with the same month one year earlier; the current month uses matching MTD dates.' : 'Completed quarters compare with the same prior-year quarter; the current quarter uses matching QTD dates.'}</p>
  </div>
}

function Detail({ label, value }: { label: string, value: string }) {
  return <div className="rounded-xl bg-[#f4f8fd] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#607991]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}

function formatMoney(value: number, currency: string) { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 4 }).format(value) }
function formatOptionalMoney(value: number | null, currency: string) { return value == null ? '—' : formatMoney(value, currency) }
function frequencyLabel(value: number | null) { return value === 12 ? 'Monthly' : value === 4 ? 'Quarterly' : value === 2 ? 'Semiannual' : value === 1 ? 'Annual' : value ? `${value}× yearly` : '—' }
function QuoteDetail({ label, value, emphasis = false }: { label: string, value: string, emphasis?: boolean }) { return <div className="rounded-xl bg-[#f4f8fd] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#607991]">{label}</p><p className={`mt-1 font-semibold tabular-nums ${emphasis ? 'text-lg tracking-[-.02em]' : 'text-sm'}`}>{value}</p></div> }

function Segmented({ values, active, onChange }: { values: string[], active: string, onChange: (value: string) => void }) {
  return <div className="flex w-full rounded-xl bg-[#e6f0fb] p-1 sm:w-auto">{values.map((value) => <button key={value} onClick={() => onChange(value)} className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-bold transition sm:flex-none ${active === value ? 'bg-white text-[#0b3b66] shadow-sm' : 'text-[#526d87]'}`}>{value}</button>)}</div>
}

export default InstrumentPage
