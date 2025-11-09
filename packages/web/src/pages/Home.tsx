export function Home() {
  return (
    <section className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-neutral-100/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600 dark:border-white/15 dark:bg-white/10 dark:text-white/70">
          Rapid Response Hub
        </span>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            A faster way to move Makati forward
          </h1>
          <p className="max-w-xl text-base text-neutral-600 dark:text-white/70">
            Log concerns, share locations, and monitor real-time updates from the departments that keep the city running.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/report" className="btn-primary">Submit a report</a>
          <a href="/track" className="btn-secondary">Track a report</a>
        </div>
        <dl className="grid gap-6 sm:grid-cols-3">
          {[
            { label: 'Avg. response time', value: '~24h' },
            { label: 'Departments onboard', value: '12' },
            { label: 'Reports resolved', value: '4.8k+' }
          ].map((item) => (
            <div key={item.label} className="card px-6 py-5">
              <dt className="stat-label">{item.label}</dt>
              <dd className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative">
        <div className="card px-6 py-8">
          <div className="absolute -top-12 right-10 hidden h-24 w-24 rounded-full bg-brand/40 blur-3xl md:block" aria-hidden />
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">How it works</h2>
              <p className="text-secondary">Three clear steps to resolve every report.</p>
            </div>
            <ol className="space-y-4 text-sm">
              <li className="surface-subtle flex gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 text-base font-semibold text-brand-dark dark:bg-brand/30 dark:text-white">1</span>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">Submit detailed information</p>
                  <p className="text-secondary">Share what happened, where, and attach supporting photos.</p>
                </div>
              </li>
              <li className="surface-subtle flex gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 text-base font-semibold text-brand-dark dark:bg-brand/30 dark:text-white">2</span>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">Assigned instantly</p>
                  <p className="text-secondary">We route your concern to the correct department or facility.</p>
                </div>
              </li>
              <li className="surface-subtle flex gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 text-base font-semibold text-brand-dark dark:bg-brand/30 dark:text-white">3</span>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">Track progress live</p>
                  <p className="text-secondary">Stay in the loop with each update until the issue is closed.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
