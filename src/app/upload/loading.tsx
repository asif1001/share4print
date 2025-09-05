export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-[323px] sm:h-[391px] lg:h-[544px] bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  )
}
