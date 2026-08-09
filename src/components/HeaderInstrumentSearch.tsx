import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { searchInstruments } from '../api/instruments'
import type { Instrument } from '../types/instrument'
import InstrumentMark from './InstrumentMark'

type HeaderInstrumentSearchProps = {
  className?: string
  mobile?: boolean
  onSelect: (symbol: string) => void
}

export default function HeaderInstrumentSearch({ className = '', mobile = false, onSelect }: HeaderInstrumentSearchProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const resultsId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  useEffect(() => {
    const value = query.trim()
    if (!value) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      searchInstruments(value, controller.signal)
        .then((instruments) => {
          setResults(instruments.slice(0, 8))
          setHighlighted(0)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const choose = (instrument: Instrument) => {
    setQuery('')
    setResults([])
    setOpen(false)
    onSelect(instrument.symbol)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setOpen(true)
      setHighlighted((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setHighlighted((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (results[highlighted]) choose(results[highlighted])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showResults = open && Boolean(query.trim())
  return <div ref={rootRef} className={`relative ${className}`}>
    <svg className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#879089] ${mobile ? 'size-4' : 'size-3.5'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    <input
      value={query}
      onChange={(event) => { setQuery(event.target.value.slice(0, 50)); setOpen(true) }}
      onFocus={() => { if (query.trim()) setOpen(true) }}
      onKeyDown={handleKeyDown}
      autoComplete="off"
      role="combobox"
      aria-expanded={showResults}
      aria-controls={resultsId}
      aria-autocomplete="list"
      className={`w-full border border-[#dfe4df] bg-white pl-10 outline-none placeholder:text-[#879089] focus:border-[#789887] focus:ring-4 focus:ring-[#e2ebe5] dark:border-[#35463d] dark:bg-[#18231e] dark:text-[#e5ebe7] dark:focus:ring-[#25342c] ${mobile ? 'rounded-xl py-3 pr-3 text-sm' : 'rounded-xl py-2.5 pr-3 text-[11px] shadow-sm'}`}
      placeholder="Search stocks or ETFs"
      aria-label="Search stocks or ETFs"
    />
    {showResults && <div id={resultsId} role="listbox" className="absolute left-0 right-0 top-full z-70 mt-2 max-h-[min(26rem,70vh)] overflow-y-auto rounded-2xl border border-[#dce3dd] bg-white p-1.5 shadow-[0_18px_50px_rgba(20,38,29,.22)] dark:border-[#35463d] dark:bg-[#18231e]">
      {loading && !results.length ? <p className="px-3 py-5 text-center text-xs text-[#7b867f]">Searching instruments…</p> : results.length ? results.map((instrument, index) => <button
        key={instrument.symbol}
        type="button"
        role="option"
        aria-selected={highlighted === index}
        onMouseEnter={() => setHighlighted(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(instrument)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${highlighted === index ? 'bg-[#eef2ee] dark:bg-[#25342c]' : 'hover:bg-[#f7f9f7] dark:hover:bg-[#202d26]'}`}
      ><InstrumentMark symbol={instrument.symbol} size="small" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm text-[#18251f] dark:text-[#edf2ef]">{instrument.symbol}</strong><span className="rounded-md bg-[#f0f3f0] px-1.5 py-0.5 text-[9px] font-semibold text-[#748078] dark:bg-[#2a3830]">{instrument.instrumentType}</span></span><span className="mt-0.5 block truncate text-xs text-[#7b867f]">{instrument.name}</span></span><span className="shrink-0 text-[10px] text-[#929b95]">{instrument.exchange}</span></button>) : !loading ? <p className="px-3 py-5 text-center text-xs text-[#7b867f]">No matching stocks or ETFs</p> : null}
    </div>}
  </div>
}
