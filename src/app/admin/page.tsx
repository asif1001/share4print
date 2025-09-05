export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border rounded p-3">
          <h2 className="font-semibold">Reports queue</h2>
          <div className="text-sm text-gray-500">Coming soon</div>
        </div>
        <div className="border rounded p-3">
          <h2 className="font-semibold">Featured picks</h2>
          <div className="text-sm text-gray-500">Coming soon</div>
        </div>
      </div>
    </div>
  )
}
