import { useEffect, useState } from "react";

import { api, EventItem } from "../lib/api";
import EventCard from "../components/EventCard";
import { FeedSkeleton } from "../components/ui/Skeleton";

export default function SocialPage() {
  const [posts, setPosts] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSocialPosts().then(setPosts).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white">Social</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!posts && !error && <FeedSkeleton count={5} />}
      {posts && posts.length === 0 && <p className="text-slate-500 text-sm">No posts yet.</p>}
      <div>
        {posts?.map((post) => (
          <EventCard key={post.id} event={post} />
        ))}
      </div>
    </div>
  );
}
