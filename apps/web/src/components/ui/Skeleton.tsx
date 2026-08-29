/** Base pulse block — compose into shapes below rather than using directly on pages. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

/** Mimics a list of EventCard rows (byline, headline, two body lines). */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-white/10 py-5 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Mimics the Teams directory / squad grid of tiles. */
export function TileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface border border-white/10 p-4 h-20 flex items-center justify-center">
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Mimics Games list / search result rows. */
export function RowListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-white/10 py-5 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}
