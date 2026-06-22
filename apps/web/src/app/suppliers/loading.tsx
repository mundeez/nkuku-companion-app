export default function SuppliersLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-10 w-full max-w-md bg-muted rounded animate-pulse mb-6" />
      <div className="h-96 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
