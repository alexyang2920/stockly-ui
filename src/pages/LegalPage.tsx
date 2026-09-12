type LegalPageProps = {
  page: 'privacy' | 'terms'
}

const updated = 'September 12, 2026'

export default function LegalPage({ page }: LegalPageProps) {
  const privacy = page === 'privacy'
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-16">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#506a84] dark:text-[#9db9d4]">FolioNest</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] text-[#102b47] dark:text-white">{privacy ? 'Privacy' : 'Terms of use'}</h1>
      <p className="mt-3 text-sm text-[#627b93] dark:text-[#aec0d3]">Last updated {updated}</p>
      {privacy ? <PrivacyContent /> : <TermsContent />}
    </main>
  )
}

function PrivacyContent() {
  return <div className="legal-copy mt-10 space-y-8 text-sm leading-7 text-[#405b74] dark:text-[#c4d4e4]">
    <section><h2>Information FolioNest stores</h2><p>FolioNest stores the name and email address you provide, a secure password hash, portfolio settings, holdings, transactions, and preferences. It also uses a secure refresh-token cookie and normal technical request logs to keep your account signed in and protect the service.</p></section>
    <section><h2>How information is used</h2><p>Your information is used to operate the app, authenticate your account, preserve preferences, and calculate portfolio and dividend views. FolioNest does not execute trades, hold funds, or access brokerage accounts.</p></section>
    <section><h2>Service providers</h2><p>FolioNest uses Cloudflare for website delivery and email routing, Fly.io for its API, and Neon for its database. These providers process the technical and stored information needed to provide FolioNest. We may change providers as the service evolves.</p></section>
    <section><h2>No sale or advertising use</h2><p>FolioNest does not sell your personal information or use it for targeted advertising.</p></section>
    <section><h2>Your choices and deletion requests</h2><p>You can sign out at any time. To ask a question about your data or request deletion of your account and associated portfolio data, email <a href="mailto:privacy@folionest.app">privacy@folionest.app</a>. Please avoid entering information you do not want stored in a portfolio-tracking application.</p></section>
  </div>
}

function TermsContent() {
  return <div className="legal-copy mt-10 space-y-8 text-sm leading-7 text-[#405b74] dark:text-[#c4d4e4]">
    <section><h2>Free service</h2><p>FolioNest is currently provided without charge. It does not process payments, hold funds, or execute trades.</p></section>
    <section><h2>Informational use only</h2><p>FolioNest provides dividend and portfolio tracking for personal informational use. Nothing in the app is investment, tax, legal, or financial advice, and it is not a recommendation to buy or sell any security.</p></section>
    <section><h2>Market data</h2><p>Market prices, dividend events, and other data can be delayed, incomplete, or inaccurate. Always verify information independently before making an investment decision.</p></section>
    <section><h2>Your responsibility</h2><p>You are responsible for the information you enter and for decisions you make using it. FolioNest does not place trades, hold customer funds, or connect to brokerage accounts.</p></section>
    <section><h2>Questions and changes</h2><p>For questions about these terms, email <a href="mailto:support@folionest.app">support@folionest.app</a>. FolioNest may update these terms as the product changes. Continued use after an update means you accept the revised terms.</p></section>
  </div>
}
