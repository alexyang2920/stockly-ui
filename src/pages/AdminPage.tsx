import { useEffect, useState } from 'react'
import { getAutomatedSyncStatus, getMarketDataStatus, syncCompanyClassifications, syncDailyQuotes, syncDividends, syncInstrumentCatalog, syncStockSplits } from '../api/admin'
import { apiErrorMessage } from '../api/client'
import type { AutomatedSyncStatus, MarketDataDatasetStatus } from '../types/admin'
import type { AuthResponse } from '../types/auth'
import { localDateKey } from '../utils/date'

const automatedJobCopy = {
  INSTRUMENTS: ['Instrument catalog', 'Latest supported stocks and ETFs'],
  CLASSIFICATIONS: ['Classifications', 'Pending SEC company classifications'],
  QUOTES_SPLITS: ['Quotes & splits', 'Latest closing quotes and stock splits'],
  DIVIDENDS: ['Dividends', 'Incremental market-wide dividend events'],
} as const

function localDate(daysAgo = 0) {
  const date = new Date(); date.setDate(date.getDate() - daysAgo)
  return localDateKey(date)
}

function previousWeekday() {
  const date = new Date()
  do { date.setDate(date.getDate() - 1) } while (date.getDay() === 0 || date.getDay() === 6)
  return localDateKey(date)
}

function DatasetStatus({ status, loading }: { status?: MarketDataDatasetStatus, loading: boolean }) {
  const statusColor = status?.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700'
    : status?.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' : 'bg-[#e6f0fb] text-[#4d6882]'
  const hasIssue = status?.status === 'PAUSED' || status?.status === 'FAILED'
  return <div className="mt-5 border-t border-[#e8ece8] pt-4">
    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#607991]">Last successful run</span>{status?.status && <span className={`rounded-md px-2 py-1 text-[9px] font-bold ${statusColor}`}>{status.status}{status.lastHttpStatus ? ` · HTTP ${status.lastHttpStatus}` : ''}</span>}</div>
    <p className="mt-1 text-sm font-semibold">{loading ? 'Loading…' : status?.lastSuccessfulAt ? new Date(status.lastSuccessfulAt).toLocaleString() : 'Never'}</p>
    <p className="mt-1 text-xs text-[#526b84]">{status?.recordsProcessed?.toLocaleString() ?? 0} records · {status?.pagesProcessed ?? 0} pages</p>
    {status?.requestedFrom && <p className="mt-1 text-[11px] text-[#607991]">Backfill from {status.requestedFrom}</p>}
    {hasIssue && (status.message || status.lastError) && <p className={`mt-2 text-xs leading-5 ${status.status === 'FAILED' ? 'text-rose-700' : 'text-amber-700'}`}>{status.lastError || status.message}</p>}
  </div>
}

function AdminPage({ auth, onNeedAuth }: { auth: AuthResponse | null, onNeedAuth: () => void }) {
  const isAdmin = auth?.user.role === 'ADMIN'
  const [tab, setTab] = useState<'market' | 'instruments'>('instruments')
  const [statuses, setStatuses] = useState<MarketDataDatasetStatus[]>([])
  const [automatedStatuses, setAutomatedStatuses] = useState<AutomatedSyncStatus[]>([])
  const [marketDate, setMarketDate] = useState(previousWeekday)
  const [splitFrom, setSplitFrom] = useState('')
  const [dividendFrom, setDividendFrom] = useState('')
  const [loading, setLoading] = useState(isAdmin)
  const [syncingDataset, setSyncingDataset] = useState<'QUOTES' | 'SPLITS' | 'DIVIDENDS' | null>(null)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [classificationLimit, setClassificationLimit] = useState(100)
  const [classificationSyncing, setClassificationSyncing] = useState(false)
  const [classificationSummary, setClassificationSummary] = useState('')
  const [catalogSyncing, setCatalogSyncing] = useState(false)
  const [catalogSummary, setCatalogSummary] = useState('')

  useEffect(() => {
    if (!auth || !isAdmin) return
    const controller = new AbortController()
    Promise.all([getMarketDataStatus(auth, controller.signal), getAutomatedSyncStatus(auth, controller.signal)])
      .then(([marketStatuses, scheduledStatuses]) => { setStatuses(marketStatuses); setAutomatedStatuses(scheduledStatuses) })
      .catch((reason: unknown) => setError(apiErrorMessage(reason, 'Unable to load synchronization status.')))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, isAdmin])

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><h1 className="text-2xl font-semibold">Administration requires authentication</h1><p className="mt-2 text-sm text-[#536d86]">Sign in with an administrator account to continue.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#0b3b66] px-5 py-3 text-sm font-bold text-white">Sign in</button></section></main>
  if (!isAdmin) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><h1 className="text-2xl font-semibold">Administrator access required</h1><p className="mt-2 text-sm text-[#536d86]">Your account does not have permission to manage FolioNest data.</p></section></main>

  const runSync = async (mode: 'quotes' | 'splits' | 'dividends') => {
    const dataset = mode === 'quotes' ? 'QUOTES' : mode === 'splits' ? 'SPLITS' : 'DIVIDENDS'
    setSyncingDataset(dataset); setError(''); setSummary('')
    try {
      const result = mode === 'quotes' ? await syncDailyQuotes(auth, marketDate)
        : mode === 'splits' ? await syncStockSplits(auth, splitFrom || undefined)
          : await syncDividends(auth, dividendFrom || undefined, Boolean(dividendFrom) || !dividendStatus?.resumable)
      setStatuses((current) => current.map((status) => status.dataset === result.dataset ? result : status))
      setSummary(`${result.dataset}: ${result.recordsProcessed.toLocaleString()} records processed. ${result.lastError || result.message}`)
    } catch (reason) { setError(apiErrorMessage(reason, 'Market-data synchronization failed.')) }
    finally { setSyncingDataset(null) }
  }

  const quoteStatus = statuses.find((item) => item.dataset === 'QUOTES')
  const splitStatus = statuses.find((item) => item.dataset === 'SPLITS')
  const dividendStatus = statuses.find((item) => item.dataset === 'DIVIDENDS')

  const syncClassifications = async () => {
    setClassificationSyncing(true); setError(''); setClassificationSummary('')
    try {
      const result = await syncCompanyClassifications(auth, classificationLimit)
      setClassificationSummary(`Attempted ${result.attempted.toLocaleString()} companies: ${result.succeeded.toLocaleString()} updated, ${result.failed.toLocaleString()} failed, and ${result.remaining.toLocaleString()} remain.`)
    } catch (reason) { setError(apiErrorMessage(reason, 'Company-classification synchronization failed.')) }
    finally { setClassificationSyncing(false) }
  }

  const syncCatalog = async () => {
    setCatalogSyncing(true); setError(''); setCatalogSummary('')
    try {
      const result = await syncInstrumentCatalog(auth)
      setCatalogSummary(`Received ${result.received.toLocaleString()} instruments: ${result.inserted.toLocaleString()} inserted, ${result.updated.toLocaleString()} updated, ${result.unchanged.toLocaleString()} unchanged, ${result.deactivated.toLocaleString()} marked inactive, and ${result.skipped.toLocaleString()} skipped.`)
    } catch (reason) { setError(apiErrorMessage(reason, 'Instrument catalog synchronization failed.')) }
    finally { setCatalogSyncing(false) }
  }

  return <main className="page-shell">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#506a84]">FolioNest operations</p><h1 className="mt-2 text-[38px] font-semibold tracking-[-.045em] md:text-[48px]">Administration</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#516c86]">Manage external datasets and maintain the instrument catalog.</p></div>
    <section className="mb-7 rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-6"><div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"><div><h2 className="text-xl font-semibold tracking-[-.025em]">Automated daily sync</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Runs in order: instruments, classifications, quotes and splits, then dividends.</p></div><span className="text-xs text-[#607991]">Times shown in your local timezone</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(Object.keys(automatedJobCopy) as Array<keyof typeof automatedJobCopy>).map((jobName) => { const status = automatedStatuses.find((item) => item.jobName === jobName); const failed = status?.status === 'FAILED'; return <div key={jobName} className="rounded-2xl border border-[#d9e3ee] bg-[#f8fbfe] p-4"><div className="flex items-start justify-between gap-2"><div><strong className="block text-sm">{automatedJobCopy[jobName][0]}</strong><span className="mt-1 block text-[11px] leading-4 text-[#607991]">{automatedJobCopy[jobName][1]}</span></div>{status && <span className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${status.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : failed ? 'bg-rose-50 text-rose-700' : 'bg-[#e6f0fb] text-[#4d6882]'}`}>{status.status}</span>}</div><p className="mt-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#607991]">Last run</p><p className="mt-1 text-sm font-semibold">{loading ? 'Loading…' : status?.lastCompletedAt ? new Date(status.lastCompletedAt).toLocaleString() : 'Never'}</p>{status && <p className={`mt-2 text-xs leading-5 ${failed ? 'text-rose-700' : 'text-[#526b84]'}`}>{status.recordsProcessed.toLocaleString()} records{status.message ? ` · ${status.message}` : ''}</p>}</div> })}</div></section>
    <nav className="mb-7 flex overflow-x-auto border-b border-[#c4d5e8]" aria-label="Administration sections">{([['instruments', 'Instruments'], ['market', 'Market Data']] as const).map(([key, label]) => <button key={key} onClick={() => { setTab(key); setError('') }} className={`relative min-w-max px-4 py-4 text-sm font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:transition ${tab === key ? 'text-[#0b3b66] after:bg-[#0b5b9e] dark:text-[#bddcff]' : 'text-[#566f88] after:bg-transparent hover:bg-[#edf4fb] hover:text-[#0b5b9e]'}`} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}</nav>

    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {tab === 'market' && summary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{summary}</div>}
    {tab === 'instruments' && catalogSummary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{catalogSummary}</div>}
    {tab === 'instruments' && classificationSummary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{classificationSummary}</div>}

    {tab === 'market' && <>
    <section className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-6"><h2 className="text-xl font-semibold tracking-[-.025em]">Daily quotes</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Fetch the closing price for one U.S. market day.</p><p className="mt-3 rounded-xl bg-[#f4f8fd] p-3 text-xs leading-5 text-[#4d6882]">Updates the latest quote for every active instrument. It does not change the historical daily-price table.</p><label className="mt-5 block text-sm font-semibold">Market date<input type="date" value={marketDate} max={localDate()} onChange={(event) => setMarketDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none" /></label><button onClick={() => runSync('quotes')} disabled={syncingDataset !== null || loading} className="mt-4 w-full rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{syncingDataset === 'QUOTES' ? 'Synchronizing quotes…' : 'Sync daily quotes'}</button><DatasetStatus status={quoteStatus} loading={loading} /></section>
      <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-6"><h2 className="text-xl font-semibold tracking-[-.025em]">Stock splits</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Fetch forward splits, reverse splits, and stock dividends.</p><p className="mt-3 rounded-xl bg-[#f4f8fd] p-3 text-xs leading-5 text-[#4d6882]">Leave the date empty to use the last successful sync date with a seven-day overlap. Enter a date only when you need a targeted refresh.</p><label className="mt-5 block text-sm font-semibold">From date <span className="font-normal text-[#607991]">(optional)</span><input type="date" value={splitFrom} max={localDate()} onChange={(event) => setSplitFrom(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none" /></label><button onClick={() => runSync('splits')} disabled={syncingDataset !== null || loading} className="mt-4 w-full rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{syncingDataset === 'SPLITS' ? 'Synchronizing splits…' : 'Sync stock splits'}</button><DatasetStatus status={splitStatus} loading={loading} /></section>
      <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-6"><h2 className="text-xl font-semibold tracking-[-.025em]">Dividends</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Fetch incremental, market-wide dividend events in manageable pages.</p><p className="mt-3 rounded-xl bg-[#f4f8fd] p-3 text-xs leading-5 text-[#4d6882]">Leave the date empty to resume an unfinished run or use the normal incremental update. Choose a date only to start again from that date. Each run processes up to four pages.</p><label className="mt-5 block text-sm font-semibold">Sync from <span className="font-normal text-[#607991]">(optional)</span><input type="date" value={dividendFrom} max={localDate()} onChange={(event) => setDividendFrom(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none" /></label><button onClick={() => runSync('dividends')} disabled={syncingDataset !== null || loading} className="mt-4 w-full rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{syncingDataset === 'DIVIDENDS' ? 'Synchronizing dividends…' : 'Sync dividends'}</button><DatasetStatus status={dividendStatus} loading={loading} /></section>
    </section>

    </>}

    {tab === 'instruments' && <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-7"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4effb] text-[#0b5b9e]"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5" /></svg></span><div><h2 className="text-xl font-semibold tracking-[-.025em]">Instrument catalog</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Import the latest supported stocks and ETFs, update existing metadata, and add newly listed instruments.</p></div></div><button onClick={syncCatalog} disabled={catalogSyncing} className="mt-7 w-full rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{catalogSyncing ? 'Synchronizing instruments…' : 'Sync instrument catalog'}</button><div className="mt-6 rounded-xl bg-[#f4f8fd] p-4 text-xs leading-5 text-[#4d6882]">Symbols no longer in the source catalog are marked inactive. Their transactions and market-data history stay intact, but future market-data syncs and new-transaction search exclude them. Run this before classification sync so newly imported companies can receive their SEC sector and industry data.</div></section>
      <section className="rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-7"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4effb] text-[#0b5b9e]"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg></span><div><h2 className="text-xl font-semibold tracking-[-.025em]">Company classifications</h2><p className="mt-1 text-sm leading-6 text-[#556c84]">Fetch pending company SIC classifications from SEC data, then derive sector and industry information used by portfolio allocation.</p></div></div><div className="mt-7"><label className="text-sm font-semibold">Batch size <span className="font-normal text-[#607991]">(1–500)</span><input type="number" min="1" max="500" value={classificationLimit} onChange={(event) => setClassificationLimit(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none focus:border-[#327ab7]" /></label><button onClick={syncClassifications} disabled={classificationSyncing} className="mt-4 w-full rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{classificationSyncing ? 'Synchronizing classifications…' : 'Sync company classifications'}</button></div><div className="mt-6 rounded-xl bg-[#f4f8fd] p-4 text-xs leading-5 text-[#4d6882]">Only stocks with a CIK and no existing classification are selected. Run additional batches until the remaining count reaches zero.</div></section>
    </div>}

    <section className="mt-6 rounded-[22px] border border-[#c4d5e8] bg-[#e7f1fc] p-5 md:p-6"><h2 className="font-semibold">Administrator access</h2><p className="mt-1 text-sm leading-6 text-[#4d6882]">These synchronization operations are restricted to accounts with the ADMIN role.</p></section>
  </main>
}

export default AdminPage
