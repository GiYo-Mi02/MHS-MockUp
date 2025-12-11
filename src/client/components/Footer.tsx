export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/30">
      <div className="container flex flex-col gap-4 py-8 text-sm text-neutral-600 dark:text-white/60 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-neutral-900 dark:text-white">MakatiReport</p>
          <p className="text-xs text-neutral-500 dark:text-white/40">Streamlined citizen reporting for a responsive city.</p>
        </div>
        <div className="flex items-center gap-6">
          <a href="/report" className="hover:text-neutral-900 dark:hover:text-white">Submit a report</a>
          <a href="/track" className="hover:text-neutral-900 dark:hover:text-white">Track status</a>
          <span>© {new Date().getFullYear()} City of Makati</span>
        </div>
      </div>
    </footer>
  )
}
