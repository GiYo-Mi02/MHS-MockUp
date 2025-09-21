export function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to MakatiReport</h1>
      <p>Report concerns directly to the right department and track progress.</p>
      <div className="space-x-2">
        <a href="/report" className="px-4 py-2 bg-blue-600 text-white rounded">Submit a Report</a>
        <a href="/track/MR-XXXXXX" className="px-4 py-2 border rounded">Track a Report</a>
      </div>
    </section>
  )
}
