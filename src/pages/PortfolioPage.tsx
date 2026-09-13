import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { apiErrorMessage } from '../api/client'
import { searchInstruments } from '../api/instruments'
import { createTransaction, deleteTransaction, getHoldings, getPortfolios, getTransactions, importFidelityActivity, updateTransaction } from '../api/portfolios'
import InstrumentMark from '../components/InstrumentMark'
import { formatLocalDateTime, toLocalDateTimeInput } from '../utils/date'
import type { AuthResponse } from '../types/auth'
import type { Instrument } from '../types/instrument'
import type { FidelityImportResult, Holding, Portfolio, PortfolioTransaction, TransactionInput, TransactionType } from '../types/portfolio'

type PortfolioPageProps = {
  auth: AuthResponse | null
  section: 'holdings' | 'transactions'
  requestedPortfolioId?: string
  onNeedAuth: () => void
  onSelectInstrument: (symbol: string) => void
  startWithTransaction?: boolean
}

const transactionTypes: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL']

type HoldingSortKey = 'instrument' | 'quantity' | 'averageCost' | 'marketPrice' | 'marketValue' | 'unrealizedGain' | 'realizedGain'
type SortDirection = 'asc' | 'desc'

function Icon({ children, className = 'size-5' }: { children: ReactNode, className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function quantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value)
}

const shortDate = formatLocalDateTime

function useDebouncedValue(value: string, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debouncedValue
}

function SortableHoldingHeader({ label, sortKey, activeSort, onSort, className = 'px-4' }: { label: string, sortKey: HoldingSortKey, activeSort: { key: HoldingSortKey, direction: SortDirection }, onSort: (key: HoldingSortKey) => void, className?: string }) {
  const active = activeSort.key === sortKey
  const directionLabel = activeSort.direction === 'asc' ? 'ascending' : 'descending'
  return <th className={`${className} py-3 ${sortKey === 'instrument' ? 'text-left' : 'text-right'}`} aria-sort={active ? directionLabel : 'none'}><button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 rounded py-1 hover:text-[#0b5b9e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3077b4]" aria-label={`Sort by ${label}${active ? `, currently ${directionLabel}` : ''}`}>{label}<span className={`text-[11px] ${active ? 'text-[#0b5b9e]' : 'text-[#b1bab4]'}`} aria-hidden="true">{active ? activeSort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>
}

function PortfolioPage({ auth, section, requestedPortfolioId, onNeedAuth, onSelectInstrument, startWithTransaction = false }: PortfolioPageProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [loading, setLoading] = useState(Boolean(auth))
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTransaction, setShowTransaction] = useState(startWithTransaction)
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PortfolioTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showFidelityImport, setShowFidelityImport] = useState(false)
  const [holdingSort, setHoldingSort] = useState<{ key: HoldingSortKey, direction: SortDirection }>({ key: 'marketValue', direction: 'desc' })
  const [holdingSearch, setHoldingSearch] = useState('')
  const debouncedSymbolFilter = useDebouncedValue(symbolFilter)

  const selected = portfolios.find((portfolio) => portfolio.id === selectedId)

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getPortfolios(auth, controller.signal)
      .then((data) => {
        setPortfolios(data)
        setSelectedId(data.some((portfolio) => portfolio.id === requestedPortfolioId) ? requestedPortfolioId! : data[0]?.id || '')
      })
      .catch((reason: unknown) => setError(apiErrorMessage(reason, 'Unable to load your portfolios.')))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, requestedPortfolioId])

  const loadDetails = useCallback((signal?: AbortSignal) => {
    if (!auth || !selectedId) return Promise.resolve()
    return Promise.all([
      getHoldings(auth, selectedId, signal),
      getTransactions(auth, selectedId, { symbol: debouncedSymbolFilter.trim().toUpperCase(), type: typeFilter, from: fromFilter, to: toFilter, page, size: 20 }, signal),
    ]).then(([holdingData, transactionData]) => {
      setHoldings(holdingData)
      setTransactions(transactionData.content)
      setTotalTransactions(transactionData.totalElements)
      setTotalPages(transactionData.totalPages)
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(apiErrorMessage(reason, 'Unable to load portfolio details.'))
    }).finally(() => { if (!signal?.aborted) setDetailsLoading(false) })
  }, [auth, debouncedSymbolFilter, fromFilter, page, selectedId, toFilter, typeFilter])

  useEffect(() => {
    const controller = new AbortController()
    void loadDetails(controller.signal)
    return () => controller.abort()
  }, [loadDetails])

  const totals = useMemo(() => holdings.reduce((result, holding) => ({
    costBasis: result.costBasis + holding.costBasis,
    realizedGain: result.realizedGain + holding.realizedGain,
    marketValue: result.marketValue + (holding.marketValue ?? 0),
    unrealizedGain: result.unrealizedGain + (holding.unrealizedGain ?? 0),
    quotedPositions: result.quotedPositions + (holding.marketValue == null ? 0 : 1),
  }), { costBasis: 0, realizedGain: 0, marketValue: 0, unrealizedGain: 0, quotedPositions: 0 }), [holdings])

  const sortedHoldings = useMemo(() => [...holdings].sort((left, right) => {
    const values: Record<HoldingSortKey, [string | number | null, string | number | null]> = {
      instrument: [left.symbol, right.symbol],
      quantity: [left.quantity, right.quantity],
      averageCost: [left.averageCost, right.averageCost],
      marketPrice: [left.marketPrice, right.marketPrice],
      marketValue: [left.marketValue, right.marketValue],
      unrealizedGain: [left.unrealizedGain, right.unrealizedGain],
      realizedGain: [left.realizedGain, right.realizedGain],
    }
    const [leftValue, rightValue] = values[holdingSort.key]
    if (leftValue == null) return rightValue == null ? left.symbol.localeCompare(right.symbol) : 1
    if (rightValue == null) return -1
    const comparison = typeof leftValue === 'string'
      ? leftValue.localeCompare(String(rightValue))
      : leftValue - Number(rightValue)
    return (holdingSort.direction === 'asc' ? comparison : -comparison) || left.symbol.localeCompare(right.symbol)
  }), [holdings, holdingSort])

  const visibleHoldings = useMemo(() => {
    const query = holdingSearch.trim().toLowerCase()
    if (!query) return sortedHoldings
    return sortedHoldings.filter((holding) => holding.symbol.toLowerCase().includes(query) || holding.name.toLowerCase().includes(query))
  }, [holdingSearch, sortedHoldings])

  const sortHoldings = (key: HoldingSortKey) => {
    setHoldingSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'instrument' ? 'asc' : 'desc' })
  }

  const removeTransaction = async () => {
    if (!auth || !selected || !deleteTarget) return
    try {
      setDeleting(true)
      setDetailsLoading(true)
      await deleteTransaction(auth, selected.id, deleteTarget.id)
      setDeleteTarget(null)
      await loadDetails()
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Unable to delete transaction.'))
    } finally {
      setDeleting(false)
    }
  }

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16 lg:px-8"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4effb] text-[#0b5b9e]"><Icon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></Icon></span><h1 className="mt-5 text-2xl font-semibold tracking-[-.03em]">Your investments belong to you</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#536d86]">Sign in to create portfolios, record transactions, and track your cost basis.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#0b3b66] px-5 py-3 text-sm font-bold text-white">Sign in to continue</button></section></main>

  return <main className="page-shell">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="page-eyebrow">Investment ledger</p><h1 className="page-title">{section === 'holdings' ? 'Holdings' : 'Transactions'}</h1><p className="page-description">{section === 'holdings' ? 'Positions calculated directly from your transaction history.' : 'Review and maintain the complete investment ledger.'}</p></div>
      {selected && <div className="flex w-full flex-col gap-2 self-start sm:w-auto sm:flex-row md:self-auto">{section === 'transactions' && <button onClick={() => setShowFidelityImport(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cfd8d1] bg-white px-4 py-3 text-sm font-bold text-[#284536] hover:bg-[#eef4fb] sm:w-auto"><Icon className="size-4"><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></Icon>Import Fidelity CSV</button>}<button onClick={() => { setEditing(null); setShowTransaction(true) }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] px-4 py-3 text-sm font-bold text-[#162b45] hover:bg-[#22b4ee] sm:w-auto"><Icon className="size-4"><path d="M12 5v14M5 12h14" /></Icon>Add transaction</button></div>}
    </div>

    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

    {loading ? <div className="h-72 animate-pulse rounded-[22px] bg-white" /> : portfolios.length === 0 ? <div className="rounded-[22px] border border-dashed border-[#b9cce0] bg-white py-20 text-center"><h2 className="text-xl font-semibold">Create your first portfolio</h2><p className="mt-2 text-sm text-[#526b84]">Use the + beside the portfolio selector in the top menu.</p></div> : <>
      {section === 'holdings' && <>
      <section className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#c4d5e8] bg-white px-4 py-3 text-sm shadow-sm sm:px-5">
        <span className="font-semibold text-[#0d243d]">{selected?.name}</span>
        <span className="hidden h-4 w-px bg-[#dbe6f2] sm:block" />
        <span className="text-[#526b84]">{holdings.length} open position{holdings.length === 1 ? '' : 's'}</span>
        <span className="hidden h-4 w-px bg-[#dbe6f2] sm:block" />
        <span className="text-[#526b84]">Market value <strong className="ml-1 tabular-nums text-[#0d243d]">{totals.quotedPositions ? money(totals.marketValue, selected?.currency) : '—'}</strong></span>
        <span className="hidden h-4 w-px bg-[#dbe6f2] sm:block" />
        <span className="text-[#526b84]">Unrealized <strong className={`ml-1 tabular-nums ${totals.unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{totals.quotedPositions ? `${totals.unrealizedGain >= 0 ? '+' : ''}${money(totals.unrealizedGain, selected?.currency)}` : '—'}</strong></span>
      </section>

      <section className="surface-card surface-card--flush mb-5">
        <div className="flex flex-col gap-3 border-b border-[#dbe6f2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6"><div><h2 className="text-lg font-semibold tracking-[-.02em]">Holdings</h2><p className="mt-1 text-xs text-[#526b84]">Latest server-synchronized prices · weighted-average cost</p></div><input value={holdingSearch} onChange={(event) => setHoldingSearch(event.target.value)} className="rounded-xl border border-[#c4d5e8] bg-[#f9fbff] px-3 py-2.5 text-sm outline-none focus:border-[#3077b4]" placeholder="Search holdings" aria-label="Search holdings by symbol or company" /></div>
        {detailsLoading && !holdings.length ? <div className="h-44 animate-pulse bg-[#f4f8fd]" /> : holdings.length === 0 ? <EmptyState title="No open positions" text="Add a BUY transaction to begin building this portfolio." /> : visibleHoldings.length === 0 ? <EmptyState title="No matching holdings" text="Try a different ticker or company name." /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#f9fbff] text-[10px] font-bold uppercase tracking-[.12em] text-[#5d768f]"><tr><SortableHoldingHeader label="Instrument" sortKey="instrument" activeSort={holdingSort} onSort={sortHoldings} className="px-6" /><SortableHoldingHeader label="Quantity" sortKey="quantity" activeSort={holdingSort} onSort={sortHoldings} /><SortableHoldingHeader label="Average cost" sortKey="averageCost" activeSort={holdingSort} onSort={sortHoldings} /><SortableHoldingHeader label="Latest price" sortKey="marketPrice" activeSort={holdingSort} onSort={sortHoldings} /><SortableHoldingHeader label="Market value" sortKey="marketValue" activeSort={holdingSort} onSort={sortHoldings} /><SortableHoldingHeader label="Unrealized gain" sortKey="unrealizedGain" activeSort={holdingSort} onSort={sortHoldings} /><SortableHoldingHeader label="Realized gain" sortKey="realizedGain" activeSort={holdingSort} onSort={sortHoldings} className="px-6" /></tr></thead><tbody>{visibleHoldings.map((holding) => <tr key={holding.symbol} className="border-t border-[#ecefec] hover:bg-[#fafcff] dark:hover:bg-[#172b40]"><td className="px-6 py-4"><button onClick={() => onSelectInstrument(holding.symbol)} className="flex items-center gap-3 text-left"><InstrumentMark symbol={holding.symbol} size="small" /><span><strong className="block text-sm">{holding.symbol}</strong><span className="mt-0.5 block text-xs text-[#526b84]">{holding.name}</span></span></button></td><td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">{quantity(holding.quantity)}</td><td className="px-4 py-4 text-right text-sm tabular-nums">{money(holding.averageCost, holding.currency)}</td><td className="px-4 py-4 text-right text-sm tabular-nums">{holding.marketPrice == null ? <span className="text-[#607991]">Not quoted</span> : <span>{money(holding.marketPrice, holding.currency)}<small className="mt-0.5 block text-[10px] text-[#607991]">Close · {holding.quoteDate}</small></span>}</td><td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">{holding.marketValue == null ? '—' : money(holding.marketValue, holding.currency)}</td><td className={`px-4 py-4 text-right text-sm font-bold tabular-nums ${holding.unrealizedGain == null ? 'text-[#607991]' : holding.unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{holding.unrealizedGain == null ? '—' : <span>{holding.unrealizedGain >= 0 ? '+' : ''}{money(holding.unrealizedGain, holding.currency)}<small className="mt-0.5 block text-[10px]">{holding.unrealizedGainPercent == null ? '' : `${holding.unrealizedGainPercent >= 0 ? '+' : ''}${holding.unrealizedGainPercent.toFixed(2)}%`}</small></span>}</td><td className={`px-6 py-4 text-right text-sm font-bold tabular-nums ${holding.realizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{holding.realizedGain >= 0 ? '+' : ''}{money(holding.realizedGain, holding.currency)}</td></tr>)}</tbody></table></div>}
      </section>
      </>}

      {section === 'transactions' &&
      <section className="surface-card surface-card--flush">
        <div className="flex flex-col gap-4 border-b border-[#dbe6f2] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6"><div><h2 className="text-lg font-semibold tracking-[-.02em]">Transactions</h2><p className="mt-1 text-xs text-[#526b84]">{totalTransactions} recorded entries</p></div><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><input value={symbolFilter} onChange={(event) => { setSymbolFilter(event.target.value.slice(0, 14)); setPage(0) }} className="min-w-0 w-full rounded-xl border border-[#c4d5e8] bg-[#f9fbff] px-3 py-2.5 text-sm uppercase outline-none focus:border-[#3077b4] sm:w-36" placeholder="Symbol" aria-label="Filter transactions by symbol" /><TransactionFilterTypeSelect value={typeFilter} onChange={(value) => { setTypeFilter(value); setPage(0) }} /><label className="col-span-2 min-w-0 sm:w-36"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.1em] text-[#607991] sm:sr-only">From</span><input type="date" value={fromFilter} max={toFilter || undefined} onChange={(event) => { setFromFilter(event.target.value); setPage(0) }} className="w-full rounded-xl border border-[#c4d5e8] bg-[#f9fbff] px-3 py-2.5 text-sm outline-none" aria-label="Transactions from date" /></label><label className="col-span-2 min-w-0 sm:w-36"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.1em] text-[#607991] sm:sr-only">To</span><input type="date" value={toFilter} min={fromFilter || undefined} onChange={(event) => { setToFilter(event.target.value); setPage(0) }} className="w-full rounded-xl border border-[#c4d5e8] bg-[#f9fbff] px-3 py-2.5 text-sm outline-none" aria-label="Transactions through date" /></label>{(symbolFilter || typeFilter || fromFilter || toFilter) && <button onClick={() => { setSymbolFilter(''); setTypeFilter(''); setFromFilter(''); setToFilter(''); setPage(0) }} className="col-span-2 justify-self-start rounded-xl px-3 py-2.5 text-sm font-bold text-[#0b5b9e] hover:bg-[#e8f1fb] sm:w-auto">Clear filters</button>}</div></div>
        {detailsLoading ? <div className="h-48 animate-pulse bg-[#f4f8fd]" /> : transactions.length === 0 ? <EmptyState title="No transactions found" text={symbolFilter || typeFilter || fromFilter || toFilter ? 'Try changing or clearing the current filters.' : 'Add your first transaction to create a holding.'} /> : <div><div className="divide-y divide-[#ecefec]">{transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onEdit={() => { setEditing(transaction); setShowTransaction(true) }} onDelete={() => setDeleteTarget(transaction)} />)}</div>{totalPages > 1 && <div className="flex items-center justify-between border-t border-[#dbe6f2] px-4 py-3 text-xs sm:px-5"><button disabled={page === 0} onClick={() => setPage((current) => current - 1)} className="rounded-lg px-3 py-2 font-bold disabled:opacity-35">Previous</button><span className="text-[#526b84]">{page + 1} / {totalPages}</span><button disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg px-3 py-2 font-bold disabled:opacity-35">Next</button></div>}</div>}
      </section>
      }
    </>}

    {showTransaction && selected && <TransactionModal auth={auth} portfolio={selected} transaction={editing} onClose={() => { setShowTransaction(false); setEditing(null) }} onSaved={async () => { setShowTransaction(false); setEditing(null); await loadDetails() }} />}
    {showFidelityImport && selected && <FidelityImportModal auth={auth} portfolio={selected} onClose={() => setShowFidelityImport(false)} onImported={loadDetails} />}
    {deleteTarget && <DeleteTransactionModal transaction={deleteTarget} deleting={deleting} onClose={() => { if (!deleting) setDeleteTarget(null) }} onConfirm={removeTransaction} />}
  </main>
}

function FidelityImportModal({ auth, portfolio, onClose, onImported }: { auth: AuthResponse, portfolio: Portfolio, onClose: () => void, onImported: () => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FidelityImportResult | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) { setError('Choose a Fidelity CSV file.'); return }
    setImporting(true); setError(''); setResult(null)
    try {
      const imported = await importFidelityActivity(auth, portfolio.id, file)
      setResult(imported)
      await onImported()
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Unable to import the Fidelity activity file.'))
    } finally {
      setImporting(false)
    }
  }
  return <Modal title="Import Fidelity activity" description={`Add supported activity to ${portfolio.name}`} onClose={onClose}>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block rounded-2xl border border-dashed border-[#bdc9c0] bg-[#f4f8fd] p-5 text-center text-sm font-semibold hover:border-[#3077b4]"><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setError('') }} /><span className="block text-[#0b5b9e]">{file ? file.name : 'Choose Fidelity CSV'}</span><span className="mt-1 block text-xs font-normal text-[#526b84]">Maximum file size 10 MB</span></label>
      <div className="rounded-xl bg-[#f2f5f2] px-4 py-3 text-xs leading-5 text-[#657168]"><p>Stocks, ETFs, dividends, reinvestments, cash deposits and transfers are imported. Put and call activity is ignored.</p><p className="mt-1">Transferred securities use Fidelity’s reported value as a provisional cost basis.</p></div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {result && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-bold">Imported {result.imported} transactions</p><p className="mt-1 text-xs">Read {result.rowsRead} rows · {result.duplicates} duplicates · {result.ignoredOptions} options ignored · {result.ignoredUnsupported} unsupported ignored</p>{result.warnings.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold">Review {result.warnings.length} warnings</summary><ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-xs">{result.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></details>}</div>}
      <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-[#c3d5e8] px-4 py-3 text-sm font-bold">{result ? 'Close' : 'Cancel'}</button><button disabled={importing || !file} className={`${submitClass} flex-1`}>{importing ? 'Importing…' : result ? 'Import again' : 'Import activity'}</button></div>
    </form>
  </Modal>
}

function DeleteTransactionModal({ transaction, deleting, onClose, onConfirm }: { transaction: PortfolioTransaction, deleting: boolean, onClose: () => void, onConfirm: () => void }) {
  return <Modal title="Delete transaction?" description={`Remove this ${transaction.type.toLowerCase()} transaction from your portfolio.`} onClose={onClose}>
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">This cannot be undone. Your holdings, cash balance, and realized gain may be recalculated.</div>
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={deleting} onClick={onClose} className="rounded-xl border border-[#c3d5e8] px-4 py-3 text-sm font-bold disabled:opacity-60">Cancel</button><button type="button" disabled={deleting} onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete transaction'}</button></div>
  </Modal>
}

function TransactionRow({ transaction, onEdit, onDelete }: { transaction: PortfolioTransaction, onEdit: () => void, onDelete: () => void }) {
  const incoming = transaction.type === 'BUY' || transaction.type === 'DEPOSIT' || transaction.type === 'DIVIDEND'
  return <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-6">
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${incoming ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}><Icon className="size-4"><path d={incoming ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M18 13l-6 6-6-6'} /></Icon></span>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{transaction.type}</strong>{transaction.symbol && <span className="rounded-md bg-[#e6f0fb] px-2 py-1 text-[10px] font-bold text-[#4a657f]">{transaction.symbol}</span>}{transaction.returnOfCapitalAmount > 0 && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">ROC {money(transaction.returnOfCapitalAmount, transaction.currency)}</span>}</div><p className="mt-1 text-xs leading-5 text-[#526b84] sm:truncate">{shortDate(transaction.executedAt)}{transaction.notes ? ` · ${transaction.notes}` : ''}</p></div>
    <div className="col-span-2 col-start-2 row-start-2 flex items-center justify-between gap-3 rounded-xl bg-[#f9fbff] px-3 py-2.5 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:block sm:min-w-32 sm:bg-transparent sm:p-0 sm:text-right"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#607991] sm:hidden">Total</span><span><span className="block text-sm font-bold tabular-nums">{transaction.totalAmount == null ? '—' : money(transaction.totalAmount, transaction.currency)}</span>{transaction.quantity != null && <span className="mt-0.5 block text-[11px] text-[#526b84]">{quantity(transaction.quantity)} × {money(transaction.price ?? 0, transaction.currency)}</span>}</span></div>
    <div className="col-start-3 row-start-1 flex gap-0.5 sm:col-start-4"><button onClick={onEdit} className="grid size-8 place-items-center rounded-lg text-[#526b84] hover:bg-[#e8f1fb] sm:size-9" aria-label="Edit transaction"><Icon className="size-4"><path d="m4 16-.8 4 4-.8L18 8.4 15.6 6 4 16Z" /><path d="m14 7 3 3" /></Icon></button><button onClick={onDelete} className="grid size-8 place-items-center rounded-lg text-[#8b958f] hover:bg-rose-50 hover:text-rose-600 sm:size-9" aria-label="Delete transaction"><Icon className="size-4"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></Icon></button></div>
  </article>
}

function EmptyState({ title, text }: { title: string, text: string }) {
  return <div className="px-6 py-12 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[#526b84]">{text}</p></div>
}

function Modal({ title, description, onClose, children }: { title: string, description: string, onClose: () => void, children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#091523]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section role="dialog" aria-modal="true" className="my-5 w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-[-.03em]">{title}</h2><p className="mt-1 text-sm text-[#536d86]">{description}</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-[#506980] hover:bg-[#f1f3f1]" aria-label="Close"><Icon><path d="M6 6l12 12M18 6 6 18" /></Icon></button></div>{children}</section></div>
}

function TransactionModal({ auth, portfolio, transaction, onClose, onSaved }: { auth: AuthResponse, portfolio: Portfolio, transaction: PortfolioTransaction | null, onClose: () => void, onSaved: () => void | Promise<void> }) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'BUY')
  const [symbol, setSymbol] = useState(transaction?.symbol ?? '')
  const [symbolSelected, setSymbolSelected] = useState(Boolean(transaction?.symbol))
  const [quantityValue, setQuantityValue] = useState(transaction?.quantity?.toString() ?? '')
  const [price, setPrice] = useState(transaction?.price?.toString() ?? '')
  const [fees, setFees] = useState(transaction?.fees?.toString() ?? '0')
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? '')
  const [returnOfCapitalAmount, setReturnOfCapitalAmount] = useState(transaction?.returnOfCapitalAmount?.toString() ?? '0')
  const [executedAt, setExecutedAt] = useState(() => {
    const date = transaction ? new Date(transaction.executedAt) : new Date()
    return toLocalDateTimeInput(date)
  })
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const trade = type === 'BUY' || type === 'SELL'
  const needsSymbol = trade || type === 'DIVIDEND'
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (needsSymbol && !symbolSelected) { setError('Select an instrument from the available results.'); return }
    setSaving(true); setError('')
    const input: TransactionInput = { type, currency: portfolio.currency, executedAt: new Date(executedAt).toISOString(), fees: Number(fees || 0), notes: notes || undefined }
    if (needsSymbol) input.symbol = symbol.trim().toUpperCase()
    if (trade) { input.quantity = Number(quantityValue); input.price = Number(price) } else input.amount = Number(amount)
    if (type === 'DIVIDEND') input.returnOfCapitalAmount = Number(returnOfCapitalAmount || 0)
    if (!transaction) input.clientRequestId = crypto.randomUUID()
    try { if (transaction) await updateTransaction(auth, portfolio.id, transaction.id, input); else await createTransaction(auth, portfolio.id, input); await onSaved() } catch (reason) { setError(apiErrorMessage(reason, 'Unable to save transaction.')) } finally { setSaving(false) }
  }
  return <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} description={`Recording in ${portfolio.name} · ${portfolio.currency}`} onClose={onClose}><form onSubmit={submit} className="mt-6 space-y-4"><Field label="Transaction type"><TransactionTypeSelect value={type} onChange={setType} /></Field>{needsSymbol && <InstrumentSelect value={symbol} selected={symbolSelected} onChange={(value) => { setSymbol(value); setSymbolSelected(false) }} onSelect={(instrument) => { setSymbol(instrument.symbol); setSymbolSelected(true); setError('') }} />}{trade ? <div className="grid grid-cols-2 gap-4"><Field label="Quantity"><input required min="0" step="any" type="number" value={quantityValue} onChange={(event) => setQuantityValue(event.target.value)} className={inputClass} placeholder="10" /></Field><Field label={`Price (${portfolio.currency})`}><input required min="0" step="any" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} placeholder="220.15" /></Field></div> : <Field label={`Amount (${portfolio.currency})`}><input required min="0" step="any" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} placeholder="500.00" /></Field>}{type === 'DIVIDEND' && <div><Field label={`Return of capital (${portfolio.currency})`}><input min="0" max={amount || undefined} step="any" type="number" value={returnOfCapitalAmount} onChange={(event) => setReturnOfCapitalAmount(event.target.value)} className={inputClass} /></Field><p className="mt-2 text-xs leading-5 text-[#526b84]">Optional. Use a confirmed amount from your broker or final tax statement. This reduces the holding's cost basis.</p></div>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Fees"><input min="0" step="any" type="number" value={fees} onChange={(event) => setFees(event.target.value)} className={inputClass} /></Field><Field label="Date and time"><input required type="datetime-local" value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} className={inputClass} /></Field></div><Field label="Notes"><textarea maxLength={500} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Optional note" /></Field>{error && <ErrorMessage>{error}</ErrorMessage>}<button disabled={saving} className={submitClass}>{saving ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}</button></form></Modal>
}

function TransactionTypeSelect({ value, onChange }: { value: TransactionType, onChange: (value: TransactionType) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return <div ref={rootRef} className="relative mt-2"><button type="button" onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} className={`${inputClass} mt-0 flex items-center justify-between text-left`} aria-haspopup="listbox" aria-expanded={open} aria-controls="transaction-type-options"><span>{value}</span><Icon className={`size-4 text-[#607991] transition ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></Icon></button>{open && <div id="transaction-type-options" role="listbox" className="absolute left-0 right-0 top-full z-60 mt-2 overflow-hidden rounded-2xl border border-[#c3d5e8] bg-white p-1.5 shadow-[0_18px_50px_rgba(20,38,29,.2)] dark:border-[#304258] dark:bg-[#16283b]">{transactionTypes.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false) }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${option === value ? 'bg-[#e8f1fb] text-[#0b5b9e] dark:bg-[#22364e] dark:text-[#bddcff]' : 'hover:bg-[#f4f8fd] dark:hover:bg-[#1d3045]'}`}><span>{option}</span>{option === value && <span aria-hidden="true">✓</span>}</button>)}</div>}</div>
}

function TransactionFilterTypeSelect({ value, onChange }: { value: TransactionType | '', onChange: (value: TransactionType | '') => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const options: (TransactionType | '')[] = ['', ...transactionTypes]

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return <div ref={rootRef} className="relative min-w-0 sm:w-36"><button type="button" onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} className="flex w-full items-center justify-between rounded-xl border border-[#c4d5e8] bg-[#f9fbff] px-3 py-2.5 text-left text-sm outline-none" aria-label="Filter transactions by type" aria-haspopup="listbox" aria-expanded={open} aria-controls="transaction-filter-type-options"><span>{value || 'All types'}</span><Icon className={`size-4 text-[#607991] transition ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></Icon></button>{open && <div id="transaction-filter-type-options" role="listbox" className="absolute left-0 right-0 top-full z-60 mt-2 overflow-hidden rounded-2xl border border-[#c3d5e8] bg-white p-1.5 shadow-[0_18px_50px_rgba(20,38,29,.2)] dark:border-[#304258] dark:bg-[#16283b]">{options.map((option) => <button key={option || 'all'} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false) }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${option === value ? 'bg-[#e8f1fb] text-[#0b5b9e] dark:bg-[#22364e] dark:text-[#bddcff]' : 'hover:bg-[#f4f8fd] dark:hover:bg-[#1d3045]'}`}><span>{option || 'All types'}</span>{option === value && <span aria-hidden="true">✓</span>}</button>)}</div>}</div>
}

function InstrumentSelect({ value, selected, onChange, onSelect }: { value: string, selected: boolean, onChange: (value: string) => void, onSelect: (instrument: Instrument) => void }) {
  const [results, setResults] = useState<Instrument[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  useEffect(() => {
    if (selected || !value.trim()) return
    let controller: AbortController | undefined
    const timer = window.setTimeout(() => {
      controller = new AbortController()
      setLoading(true)
      searchInstruments(value.trim(), controller.signal)
        .then((items) => { setResults(items.slice(0, 8)); setHighlighted(0); setOpen(true) })
        .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setResults([]) })
        .finally(() => { if (!controller?.signal.aborted) setLoading(false) })
    }, 220)
    return () => { window.clearTimeout(timer); controller?.abort() }
  }, [selected, value])

  const choose = (instrument: Instrument) => { onSelect(instrument); setOpen(false); setResults([]) }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlighted((current) => (current + 1) % results.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlighted((current) => (current - 1 + results.length) % results.length) }
    if (event.key === 'Enter') { event.preventDefault(); choose(results[highlighted]) }
    if (event.key === 'Escape') setOpen(false)
  }

  return <div className="relative"><label htmlFor="transaction-instrument" className="block text-sm font-semibold">Instrument</label><div className="relative"><input id="transaction-instrument" role="combobox" aria-expanded={open} aria-controls="instrument-options" aria-autocomplete="list" required maxLength={50} value={value} onChange={(event) => { onChange(event.target.value.toUpperCase()); setOpen(true) }} onFocus={() => { if (!selected && (results.length || loading)) setOpen(true) }} onKeyDown={keyDown} autoComplete="off" className={`${inputClass} pr-10 uppercase`} placeholder="Search ticker or company" />{selected ? <span className="absolute right-3 top-[22px] grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon className="size-3"><path d="m4 12 5 5L20 6" /></Icon></span> : loading ? <span className="absolute right-3 top-[23px] size-4 animate-spin rounded-full border-2 border-[#c3d5e8] border-t-[#0b5b9e]" /> : null}</div>{open && !selected && <div id="instrument-options" role="listbox" className="absolute left-0 right-0 top-full z-60 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#c3d5e8] bg-white p-1.5 shadow-[0_18px_50px_rgba(20,38,29,.2)] dark:border-[#304258] dark:bg-[#16283b]">{loading && !results.length ? <p className="px-3 py-4 text-center text-xs text-[#526b84]">Searching instruments…</p> : results.length ? results.map((instrument, index) => <button key={instrument.symbol} type="button" role="option" aria-selected={index === highlighted} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(instrument)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${index === highlighted ? 'bg-[#e8f1fb] dark:bg-[#22364e]' : ''}`}><InstrumentMark symbol={instrument.symbol} size="small" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm">{instrument.symbol}</strong><span className="text-[10px] text-[#607991]">{instrument.exchange}</span></span><span className="mt-0.5 block truncate text-xs normal-case text-[#526b84]">{instrument.name}</span></span></button>) : <p className="px-3 py-4 text-center text-xs text-[#526b84]">No matching instruments</p>}</div>}<p className="mt-1.5 text-[11px] font-normal text-[#607991]">Type a ticker or company name, then select a result.</p></div>
}

function Field({ label, children }: { label: string, children: ReactNode }) { return <label className="block text-sm font-semibold">{label}{children}</label> }
function ErrorMessage({ children }: { children: ReactNode }) { return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{children}</div> }
const inputClass = 'mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-[#3b7fbd] focus:ring-4 focus:ring-[#e8f0fb]'
const submitClass = 'w-full rounded-xl bg-[#0b3b66] py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:opacity-60'

export default PortfolioPage
