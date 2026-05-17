// src/screens/HomeScreen.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import localforage from "localforage";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

import TopAppBar from "../components/Shared/TopAppBar";
import BottomNav from "../components/Shared/BottomNav";
import Stories from "../components/Home/Stories";
import Composer from "../components/Home/Composer";
import PostCard from "../components/Home/PostCard";
import ReelsFeed from "../components/Home/ReelsFeed";
import TrendingWidget from "../components/Home/TrendingWidget";
import LoadingSpinner from "../components/Shared/LoadingSpinner";

import {
subscribeStories,
loadTrending,
loadAds,
getFollowingIds,
getPostsPage,
getExplorePage,
rankAndBlend,
getColdStart,
getSuggestedUsers,
getUserInterests,
} from "../lib/arvdoulService";

/** ---------- Tunables ---------- */
const POSTS_PAGE_SIZE = 10;
const ADS_INJECTION_EVERY = 6;
const CACHE_KEY_FEED = "arvdoul_feed_cache_v2";
const CACHE_TTL_MS = 1000 * 60 * 5;

/** ---------- Helpers ---------- */
const now = () => Date.now();

/** ---------- Skeletons ---------- */
const PostSkeleton = ({ keyVal }) => (

  <div key={keyVal} className="p-4 border-b border-muted animate-pulse">  
    <div className="flex items-center space-x-3 mb-3">  
      <div className="w-10 h-10 bg-muted rounded-full" />  
      <div className="flex-1 h-4 bg-muted rounded" />  
    </div>  
    <div className="h-48 bg-muted rounded mb-3" />  
    <div className="h-4 bg-muted rounded w-3/4 mb-1" />  
    <div className="h-4 bg-muted rounded w-1/2" />  
  </div>  
);  function AdCard({ ad }) {
if (!ad) return null;
return (
<article className="p-3 border rounded-xl bg-yellow-50 dark:bg-yellow-900/20" role="article" aria-label="Sponsored">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">Sponsored</span>
<span className="text-xs text-muted-foreground">{ad.sponsor || "Partner"}</span>
</div>
{ad.type === "video" ? (
<video src={ad.mediaUrl} controls className="w-full h-56 object-cover rounded-md" playsInline />
) : (
<img src={ad.mediaUrl} alt={`ad.title || "Sponsored content"`} className="w-full h-56 object-cover rounded-md" />
)}
<h4 className="mt-3 font-semibold text-sm">{ad.title}</h4>
<p className="text-xs mt-1 text-muted-foreground">{ad.description}</p>
<div className="mt-3 flex gap-2">
<a href={ad.clickUrl || "#"} className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-600 text-white text-xs">
Learn more
</a>
</div>
</article>
);
}

function ReelsFallback({ videos }) {
if (!videos?.length) return <div className="p-6 text-center text-muted-foreground">No reels available yet.</div>;
return (
<div className="space-y-4 p-3">
{videos.map((v) => (
<div key={v.id} className="rounded-xl overflow-hidden border">
<video src={v.media?.[0]?.url || v.mediaUrl} controls className="w-full h-96 object-cover" />
</div>
))}
</div>
);
}

/** ---------- Cache helpers ---------- */
const saveFeedCache = async (items) => {
try {
await localforage.setItem(CACHE_KEY_FEED, { ts: now(), items });
} catch {}
};
const getFeedCache = async () => {
try {
const v = await localforage.getItem(CACHE_KEY_FEED);
if (!v) return null;
if (now() - (v.ts || 0) > CACHE_TTL_MS) return null;
return v.items || null;
} catch {
return null;
}
};

/** ================================================================

HomeScreen

============================================================== */
export default function HomeScreen() {
const navigate = useNavigate();
const { theme } = useTheme();
const { user } = useAuth();


// data state
const [posts, setPosts] = useState([]);
const [ads, setAds] = useState([]);
const [stories, setStories] = useState([]);
const [videos, setVideos] = useState([]);
const [trending, setTrending] = useState([]);
const [suggested, setSuggested] = useState([]);

// UI state
const [activeTab, setActiveTab] = useState("feed"); // feed | reels | explore
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [lastFriendDoc, setLastFriendDoc] = useState(null);
const [lastExploreDoc, setLastExploreDoc] = useState(null);
const sentinelRef = useRef(null);

// personalization
const [followingIds, setFollowingIds] = useState([]);
const [interests, setInterests] = useState([]);

// bootstrap cache
useEffect(() => {
let mounted = true;
(async () => {
const cached = await getFeedCache();
if (mounted && cached?.length) {
setPosts(cached);
setLoading(false);
}
})();
return () => { mounted = false; };
}, []);

// real-time stories
useEffect(() => {
let unsub;
(async () => {
unsub = await subscribeStories(
(arr) => setStories(arr),
(err) => console.error("stories error", err)
);
})();
return () => unsub && unsub();
}, []);

// trending + ads (static fetch)
useEffect(() => {
(async () => {
try {
const [t, a] = await Promise.all([loadTrending(12), loadAds(20)]);
setTrending(t);
setAds(a);
} catch (e) {
console.warn("aux load failed", e);
}
})();
}, []);

// personalization: following + interests
useEffect(() => {
(async () => {
if (!user?.uid) return;
try {
const [f, ints] = await Promise.all([getFollowingIds(user.uid), getUserInterests(user.uid)]);
setFollowingIds(f);
setInterests(ints);
} catch (e) {
console.warn("personalization load failed", e);
}
})();
}, [user?.uid]);

// initial feed load (rank & blend)
useEffect(() => {
let cancelled = false;
(async () => {
setLoading(true);
try {
if (!user?.uid || followingIds.length === 0) {
// Cold start: explore + suggestions
const cs = await getColdStart({ pageSize: POSTS_PAGE_SIZE });
if (cancelled) return;
setSuggested(cs.suggestions || []);
setPosts(cs.posts || []);
setHasMore(true); // we can always page explore
setLastFriendDoc(null);
setLastExploreDoc(null);
} else {
const [friendPage, explorePage] = await Promise.all([
getPostsPage({ followingIds, pageSize: POSTS_PAGE_SIZE }),
getExplorePage({ pageSize: POSTS_PAGE_SIZE, excludeAuthorIds: followingIds }),
]);
if (cancelled) return;

// inject interests into ranking via closure  
      const ranked = rankAndBlend({  
        friendDocs: friendPage.docs.map((d) => ({ ...d, interests })),  
        exploreDocs: explorePage.docs.map((d) => ({ ...d, interests })),  
        followingIds,  
      });  

      setPosts(ranked);  
      setLastFriendDoc(friendPage.lastDoc);  
      setLastExploreDoc(explorePage.lastDoc);  
      setHasMore((friendPage.docs?.length || 0) + (explorePage.docs?.length || 0) >= POSTS_PAGE_SIZE);  
    }  
  } catch (e) {  
    console.error("feed init error", e);  
    toast.error("Failed to load feed.");  
  } finally {  
    if (!cancelled) setLoading(false);  
  }  
})();  
return () => { cancelled = true; };

}, [user?.uid, followingIds.join("|")]); // re-run when following changes

// reels/videos subset (for Reels tab fallback)
useEffect(() => {
const vids = (posts || []).filter(
(p) => p.media?.some((m) => m.type === "video") || p.type === "video"
);
setVideos(vids);
}, [posts]);

// pagination: load more with dual cursors
const loadMore = useCallback(async () => {
if (loadingMore) return;
setLoadingMore(true);
try {
if (!user?.uid || followingIds.length === 0) {
// cold start: just page explore
const explore = await getExplorePage({
cursor: lastExploreDoc,
pageSize: POSTS_PAGE_SIZE,
excludeAuthorIds: [],
});
const merged = [...posts, ...explore.docs];
setPosts(merged);
setLastExploreDoc(explore.lastDoc);
setHasMore((explore.docs?.length || 0) === POSTS_PAGE_SIZE);
saveFeedCache(merged.slice(0, POSTS_PAGE_SIZE * 3));
} else {
const [friendPage, explorePage] = await Promise.all([
getPostsPage({ followingIds, cursor: lastFriendDoc, pageSize: POSTS_PAGE_SIZE }),
getExplorePage({ cursor: lastExploreDoc, pageSize: POSTS_PAGE_SIZE, excludeAuthorIds: followingIds }),
]);
const ranked = rankAndBlend({
friendDocs: friendPage.docs.map((d) => ({ ...d, interests })),
exploreDocs: explorePage.docs.map((d) => ({ ...d, interests })),
followingIds,
});
const deDuped = (() => {
const seen = new Set(posts.map((p) => p.id));
return [...posts, ...ranked.filter((p) => !seen.has(p.id))];
})();
setPosts(deDuped);
setLastFriendDoc(friendPage.lastDoc);
setLastExploreDoc(explorePage.lastDoc);
setHasMore((friendPage.docs?.length || 0) + (explorePage.docs?.length || 0) > 0);
saveFeedCache(deDuped.slice(0, POSTS_PAGE_SIZE * 3));
}
} catch (e) {
console.error("loadMore error", e);
toast.error("Could not load more posts.");
} finally {
setLoadingMore(false);
}
}, [loadingMore, user?.uid, followingIds.join("|"), lastFriendDoc, lastExploreDoc, posts, interests]);

// infinite scroll
useEffect(() => {
if (!sentinelRef.current) return;
const obs = new IntersectionObserver(
(entries) => {
if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
loadMore();
}
},
{ rootMargin: "300px" }
);
obs.observe(sentinelRef.current);
return () => obs.disconnect();
}, [loadMore, loading, loadingMore, hasMore]);

// compose final feed: inject ads + trending
const preparedFeed = useMemo(() => {
if (!posts?.length) return [];
const result = [];
let adIdx = 0;

for (let i = 0; i < posts.length; i++) {  
  result.push({ __type: "post", data: posts[i] });  

  // trending after #3  
  if (i === 2 && trending.length > 0) {  
    result.push({ __type: "trending", data: trending });  
  }  

  // ad pacing  
  if ((i + 1) % ADS_INJECTION_EVERY === 0 && ads.length > 0) {  
    result.push({ __type: "ad", data: ads[adIdx % ads.length] });  
    adIdx++;  
  }  
}  
return result;

}, [posts, ads, trending]);

// actions
const handleNavigateToPost = (postId) => navigate(/post/${postId});
const handleOpenCreate = () => navigate("/create");

// UI — include cold-start suggestions
const ColdStartBlock = () => (
<div className="p-4 border rounded-xl bg-surface/50">
<h3 className="font-semibold mb-2">Suggested creators to follow</h3>
<div className="grid grid-cols-2 gap-3">
{suggested.slice(0, 6).map((u) => (
<div key={u.id} className="flex items-center gap-2">
<img src={u.photoURL || "/assets/default-profile.png"} alt={`u.displayName`} className="w-8 h-8 rounded-full" />
<div className="flex-1">
<div className="text-sm font-medium truncate">{u.displayName || "Creator"}</div>
<div className="text-xs text-muted-foreground">{(u.followerCount || 0).toLocaleString()} followers</div>
</div>
<button className="px-2 py-1 text-xs rounded-full bg-primary-600 text-white">Follow</button>
</div>
))}
</div>
</div>
);

return (
<div className={`min-h-screen flex flex-col ${theme === "dark" ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
{/* Top app bar */}
<TopAppBar
leftContent={<h1 className="text-lg font-bold">Arvdoul</h1>}
rightContent={
<div className="flex items-center gap-3">
<button aria-label="Search" onClick={() => navigate("/search")} className="p-1">🔎</button>
<button aria-label="Notifications" onClick={() => navigate("/notifications")} className="p-1">🔔</button>
<button aria-label="Messages" onClick={() => navigate("/messages")} className="p-1">💬</button>
</div>
}
/>

{/* Stories */}  
  <div className="border-b border-muted">  
    <Stories items={stories} onOpenStory={`(id) => navigate(`/story/${id}`)`} />  
  </div>  

  {/* Composer */}  
  <div className="p-3 border-b border-muted">  
    <Composer onCreate={() => {}} onOpenCreate={handleOpenCreate} />  
  </div>  

  {/* Tabs */}  
  <div className="flex gap-2 justify-center py-2">  
    <button  
      onClick={() => setActiveTab("feed")}  
      className={`px-4 py-1 rounded-full text-sm ${activeTab === "feed" ? "bg-primary-600 text-white" : "bg-muted text-muted-foreground"}`}  
    >  
      Feed  
    </button>  
    <button  
      onClick={() => setActiveTab("reels")}  
      className={`px-4 py-1 rounded-full text-sm ${activeTab === "reels" ? "bg-primary-600 text-white" : "bg-muted text-muted-foreground"}`}  
    >  
      Reels  
    </button>  
    <button  
      onClick={() => setActiveTab("explore")}  
      className={`px-4 py-1 rounded-full text-sm ${activeTab === "explore" ? "bg-primary-600 text-white" : "bg-muted text-muted-foreground"}`}  
    >  
      Explore  
    </button>  
  </div>  

  {/* Main content */}  
  <main className="flex-1 overflow-y-auto">  
    <AnimatePresence mode="wait">  
      {activeTab === "feed" && (  
        <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 p-3">  
          {loading && posts.length === 0 ? (  
            <>  
              <PostSkeleton keyVal="s1" />  
              <PostSkeleton keyVal="s2" />  
              <PostSkeleton keyVal="s3" />  
            </>  
          ) : posts.length === 0 ? (  
            <div className="space-y-3">  
              <div className="py-10 text-center text-muted-foreground">No posts yet — start following creators you like.</div>  
              <ColdStartBlock />  
            </div>  
          ) : (  
            preparedFeed.map((slot, idx) => {  
              if (slot.__type === "post") {  
                const p = slot.data;  
                return (  
                  <motion.div  
                    key={p.id}  
                    initial={{ opacity: 0, y: 8 }}  
                    animate={{ opacity: 1, y: 0 }}  
                    exit={{ opacity: 0, y: -8 }}  
                    transition={{ duration: 0.18 }}  
                  >  
                    <PostCard post={p} onOpen={() => handleNavigateToPost(p.id)} />  
                  </motion.div>  
                );  
              }  
              if (slot.__type === "ad") {  
                return (  
                  <motion.div  
                    key={`ad-${slot.data.id || idx}`}  
                    initial={{ opacity: 0, y: 8 }}  
                    animate={{ opacity: 1, y: 0 }}  
                    exit={{ opacity: 0, y: -8 }}  
                    transition={{ duration: 0.18 }}  
                  >  
                    <AdCard ad={slot.data} />  
                  </motion.div>  
                );  
              }  
              if (slot.__type === "trending") {  
                return (  
                  <div key="trending" className="p-3 rounded-xl bg-surface/60 border">  
                    {typeof TrendingWidget === "function" ? (  
                      <TrendingWidget items={slot.data} />  
                    ) : (  
                      <div>  
                        <h4 className="font-semibold mb-2">Trending</h4>  
                        <div className="flex flex-wrap gap-2">  
                          {slot.data.slice(0, 8).map((t) => (  
                            <button  
                              key={t.id}  
                              onClick={`() => navigate(`/search?q=${encodeURIComponent(t.tag || t.name)}`)`}  
                              className="px-3 py-1 text-xs rounded-full bg-muted"  
                            >  
                              #{t.tag || t.name}  
                            </button>  
                          ))}  
                        </div>  
                      </div>  
                    )}  
                  </div>  
                );  
              }  
              return null;  
            })  
          )}  

          {/* sentinel / load more */}  
          <div className="flex justify-center py-6">  
            {loadingMore ? (  
              <LoadingSpinner />  
            ) : hasMore ? (  
              <div ref={sentinelRef} className="w-full h-2" />  
            ) : (  
              <div className="text-sm text-muted-foreground">You’re all caught up 👋</div>  
            )}  
          </div>  
        </motion.div>  
      )}  

      {activeTab === "reels" && (  
        <motion.div key="reels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">  
          {typeof ReelsFeed === "function" ? <ReelsFeed initialQueryLimit={8} /> : <ReelsFallback videos={videos} />}  
        </motion.div>  
      )}  

      {activeTab === "explore" && (  
        <motion.div key="explore" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3 grid grid-cols-2 gap-3">  
          {posts.slice(0, 30).map((p) => (  
            <div key={p.id} className="cursor-pointer" onClick={`() => navigate(`/post/${p.id}`)`}>  
              <img  
                src={(p.media && p.media[0] && p.media[0].url) || p.mediaUrl}  
                alt={`p.content?.slice(0, 60) || "Explore item"`}  
                className="w-full h-40 object-cover rounded-lg"  
              />  
            </div>  
          ))}  
        </motion.div>  
      )}  
    </AnimatePresence>  
  </main>  

  {/* Trending rail (mobile) */}  
  <div className="p-3 border-t border-muted bg-background/50">  
    <div className="flex items-center justify-between">  
      <h4 className="text-sm font-semibold">Trending</h4>  
      <button onClick={() => navigate("/trending")} className="text-xs text-primary-600">See all</button>  
    </div>  
    <div className="mt-2 flex flex-wrap gap-2">  
      {trending.slice(0, 6).map((t) => (  
        <button  
          key={t.id}  
          onClick={`() => navigate(`/search?q=${encodeURIComponent(t.tag || t.name)}`)`}  
          className="px-3 py-1 text-xs rounded-full bg-muted"  
        >  
          #{t.tag || t.name}  
        </button>  
      ))}  
    </div>  
  </div>  

  {/* Bottom navigation */}  
  <BottomNav  
    items={[  
      { icon: "home", label: "Home", onClick: () => setActiveTab("feed") },  
      { icon: "reels", label: "Reels", onClick: () => setActiveTab("reels") },  
      { icon: "create", label: "Create", onClick: handleOpenCreate },  
      { icon: "messages", label: "Messages", onClick: () => navigate("/messages") },  
      { icon: "profile", label: "Profile", onClick: () => navigate(`/profile/${user?.uid || "me"}`) },  
    ]}  
  />  
</div>

);
}