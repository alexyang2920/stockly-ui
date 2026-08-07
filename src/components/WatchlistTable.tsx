import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { createWatchlist as createWatchlistRequest, deleteWatchlist as deleteWatchlistRequest, getWatchlists, removeWatchlistInstrument } from '../api/watchlists'
import InstrumentMark from './InstrumentMark'
import type { AuthResponse } from '../types/auth'
import type { Watchlist } from '../types/instrument'

type WatchlistTableProps = {
  auth: AuthResponse | null
  onNeedAuth: () => void
  onSelectInstrument: (symbol: string) => void
  onSymbolsChange: (symbols: Set<string>) => void
}

function WatchlistTable({ auth, onNeedAuth, onSelectInstrument, onSymbolsChange }: WatchlistTableProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(Boolean(auth))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getWatchlists(auth, controller.signal)
      .then((data) => {
        setWatchlists(data)
        setSelectedId(data[0]?.id ?? '')
        onSymbolsChange(new Set(data.flatMap((watchlist) => watchlist.instruments.map((instrument) => instrument.symbol))))
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(apiErrorMessage(reason, 'Cannot reach the Stockly API.'))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth, onSymbolsChange])

  const selected = watchlists.find((watchlist) => watchlist.id === selectedId) ?? watchlists[0]
  const instruments = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!selected) return []
    return term ? selected.instruments.filter((instrument) => `${instrument.symbol} ${instrument.name}`.toLowerCase().includes(term)) : selected.instruments
  }, [query, selected])

  const createWatchlist = async (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!auth || !name) return
    setSaving(true)
    setError('')
    try {
      const created = await createWatchlistRequest(auth, name)
      setWatchlists((current) => [...current, created])
      setSelectedId(created.id)
      setNewName('')
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Unable to create watchlist'))
    } finally {
      setSaving(false)
    }
  }

  const removeInstrument = async (watchlistId: string, symbol: string) => {
    if (!auth) return
    setError('')
    try {
      await removeWatchlistInstrument(auth, watchlistId, symbol)
      setWatchlists((current) => {
        const next = current.map((watchlist) => watchlist.id === watchlistId ? { ...watchlist, instruments: watchlist.instruments.filter((instrument) => instrument.symbol !== symbol) } : watchlist)
        onSymbolsChange(new Set(next.flatMap((watchlist) => watchlist.instruments.map((instrument) => instrument.symbol))))
        return next
      })
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Unable to remove instrument'))
    }
  }

  const deleteWatchlist = async () => {
    if (!auth || !selected) return
    if (!window.confirm(`Delete “${selected.name}”? This will remove the watchlist and cannot be undone.`)) return
    setSaving(true)
    setError('')
    try {
      await deleteWatchlistRequest(auth, selected.id)
      const next = watchlists.filter((watchlist) => watchlist.id !== selected.id)
      setWatchlists(next)
      setSelectedId(next[0]?.id ?? '')
      setQuery('')
      onSymbolsChange(new Set(next.flatMap((watchlist) => watchlist.instruments.map((instrument) => instrument.symbol))))
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Cannot reach the Stockly API.'))
    } finally {
      setSaving(false)
    }
  }

  if (!auth) return <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white p-8 text-center shadow-[0_12px_40px_rgba(23,39,30,.035)]"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf1ec] text-[#285d43]"><BookmarkIcon /></span><h2 className="mt-4 text-lg font-semibold">Your watchlist, in one place</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77837b]">Sign in to see the instruments saved to your personal watchlists.</p><button onClick={onNeedAuth} className="mt-5 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white hover:bg-[#205139]">Sign in to continue</button></section>

  return <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white shadow-[0_1px_2px_rgba(23,39,30,.02),0_12px_40px_rgba(23,39,30,.035)]">
    <div className="flex flex-col gap-4 border-b border-[#e5e9e5] p-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-[-.02em]">Your watchlist</h2>{watchlists.length > 0 && <><select value={selected?.id ?? ''} onChange={(event) => { setSelectedId(event.target.value); setQuery('') }} className="max-w-40 rounded-lg border border-[#dce2dd] bg-[#f7f9f7] px-2 py-1 text-xs font-semibold outline-none" aria-label="Select watchlist">{watchlists.map((watchlist) => <option key={watchlist.id} value={watchlist.id}>{watchlist.name}</option>)}</select><button onClick={deleteWatchlist} disabled={saving} className="grid size-7 place-items-center rounded-lg text-[#8b958f] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" aria-label={`Delete ${selected?.name ?? 'watchlist'}`} title="Delete selected watchlist"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg></button></>}</div><p className="mt-1 text-sm text-[#7b867f]">{selected ? `${selected.instruments.length} ${selected.instruments.length === 1 ? 'instrument' : 'instruments'}` : 'Create a list to get started'}</p></div>
      {selected && <div className="relative w-full sm:w-64"><svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a958e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-[#dfe4df] bg-[#fafbf9] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#779a86] focus:ring-4 focus:ring-[#dfe9e1]" placeholder="Filter this watchlist" aria-label="Filter selected watchlist" /></div>}
    </div>

    {error && <div role="alert" className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="space-y-px bg-[#edf0ed]" aria-label="Loading watchlists">{[1, 2, 3].map((item) => <div key={item} className="h-[76px] animate-pulse bg-white" />)}</div> : !selected ? <form onSubmit={createWatchlist} className="px-6 py-14 text-center"><p className="font-semibold">You don’t have a watchlist yet</p><p className="mt-1 text-sm text-[#7b867f]">Create one, then add instruments from their detail pages.</p><div className="mx-auto mt-5 flex max-w-sm gap-2"><input required maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#dce2dd] px-3.5 py-2.5 text-sm outline-none focus:border-[#779a86]" placeholder="e.g. Long-term ideas" aria-label="New watchlist name" /><button disabled={saving} className="rounded-xl bg-[#173c2c] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Creating…' : 'Create'}</button></div></form> : instruments.length === 0 ? <div className="px-6 py-14 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#eef2ee] text-[#647168]"><BookmarkIcon /></span><p className="mt-4 font-semibold">{query ? 'No matching instruments' : `${selected.name} is empty`}</p><p className="mt-1 text-sm text-[#7b867f]">{query ? 'Try another symbol or company name.' : 'Search for an instrument and add it from its detail page.'}</p></div> : <>
      <div className="hidden grid-cols-[minmax(210px,1fr)_120px_150px_44px] gap-4 border-b border-[#edf0ed] bg-[#fafbf9] px-6 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#8b958f] md:grid"><span>Company</span><span>Type</span><span>Exchange</span><span /></div>
      <div>{instruments.map((instrument) => <div key={instrument.symbol} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#edf0ed] px-5 py-4 last:border-0 md:grid-cols-[minmax(210px,1fr)_120px_150px_44px] md:gap-4 md:px-6"><button onClick={() => onSelectInstrument(instrument.symbol)} className="flex min-w-0 items-center gap-3 text-left"><InstrumentMark symbol={instrument.symbol} /><span className="min-w-0"><strong className="text-sm">{instrument.symbol}</strong><span className="mt-1 block truncate text-xs text-[#7b867f]">{instrument.name}</span></span></button><span className="hidden text-xs font-semibold text-[#68746c] md:block">{instrument.instrumentType}</span><span className="hidden text-sm text-[#68746c] md:block">{instrument.exchange}</span><button onClick={() => removeInstrument(selected.id, instrument.symbol)} className="grid size-9 place-items-center rounded-xl text-[#8b958f] hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${instrument.symbol} from ${selected.name}`} title="Remove from watchlist"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg></button></div>)}</div>
    </>}

    {watchlists.length > 0 && <form onSubmit={createWatchlist} className="flex gap-2 border-t border-[#e5e9e5] bg-[#fafbf9] px-5 py-3"><input required maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#929b95]" placeholder="Create another watchlist…" aria-label="New watchlist name" /><button disabled={saving} className="rounded-lg px-3 py-2 text-xs font-bold text-[#285d43] hover:bg-[#eaf1ec] disabled:opacity-60">{saving ? 'Creating…' : 'Add list'}</button></form>}
  </section>
}

function BookmarkIcon() {
  return <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" /></svg>
}

export default WatchlistTable
