import WatchlistTable from '../components/WatchlistTable'
import type { AuthResponse } from '../types/auth'

function WatchlistPage({ auth, onNeedAuth, onSelectInstrument, onSymbolsChange }: { auth: AuthResponse | null, onNeedAuth: () => void, onSelectInstrument: (symbol: string) => void, onSymbolsChange: (symbols: Set<string>) => void }) {
  return <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8 lg:py-11"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Saved instruments</p><h1 className="mt-2 text-[36px] font-semibold tracking-[-.045em] md:text-[46px]">Watchlist</h1><p className="mt-2 text-sm text-[#738078]">Follow quotes and open any instrument for deeper financial details.</p></div><WatchlistTable auth={auth} onNeedAuth={onNeedAuth} onSelectInstrument={onSelectInstrument} onSymbolsChange={onSymbolsChange} /></main>
}

export default WatchlistPage
