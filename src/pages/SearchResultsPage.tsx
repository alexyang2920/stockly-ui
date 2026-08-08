import { useEffect, useState, type FormEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { searchInstruments } from '../api/instruments'
import InstrumentMark from '../components/InstrumentMark'
import type { Instrument } from '../types/instrument'

type SearchResultsPageProps = {
  query: string
  onSearch: (query: string) => void
  onSelect: (symbol: string) => void
}

function SearchResultsPage({ query, onSearch, onSelect }: SearchResultsPageProps) {
  const [input, setInput] = useState(query)
  const [results, setResults] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    searchInstruments(query, controller.signal)
      .then(setResults)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(apiErrorMessage(reason, 'Cannot reach the Stockly API.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = input.trim().slice(0, 50)
    if (value) onSearch(value)
  }

  return <main className="mx-auto max-w-[1120px] px-5 py-8 lg:px-8 lg:py-12">
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Instrument discovery</p>
      <h1 className="mt-3 text-[34px] font-semibold tracking-[-.04em] md:text-[44px]">Search the market</h1>
      <p className="mt-2 text-[#738078]">Find stocks and ETFs by ticker, company, or fund name.</p>
    </div>

    <form onSubmit={submit} className="relative mb-8">
      <svg className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#79857d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} maxLength={50} className="w-full rounded-2xl border border-[#d8dfda] bg-white py-4 pl-13 pr-28 text-base shadow-sm outline-none focus:border-[#789887] focus:ring-4 focus:ring-[#e2ebe5]" placeholder="Search Apple, AAPL, Vanguard…" aria-label="Search instruments" />
      <button className="absolute right-2 top-2 rounded-xl bg-[#173c2c] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#205139]">Search</button>
    </form>

    <div className="mb-4 flex items-end justify-between">
      <div><h2 className="text-lg font-semibold">Results for “{query}”</h2>{!loading && !error && <p className="mt-1 text-sm text-[#7c8780]">{results.length} {results.length === 1 ? 'instrument' : 'instruments'} found</p>}</div>
    </div>

    {loading && <div className="grid gap-3" aria-label="Loading search results">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-[#e1e6e2] bg-white" />)}</div>}
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><p className="font-semibold">Search unavailable</p><p className="mt-1 text-sm">{error}</p></div>}
    {!loading && !error && results.length === 0 && <div className="rounded-[22px] border border-[#dde3de] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef2ee] text-[#617068]"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></span><h3 className="mt-4 font-semibold">No instruments found</h3><p className="mt-1 text-sm text-[#7c8780]">Check the spelling or try a ticker symbol.</p></div>}
    {!loading && !error && results.length > 0 && <div className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white shadow-[0_10px_35px_rgba(23,39,30,.035)]">
      {results.map((instrument) => <button key={instrument.symbol} onClick={() => onSelect(instrument.symbol)} className="flex w-full items-center gap-4 border-b border-[#e9ece9] px-5 py-5 text-left transition last:border-0 hover:bg-[#f7faf7] sm:px-6">
        <InstrumentMark symbol={instrument.symbol} />
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong>{instrument.symbol}</strong><span className="rounded-md bg-[#edf1ed] px-2 py-1 text-[9px] font-bold tracking-wide text-[#68746c]">{instrument.instrumentType}</span></span><span className="mt-1 block truncate text-sm text-[#758078]">{instrument.name}</span></span>
        <span className="hidden text-right sm:block"><span className="block text-sm font-semibold">{instrument.exchange}</span><span className="mt-1 block text-xs text-[#87918b]">{instrument.instrumentType === 'ETF' ? 'Funds' : instrument.sector || 'Not classified'}</span></span>
        <svg className="ml-1 size-5 shrink-0 text-[#8b968f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18 6-6-6-6" /></svg>
      </button>)}
    </div>}
  </main>
}

export default SearchResultsPage
