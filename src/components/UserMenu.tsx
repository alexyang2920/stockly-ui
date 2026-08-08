import { useEffect, useRef, useState } from 'react'
import type { AuthResponse } from '../types/auth'

function UserMenu({ auth, darkMode, mobile = false, onToggleTheme, onSignOut, onAdmin }: { auth: AuthResponse, darkMode: boolean, mobile?: boolean, onToggleTheme: () => void, onSignOut: () => void, onAdmin: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [open])

  const initial = auth.user.name.slice(0, 1).toUpperCase()
  if (mobile) return <div className="w-full">
    <div className="flex items-center gap-3 px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d8f768] text-xs font-extrabold text-[#173c2c]">{initial}</span><span className="min-w-0"><strong className="block truncate text-sm">{auth.user.name}</strong><span className="mt-0.5 block truncate text-xs text-[#7b867f]">{auth.user.email}</span></span></div>
    <div className="space-y-1 p-1.5"><button role="menuitemcheckbox" aria-checked={darkMode} onClick={onToggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f3f6f3] dark:hover:bg-[#243129]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{darkMode ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></> : <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />}</svg><span className="flex-1">Dark mode</span><span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${darkMode ? 'bg-[#285d43]' : 'bg-[#cdd4cf]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${darkMode ? 'left-[18px]' : 'left-0.5'}`} /></span></button>{auth.user.role === 'ADMIN' && <button role="menuitem" onClick={onAdmin} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f3f6f3] dark:hover:bg-[#243129]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3" /></svg>Administration</button>}<button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>Sign out</button></div>
  </div>

  return <div ref={menuRef} className={`relative ${mobile ? 'w-full' : ''}`}>
    <button onClick={() => setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open} className={`flex items-center gap-2 text-sm font-semibold transition ${mobile ? 'w-full rounded-lg px-3 py-3 text-[#15231d] hover:bg-[#f3f5f2] dark:text-[#e8eee9] dark:hover:bg-[#202d26]' : 'rounded-xl bg-[#173c2c] p-2 text-white shadow-[0_8px_20px_rgba(23,60,44,.18)] hover:bg-[#205139] sm:px-3'}`}>
      <span className="grid size-6 place-items-center rounded-full bg-[#d8f768] text-[10px] font-extrabold text-[#173c2c]">{initial}</span>
      <span className={`${mobile ? 'block max-w-none flex-1 text-left' : 'hidden max-w-24 lg:block'} truncate`}>{auth.user.name}</span>
      <svg className={`${mobile ? 'block' : 'hidden lg:block'} size-3.5 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div role="menu" className={`${mobile ? 'relative mt-2 w-full shadow-none' : 'absolute right-0 top-[calc(100%+10px)] w-64 shadow-[0_18px_50px_rgba(20,38,29,.2)]'} z-50 overflow-hidden rounded-2xl border border-[#dce3dd] bg-white dark:border-[#35463d] dark:bg-[#18231e]`}>
      <div className="flex items-center gap-3 border-b border-[#e5e9e5] px-4 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d8f768] text-sm font-extrabold text-[#173c2c]">{initial}</span><span className="min-w-0"><strong className="block truncate text-sm">{auth.user.name}</strong><span className="mt-0.5 block truncate text-xs text-[#7b867f]">{auth.user.email}</span></span></div>
      <div className="p-1.5"><button role="menuitemcheckbox" aria-checked={darkMode} onClick={onToggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f3f6f3] dark:hover:bg-[#243129]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{darkMode ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></> : <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />}</svg><span className="flex-1">Dark mode</span><span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${darkMode ? 'bg-[#285d43]' : 'bg-[#cdd4cf]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${darkMode ? 'left-[18px]' : 'left-0.5'}`} /></span></button>{auth.user.role === 'ADMIN' && <button role="menuitem" onClick={() => { setOpen(false); onAdmin() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f3f6f3] dark:hover:bg-[#243129]"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3" /></svg>Administration</button>}<button role="menuitem" onClick={() => { setOpen(false); onSignOut() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>Sign out</button></div>
    </div>}
  </div>
}

export default UserMenu
