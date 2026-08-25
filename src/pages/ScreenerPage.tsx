import { useEffect, useState, type FormEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { createScreener, deleteScreener, getScreenerResults, getScreeners, updateScreener } from '../api/screeners'
import InstrumentMark from '../components/InstrumentMark'
import type { AuthResponse } from '../types/auth'
import type { Screener, ScreenerInput, ScreenerResult } from '../types/screener'

const emptyForm = { name: 'Wheel pullbacks', instrumentType: '', minimumPrice: '', maximumPrice: '', minimumDrawdownPercent: '10', minimumRsi: '', maximumRsi: '50', maximumDailyReturnPercent: '', maximumFiveDayReturnPercent: '', minimumPriceVsSma200Percent: '0', maximumPriceVsSma50Percent: '', drawdownSinceDate: '', maximumDrawdownSinceDatePercent: '', resultLimit: '50' }
type FormState = typeof emptyForm
const fieldClass = 'mt-2 w-full rounded-xl border border-[#dce2dd] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]'
const numericKeys = ['minimumPrice', 'maximumPrice', 'minimumDrawdownPercent', 'minimumRsi', 'maximumRsi', 'maximumDailyReturnPercent', 'maximumFiveDayReturnPercent', 'minimumPriceVsSma200Percent', 'maximumPriceVsSma50Percent', 'maximumDrawdownSinceDatePercent'] as const

function toForm(value: Screener): FormState {
  const result = { ...emptyForm, name: value.name, instrumentType: value.filters.instrumentType ?? '', drawdownSinceDate: value.filters.drawdownSinceDate ?? '', resultLimit: String(value.filters.resultLimit) }
  numericKeys.forEach((key) => { result[key] = value.filters[key] == null ? '' : String(value.filters[key]) })
  return result
}

function toInput(form: FormState): ScreenerInput {
  const value = (key: typeof numericKeys[number]) => form[key] === '' ? null : Number(form[key])
  return { name: form.name.trim(), filters: { instrumentType: form.instrumentType === '' ? null : form.instrumentType as 'STOCK' | 'ETF', minimumPrice: value('minimumPrice'), maximumPrice: value('maximumPrice'), minimumDrawdownPercent: value('minimumDrawdownPercent'), minimumRsi: value('minimumRsi'), maximumRsi: value('maximumRsi'), maximumDailyReturnPercent: value('maximumDailyReturnPercent'), maximumFiveDayReturnPercent: value('maximumFiveDayReturnPercent'), minimumPriceVsSma200Percent: value('minimumPriceVsSma200Percent'), maximumPriceVsSma50Percent: value('maximumPriceVsSma50Percent'), drawdownSinceDate: form.drawdownSinceDate || null, maximumDrawdownSinceDatePercent: value('maximumDrawdownSinceDatePercent'), resultLimit: Number(form.resultLimit) } }
}

function pct(value: number | null) { return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` }

export default function ScreenerPage({ auth, onNeedAuth, onSelectInstrument }: { auth: AuthResponse | null, onNeedAuth: () => void, onSelectInstrument: (symbol: string) => void }) {
  const [screeners, setScreeners] = useState<Screener[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = screeners.find((item) => item.id === selectedId)

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getScreeners(auth, controller.signal).then((items) => { setScreeners(items); if (items[0]) { setSelectedId(items[0].id); setForm(toForm(items[0])) } }).catch((reason) => setError(apiErrorMessage(reason, 'Unable to load screeners.')))
    return () => controller.abort()
  }, [auth])

  const run = async (id = selectedId) => {
    if (!auth || !id) return
    setLoading(true); setError('')
    try { setResults(await getScreenerResults(auth, id)) } catch (reason) { setError(apiErrorMessage(reason, 'Unable to run screener.')) } finally { setLoading(false) }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!auth) return
    setSaving(true); setError('')
    try {
      const saved = selected ? await updateScreener(auth, selected.id, toInput(form)) : await createScreener(auth, toInput(form))
      setScreeners((current) => selected ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setSelectedId(saved.id); setForm(toForm(saved)); await run(saved.id)
    } catch (reason) { setError(apiErrorMessage(reason, 'Unable to save screener.')) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!auth || !selected || !window.confirm(`Delete “${selected.name}”?`)) return
    try { await deleteScreener(auth, selected.id); const remaining = screeners.filter((item) => item.id !== selected.id); setScreeners(remaining); setResults([]); setSelectedId(remaining[0]?.id ?? ''); setForm(remaining[0] ? toForm(remaining[0]) : emptyForm) } catch (reason) { setError(apiErrorMessage(reason, 'Unable to delete screener.')) }
  }

  if (!auth) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold">Saved screeners</h1><p className="mt-3 text-sm text-[#718078]">Sign in to configure and save market filters.</p><button onClick={onNeedAuth} className="mt-6 rounded-xl bg-[#173c2c] px-5 py-3 text-sm font-bold text-white">Sign in</button></main>
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))
  return <main className="mx-auto max-w-[1560px] px-5 py-8 lg:px-8 lg:py-11">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Research</p><h1 className="mt-2 text-[38px] font-semibold tracking-[-.045em]">Market screeners</h1><p className="mt-2 text-sm text-[#738078]">Find pullbacks and trend setups from Stockly's daily price history.</p></div>
    {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="rounded-[22px] border border-[#dfe4df] bg-white p-5">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Configuration</h2><p className="mt-1 text-xs text-[#7b867f]">Blank fields are not applied.</p></div><button onClick={() => { setSelectedId(''); setForm(emptyForm); setResults([]) }} className="rounded-lg border border-[#dce2dd] px-3 py-2 text-xs font-bold">New</button></div>
        <select value={selectedId} onChange={(event) => { const item = screeners.find((value) => value.id === event.target.value); setSelectedId(event.target.value); if (item) setForm(toForm(item)); setResults([]) }} className={`${fieldClass} mt-0`}><option value="">New screener</option>{screeners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Name<input required maxLength={100} value={form.name} onChange={(event) => set('name', event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-semibold">Instrument type<select value={form.instrumentType} onChange={(event) => set('instrumentType', event.target.value)} className={fieldClass}><option value="">Stocks and ETFs</option><option value="STOCK">Stocks</option><option value="ETF">ETFs</option></select></label>
          <div className="grid grid-cols-2 gap-3"><NumberField label="Minimum price" value={form.minimumPrice} onChange={(value) => set('minimumPrice', value)} /><NumberField label="Maximum price" value={form.maximumPrice} onChange={(value) => set('maximumPrice', value)} /></div>
          <NumberField label="Minimum drawdown from 52-week high (%)" value={form.minimumDrawdownPercent} onChange={(value) => set('minimumDrawdownPercent', value)} min="0" max="100" />
          <div className="grid grid-cols-2 gap-3"><NumberField label="Minimum RSI(14)" value={form.minimumRsi} onChange={(value) => set('minimumRsi', value)} min="0" max="100" /><NumberField label="Maximum RSI(14)" value={form.maximumRsi} onChange={(value) => set('maximumRsi', value)} min="0" max="100" /></div>
          <div className="grid grid-cols-2 gap-3"><NumberField label="Max 1-day return (%)" value={form.maximumDailyReturnPercent} onChange={(value) => set('maximumDailyReturnPercent', value)} /><NumberField label="Max 5-day return (%)" value={form.maximumFiveDayReturnPercent} onChange={(value) => set('maximumFiveDayReturnPercent', value)} /></div>
          <div className="grid grid-cols-2 gap-3"><NumberField label="Min vs SMA200 (%)" value={form.minimumPriceVsSma200Percent} onChange={(value) => set('minimumPriceVsSma200Percent', value)} /><NumberField label="Max vs SMA50 (%)" value={form.maximumPriceVsSma50Percent} onChange={(value) => set('maximumPriceVsSma50Percent', value)} /></div>
          <div className="rounded-2xl border border-[#e3e8e3] bg-[#fafbf9] p-4"><p className="text-sm font-semibold">Drawdown since date</p><p className="mt-1 text-xs leading-5 text-[#7b867f]">Compares the latest close with the highest close on or after this date.</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Start date<input type="date" value={form.drawdownSinceDate} onChange={(event) => set('drawdownSinceDate', event.target.value)} className={fieldClass} /></label><NumberField label="Threshold (%)" value={form.maximumDrawdownSinceDatePercent} onChange={(value) => set('maximumDrawdownSinceDatePercent', value)} min="-100" max="0" /></div><p className="mt-2 text-xs text-[#7b867f]">Example: enter <strong>-50</strong> to find instruments currently down at least 50% from their peak since the selected date.</p></div>
          <NumberField label="Maximum results" value={form.resultLimit} onChange={(value) => set('resultLimit', value)} min="1" max="200" step="1" />
          <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-[#173c2c] py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : selected ? 'Save changes' : 'Save and run'}</button>{selected && <button type="button" onClick={remove} className="rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-600">Delete</button>}</div>
        </form>
      </section>
      <section className="overflow-hidden rounded-[22px] border border-[#dfe4df] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e9e5] px-5 py-5"><div><h2 className="font-semibold">Results</h2><p className="mt-1 text-xs text-[#7b867f]">{results.length ? `${results.length} matches · latest stored market dates` : 'Save or select a screener, then run it.'}</p></div><button disabled={!selectedId || loading} onClick={() => void run()} className="rounded-xl bg-[#d8f768] px-4 py-2.5 text-sm font-bold disabled:opacity-40">{loading ? 'Running…' : 'Run screener'}</button></div>
        {loading ? <div className="h-60 animate-pulse bg-[#f7f9f7]" /> : results.length === 0 ? <div className="px-6 py-20 text-center text-sm text-[#7b867f]">No results to display.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px]"><thead className="bg-[#fafbf9] text-[10px] uppercase tracking-[.12em] text-[#849088]"><tr><th className="px-5 py-3 text-left">Instrument</th><th className="px-3 py-3 text-right">Price</th><th className="px-3 py-3 text-right">52w drawdown</th>{selected?.filters.drawdownSinceDate && <th className="px-3 py-3 text-right">Since {selected.filters.drawdownSinceDate}</th>}<th className="px-3 py-3 text-right">RSI</th><th className="px-3 py-3 text-right">1 day</th><th className="px-3 py-3 text-right">5 days</th><th className="px-5 py-3 text-right">vs SMA200</th></tr></thead><tbody>{results.map((item) => <tr key={item.symbol} className="border-t border-[#ecefec] hover:bg-[#fafcf9]"><td className="px-5 py-4"><button onClick={() => onSelectInstrument(item.symbol)} className="flex items-center gap-3 text-left"><InstrumentMark symbol={item.symbol} size="small" /><span><strong className="block text-sm">{item.symbol}</strong><small className="block max-w-56 truncate text-[#7b867f]">{item.name}</small></span></button></td><td className="px-3 py-4 text-right text-sm font-semibold">${item.price.toFixed(2)}</td><td className="px-3 py-4 text-right text-sm font-semibold text-amber-700">-{item.drawdownPercent.toFixed(2)}%</td>{selected?.filters.drawdownSinceDate && <MetricCell value={item.drawdownSinceDatePercent} />}<td className="px-3 py-4 text-right text-sm">{item.rsi14.toFixed(1)}</td><MetricCell value={item.dailyReturnPercent} /><MetricCell value={item.fiveDayReturnPercent} /><MetricCell value={item.priceVsSma200Percent} wide /></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>
}

function NumberField({ label, value, onChange, min, max, step = 'any' }: { label: string, value: string, onChange: (value: string) => void, min?: string, max?: string, step?: string }) { return <label className="block text-sm font-semibold">{label}<input type="number" value={value} onChange={(event) => onChange(event.target.value)} min={min} max={max} step={step} className={fieldClass} /></label> }
function MetricCell({ value, wide = false }: { value: number | null, wide?: boolean }) { return <td className={`${wide ? 'px-5' : 'px-3'} py-4 text-right text-sm font-semibold ${value == null ? 'text-[#87918b]' : value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(value)}</td> }
