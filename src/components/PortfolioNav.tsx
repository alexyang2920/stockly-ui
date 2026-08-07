import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { apiErrorMessage } from '../api/client'
import { createPortfolio, deletePortfolio, getPortfolios, updatePortfolio } from '../api/portfolios'
import type { AuthResponse } from '../types/auth'
import type { Portfolio } from '../types/portfolio'

type PortfolioNavProps = {
  auth: AuthResponse
  selectedId?: string
  onSelect: (portfolioId: string) => void
  mobile?: boolean
}

function PortfolioNav({ auth, selectedId, onSelect, mobile = false }: PortfolioNavProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [managingPortfolio, setManagingPortfolio] = useState<Portfolio | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === selectedId) ?? portfolios[0]
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getPortfolios(auth, controller.signal).then((data) => {
      setPortfolios(data)
    }).catch(() => { if (!controller.signal.aborted) setPortfolios([]) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return <>
    <div ref={menuRef} className={`relative ${mobile ? 'mb-3 block w-full' : 'hidden md:block'}`}>
      <button disabled={loading} onClick={() => setMenuOpen((open) => !open)} className={`${mobile ? 'w-full' : 'w-44 xl:w-52'} flex h-10 items-center gap-2 rounded-xl border border-[#dfe4df] bg-white px-3 text-left transition hover:border-[#aeb9b1] disabled:opacity-60`} aria-haspopup="menu" aria-expanded={menuOpen}>
        <span className="grid size-6 shrink-0 place-items-center text-[#617068]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{loading ? 'Loading…' : activePortfolio?.name ?? 'Select portfolio'}</span>
        <svg className={`size-4 shrink-0 text-[#87918b] transition ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {menuOpen && <div role="menu" className={`${mobile ? 'left-0 right-0' : 'right-0 w-72'} absolute top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#dce3dd] bg-white shadow-[0_18px_50px_rgba(20,38,29,.2)] dark:border-[#35463d] dark:bg-[#18231e]`}>
        <div className="border-b border-[#e5e9e5] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#87918b]">Your portfolios</p></div>
        <div className="max-h-64 overflow-y-auto p-1.5">{portfolios.length ? portfolios.map((portfolio) => <div key={portfolio.id} className={`group flex items-center rounded-xl ${portfolio.id === activePortfolio?.id ? 'bg-[#eef2ee] dark:bg-[#25342c]' : 'hover:bg-[#f7f9f7] dark:hover:bg-[#202d26]'}`}><button role="menuitem" onClick={() => { setMenuOpen(false); onSelect(portfolio.id) }} className="min-w-0 flex-1 px-3 py-2.5 text-left"><span className="block truncate text-sm font-bold">{portfolio.name}</span><span className="mt-0.5 block truncate text-[11px] text-[#7b867f]">{portfolio.description || `${portfolio.currency} portfolio`}</span></button><button onClick={() => { setMenuOpen(false); setManagingPortfolio(portfolio) }} className="mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-[#7b867f] hover:bg-white hover:text-[#285d43] dark:hover:bg-[#141d19]" aria-label={`Edit ${portfolio.name}`} title={`Edit ${portfolio.name}`}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6.2L14.7 3h-4L10.3 6.2a8 8 0 0 0-1.5.9l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.5.9l.4 3.2h4l.3-3.2a8 8 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></svg></button></div>) : <p className="px-3 py-5 text-center text-xs text-[#7b867f]">No portfolios yet</p>}</div>
        <button onClick={() => { setMenuOpen(false); setShowCreate(true) }} className="flex w-full items-center gap-2 border-t border-[#e5e9e5] px-4 py-3 text-left text-xs font-bold text-[#285d43] hover:bg-[#eaf1ec] dark:text-[#8dd0aa] dark:hover:bg-[#202d26]"><span className="grid size-6 place-items-center rounded-lg bg-[#eaf1ec] dark:bg-[#25342c]"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></span>Create new portfolio</button>
      </div>}
    </div>
    {showCreate && <PortfolioDialog auth={auth} onClose={() => setShowCreate(false)} onSaved={(portfolio) => { setPortfolios((current) => [...current, portfolio]); setShowCreate(false); onSelect(portfolio.id) }} />}
    {managingPortfolio && <PortfolioDialog auth={auth} portfolio={managingPortfolio} onClose={() => setManagingPortfolio(null)} onSaved={(updated) => { setPortfolios((current) => current.map((portfolio) => portfolio.id === updated.id ? updated : portfolio)); setManagingPortfolio(null) }} onDeleted={() => { const remaining = portfolios.filter((portfolio) => portfolio.id !== managingPortfolio.id); setPortfolios(remaining); setManagingPortfolio(null); if (managingPortfolio.id === activePortfolio?.id) onSelect(remaining[0]?.id ?? '') }} />}
  </>
}

function PortfolioDialog({ auth, portfolio, onClose, onSaved, onDeleted }: { auth: AuthResponse, portfolio?: Portfolio, onClose: () => void, onSaved: (portfolio: Portfolio) => void, onDeleted?: () => void }) {
  const editing = Boolean(portfolio)
  const [name, setName] = useState(portfolio?.name ?? '')
  const [currency, setCurrency] = useState(portfolio?.currency ?? 'USD')
  const [description, setDescription] = useState(portfolio?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const fieldClass = 'mt-2 w-full rounded-xl border border-[#dce2dd] bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]'
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const saved = portfolio
        ? await updatePortfolio(auth, portfolio.id, { name, description })
        : await createPortfolio(auth, { name, currency, description })
      onSaved(saved)
    }
    catch (reason) { setError(apiErrorMessage(reason, editing ? 'Unable to update portfolio.' : 'Unable to create portfolio.')) }
    finally { setSaving(false) }
  }
  const remove = async () => {
    if (!portfolio || !onDeleted) return
    setSaving(true); setError('')
    try { await deletePortfolio(auth, portfolio.id, true); onDeleted() }
    catch (reason) { setError(apiErrorMessage(reason, 'Unable to delete portfolio.')) }
    finally { setSaving(false) }
  }
  return createPortal(<div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-[#0a1711]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section role="dialog" aria-modal="true" className="my-5 w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-semibold">{editing ? 'Edit portfolio' : 'Create a portfolio'}</h2><p className="mt-1 text-sm text-[#77837b]">{editing ? 'Update this portfolio or remove it permanently.' : 'Add another account or investment strategy.'}</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl hover:bg-[#f1f3f1]" aria-label="Close"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Main Brokerage" autoFocus /></label><div className="grid grid-cols-[110px_1fr] gap-4"><label className="block text-sm font-semibold">Currency<input required readOnly={editing} pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={`${fieldClass} ${editing ? 'cursor-not-allowed opacity-60' : ''}`} /></label><label className="block text-sm font-semibold">Description<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} placeholder="Long-term" /></label></div>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={saving} className="w-full rounded-xl bg-[#173c2c] py-3.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create portfolio'}</button></form>{editing && <div className="mt-6 border-t border-[#e5e9e5] pt-5">{confirmDelete ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-bold text-rose-700">Delete this portfolio permanently?</p><p className="mt-1 text-xs leading-5 text-rose-600">All holdings and transaction history inside it will also be deleted. This cannot be undone.</p><div className="mt-4 flex gap-2"><button disabled={saving} onClick={remove} className="flex-1 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">{saving ? 'Deleting…' : 'Yes, delete everything'}</button><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-bold text-rose-700">Cancel</button></div></div> : <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded-xl border border-rose-200 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Delete portfolio</button>}</div>}</section></div>, document.body)
}

export default PortfolioNav
