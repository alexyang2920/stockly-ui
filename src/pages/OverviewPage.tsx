import { useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { getDividendCalendar, getHoldings, getPortfolioPerformance, getPortfolios } from '../api/portfolios'
import type { AuthResponse } from '../types/auth'
import type { Holding, Portfolio } from '../types/portfolio'
import InstrumentMark from '../components/InstrumentMark'

const colors = ['#38a8a1', '#4d88d8', '#8b5cf6', '#e8a63a', '#e56f6f', '#6f9e5d', '#9b7b66']
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const money = (value: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const holdingGroup = (holding: Holding) => holding.instrumentType === 'ETF' ? 'Funds' : holding.sector || 'Not classified'

function OverviewPage({ auth, portfolioId, onNeedAuth, onOpenHoldings, onOpenDividends, onSelectInstrument }: { auth: AuthResponse | null, portfolioId?: string, onNeedAuth: () => void, onOpenHoldings: () => void, onOpenDividends: () => void, onSelectInstrument: (symbol: string) => void }) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [realizedGain, setRealizedGain] = useState(0)
  const [annualIncome, setAnnualIncome] = useState(0)
  const [loading, setLoading] = useState(Boolean(auth))
  const [error, setError] = useState('')
  const [selectedAllocation, setSelectedAllocation] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getPortfolios(auth, controller.signal).then(async (portfolios) => {
      const selected = portfolios.find((item) => item.id === portfolioId) ?? portfolios[0] ?? null
      setPortfolio(selected)
      setSelectedAllocation(null)
      if (!selected) return
      const now = new Date()
      const [holdingData, performance, dividends] = await Promise.all([
        getHoldings(auth, selected.id, controller.signal),
        getPortfolioPerformance(auth, selected.id, controller.signal),
        getDividendCalendar(auth, selected.id, dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), dateKey(new Date(now.getFullYear(), now.getMonth() + 12, 0)), controller.signal),
      ])
      setHoldings(holdingData); setRealizedGain(performance.realizedGain); setAnnualIncome(dividends.reduce((sum, event) => sum + event.projectedAmount, 0))
    }).catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(apiErrorMessage(reason, 'Unable to load the portfolio overview.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, portfolioId])

  const totals = holdings.reduce((sum, holding) => ({ invested: sum.invested + holding.costBasis, value: sum.value + (holding.marketValue ?? 0), unrealized: sum.unrealized + (holding.unrealizedGain ?? 0), quoted: sum.quoted + (holding.marketValue == null ? 0 : 1) }), { invested: 0, value: 0, unrealized: 0, quoted: 0 })
  const allocations = useMemo(() => {
    const grouped = new Map<string, { value: number, invested: number, holdings: number }>()
    holdings.forEach((holding) => { const key = holdingGroup(holding); const current = grouped.get(key) ?? { value: 0, invested: 0, holdings: 0 }; current.value += holding.marketValue ?? holding.costBasis; current.invested += holding.costBasis; current.holdings++; grouped.set(key, current) })
    return [...grouped.entries()].map(([name, values]) => ({ name, ...values, percent: (totals.value || totals.invested) ? values.value / (totals.value || totals.invested) * 100 : 0 })).sort((a, b) => b.value - a.value)
  }, [holdings, totals.invested, totals.value])
  const gradient = allocations.length ? `conic-gradient(${allocations.map((_, index) => `${colors[index % colors.length]} ${allocations.slice(0, index).reduce((sum, value) => sum + value.percent, 0)}% ${allocations.slice(0, index + 1).reduce((sum, value) => sum + value.percent, 0)}%`).join(',')})` : '#e5e9e5'
  const totalProfit = totals.unrealized + realizedGain
  const concentration = allocations[0]

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#dfe4df] bg-white px-7 py-16 text-center"><h1 className="text-2xl font-semibold">Your portfolio overview</h1><p className="mt-2 text-sm text-[#77837b]">Sign in to see performance, passive income, and allocation insights.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white">Sign in to continue</button></section></main>
  if (loading) return <main className="mx-auto max-w-[1560px] px-5 py-10 lg:px-8"><div className="h-[560px] animate-pulse rounded-[24px] bg-white" /></main>

  return <main className="mx-auto max-w-[1560px] px-5 py-8 lg:px-8 lg:py-11"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Portfolio overview</p><h1 className="mt-2 text-[36px] font-semibold tracking-[-.045em] md:text-[46px]">{portfolio?.name ?? 'Overview'}</h1><p className="mt-2 text-sm text-[#738078]">Performance, income, and diversification in one place.</p></div>{error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{!portfolio ? <div className="rounded-[22px] border border-dashed border-[#cfd7d1] bg-white py-20 text-center"><h2 className="text-xl font-semibold">Create your first portfolio</h2></div> : <>
    <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Portfolio value" value={totals.quoted ? money(totals.value, portfolio.currency) : '—'} note={`${money(totals.invested, portfolio.currency)} invested`} color="bg-sky-100 text-sky-700">▣</Metric><Metric label="Total profit" value={money(totalProfit, portfolio.currency)} note={`${money(realizedGain, portfolio.currency)} realized`} positive={totalProfit >= 0} color="bg-emerald-100 text-emerald-700">↗</Metric><Metric label="Unrealized gain" value={totals.quoted ? money(totals.unrealized, portfolio.currency) : '—'} note={`${totals.quoted} of ${holdings.length} positions quoted`} positive={totals.unrealized >= 0} color="bg-violet-100 text-violet-700">⌁</Metric><button onClick={onOpenDividends} className="rounded-[20px] border border-[#dfe4df] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#859088]">Passive income</p><p className="mt-2 text-2xl font-semibold tracking-[-.035em]">{money(annualIncome, portfolio.currency)}</p><p className="mt-2 text-xs text-[#7b867f]">Estimated over the next 12 months →</p></button></section>
    {concentration && concentration.percent >= 40 && <section className="mb-5 flex flex-col justify-between gap-4 rounded-[20px] border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/70 dark:bg-amber-950/55 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-amber-700 dark:text-amber-300">Diversification insight</p><h2 className="mt-1 font-semibold text-amber-950 dark:text-amber-100">{concentration.name} represents {concentration.percent.toFixed(1)}% of this portfolio</h2><p className="mt-1 text-xs text-[#7b867f] dark:text-amber-200/75">A concentrated allocation can make performance more sensitive to one part of the market.</p></div><button onClick={onOpenHoldings} className="shrink-0 rounded-xl bg-[#173c2c] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#205139] dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200">Review holdings</button></section>}
    <section className="grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]"><div className="rounded-[22px] border border-[#dfe4df] bg-white p-6"><h2 className="font-semibold">Sector allocation</h2><div className="mx-auto mt-7 grid size-56 place-items-center rounded-full" style={{ background: gradient }}><div className="grid size-32 place-items-center rounded-full bg-white text-center"><div><strong className="block text-xl">{holdings.length}</strong><span className="text-[10px] text-[#7b867f]">holdings</span></div></div></div></div><AllocationPanel allocations={allocations} holdings={holdings} selected={selectedAllocation} currency={portfolio.currency} onSelect={setSelectedAllocation} onSelectInstrument={onSelectInstrument} /></section>
  </>}</main>
}

function Metric({ label, value, note, positive, color, children }: { label: string, value: string, note: string, positive?: boolean, color: string, children: string }) { return <div className="rounded-[20px] border border-[#dfe4df] bg-white p-5"><div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-lg text-xs ${color}`}>{children}</span><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#859088]">{label}</p></div><p className={`mt-3 text-2xl font-semibold tracking-[-.035em] ${positive === undefined ? '' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>{value}</p><p className="mt-2 text-xs text-[#7b867f]">{note}</p></div> }

function AllocationPanel({ allocations, holdings, selected, currency, onSelect, onSelectInstrument }: { allocations: { name: string, value: number, invested: number, holdings: number, percent: number }[], holdings: Holding[], selected: string | null, currency: string, onSelect: (name: string | null) => void, onSelectInstrument: (symbol: string) => void }) {
  const selectedHoldings = selected ? holdings.filter((holding) => holdingGroup(holding) === selected) : []
  return <div className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white"><div className="flex items-center gap-3 border-b border-[#e5e9e5] px-5 py-5">{selected && <button onClick={() => onSelect(null)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#dfe4df] hover:bg-[#f3f5f2]" aria-label="Back to portfolio sectors">←</button>}<div><h2 className="font-semibold">{selected ?? 'Portfolio sectors'}</h2><p className="mt-1 text-xs text-[#7b867f]">{selected ? `${selectedHoldings.length} holding${selectedHoldings.length === 1 ? '' : 's'} in this sector` : 'Select a sector to see its holdings'}</p></div></div>{selected ? <div className="divide-y divide-[#e8ece8]">{selectedHoldings.map((holding) => <button key={holding.symbol} onClick={() => onSelectInstrument(holding.symbol)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left hover:bg-[#fafcf9] sm:grid-cols-[minmax(0,1fr)_120px_100px]"><div className="flex min-w-0 items-center gap-3"><InstrumentMark symbol={holding.symbol} size="small" /><span className="min-w-0"><strong className="block text-sm">{holding.symbol}</strong><small className="block truncate text-[10px] text-[#7b867f]">{holding.name}</small></span></div><span className="hidden text-right text-sm font-semibold sm:block">{money(holding.marketValue ?? holding.costBasis, currency)}</span><span className={`text-right text-sm font-bold ${(holding.unrealizedGain ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{holding.unrealizedGain == null ? '—' : money(holding.unrealizedGain, currency)}</span></button>)}</div> : <div className="divide-y divide-[#e8ece8]">{allocations.map((item, index) => <button key={item.name} onClick={() => onSelect(item.name)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left hover:bg-[#fafcf9] sm:grid-cols-[minmax(0,1fr)_120px_90px]"><div className="flex min-w-0 items-center gap-3"><span className="size-3 shrink-0 rounded-sm" style={{ background: colors[index % colors.length] }} /><span><strong className="block truncate text-sm">{item.name}</strong><small className="text-[10px] text-[#7b867f]">{item.holdings} holding{item.holdings === 1 ? '' : 's'}</small></span></div><span className="hidden text-right text-sm font-semibold sm:block">{money(item.value, currency)}</span><span className="flex items-center justify-end gap-2 text-sm font-bold">{item.percent.toFixed(1)}% <i className="text-[#87918b]">›</i></span></button>)}</div>}</div>
}

export default OverviewPage
