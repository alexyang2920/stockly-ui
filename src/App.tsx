import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import AuthModal from './components/AuthModal'
import InstrumentMark from './components/InstrumentMark'
import PortfolioNav from './components/PortfolioNav'
import UserMenu from './components/UserMenu'
import { getUserPreferences, updateUserPreferences } from './api/users'
import { logout } from './api/auth'
import { configureAuthLifecycle } from './api/client'
import WatchlistTable from './components/WatchlistTable'
import InstrumentPage from './pages/InstrumentPage'
import PortfolioPage from './pages/PortfolioPage'
import AdminPage from './pages/AdminPage'
import SearchResultsPage from './pages/SearchResultsPage'
import DividendCalendarPage from './pages/DividendCalendarPage'
import OverviewPage from './pages/OverviewPage'
import WatchlistPage from './pages/WatchlistPage'
import type { AuthResponse } from './types/auth'
import type { Instrument } from './types/instrument'
import './App.css'

type Route = { view: 'home' } | { view: 'watchlist' } | { view: 'search', query: string } | { view: 'instrument', symbol: string } | { view: 'portfolio', section: 'holdings' | 'transactions', portfolioId?: string, addTransaction: boolean } | { view: 'dividends', portfolioId?: string } | { view: 'admin' }

function routeFromLocation(): Route {
  const instrumentMatch = window.location.pathname.match(/^\/instruments\/([^/]+)$/)
  if (instrumentMatch) return { view: 'instrument', symbol: decodeURIComponent(instrumentMatch[1]).toUpperCase() }
  if (window.location.pathname === '/search') return { view: 'search', query: new URLSearchParams(window.location.search).get('q')?.slice(0, 50) || '' }
  if (window.location.pathname === '/admin') return { view: 'admin' }
  if (window.location.pathname === '/watchlist') return { view: 'watchlist' }
  if (window.location.pathname === '/portfolio/dividends') return { view: 'dividends' }
  if (window.location.pathname === '/portfolio' || window.location.pathname === '/portfolio/holdings' || window.location.pathname === '/portfolio/transactions') {
    const params = new URLSearchParams(window.location.search)
    return { view: 'portfolio', section: window.location.pathname.endsWith('/transactions') ? 'transactions' : 'holdings', portfolioId: params.get('portfolio') || undefined, addTransaction: params.get('add') === 'transaction' }
  }
  return { view: 'home' }
}

const AUTH_STORAGE_KEY = 'stockly.auth'

function readStoredAuth(): AuthResponse | null {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY)
    return value ? JSON.parse(value) as AuthResponse : null
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

type IconName =
  | 'activity' | 'arrow' | 'bell' | 'bookmark' | 'briefcase' | 'chart'
  | 'check' | 'chevron' | 'clock' | 'close' | 'eye' | 'grid' | 'menu'
  | 'more' | 'moon' | 'plus' | 'search' | 'sparkles' | 'sun' | 'trend' | 'user'
  | 'star'

const paths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h4l2.4-7 4.2 14 2.4-7h5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  bookmark: <><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  moon: <><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" /></>,
  star: <><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
}

function Icon({ name, className = 'size-5' }: { name: IconName, className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const fallbackInstruments: Instrument[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semiconductors', instrumentType: 'STOCK', price: 182.41, change: 2.84 },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', instrumentType: 'STOCK', price: 219.57, change: 1.12 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', instrumentType: 'STOCK', price: 514.36, change: -0.38 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', sector: 'Consumer Cyclical', instrumentType: 'STOCK', price: 234.12, change: 0.67 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', sector: 'Communication', instrumentType: 'STOCK', price: 781.43, change: 1.96 },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', exchange: 'NYSE', instrumentType: 'ETF', price: 603.91, change: 0.42 },
]

const sparkLines = [
  '0,25 12,26 24,18 36,20 48,13 60,16 72,8 84,11 96,3',
  '0,23 12,19 24,21 36,12 48,15 60,8 72,11 84,5 96,8',
  '0,8 12,6 24,10 36,9 48,16 60,13 72,19 84,17 96,24',
  '0,26 12,20 24,22 36,15 48,17 60,9 72,11 84,7 96,3',
]

function Sparkline({ index = 0, positive = true }: { index?: number, positive?: boolean }) {
  return <svg viewBox="0 0 96 30" className={`h-8 w-24 ${positive ? 'text-emerald-500' : 'text-rose-400'}`} preserveAspectRatio="none"><polyline points={sparkLines[index % sparkLines.length]} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}

function StockMark({ symbol, small = false }: { symbol: string, small?: boolean }) {
  return <InstrumentMark symbol={symbol} size={small ? 'small' : 'medium'} />
}

function App() {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))
  const [preferredPortfolioId, setPreferredPortfolioId] = useState<string | undefined>()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [watching, setWatching] = useState(() => new Set<string>())
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState('')
  const [auth, setAuth] = useState<AuthResponse | null>(readStoredAuth)
  const [route, setRoute] = useState<Route>(routeFromLocation)
  const [globalSearch, setGlobalSearch] = useState(route.view === 'search' ? route.query : '')

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('stockly.theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!auth) return
    const controller = new AbortController()
    getUserPreferences(auth, controller.signal).then((preferences) => {
      setDarkMode(preferences.darkMode)
      setPreferredPortfolioId(preferences.selectedPortfolioId ?? undefined)
    }).catch(() => { /* Keep local preferences when the server is unavailable. */ })
    return () => controller.abort()
  }, [auth])

  useEffect(() => {
    configureAuthLifecycle({
      onRefreshed: (response) => {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response))
        setAuth(response)
      },
      onExpired: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        setAuth(null)
        setWatching(new Set())
        setPreferredPortfolioId(undefined)
        setToast('Your session expired. Please sign in again.')
        setShowModal(true)
      },
    })
    return () => configureAuthLifecycle(null)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const syncWatchlistSymbols = useCallback((symbols: Set<string>) => setWatching(symbols), [])

  const completeAuth = (response: AuthResponse) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response))
    setAuth(response)
    setShowModal(false)
    setToast(`Welcome${response.user.name ? `, ${response.user.name.split(' ')[0]}` : ''}`)
  }

  const signOut = () => {
    void logout().catch(() => undefined)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuth(null)
    setWatching(new Set())
    setPreferredPortfolioId(undefined)
    setToast('You have been signed out')
  }

  const navigate = (nextRoute: Route) => {
    const url = nextRoute.view === 'home' ? '/' : nextRoute.view === 'watchlist' ? '/watchlist' : nextRoute.view === 'search' ? `/search?q=${encodeURIComponent(nextRoute.query)}` : nextRoute.view === 'instrument' ? `/instruments/${encodeURIComponent(nextRoute.symbol)}` : nextRoute.view === 'admin' ? '/admin' : nextRoute.view === 'dividends' ? '/portfolio/dividends' : `/portfolio/${nextRoute.section}${nextRoute.addTransaction ? '?add=transaction' : ''}`
    window.history.pushState({}, '', url)
    setRoute(nextRoute)
    if (nextRoute.view === 'search') setGlobalSearch(nextRoute.query)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitGlobalSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = globalSearch.trim().slice(0, 50)
    if (query) navigate({ view: 'search', query })
  }

  const selectNav = (item: string) => {
    if (item === 'Overview') navigate({ view: 'home' })
    if (item === 'Dividends') {
      if (auth) navigate({ view: 'dividends', portfolioId: route.view === 'dividends' ? route.portfolioId ?? preferredPortfolioId : preferredPortfolioId })
      else setShowModal(true)
    } else if (item === 'Holdings' || item === 'Transactions') {
      if (auth) navigate({ view: 'portfolio', section: item.toLowerCase() as 'holdings' | 'transactions', portfolioId: route.view === 'portfolio' ? route.portfolioId ?? preferredPortfolioId : preferredPortfolioId, addTransaction: false })
      else setShowModal(true)
    }
  }

  const selectPortfolio = (portfolioId: string) => {
    const nextPortfolioId = portfolioId || undefined
    setPreferredPortfolioId(nextPortfolioId)
    if (auth) void updateUserPreferences(auth, { darkMode, selectedPortfolioId: nextPortfolioId ?? null }).catch(() => undefined)
    if (route.view === 'home') navigate({ view: 'home' })
    else if (route.view === 'dividends') navigate({ view: 'dividends', portfolioId: nextPortfolioId })
    else navigate({ view: 'portfolio', section: route.view === 'portfolio' ? route.section : 'holdings', portfolioId: nextPortfolioId, addTransaction: false })
  }

  const toggleTheme = () => {
    const nextDarkMode = !darkMode
    setDarkMode(nextDarkMode)
    if (auth) void updateUserPreferences(auth, { darkMode: nextDarkMode, selectedPortfolioId: preferredPortfolioId ?? null }).catch(() => undefined)
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#15231d]">
      <header className="sticky top-0 z-40 border-b border-[#dfe4df] bg-[#fbfcf9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center gap-8 px-5 lg:px-8">
          <button className="flex items-center gap-2.5" onClick={() => navigate({ view: 'home' })} aria-label="Stockly home">
            <span className="grid size-9 place-items-center rounded-xl bg-[#173c2c] text-white shadow-[0_7px_18px_rgba(23,60,44,.18)]"><Icon name="trend" className="size-5" /></span>
            <span className="text-[21px] font-bold tracking-[-.04em]">Stockly</span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            <button onClick={() => selectNav('Overview')} className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${route.view === 'home' ? 'bg-[#e9efea] text-[#173c2c] dark:text-[#b8e2c9]' : 'text-[#66716b] hover:bg-white hover:text-[#15231d]'}`}>Overview</button>
            <div className="group relative">
              <button onClick={() => selectNav('Holdings')} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${route.view === 'portfolio' || route.view === 'dividends' ? 'bg-[#e9efea] text-[#173c2c] dark:text-[#b8e2c9]' : 'text-[#66716b] hover:bg-white hover:text-[#15231d]'}`} aria-haspopup="menu"><span>Portfolio</span><svg className="size-3.5 transition group-hover:rotate-180 group-focus-within:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></button>
              <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"><div role="menu" className="w-52 rounded-2xl border border-[#dce3dd] bg-white p-1.5 shadow-[0_16px_45px_rgba(20,38,29,.18)] dark:border-[#35463d] dark:bg-[#18231e]">{(['Holdings', 'Transactions', 'Dividends'] as const).map((item) => <button key={item} role="menuitem" onClick={() => selectNav(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${(item === 'Dividends' ? route.view === 'dividends' : route.view === 'portfolio' && route.section === item.toLowerCase()) ? 'bg-[#eef2ee] text-[#285d43] dark:bg-[#25342c] dark:text-[#b8e2c9]' : 'text-[#66716b] hover:bg-[#f7f9f7] dark:hover:bg-[#202d26]'}`}><span className="grid size-7 place-items-center rounded-lg bg-[#eef2ee] text-[#285d43] dark:bg-[#25342c] dark:text-[#8dd0aa]"><Icon name={item === 'Holdings' ? 'briefcase' : item === 'Dividends' ? 'grid' : 'activity'} className="size-3.5" /></span>{item}</button>)}</div></div>
            </div>
          </nav>

          {auth && <PortfolioNav auth={auth} selectedId={route.view === 'portfolio' || route.view === 'dividends' ? route.portfolioId ?? preferredPortfolioId : preferredPortfolioId} onSelect={selectPortfolio} />}

          <form onSubmit={submitGlobalSearch} className="relative ml-auto hidden min-w-56 md:block xl:min-w-72">
            <Icon name="search" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#879089]" />
            <input id="global-search" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} maxLength={50} className="w-full rounded-xl border border-[#dfe4df] bg-white py-2.5 pl-10 pr-12 text-sm shadow-sm outline-none placeholder:text-[#879089] focus:border-[#789887] focus:ring-4 focus:ring-[#e2ebe5]" placeholder="Search stocks or ETFs" aria-label="Search stocks or ETFs" />
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-[#526158] hover:bg-[#eef2ee]" aria-label="Submit search">↵</button>
          </form>
          <button onClick={() => navigate({ view: 'watchlist' })} className={`grid size-10 place-items-center rounded-xl border bg-white transition hover:border-[#aeb9b1] ${route.view === 'watchlist' ? 'border-[#789887] text-amber-500' : 'border-[#dfe4df] text-[#4e5c54]'}`} aria-label="Open watchlist" title="Watchlist"><Icon name="star" className="size-[18px]" /></button>
          <button onClick={toggleTheme} className="grid size-10 place-items-center rounded-xl border border-[#dfe4df] bg-white text-[#4e5c54] transition hover:border-[#aeb9b1]" aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}><Icon name={darkMode ? 'sun' : 'moon'} className="size-[18px]" /></button>
          <button className="relative hidden size-10 place-items-center rounded-xl border border-[#dfe4df] bg-white text-[#4e5c54] transition hover:border-[#aeb9b1] sm:grid" aria-label="Notifications"><Icon name="bell" className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#f1805b] ring-2 ring-white" /></button>
          {auth ? <UserMenu auth={auth} onAdmin={() => navigate({ view: 'admin' })} onSignOut={signOut} /> : <button onClick={() => setShowModal(true)} className="hidden items-center gap-2 rounded-xl bg-[#173c2c] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(23,60,44,.18)] transition hover:bg-[#205139] sm:flex"><Icon name="user" className="size-4" /> Sign in</button>}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-10 place-items-center rounded-xl border border-[#dfe4df] bg-white lg:hidden" aria-label="Open menu"><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
        </div>
        {mobileOpen && <nav className="border-t border-[#e4e8e4] bg-white px-5 py-3 lg:hidden">{auth && <PortfolioNav mobile auth={auth} selectedId={route.view === 'portfolio' || route.view === 'dividends' ? route.portfolioId : undefined} onSelect={(portfolioId) => { selectPortfolio(portfolioId); setMobileOpen(false) }} />}<form onSubmit={(event) => { submitGlobalSearch(event); setMobileOpen(false) }} className="relative mb-2"><Icon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#879089]" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} maxLength={50} className="w-full rounded-xl border border-[#dfe4df] py-3 pl-10 pr-3 text-sm outline-none" placeholder="Search stocks or ETFs" aria-label="Mobile instrument search" /></form><button onClick={() => { selectNav('Overview'); setMobileOpen(false) }} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-[#f3f5f2]">Overview</button><button onClick={() => { navigate({ view: 'watchlist' }); setMobileOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-[#f3f5f2]"><Icon name="star" className="size-4 text-amber-500" />Watchlist</button><p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#87918b]">Portfolio</p>{(['Holdings', 'Transactions', 'Dividends'] as const).map((item) => <button key={item} onClick={() => { selectNav(item); setMobileOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-[#f3f5f2]"><Icon name={item === 'Holdings' ? 'briefcase' : item === 'Dividends' ? 'grid' : 'activity'} className="size-4 text-[#617068]" />{item}</button>)}</nav>}
      </header>

      {route.view === 'home' && <OverviewPage auth={auth} portfolioId={preferredPortfolioId} onNeedAuth={() => setShowModal(true)} onOpenHoldings={() => auth ? navigate({ view: 'portfolio', section: 'holdings', portfolioId: preferredPortfolioId, addTransaction: false }) : setShowModal(true)} onOpenDividends={() => auth ? navigate({ view: 'dividends', portfolioId: preferredPortfolioId }) : setShowModal(true)} onSelectInstrument={(symbol) => navigate({ view: 'instrument', symbol })} />}
      {route.view === 'home' && window.location.hash === '#legacy-overview' && <main className="mx-auto max-w-[1480px] px-5 py-8 lg:px-8 lg:py-11">
        <section className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#718078]"><span className="size-1.5 rounded-full bg-emerald-500" /> Markets are open</div>
            <h1 className="max-w-2xl text-[36px] font-semibold leading-[1.08] tracking-[-.045em] text-[#14251d] md:text-[48px]">Good morning{auth?.user.name ? `, ${auth?.user.name.split(' ')[0]}` : ''}.</h1>
            <p className="mt-3 text-[15px] text-[#6c7871]">Here’s what’s moving in your market today.</p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button onClick={() => setToast('Market data refreshed')} className="flex items-center gap-2 rounded-xl border border-[#dce2dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#425047] shadow-sm transition hover:border-[#afbab2]"><Icon name="clock" className="size-4" /> Aug 3, 2026</button>
            <button onClick={() => auth ? navigate({ view: 'portfolio', section: 'transactions', addTransaction: true }) : setShowModal(true)} className="flex items-center gap-2 rounded-xl bg-[#d8f768] px-4 py-2.5 text-sm font-bold text-[#1c2d24] shadow-sm transition hover:bg-[#c9ed4d]"><Icon name="plus" className="size-4" /> Add investment</button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <MetricCard eyebrow="S&P 500" value="6,329.94" change="+0.74%" chart={0} />
          <MetricCard eyebrow="NASDAQ" value="22,763.31" change="+1.12%" chart={1} />
          <MetricCard eyebrow="DOW JONES" value="46,807.17" change="−0.08%" chart={2} negative />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <WatchlistTable key={auth?.user.id ?? 'signed-out'} auth={auth} onNeedAuth={() => setShowModal(true)} onSelectInstrument={(symbol) => navigate({ view: 'instrument', symbol })} onSymbolsChange={syncWatchlistSymbols} />

          <aside className="space-y-6">
            <div onClick={() => auth ? navigate({ view: 'portfolio', section: 'holdings', addTransaction: false }) : setShowModal(true)} className="cursor-pointer rounded-[22px] bg-[#173c2c] p-6 text-white shadow-[0_18px_45px_rgba(23,60,44,.16)] transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#d8f768]"><Icon name="briefcase" /></span><button className="text-white/60 hover:text-white"><Icon name="more" /></button></div>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[.14em] text-white/55">Portfolio value</p>
              <div className="mt-2 text-[34px] font-semibold tracking-[-.04em]">$48,240.18</div>
              <div className="mt-3 flex items-center gap-2 text-sm"><span className="rounded-md bg-[#d8f768]/15 px-2 py-1 font-semibold text-[#d8f768]">+$1,284.22</span><span className="text-white/55">this month</span></div>
              <div className="mt-7 h-px bg-white/10" />
              <div className="mt-5 grid grid-cols-2 gap-4"><div><p className="text-[11px] text-white/50">Total return</p><p className="mt-1 text-sm font-semibold text-[#d8f768]">+18.42%</p></div><div><p className="text-[11px] text-white/50">Day change</p><p className="mt-1 text-sm font-semibold">+$362.80</p></div></div>
            </div>

            <div className="rounded-[22px] border border-[#dfe4df] bg-white p-5 lg:p-6">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold tracking-[-.02em]">Market pulse</h2><p className="mt-1 text-xs text-[#859088]">Top movers today</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#eef4ef] text-[#2e684c]"><Icon name="activity" className="size-[18px]" /></span></div>
              <div className="mt-5 space-y-1">
                {fallbackInstruments.slice(0, 3).map((item) => <div key={item.symbol} className="flex items-center gap-3 rounded-xl px-1 py-2.5"><StockMark symbol={item.symbol} small /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.symbol}</p><p className="truncate text-[11px] text-[#8a948e]">{item.name}</p></div><div className="text-right"><p className="text-sm font-semibold">${item.price}</p><p className={`text-[11px] font-semibold ${(item.change ?? 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{(item.change ?? 0) > 0 ? '+' : ''}{item.change}%</p></div></div>)}
              </div>
              <button onClick={() => setToast('More market insights are coming next')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe4df] py-2.5 text-sm font-semibold transition hover:bg-[#f7f9f7]">Explore movers <Icon name="chevron" className="size-4" /></button>
            </div>

            <div className="relative overflow-hidden rounded-[22px] border border-[#dce6de] bg-[#eaf3eb] p-6">
              <div className="absolute -right-8 -top-10 size-32 rounded-full border-[18px] border-white/40" />
              <span className="grid size-9 place-items-center rounded-xl bg-white text-[#2e684c] shadow-sm"><Icon name="sparkles" className="size-[18px]" /></span>
              <h3 className="mt-5 max-w-[220px] text-lg font-semibold leading-tight tracking-[-.025em]">Make smarter moves with financial insights.</h3>
              <button onClick={() => setToast('Search for a company to explore its financials')} className="mt-4 flex items-center gap-2 text-sm font-bold text-[#24563f]">Explore financials <Icon name="arrow" className="size-4" /></button>
            </div>
          </aside>
        </section>
      </main>}

      {route.view === 'search' && <SearchResultsPage key={route.query} query={route.query} onSearch={(query) => navigate({ view: 'search', query })} onSelect={(symbol) => navigate({ view: 'instrument', symbol })} />}
      {route.view === 'watchlist' && <WatchlistPage auth={auth} onNeedAuth={() => setShowModal(true)} onSelectInstrument={(symbol) => navigate({ view: 'instrument', symbol })} onSymbolsChange={syncWatchlistSymbols} />}
      {route.view === 'instrument' && <InstrumentPage key={`${route.symbol}-${auth?.user.id ?? 'guest'}`} symbol={route.symbol} auth={auth} watched={watching.has(route.symbol)} onNeedAuth={() => setShowModal(true)} onWatchChange={(symbol, isWatched) => { setWatching((current) => { const next = new Set(current); if (isWatched) next.add(symbol); else next.delete(symbol); return next }); setToast(isWatched ? `${symbol} added to watchlist` : `${symbol} removed from watchlist`) }} onBack={() => window.history.length > 1 ? window.history.back() : navigate({ view: 'search', query: route.symbol })} />}
      {route.view === 'portfolio' && <PortfolioPage key={`${auth?.user.id ?? 'guest'}-${route.section}-${route.portfolioId ?? preferredPortfolioId ?? 'default'}-${route.addTransaction}`} auth={auth} section={route.section} requestedPortfolioId={route.portfolioId ?? preferredPortfolioId} startWithTransaction={route.addTransaction} onNeedAuth={() => setShowModal(true)} onSelectInstrument={(symbol) => navigate({ view: 'instrument', symbol })} />}
      {route.view === 'dividends' && <DividendCalendarPage key={`${auth?.user.id ?? 'guest'}-${route.portfolioId ?? preferredPortfolioId ?? 'default'}`} auth={auth} requestedPortfolioId={route.portfolioId ?? preferredPortfolioId} onNeedAuth={() => setShowModal(true)} onSelectInstrument={(symbol) => navigate({ view: 'instrument', symbol })} />}
      {route.view === 'admin' && <AdminPage auth={auth} onNeedAuth={() => setShowModal(true)} />}

      {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#15231d] px-4 py-3 text-sm font-medium text-white shadow-2xl"><span className="grid size-5 place-items-center rounded-full bg-[#d8f768] text-[#173c2c]"><Icon name="check" className="size-3.5" /></span>{toast}</div>}
      {showModal && <AuthModal onClose={() => setShowModal(false)} onSuccess={completeAuth} />}
    </div>
  )
}

function MetricCard({ eyebrow, value, change, chart, negative = false }: { eyebrow: string, value: string, change: string, chart: number, negative?: boolean }) {
  return <article className="flex items-end justify-between rounded-[20px] border border-[#dfe4df] bg-white p-5 shadow-[0_1px_2px_rgba(23,39,30,.02)] lg:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#859088]">{eyebrow}</p><p className="mt-2 text-xl font-semibold tracking-[-.025em] tabular-nums">{value}</p><span className={`mt-2 inline-block rounded-md px-2 py-1 text-[11px] font-bold ${negative ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-700'}`}>{change}</span></div><Sparkline index={chart} positive={!negative} /></article>
}

export default App
