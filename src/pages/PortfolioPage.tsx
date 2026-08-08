import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { apiErrorMessage } from '../api/client'
import { searchInstruments } from '../api/instruments'
import { createTransaction, deleteTransaction, getHoldings, getPortfolioPerformance, getPortfolios, getTransactions, updateTransaction } from '../api/portfolios'
import InstrumentMark from '../components/InstrumentMark'
import type { AuthResponse } from '../types/auth'
import type { Instrument } from '../types/instrument'
import type { Holding, Portfolio, PortfolioTransaction, TransactionInput, TransactionType } from '../types/portfolio'

type PortfolioPageProps = {
  auth: AuthResponse | null
  section: 'holdings' | 'transactions'
  requestedPortfolioId?: string
  onNeedAuth: () => void
  onSelectInstrument: (symbol: string) => void
  startWithTransaction?: boolean
}

const transactionTypes: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL']

function Icon({ children, className = 'size-5' }: { children: ReactNode, className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function quantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
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
  const [loading, setLoading] = useState(Boolean(auth))
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [realizedGain, setRealizedGain] = useState(0)
  const [error, setError] = useState('')
  const [showTransaction, setShowTransaction] = useState(startWithTransaction)
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null)

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
      getTransactions(auth, selectedId, { symbol: symbolFilter.trim().toUpperCase(), type: typeFilter, page, size: 20 }, signal),
      getPortfolioPerformance(auth, selectedId, signal),
    ]).then(([holdingData, transactionData, performance]) => {
      setHoldings(holdingData)
      setTransactions(transactionData.content)
      setTotalTransactions(transactionData.totalElements)
      setTotalPages(transactionData.totalPages)
      setRealizedGain(performance.realizedGain)
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(apiErrorMessage(reason, 'Unable to load portfolio details.'))
    }).finally(() => { if (!signal?.aborted) setDetailsLoading(false) })
  }, [auth, page, selectedId, symbolFilter, typeFilter])

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

  const removeTransaction = async (transaction: PortfolioTransaction) => {
    if (!auth || !selected || !window.confirm(`Delete this ${transaction.type.toLowerCase()} transaction?`)) return
    try {
      setDetailsLoading(true)
      await deleteTransaction(auth, selected.id, transaction.id)
      await loadDetails()
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Unable to delete transaction.'))
    }
  }

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16 lg:px-8"><section className="rounded-[24px] border border-[#dfe4df] bg-white px-7 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf1ec] text-[#285d43]"><Icon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></Icon></span><h1 className="mt-5 text-2xl font-semibold tracking-[-.03em]">Your investments belong to you</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77837b]">Sign in to create portfolios, record transactions, and track your cost basis.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white">Sign in to continue</button></section></main>

  return <main className="mx-auto max-w-[1560px] px-5 py-8 lg:px-8 lg:py-11">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Investment ledger</p><h1 className="mt-2 text-[36px] font-semibold tracking-[-.045em] md:text-[46px]">{section === 'holdings' ? 'Holdings' : 'Transactions'}</h1><p className="mt-2 text-sm text-[#738078]">{section === 'holdings' ? 'Positions calculated directly from your transaction history.' : 'Review and maintain the complete investment ledger.'}</p></div>
      {section === 'transactions' && selected && <button onClick={() => { setEditing(null); setShowTransaction(true) }} className="flex items-center gap-2 self-start rounded-xl bg-[#d8f768] px-4 py-3 text-sm font-bold text-[#1c2d24] hover:bg-[#c9ed4d] md:self-auto"><Icon className="size-4"><path d="M12 5v14M5 12h14" /></Icon>Add transaction</button>}
    </div>

    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

    {loading ? <div className="h-72 animate-pulse rounded-[22px] bg-white" /> : portfolios.length === 0 ? <div className="rounded-[22px] border border-dashed border-[#cfd7d1] bg-white py-20 text-center"><h2 className="text-xl font-semibold">Create your first portfolio</h2><p className="mt-2 text-sm text-[#7b867f]">Use the + beside the portfolio selector in the top menu.</p></div> : <>
      {section === 'holdings' && <>
      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Market value" value={totals.quotedPositions ? money(totals.marketValue, selected?.currency) : '—'} note={`${totals.quotedPositions} of ${holdings.length} positions quoted`} />
        <SummaryCard label="Unrealized gain" value={totals.quotedPositions ? money(totals.unrealizedGain, selected?.currency) : '—'} note={`Cost basis ${money(totals.costBasis, selected?.currency)}`} positive={totals.quotedPositions ? totals.unrealizedGain >= 0 : undefined} />
        <SummaryCard label="Realized gain" value={money(realizedGain, selected?.currency)} note="Includes open and fully sold positions" positive={realizedGain >= 0} />
      </section>

      <section className="mb-5 overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
        <div className="border-b border-[#e5e9e5] px-5 py-5 md:px-6"><h2 className="text-lg font-semibold tracking-[-.02em]">Holdings</h2><p className="mt-1 text-xs text-[#7b867f]">Latest server-synchronized prices · weighted-average cost</p></div>
        {detailsLoading && !holdings.length ? <div className="h-44 animate-pulse bg-[#f7f9f7]" /> : holdings.length === 0 ? <EmptyState title="No open positions" text="Add a BUY transaction to begin building this portfolio." /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-[.12em] text-[#849088]"><tr><th className="px-6 py-3">Instrument</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Average cost</th><th className="px-4 py-3 text-right">Latest price</th><th className="px-4 py-3 text-right">Market value</th><th className="px-4 py-3 text-right">Unrealized gain</th><th className="px-6 py-3 text-right">Realized gain</th></tr></thead><tbody>{holdings.map((holding) => <tr key={holding.symbol} className="border-t border-[#ecefec] hover:bg-[#fafcf9] dark:hover:bg-[#1a2520]"><td className="px-6 py-4"><button onClick={() => onSelectInstrument(holding.symbol)} className="flex items-center gap-3 text-left"><InstrumentMark symbol={holding.symbol} size="small" /><span><strong className="block text-sm">{holding.symbol}</strong><span className="mt-0.5 block text-xs text-[#7b867f]">{holding.name}</span></span></button></td><td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">{quantity(holding.quantity)}</td><td className="px-4 py-4 text-right text-sm tabular-nums">{money(holding.averageCost, holding.currency)}</td><td className="px-4 py-4 text-right text-sm tabular-nums">{holding.marketPrice == null ? <span className="text-[#87918b]">Not quoted</span> : <span>{money(holding.marketPrice, holding.currency)}<small className="mt-0.5 block text-[10px] text-[#87918b]">Close · {holding.quoteDate}</small></span>}</td><td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">{holding.marketValue == null ? '—' : money(holding.marketValue, holding.currency)}</td><td className={`px-4 py-4 text-right text-sm font-bold tabular-nums ${holding.unrealizedGain == null ? 'text-[#87918b]' : holding.unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{holding.unrealizedGain == null ? '—' : <span>{holding.unrealizedGain >= 0 ? '+' : ''}{money(holding.unrealizedGain, holding.currency)}<small className="mt-0.5 block text-[10px]">{holding.unrealizedGainPercent == null ? '' : `${holding.unrealizedGainPercent >= 0 ? '+' : ''}${holding.unrealizedGainPercent.toFixed(2)}%`}</small></span>}</td><td className={`px-6 py-4 text-right text-sm font-bold tabular-nums ${holding.realizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{holding.realizedGain >= 0 ? '+' : ''}{money(holding.realizedGain, holding.currency)}</td></tr>)}</tbody></table></div>}
      </section>
      </>}

      {section === 'transactions' &&
      <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e5e9e5] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6"><div><h2 className="text-lg font-semibold tracking-[-.02em]">Transactions</h2><p className="mt-1 text-xs text-[#7b867f]">{totalTransactions} recorded entries</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={symbolFilter} onChange={(event) => { setSymbolFilter(event.target.value.slice(0, 14)); setPage(0) }} className="rounded-xl border border-[#dfe4df] bg-[#fafbf9] px-3 py-2.5 text-sm uppercase outline-none focus:border-[#779a86]" placeholder="Filter symbol" aria-label="Filter transactions by symbol" /><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as TransactionType | ''); setPage(0) }} className="rounded-xl border border-[#dfe4df] bg-[#fafbf9] px-3 py-2.5 text-sm outline-none" aria-label="Filter transactions by type"><option value="">All types</option>{transactionTypes.map((type) => <option key={type}>{type}</option>)}</select></div></div>
        {detailsLoading ? <div className="h-48 animate-pulse bg-[#f7f9f7]" /> : transactions.length === 0 ? <EmptyState title="No transactions found" text={symbolFilter || typeFilter ? 'Try changing the current filters.' : 'Add your first transaction to create a holding.'} /> : <div><div className="divide-y divide-[#ecefec]">{transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onEdit={() => { setEditing(transaction); setShowTransaction(true) }} onDelete={() => removeTransaction(transaction)} />)}</div>{totalPages > 1 && <div className="flex items-center justify-between border-t border-[#e5e9e5] px-4 py-3 text-xs sm:px-5"><button disabled={page === 0} onClick={() => setPage((current) => current - 1)} className="rounded-lg px-3 py-2 font-bold disabled:opacity-35">Previous</button><span className="text-[#7b867f]">{page + 1} / {totalPages}</span><button disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg px-3 py-2 font-bold disabled:opacity-35">Next</button></div>}</div>}
      </section>
      }
    </>}

    {showTransaction && selected && <TransactionModal auth={auth} portfolio={selected} transaction={editing} onClose={() => { setShowTransaction(false); setEditing(null) }} onSaved={async () => { setShowTransaction(false); setEditing(null); await loadDetails() }} />}
  </main>
}

function SummaryCard({ label, value, note, positive }: { label: string, value: string, note: string, positive?: boolean }) {
  return <div className="rounded-[20px] border border-[#dfe4df] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#859088]">{label}</p><p className={`mt-2 text-2xl font-semibold tracking-[-.035em] ${positive === undefined ? '' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>{value}</p><p className="mt-2 text-xs text-[#7b867f]">{note}</p></div>
}

function TransactionRow({ transaction, onEdit, onDelete }: { transaction: PortfolioTransaction, onEdit: () => void, onDelete: () => void }) {
  const incoming = transaction.type === 'BUY' || transaction.type === 'DEPOSIT' || transaction.type === 'DIVIDEND'
  return <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-6">
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${incoming ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}><Icon className="size-4"><path d={incoming ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M18 13l-6 6-6-6'} /></Icon></span>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{transaction.type}</strong>{transaction.symbol && <span className="rounded-md bg-[#edf1ed] px-2 py-1 text-[10px] font-bold text-[#647168]">{transaction.symbol}</span>}</div><p className="mt-1 text-xs leading-5 text-[#7b867f] sm:truncate">{shortDate(transaction.executedAt)}{transaction.notes ? ` · ${transaction.notes}` : ''}</p></div>
    <div className="col-span-2 col-start-2 row-start-2 flex items-center justify-between gap-3 rounded-xl bg-[#fafbf9] px-3 py-2.5 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:block sm:min-w-32 sm:bg-transparent sm:p-0 sm:text-right"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#87918b] sm:hidden">Total</span><span><span className="block text-sm font-bold tabular-nums">{transaction.totalAmount == null ? '—' : money(transaction.totalAmount, transaction.currency)}</span>{transaction.quantity != null && <span className="mt-0.5 block text-[11px] text-[#7b867f]">{quantity(transaction.quantity)} × {money(transaction.price ?? 0, transaction.currency)}</span>}</span></div>
    <div className="col-start-3 row-start-1 flex gap-0.5 sm:col-start-4"><button onClick={onEdit} className="grid size-8 place-items-center rounded-lg text-[#7b867f] hover:bg-[#eef2ee] sm:size-9" aria-label="Edit transaction"><Icon className="size-4"><path d="m4 16-.8 4 4-.8L18 8.4 15.6 6 4 16Z" /><path d="m14 7 3 3" /></Icon></button><button onClick={onDelete} className="grid size-8 place-items-center rounded-lg text-[#8b958f] hover:bg-rose-50 hover:text-rose-600 sm:size-9" aria-label="Delete transaction"><Icon className="size-4"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></Icon></button></div>
  </article>
}

function EmptyState({ title, text }: { title: string, text: string }) {
  return <div className="px-6 py-12 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[#7b867f]">{text}</p></div>
}

function Modal({ title, description, onClose, children }: { title: string, description: string, onClose: () => void, children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0a1711]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section role="dialog" aria-modal="true" className="my-5 w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-[-.03em]">{title}</h2><p className="mt-1 text-sm text-[#77837b]">{description}</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-[#6f7a73] hover:bg-[#f1f3f1]" aria-label="Close"><Icon><path d="M6 6l12 12M18 6 6 18" /></Icon></button></div>{children}</section></div>
}

function TransactionModal({ auth, portfolio, transaction, onClose, onSaved }: { auth: AuthResponse, portfolio: Portfolio, transaction: PortfolioTransaction | null, onClose: () => void, onSaved: () => void | Promise<void> }) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'BUY')
  const [symbol, setSymbol] = useState(transaction?.symbol ?? '')
  const [symbolSelected, setSymbolSelected] = useState(Boolean(transaction?.symbol))
  const [quantityValue, setQuantityValue] = useState(transaction?.quantity?.toString() ?? '')
  const [price, setPrice] = useState(transaction?.price?.toString() ?? '')
  const [fees, setFees] = useState(transaction?.fees?.toString() ?? '0')
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? '')
  const [executedAt, setExecutedAt] = useState(() => {
    const date = transaction ? new Date(transaction.executedAt) : new Date()
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
    if (!transaction) input.clientRequestId = crypto.randomUUID()
    try { if (transaction) await updateTransaction(auth, portfolio.id, transaction.id, input); else await createTransaction(auth, portfolio.id, input); await onSaved() } catch (reason) { setError(apiErrorMessage(reason, 'Unable to save transaction.')) } finally { setSaving(false) }
  }
  return <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} description={`Recording in ${portfolio.name} · ${portfolio.currency}`} onClose={onClose}><form onSubmit={submit} className="mt-6 space-y-4"><Field label="Transaction type"><select value={type} onChange={(event) => setType(event.target.value as TransactionType)} className={inputClass}>{transactionTypes.map((value) => <option key={value}>{value}</option>)}</select></Field>{needsSymbol && <InstrumentSelect value={symbol} selected={symbolSelected} onChange={(value) => { setSymbol(value); setSymbolSelected(false) }} onSelect={(instrument) => { setSymbol(instrument.symbol); setSymbolSelected(true); setError('') }} />}{trade ? <div className="grid grid-cols-2 gap-4"><Field label="Quantity"><input required min="0" step="any" type="number" value={quantityValue} onChange={(event) => setQuantityValue(event.target.value)} className={inputClass} placeholder="10" /></Field><Field label={`Price (${portfolio.currency})`}><input required min="0" step="any" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} placeholder="220.15" /></Field></div> : <Field label={`Amount (${portfolio.currency})`}><input required min="0" step="any" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} placeholder="500.00" /></Field>}<div className="grid grid-cols-2 gap-4"><Field label="Fees"><input min="0" step="any" type="number" value={fees} onChange={(event) => setFees(event.target.value)} className={inputClass} /></Field><Field label="Date and time"><input required type="datetime-local" value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} className={inputClass} /></Field></div><Field label="Notes"><textarea maxLength={500} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Optional note" /></Field>{error && <ErrorMessage>{error}</ErrorMessage>}<button disabled={saving} className={submitClass}>{saving ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}</button></form></Modal>
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

  return <div className="relative"><label htmlFor="transaction-instrument" className="block text-sm font-semibold">Instrument</label><div className="relative"><input id="transaction-instrument" role="combobox" aria-expanded={open} aria-controls="instrument-options" aria-autocomplete="list" required maxLength={50} value={value} onChange={(event) => { onChange(event.target.value.toUpperCase()); setOpen(true) }} onFocus={() => { if (!selected && (results.length || loading)) setOpen(true) }} onKeyDown={keyDown} autoComplete="off" className={`${inputClass} pr-10 uppercase`} placeholder="Search ticker or company" />{selected ? <span className="absolute right-3 top-[22px] grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon className="size-3"><path d="m4 12 5 5L20 6" /></Icon></span> : loading ? <span className="absolute right-3 top-[23px] size-4 animate-spin rounded-full border-2 border-[#dce2dd] border-t-[#285d43]" /> : null}</div>{open && !selected && <div id="instrument-options" role="listbox" className="absolute z-60 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#dce3dd] bg-white p-1.5 shadow-[0_18px_50px_rgba(20,38,29,.2)] dark:border-[#35463d] dark:bg-[#18231e]">{loading && !results.length ? <p className="px-3 py-4 text-center text-xs text-[#7b867f]">Searching instruments…</p> : results.length ? results.map((instrument, index) => <button key={instrument.symbol} type="button" role="option" aria-selected={index === highlighted} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(instrument)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${index === highlighted ? 'bg-[#eef2ee] dark:bg-[#25342c]' : ''}`}><InstrumentMark symbol={instrument.symbol} size="small" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm">{instrument.symbol}</strong><span className="text-[10px] text-[#87918b]">{instrument.exchange}</span></span><span className="mt-0.5 block truncate text-xs normal-case text-[#7b867f]">{instrument.name}</span></span></button>) : <p className="px-3 py-4 text-center text-xs text-[#7b867f]">No matching instruments</p>}</div>}<p className="mt-1.5 text-[11px] font-normal text-[#87918b]">Type a ticker or company name, then select a result.</p></div>
}

function Field({ label, children }: { label: string, children: ReactNode }) { return <label className="block text-sm font-semibold">{label}{children}</label> }
function ErrorMessage({ children }: { children: ReactNode }) { return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{children}</div> }
const inputClass = 'mt-2 w-full rounded-xl border border-[#dce2dd] bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]'
const submitClass = 'w-full rounded-xl bg-[#173c2c] py-3.5 text-sm font-bold text-white transition hover:bg-[#205139] disabled:opacity-60'

export default PortfolioPage
