type SiteFooterProps = {
  onPrivacy: () => void
  onTerms: () => void
}

export default function SiteFooter({ onPrivacy, onTerms }: SiteFooterProps) {
  return (
    <footer className="mt-12 border-t border-[#d9e5f1] bg-[#f8fbff] dark:border-[#304258] dark:bg-[#102236]">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-3 px-5 py-6 text-center text-xs leading-5 text-[#617891] sm:flex-row sm:items-center sm:justify-between sm:text-left lg:px-8 dark:text-[#a9bdd0]">
        <p>© {new Date().getFullYear()} FolioNest</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
          <button onClick={onPrivacy} className="font-medium text-[#496982] transition hover:text-[#0b5597] dark:text-[#c7d8e9] dark:hover:text-white">Privacy</button>
          <button onClick={onTerms} className="font-medium text-[#496982] transition hover:text-[#0b5597] dark:text-[#c7d8e9] dark:hover:text-white">Terms</button>
          <span>Market data is informational, not investment advice.</span>
        </div>
      </div>
    </footer>
  )
}
