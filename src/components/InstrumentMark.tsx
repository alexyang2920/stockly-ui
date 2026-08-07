const colors: Record<string, string> = {
  NVDA: 'bg-[#76b900] text-black',
  AAPL: 'bg-[#15191d] text-white',
  MSFT: 'bg-[#f1f3f4] text-[#1b1f23]',
  AMZN: 'bg-[#131a22] text-white',
  META: 'bg-[#0866ff] text-white',
  VOO: 'bg-[#921f31] text-white',
}

function InstrumentMark({ symbol, size = 'medium' }: { symbol: string, size?: 'small' | 'medium' | 'large' }) {
  const sizeClass = size === 'small' ? 'size-9 rounded-xl text-[10px]' : size === 'large' ? 'size-16 rounded-[20px] text-base' : 'size-11 rounded-2xl text-xs'
  return <div className={`${sizeClass} ${colors[symbol] ?? 'bg-[#173c2c] text-white'} grid shrink-0 place-items-center font-extrabold tracking-tight shadow-sm`}>{symbol === 'AAPL' ? '●' : symbol.slice(0, 2)}</div>
}

export default InstrumentMark
