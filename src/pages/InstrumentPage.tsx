import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { getDividends, getFinancials, getInstrument, getQuote, getRatios, getSplits, type FinancialPeriod, type RatioBasis } from '../api/instruments'
import { addWatchlistInstrument, createWatchlist, getWatchlists, removeWatchlistInstrument } from '../api/watchlists'
import InstrumentMark from '../components/InstrumentMark'
import type { AuthResponse } from '../types/auth'
import type { DividendEvent, FinancialFact, FinancialRatios, Instrument, InstrumentQuote, StockSplitEvent, Watchlist } from '../types/instrument'

type Period = FinancialPeriod
type Basis = RatioBasis
type DividendPeriod = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY'
type DetailTab = 'dividends' | 'splits' | 'ratios' | 'financials'
type FinancialPeriodColumn = { key: string, label: string, periodEnd: string, fiscalYear: number }
type DividendChartPoint = { key: string, label: string, year: number, quarter?: number, month?: number, amount: number, change: number | null }

type InstrumentPageProps = {
  symbol: string
  auth: AuthResponse | null
  onBack: () => void
  onNeedAuth: () => void
  onWatchChange: (symbol: string, watched: boolean) => void
  watched: boolean
}

const metricLabels: Record<string, string> = {
  REVENUE: 'Revenue', COST_OF_REVENUE: 'Cost of revenue', GROSS_PROFIT: 'Gross profit', OPERATING_EXPENSES: 'Operating expenses', OPERATING_INCOME: 'Operating income', INTEREST_EXPENSE: 'Interest expense', INCOME_BEFORE_TAX: 'Income before tax', INCOME_TAX_EXPENSE: 'Income tax expense', NET_INCOME: 'Net income', DILUTED_EPS: 'Diluted EPS', CASH_AND_EQUIVALENTS: 'Cash & equivalents', ACCOUNTS_RECEIVABLE: 'Accounts receivable', INVENTORY: 'Inventory', CURRENT_ASSETS: 'Current assets', TOTAL_ASSETS: 'Total assets', GOODWILL: 'Goodwill', CURRENT_LIABILITIES: 'Current liabilities', TOTAL_LIABILITIES: 'Total liabilities', LONG_TERM_DEBT: 'Long-term debt', SHAREHOLDERS_EQUITY: 'Shareholders’ equity', SHARES_OUTSTANDING: 'Shares outstanding', OPERATING_CASH_FLOW: 'Operating cash flow', CAPITAL_EXPENDITURES: 'Capital expenditures', INVESTING_CASH_FLOW: 'Investing cash flow', FINANCING_CASH_FLOW: 'Financing cash flow', DIVIDENDS_PAID: 'Dividends paid', SHARE_REPURCHASES: 'Share repurchases',
}

const statementGroups = [
  { key: 'INCOME_STATEMENT', title: 'Income statement', description: 'Revenue, profitability, and earnings', metrics: ['REVENUE', 'COST_OF_REVENUE', 'GROSS_PROFIT', 'OPERATING_EXPENSES', 'OPERATING_INCOME', 'INTEREST_EXPENSE', 'INCOME_BEFORE_TAX', 'INCOME_TAX_EXPENSE', 'NET_INCOME', 'DILUTED_EPS'] },
  { key: 'BALANCE_SHEET', title: 'Balance sheet', description: 'Assets, liabilities, and shareholders’ equity', metrics: ['CASH_AND_EQUIVALENTS', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'CURRENT_ASSETS', 'TOTAL_ASSETS', 'GOODWILL', 'CURRENT_LIABILITIES', 'TOTAL_LIABILITIES', 'LONG_TERM_DEBT', 'SHAREHOLDERS_EQUITY', 'SHARES_OUTSTANDING'] },
  { key: 'CASH_FLOW', title: 'Cash flow statement', description: 'Operating cash generation and capital allocation', metrics: ['OPERATING_CASH_FLOW', 'CAPITAL_EXPENDITURES', 'INVESTING_CASH_FLOW', 'FINANCING_CASH_FLOW', 'DIVIDENDS_PAID', 'SHARE_REPURCHASES'] },
] as const

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase())
}

function formatFact(value: number, unit: string) {
  if (unit === 'USD/shares') return `$${value.toFixed(2)}`
  if (unit === 'shares') return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  if (unit === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

function formatRatio(key: string, value: number) {
  if (key === 'freeCashFlow') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  if (/margin|return/i.test(key)) return `${(value * 100).toFixed(1)}%`
  return `${value.toFixed(2)}×`
}

function InstrumentPage({ symbol, auth, onBack, onNeedAuth, onWatchChange, watched }: InstrumentPageProps) {
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [facts, setFacts] = useState<FinancialFact[]>([])
  const [ratios, setRatios] = useState<FinancialRatios | null>(null)
  const [period, setPeriod] = useState<Period>('ANNUAL')
  const [loadedPeriod, setLoadedPeriod] = useState<Period>('ANNUAL')
  const [basis, setBasis] = useState<Basis>('TTM')
  const [loading, setLoading] = useState(true)
  const [factsLoading, setFactsLoading] = useState(true)
  const [ratiosLoading, setRatiosLoading] = useState(true)
  const [error, setError] = useState('')
  const [factsMessage, setFactsMessage] = useState('')
  const [ratiosMessage, setRatiosMessage] = useState('')
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState('')
  const [watchlistsLoading, setWatchlistsLoading] = useState(Boolean(auth))
  const [watchSaving, setWatchSaving] = useState(false)
  const [watchError, setWatchError] = useState('')
  const [quote, setQuote] = useState<InstrumentQuote | null>(null)
  const [dividends, setDividends] = useState<DividendEvent[]>([])
  const [dividendPeriod, setDividendPeriod] = useState<DividendPeriod>('ANNUAL')
  const [splits, setSplits] = useState<StockSplitEvent[]>([])
  const [marketLoading, setMarketLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DetailTab>('financials')

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
    getFinancials(symbol, period, controller.signal)
      .then((data) => {
        setFacts(data)
        setLoadedPeriod(period)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setFactsMessage(apiErrorMessage(reason, 'Financial data is unavailable'))
      })
      .finally(() => { if (!controller.signal.aborted) setFactsLoading(false) })
    return () => controller.abort()
  }, [period, symbol])

  useEffect(() => {
    const controller = new AbortController()
    getRatios(symbol, basis, controller.signal)
      .then(setRatios)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setRatios(null)
        setRatiosMessage(apiErrorMessage(reason, 'Financial ratios are unavailable'))
      })
      .finally(() => { if (!controller.signal.aborted) setRatiosLoading(false) })
    return () => controller.abort()
  }, [basis, symbol])

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getWatchlists(auth, controller.signal)
      .then((data) => {
        setWatchlists(data)
        const containingList = data.find((watchlist) => watchlist.instruments.some((item) => item.symbol === symbol))
        setSelectedWatchlistId(containingList?.id ?? data[0]?.id ?? '')
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setWatchError(apiErrorMessage(reason, 'Unable to load watchlists'))
      })
      .finally(() => { if (!controller.signal.aborted) setWatchlistsLoading(false) })
    return () => controller.abort()
  }, [auth, symbol])

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

  const financialTable = useMemo(() => {
    const periodMap = new Map<string, FinancialPeriodColumn>()
    const factMap = new Map<string, Map<string, FinancialFact>>()

    for (const fact of facts) {
      const periodKey = fact.periodEnd
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          key: periodKey,
          label: loadedPeriod === 'ANNUAL' ? String(fact.fiscalYear) : `${fact.fiscalPeriod} ${fact.fiscalYear}`,
          periodEnd: fact.periodEnd,
          fiscalYear: fact.fiscalYear,
        })
      }
      const metricFacts = factMap.get(fact.metric) ?? new Map<string, FinancialFact>()
      const existing = metricFacts.get(periodKey)
      if (!existing || fact.filedAt > existing.filedAt) metricFacts.set(periodKey, fact)
      factMap.set(fact.metric, metricFacts)
    }

    const allPeriods = [...periodMap.values()].sort((left, right) => right.periodEnd.localeCompare(left.periodEnd))
    const latestFiscalYear = Math.max(...allPeriods.map((item) => item.fiscalYear))
    const periods = allPeriods.filter((item) => item.fiscalYear >= latestFiscalYear - 9)
    const groups = statementGroups.map((group) => {
      const configured = group.metrics.filter((metric) => factMap.has(metric))
      const additional = [...factMap.keys()].filter((metric) => !group.metrics.includes(metric as never)
        && facts.some((fact) => fact.metric === metric && fact.statementType === group.key))
        .sort((left, right) => (metricLabels[left] ?? left).localeCompare(metricLabels[right] ?? right))
      return { ...group, metrics: [...configured, ...additional] }
    }).filter((group) => group.metrics.length > 0)
    return { periods, groups, metricCount: groups.reduce((count, group) => count + group.metrics.length, 0), factMap }
  }, [facts, loadedPeriod])

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
      const date = new Date(`${event.exDividendDate}T00:00:00`)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const quarter = Math.floor(date.getMonth() / 3) + 1
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

  const changePeriod = (value: string) => {
    setFactsLoading(true)
    setFactsMessage('')
    setPeriod(value as Period)
  }

  const changeBasis = (value: string) => {
    setRatiosLoading(true)
    setRatiosMessage('')
    setBasis(value as Basis)
  }

  const selectedWatchlist = watchlists.find((watchlist) => watchlist.id === selectedWatchlistId)
  const isInSelectedWatchlist = selectedWatchlist?.instruments.some((item) => item.symbol === symbol) ?? false

  const toggleSelectedWatchlist = async () => {
    if (!auth) { onNeedAuth(); return }
    if (watchSaving || watchlistsLoading) return
    setWatchSaving(true)
    setWatchError('')

    try {
      let target = selectedWatchlist
      let currentLists = watchlists
      if (!target) {
        target = await createWatchlist(auth, 'My Watchlist')
        currentLists = [...currentLists, target]
        setSelectedWatchlistId(target.id)
      }

      const alreadyAdded = target.instruments.some((item) => item.symbol === symbol)
      if (alreadyAdded) {
        await removeWatchlistInstrument(auth, target.id, symbol)
        const next = currentLists.map((watchlist) => watchlist.id === target.id ? { ...watchlist, instruments: watchlist.instruments.filter((item) => item.symbol !== symbol) } : watchlist)
        setWatchlists(next)
        onWatchChange(symbol, next.some((watchlist) => watchlist.instruments.some((item) => item.symbol === symbol)))
      } else {
        const updated = await addWatchlistInstrument(auth, target.id, symbol)
        const next = currentLists.map((watchlist) => watchlist.id === updated.id ? updated : watchlist)
        setWatchlists(next)
        onWatchChange(symbol, true)
      }
    } catch (reason) {
      setWatchError(apiErrorMessage(reason, 'Cannot reach the Stockly API.'))
    } finally {
      setWatchSaving(false)
    }
  }

  if (loading) return <main className="mx-auto max-w-[1560px] px-5 py-12 lg:px-8"><div className="h-52 animate-pulse rounded-[24px] bg-white" /></main>
  if (error || !instrument) return <main className="mx-auto max-w-[900px] px-5 py-16 text-center"><div className="rounded-[24px] border border-rose-200 bg-white p-10"><h1 className="text-2xl font-semibold">Instrument unavailable</h1><p className="mt-2 text-[#78837c]">{error || `We could not find ${symbol}.`}</p><button onClick={onBack} className="mt-6 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white">Back to search</button></div></main>

  return <main className="mx-auto max-w-[1560px] px-5 py-8 lg:px-8 lg:py-11">
    <button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-semibold text-[#68756d] hover:text-[#173c2c]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg> Back </button>

    <section className="rounded-[24px] border border-[#dce2dd] bg-white p-6 shadow-[0_12px_40px_rgba(23,39,30,.035)] md:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4"><InstrumentMark symbol={instrument.symbol} size="large" /><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[32px] font-semibold tracking-[-.04em]">{instrument.symbol}</h1><span className="rounded-md bg-[#edf1ed] px-2 py-1 text-[10px] font-bold text-[#647168]">{instrument.instrumentType}</span></div><p className="mt-1 text-[#67736c]">{instrument.name}</p></div></div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {auth && watchlists.length > 1 && <select value={selectedWatchlistId} onChange={(event) => setSelectedWatchlistId(event.target.value)} className="rounded-xl border border-[#dce2dd] bg-white px-3 py-2 text-xs font-semibold outline-none" aria-label="Target watchlist">{watchlists.map((watchlist) => <option key={watchlist.id} value={watchlist.id}>{watchlist.name}</option>)}</select>}
          <button onClick={toggleSelectedWatchlist} disabled={watchSaving || watchlistsLoading} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${isInSelectedWatchlist || (!auth && watched) ? 'bg-[#e7f0e9] text-[#24563f]' : 'bg-[#173c2c] text-white hover:bg-[#205139]'}`}><svg className={`size-4 ${isInSelectedWatchlist || (!auth && watched) ? 'fill-current' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" /></svg>{watchSaving ? 'Saving…' : watchlistsLoading ? 'Loading watchlists…' : isInSelectedWatchlist ? `Remove from ${selectedWatchlist?.name ?? 'watchlist'}` : selectedWatchlist ? `Add to ${selectedWatchlist.name}` : 'Add to watchlist'}</button>
          {watchError && <p role="alert" className="max-w-xs text-right text-xs text-rose-600">{watchError}</p>}
        </div>
      </div>
      <div className="mt-7">
        {marketLoading ? <div className="h-[74px] animate-pulse rounded-xl bg-[#f7f9f7]" aria-label="Loading daily quote" /> : quote ? <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><QuoteDetail label="Close" value={formatMoney(quote.price, quote.currency)} emphasis /><QuoteDetail label="Open" value={formatOptionalMoney(quote.open, quote.currency)} /><QuoteDetail label="High" value={formatOptionalMoney(quote.high, quote.currency)} /><QuoteDetail label="Low" value={formatOptionalMoney(quote.low, quote.currency)} /><QuoteDetail label="Volume" value={quote.volume == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(quote.volume)} /><QuoteDetail label="Market date" value={quote.marketDate} /></div> : <div className="rounded-xl bg-[#f7f9f7] px-4 py-3"><p className="text-sm font-semibold">No daily quote synchronized</p><p className="mt-1 text-xs text-[#7a857e]">The latest end-of-day market data is not available yet.</p></div>}
      </div>
      <div className="mt-7 grid gap-3 border-t border-[#e7ebe7] pt-6 sm:grid-cols-3"><Detail label="Exchange" value={instrument.exchange} /><Detail label="Sector" value={instrument.instrumentType === 'ETF' ? 'Funds' : instrument.sector || 'Not classified'} /><Detail label="SEC CIK" value={instrument.cik || 'Not available'} /></div>
    </section>

      <nav className="mb-6 mt-6 flex overflow-x-auto border-b border-[#dfe4df]" aria-label="Instrument details">
        {([['financials', 'Financials'], ['dividends', 'Dividend history'], ['ratios', 'Ratios'], ['splits', 'Split history']] as const).map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`relative min-w-max px-4 py-4 text-sm font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition ${activeTab === key ? 'text-[#173c2c] after:bg-[#285d43] dark:text-[#b8e2c9]' : 'text-[#78837c] after:bg-transparent hover:bg-[#f7f9f7] hover:text-[#285d43]'}`} aria-current={activeTab === key ? 'page' : undefined}>{label}</button>)}
      </nav>

    {activeTab === 'dividends' && <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e5e9e5] p-5 sm:flex-row sm:items-center md:px-7"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Dividend history</h2><p className="mt-1 text-sm text-[#7a857e]">Latest 15 calendar years · split-adjusted distributions</p></div><Segmented values={['ANNUAL', paysMonthlyDividends ? 'MONTHLY' : 'QUARTERLY']} active={effectiveDividendPeriod} onChange={(value) => setDividendPeriod(value as DividendPeriod)} /></div>
      {marketLoading ? <div className="h-72 animate-pulse bg-[#f7f9f7]" /> : displayedDividends.length ? <><DividendHistoryChart data={dividendChartData} currency={displayedDividends[0]?.currency ?? 'USD'} period={effectiveDividendPeriod} /><div className="overflow-x-auto border-t border-[#e5e9e5]"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-[.12em] text-[#849088]"><tr><th className="px-6 py-3">Ex-dividend</th><th className="px-4 py-3">Pay date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Frequency</th><th className="px-4 py-3 text-right">Reported</th><th className="px-6 py-3 text-right">Split-adjusted</th></tr></thead><tbody>{displayedDividends.map((event) => <tr key={`${event.exDividendDate}-${event.cashAmount}`} className="border-t border-[#ecefec] hover:bg-[#fafcf9] dark:hover:bg-[#1a2520]"><td className="px-6 py-4 text-sm font-semibold">{event.exDividendDate}</td><td className="px-4 py-4 text-sm text-[#6f7b74]">{event.payDate ?? '—'}</td><td className="px-4 py-4 text-sm">{event.dividendType ? humanize(event.dividendType.toLowerCase()) : 'Cash'}</td><td className="px-4 py-4 text-sm text-[#6f7b74]">{frequencyLabel(event.frequency)}</td><td className="px-4 py-4 text-right text-sm tabular-nums text-[#6f7b74]">{formatMoney(event.cashAmount, event.currency)}</td><td className="px-6 py-4 text-right text-sm font-bold tabular-nums">{formatMoney(event.splitAdjustedCashAmount ?? event.cashAmount, event.currency)}</td></tr>)}</tbody></table></div></> : <div className="px-6 py-10 text-center"><p className="font-semibold">No dividend events found</p><p className="mt-1 text-sm text-[#7a857e]">This instrument may not pay a dividend, or its history has not been synchronized.</p></div>}
    </section>}

    {activeTab === 'splits' && <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
      <div className="border-b border-[#e5e9e5] p-5 md:px-7"><h2 className="text-xl font-semibold tracking-[-.025em]">Split history</h2><p className="mt-1 text-sm text-[#7a857e]">Corporate actions used to adjust portfolio quantities and average cost</p></div>
      {marketLoading ? <div className="h-32 animate-pulse bg-[#f7f9f7]" /> : splits.length ? <div className="divide-y divide-[#ecefec]">{splits.map((split) => <div key={split.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm font-semibold">{humanize(split.adjustmentType)}</p><p className="mt-1 text-xs text-[#7a857e]">Effective {split.executionDate}</p></div><span className="rounded-xl bg-[#edf3ee] px-3 py-2 text-sm font-bold tabular-nums">{split.splitTo}:{split.splitFrom}</span></div>)}</div> : <div className="px-6 py-9 text-center text-sm text-[#7a857e]">No stock splits found.</div>}
    </section>}

    {(activeTab === 'ratios' || activeTab === 'financials') && instrument.instrumentType === 'ETF' ? <section className="rounded-[22px] border border-[#dce2dd] bg-[#eef4ef] p-7"><h2 className="text-lg font-semibold">ETF analytics are coming next</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#69756d]">SEC company financial statements do not apply to ETFs. Fund holdings, expense ratio, AUM, and NAV require a separate fund-data provider.</p></section> : <>
      {activeTab === 'ratios' && <section className="rounded-[22px] border border-[#dfe4df] bg-white p-5 md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Financial ratios</h2><p className="mt-1 text-sm text-[#7a857e]">Calculated from synchronized SEC filings</p></div><Segmented values={['TTM', 'ANNUAL', 'QUARTERLY']} active={basis} onChange={changeBasis} /></div>
        {ratiosLoading ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[#f1f3f1]" />)}</div> : ratios && Object.keys(ratios.ratios).length ? <><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(ratios.ratios).map(([key, value]) => <div key={key} className="rounded-2xl border border-[#e3e7e3] bg-[#fafbf9] p-4"><p className="text-xs font-semibold text-[#78837c]">{humanize(key)}</p><p className="mt-2 text-xl font-semibold tracking-[-.03em]">{formatRatio(key, value)}</p></div>)}</div><p className="mt-4 text-xs text-[#89928c]">As of {ratios.asOfDate}</p></> : <FinancialEmpty message={ratiosMessage} />}
      </section>}

      {activeTab === 'financials' && <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-[#e5e9e5] p-5 sm:flex-row sm:items-center md:px-7"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Financial history</h2><p className="mt-1 text-sm text-[#7a857e]">Latest 10 fiscal years from synchronized SEC filings</p></div><Segmented values={['ANNUAL', 'QUARTERLY']} active={period} onChange={changePeriod} /></div>
        {factsMessage && financialTable.metricCount > 0 && <div role="alert" className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">{factsMessage}</div>}
        {financialTable.metricCount > 0 ? <div className={`relative transition-opacity ${factsLoading ? 'opacity-55' : 'opacity-100'}`} aria-busy={factsLoading}>{financialTable.groups.map((group) => <FinancialStatementTable key={group.key} title={group.title} description={group.description} metrics={group.metrics} periods={financialTable.periods} factMap={financialTable.factMap} />)}</div> : factsLoading ? <div className="h-72 animate-pulse bg-[#f7f9f7]" aria-label="Loading financial history" /> : <FinancialEmpty message={factsMessage} />}
      </section>}
    </>}
  </main>
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
    <div className="mb-3 flex flex-wrap items-center gap-5 text-[11px] font-semibold text-[#718078]"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#3b91bc]" />Dividend per share</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-amber-500" />Year-over-year change</span></div>
    <div className="overflow-x-auto"><div className="relative" style={{ width: `${width}px`, height: `${height}px` }}><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${period === 'ANNUAL' ? 'Annual' : period === 'MONTHLY' ? 'Monthly' : 'Quarterly'} dividend history and year-over-year change`} className="max-w-none">
      {[0, .25, .5, .75, 1].map((ratio) => { const y = top + plotHeight * (1 - ratio); return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-[#e5eae6] dark:stroke-[#344139]" strokeDasharray={ratio ? '3 4' : undefined} /><text x={left - 9} y={y + 4} textAnchor="end" className="fill-[#7b867f] text-[10px]">{compactCurrency(maximumAmount * ratio)}</text></g> })}
      {data.map((point, index) => { const center = x(index); const barHeight = point.amount / maximumAmount * plotHeight; return <g key={point.key}><rect x={center - barWidth / 2} y={baseline - barHeight} width={barWidth} height={barHeight} rx="4" className={`fill-[#3b91bc] transition-opacity dark:fill-[#55a9d2] ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-45' : ''}`} /><text x={center} y={baseline + 20} textAnchor="middle" className="fill-[#758179] text-[10px]">{point.label}</text></g> })}
      {data.slice(1).map((point, index) => { const previous = data[index]; return previous.change != null && point.change != null ? <line key={`${previous.key}-${point.key}`} x1={x(index)} y1={changeY(previous.change)} x2={x(index + 1)} y2={changeY(point.change)} className="stroke-amber-500" strokeWidth="2.5" /> : null })}
      {data.map((point, index) => point.change == null ? null : <circle key={`${point.key}-change`} cx={x(index)} cy={changeY(point.change)} r={hoveredIndex === index ? 6 : 4} className="fill-amber-500 stroke-white transition-all dark:stroke-[#141d19]" strokeWidth="2" />)}
      <text x={width - right + 10} y={top + 4} className="fill-amber-600 text-[10px]">{maximumChange.toFixed(1)}%</text><text x={width - right + 10} y={baseline + 4} className="fill-amber-600 text-[10px]">{minimumChange.toFixed(1)}%</text>
    </svg>{data.map((point, index) => <button key={`${point.key}-target`} type="button" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} className="absolute top-7 z-10 bg-transparent outline-none" style={{ left: `${left + slotWidth * index}px`, width: `${slotWidth}px`, height: `${plotHeight}px` }} aria-label={`${point.label}, dividend ${formatMoney(point.amount, currency)}, year-over-year change ${point.change == null ? 'not available' : `${point.change.toFixed(1)} percent`}`} />)}{hoveredIndex !== null && (() => { const point = data[hoveredIndex]; const tooltipLeft = Math.max(8, Math.min(x(hoveredIndex) - 88, width - 184)); return <div className="pointer-events-none absolute top-9 z-20 w-44 rounded-xl bg-[#15231d] p-3 text-white shadow-[0_12px_32px_rgba(20,35,29,.3)]" style={{ left: `${tooltipLeft}px` }}><p className="border-b border-white/15 pb-2 text-xs font-bold">{point.label}</p><div className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-white/65">Dividend</span><strong>{formatMoney(point.amount, currency)}</strong></div><div className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-white/65">YoY change</span><strong className={point.change == null ? 'text-white/55' : point.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{point.change == null ? 'Not available' : `${point.change >= 0 ? '+' : ''}${point.change.toFixed(1)}%`}</strong></div></div> })()}</div></div>
    <p className="mt-2 text-[11px] text-[#849088]">{period === 'ANNUAL' ? 'Completed years use full-year change; the current year compares YTD dividends with the same prior-year dates.' : period === 'MONTHLY' ? 'Each month compares with the same month one year earlier; the current month uses matching MTD dates.' : 'Completed quarters compare with the same prior-year quarter; the current quarter uses matching QTD dates.'}</p>
  </div>
}

function Detail({ label, value }: { label: string, value: string }) {
  return <div className="rounded-xl bg-[#f7f9f6] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#87918b]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}

function formatMoney(value: number, currency: string) { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 4 }).format(value) }
function formatOptionalMoney(value: number | null, currency: string) { return value == null ? '—' : formatMoney(value, currency) }
function frequencyLabel(value: number | null) { return value === 12 ? 'Monthly' : value === 4 ? 'Quarterly' : value === 2 ? 'Semiannual' : value === 1 ? 'Annual' : value ? `${value}× yearly` : '—' }
function QuoteDetail({ label, value, emphasis = false }: { label: string, value: string, emphasis?: boolean }) { return <div className="rounded-xl bg-[#f7f9f6] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#87918b]">{label}</p><p className={`mt-1 font-semibold tabular-nums ${emphasis ? 'text-lg tracking-[-.02em]' : 'text-sm'}`}>{value}</p></div> }

function Segmented({ values, active, onChange }: { values: string[], active: string, onChange: (value: string) => void }) {
  return <div className="flex rounded-xl bg-[#eef1ee] p-1">{values.map((value) => <button key={value} onClick={() => onChange(value)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${active === value ? 'bg-white text-[#173c2c] shadow-sm' : 'text-[#748078]'}`}>{value}</button>)}</div>
}

function FinancialStatementTable({ title, description, metrics, periods, factMap }: { title: string, description: string, metrics: string[], periods: FinancialPeriodColumn[], factMap: Map<string, Map<string, FinancialFact>> }) {
  return <section className="border-b border-[#e5e9e5] last:border-b-0"><div className="bg-[#f7f9f7] px-7 py-4"><h3 className="text-sm font-bold tracking-[-.01em]">{title}</h3><p className="mt-1 text-xs text-[#7a857e]">{description}</p></div><div className="overflow-x-auto"><table className="text-left" style={{ minWidth: `${240 + periods.length * 132}px`, width: '100%' }}><thead className="bg-[#fafbf9] text-[10px] uppercase tracking-[.1em] text-[#849088]"><tr><th className="sticky left-0 z-10 min-w-60 border-r border-[#e4e8e4] bg-[#fafbf9] px-7 py-3 font-bold">Metric</th>{periods.map((item) => <th key={item.key} className="min-w-33 px-4 py-3 text-right font-bold"><span className="block text-[#59675f]">{item.label}</span><span className="mt-1 block text-[9px] font-medium normal-case tracking-normal text-[#9aa39d]">{item.periodEnd}</span></th>)}</tr></thead><tbody>{metrics.map((metric, rowIndex) => <tr key={metric} className="border-t border-[#ecefec] hover:bg-[#fafcf9] dark:hover:bg-[#1a2520]"><FinancialMetricCell label={metricLabels[metric] ?? humanize(metric)} periods={periods} factsByPeriod={factMap.get(metric)} rowIndex={rowIndex} rowCount={metrics.length} />{periods.map((item) => { const fact = factMap.get(metric)?.get(item.key); return <td key={item.key} className="px-4 py-4 text-right text-sm font-bold tabular-nums whitespace-nowrap">{fact ? formatFact(fact.value, fact.unit) : <span className="font-normal text-[#b0b7b2]">—</span>}</td> })}</tr>)}</tbody></table></div></section>
}

function FinancialMetricCell({ label, periods, factsByPeriod, rowIndex, rowCount }: { label: string, periods: FinancialPeriodColumn[], factsByPeriod?: Map<string, FinancialFact>, rowIndex: number, rowCount: number }) {
  const available = periods.flatMap((item) => {
    const fact = factsByPeriod?.get(item.key)
    return fact ? [{ period: item, fact }] : []
  })
  const latest = available[0]
  const previous = available[1]
  const change = latest && previous ? latest.fact.value - previous.fact.value : null
  const percentChange = change !== null && previous.fact.value !== 0 ? change / Math.abs(previous.fact.value) * 100 : null
  const positive = change === null || change >= 0
  const chartValues = [...available].reverse().map((item) => item.fact.value)
  const minimum = Math.min(0, ...chartValues)
  const maximum = Math.max(0, ...chartValues)
  const range = maximum - minimum || 1
  const baseline = 8 + maximum / range * 40
  const gap = 4
  const barWidth = Math.min(24, (180 - gap * Math.max(chartValues.length - 1, 0)) / Math.max(chartValues.length, 1))
  const chartWidth = barWidth * chartValues.length + gap * Math.max(chartValues.length - 1, 0)
  const chartStart = (180 - chartWidth) / 2
  const popupPosition = rowIndex < 3 ? 'top-0' : rowIndex >= rowCount - 3 ? 'bottom-0' : 'top-1/2 -translate-y-1/2'

  return <th className="group sticky left-0 z-20 border-r border-[#e4e8e4] bg-white px-7 py-4 text-sm font-semibold whitespace-nowrap dark:bg-[#141d19] dark:text-[#e8eee9]">
    <button className="flex items-center gap-2 text-left outline-none" aria-label={`Show trend for ${label}`}>
      <span>{label}</span>
      <svg className="size-3.5 text-[#718078] opacity-45 transition group-hover:opacity-100 group-focus-within:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>
    </button>
    <span className={`pointer-events-none absolute left-[calc(100%-12px)] z-40 hidden w-68 rounded-2xl border border-[#dce3dd] bg-white p-4 text-left text-[#15231d] whitespace-normal shadow-[0_16px_45px_rgba(20,38,29,.16)] group-hover:block group-focus-within:block dark:border-[#35463d] dark:bg-[#18231e] dark:text-[#e8eee9] dark:shadow-[0_18px_50px_rgba(0,0,0,.5)] ${popupPosition}`}>
      <span className="flex items-start justify-between gap-3"><span><span className="block text-[11px] font-bold uppercase tracking-[.1em] text-[#7c8780]">{label} trend</span>{latest && <span className="mt-1 block text-xs font-normal text-[#929b95]">{available.length} reported periods</span>}</span>{latest && <span className={`rounded-md px-2 py-1 text-xs font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{percentChange === null ? '—' : `${positive ? '+' : ''}${percentChange.toFixed(1)}%`}</span>}</span>
      {chartValues.length > 1 ? <svg viewBox="0 0 180 56" className={`mt-3 h-14 w-full ${positive ? 'text-emerald-500' : 'text-rose-500'}`} preserveAspectRatio="none"><line className="stroke-[#dfe5e0] dark:stroke-[#405148]" x1="0" y1={baseline} x2="180" y2={baseline} strokeWidth="1" />{chartValues.map((value, index) => { const height = Math.max(Math.abs(value) / range * 40, 1); const y = value >= 0 ? baseline - height : baseline; return <rect key={`${index}-${value}`} x={chartStart + index * (barWidth + gap)} y={y} width={barWidth} height={height} rx="2" fill="currentColor" opacity={index === chartValues.length - 1 ? 1 : .48 + index / chartValues.length * .35} /> })}</svg> : <span className="mt-4 block rounded-xl bg-[#f5f7f5] px-3 py-4 text-center text-xs font-normal text-[#7d8881]">More periods are needed to calculate a trend.</span>}
      {latest && <span className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e7ebe7] pt-3"><span><span className="block text-[10px] font-medium text-[#929b95]">Latest · {latest.period.label}</span><span className="mt-1 block text-sm font-bold">{formatFact(latest.fact.value, latest.fact.unit)}</span></span><span><span className="block text-[10px] font-medium text-[#929b95]">Period change</span><span className={`mt-1 block text-sm font-bold ${change === null ? 'text-[#7d8881]' : positive ? 'text-emerald-700' : 'text-rose-600'}`}>{change === null ? '—' : `${positive ? '+' : ''}${formatFact(change, latest.fact.unit)}`}</span></span></span>}
    </span>
  </th>
}

function FinancialEmpty({ message }: { message: string }) {
  return <div className="m-6 rounded-2xl border border-dashed border-[#cfd7d1] bg-[#fafbf9] px-5 py-9 text-center"><p className="font-semibold">Financial data is not available yet</p><p className="mx-auto mt-1 max-w-xl text-sm text-[#7a857e]">{message || 'Synchronize this company’s SEC filings through the API to populate ratios and financial statements.'}</p></div>
}

export default InstrumentPage
