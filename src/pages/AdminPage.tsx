import { useEffect, useState } from 'react'
import { getMarketDataStatus, syncCompanyClassifications, syncInstrumentCatalog, syncMarketData } from '../api/admin'
import { apiErrorMessage } from '../api/client'
import type { MarketDataDatasetStatus } from '../types/admin'
import type { AuthResponse } from '../types/auth'
import { localDateKey } from '../utils/date'

const datasetCopy = {
  QUOTES: ['Daily quotes', 'One grouped Massive request for all U.S. instruments'],
  DIVIDENDS: ['Dividends', 'Market-wide, incremental and automatically paginated'],
  SPLITS: ['Stock splits', 'Forward splits, reverse splits, and stock dividends'],
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

function AdminPage({ auth, onNeedAuth }: { auth: AuthResponse | null, onNeedAuth: () => void }) {
  const isAdmin = auth?.user.role === 'ADMIN'
  const [tab, setTab] = useState<'market' | 'instruments'>('instruments')
  const [statuses, setStatuses] = useState<MarketDataDatasetStatus[]>([])
  const [selected, setSelected] = useState({ QUOTES: true, DIVIDENDS: true, SPLITS: true })
  const [marketDate, setMarketDate] = useState(previousWeekday)
  const [corporateFrom, setCorporateFrom] = useState('')
  const [loading, setLoading] = useState(isAdmin)
  const [syncing, setSyncing] = useState(false)
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
    getMarketDataStatus(auth, controller.signal).then(setStatuses)
      .catch((reason: unknown) => setError(apiErrorMessage(reason, 'Unable to load synchronization status.')))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, isAdmin])

  if (!auth) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><h1 className="text-2xl font-semibold">Administration requires authentication</h1><p className="mt-2 text-sm text-[#536d86]">Sign in with an administrator account to continue.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#0b3b66] px-5 py-3 text-sm font-bold text-white">Sign in</button></section></main>
  if (!isAdmin) return <main className="mx-auto max-w-[900px] px-5 py-16"><section className="rounded-[24px] border border-[#c4d5e8] bg-white px-7 py-16 text-center"><h1 className="text-2xl font-semibold">Administrator access required</h1><p className="mt-2 text-sm text-[#536d86]">Your account does not have permission to manage FolioNest data.</p></section></main>

  const runSync = async (mode: 'market' | 'continue-dividends' | 'restart-dividends') => {
    const dividendOnly = mode !== 'market'
    if (mode === 'market' && !selected.QUOTES && !selected.SPLITS) { setError('Select quotes or splits to synchronize.'); return }
    setSyncing(true); setError(''); setSummary('')
    try {
      const result = await syncMarketData(auth, {
        quotes: dividendOnly ? false : selected.QUOTES,
        dividends: dividendOnly,
        splits: dividendOnly ? false : selected.SPLITS,
        marketDate: !dividendOnly && selected.QUOTES ? marketDate : undefined,
        corporateActionsFrom: mode === 'continue-dividends' ? undefined : corporateFrom || undefined,
        restartDividends: mode === 'restart-dividends',
      })
      setStatuses((current) => current.map((status) => result.datasets.find((item) => item.dataset === status.dataset) ?? status))
      const processed = result.datasets.reduce((total, item) => total + item.recordsProcessed, 0)
      setSummary(`Processed ${processed.toLocaleString()} records across ${result.datasets.length} datasets for ${result.instrumentsAvailable.toLocaleString()} FolioNest instruments.`)
    } catch (reason) { setError(apiErrorMessage(reason, 'Market-data synchronization failed.')) }
    finally { setSyncing(false) }
  }

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
    <nav className="mb-7 flex overflow-x-auto border-b border-[#c4d5e8]" aria-label="Administration sections">{([['instruments', 'Instruments'], ['market', 'Market Data']] as const).map(([key, label]) => <button key={key} onClick={() => { setTab(key); setError('') }} className={`relative min-w-max px-4 py-4 text-sm font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:transition ${tab === key ? 'text-[#0b3b66] after:bg-[#0b5b9e] dark:text-[#bddcff]' : 'text-[#566f88] after:bg-transparent hover:bg-[#edf4fb] hover:text-[#0b5b9e]'}`} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}</nav>

    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {tab === 'market' && summary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{summary}</div>}
    {tab === 'instruments' && catalogSummary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{catalogSummary}</div>}
    {tab === 'instruments' && classificationSummary && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{classificationSummary}</div>}

    {tab === 'market' && <>
    <section className="grid gap-4 md:grid-cols-3">
      {(['QUOTES', 'DIVIDENDS', 'SPLITS'] as const).map((dataset) => {
        const status = statuses.find((item) => item.dataset === dataset)
        return <label key={dataset} className={`cursor-pointer rounded-[20px] border bg-white p-5 transition ${selected[dataset] ? 'border-[#6f947f] ring-4 ring-[#e8f0fb]' : 'border-[#c4d5e8]'}`}><span className="flex items-start justify-between gap-4"><span><strong className="block text-lg tracking-[-.02em]">{datasetCopy[dataset][0]}</strong><span className="mt-1 block text-xs leading-5 text-[#526b84]">{datasetCopy[dataset][1]}</span></span><input type="checkbox" checked={selected[dataset]} onChange={(event) => setSelected((current) => ({ ...current, [dataset]: event.target.checked }))} className="mt-1 size-4 accent-[#0b5b9e]" /></span><span className="mt-5 block border-t border-[#e8ece8] pt-4"><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#607991]">Last successful run</span>{status?.status && <span className={`rounded-md px-2 py-1 text-[9px] font-bold ${status.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : status.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' : 'bg-[#e6f0fb] text-[#4d6882]'}`}>{status.status}{status.lastHttpStatus ? ` · HTTP ${status.lastHttpStatus}` : ''}</span>}</span><span className="mt-1 block text-sm font-semibold">{loading ? 'Loading…' : status?.lastSuccessfulAt ? new Date(status.lastSuccessfulAt).toLocaleString() : 'Never'}</span><span className="mt-1 block text-xs text-[#526b84]">{status?.recordsProcessed?.toLocaleString() ?? 0} records · {status?.pagesProcessed ?? 0} pages</span>{status?.requestedFrom && <span className="mt-1 block text-[11px] text-[#607991]">Backfill from {status.requestedFrom}</span>}{status?.message && status.status === 'PAUSED' && <span className="mt-2 block text-xs leading-5 text-amber-700">{status.message}</span>}</span></label>
      })}
    </section>

    <section className="mt-6 rounded-[22px] border border-[#c4d5e8] bg-white p-5 md:p-7">
      <div><h2 className="text-xl font-semibold tracking-[-.025em]">Run bulk synchronization</h2><p className="mt-1 text-sm text-[#556c84]">The corporate-actions date is the lower-bound date for a dividend restart and split synchronization.</p></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Quote market date<input type="date" value={marketDate} max={localDate()} onChange={(event) => setMarketDate(event.target.value)} disabled={!selected.QUOTES} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none disabled:opacity-45" /></label>
        <label className="text-sm font-semibold">Corporate actions from <span className="font-normal text-[#607991]">(optional)</span><input type="date" value={corporateFrom} max={localDate()} onChange={(event) => setCorporateFrom(event.target.value)} disabled={!selected.DIVIDENDS && !selected.SPLITS} className="mt-2 w-full rounded-xl border border-[#c3d5e8] bg-white px-3.5 py-3 font-normal outline-none disabled:opacity-45" /><span className="mt-1.5 block text-[11px] font-normal text-[#607991]">Leave empty to use the saved watermark with a seven-day overlap, or two years for the first run.</span></label>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {(selected.QUOTES || selected.SPLITS) && <button onClick={() => runSync('market')} disabled={syncing || loading} className="rounded-xl bg-[#0b3b66] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:cursor-wait disabled:opacity-60">{syncing ? 'Synchronizing…' : 'Sync selected quotes & splits'}</button>}
        {selected.DIVIDENDS && (dividendStatus?.resumable
          ? <button onClick={() => runSync('continue-dividends')} disabled={syncing || loading} className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60">Continue dividend backfill</button>
          : <button onClick={() => runSync('restart-dividends')} disabled={syncing || loading} className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60">Restart dividend backfill</button>)}
      </div>
      <p className="mt-3 text-xs text-[#556c84]">A saved cursor always shows Continue. Without a cursor, Restart begins from the optional corporate-actions date.</p>
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
