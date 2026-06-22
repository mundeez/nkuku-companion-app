export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md px-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-32 bg-muted rounded-lg animate-pulse mt-8" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
