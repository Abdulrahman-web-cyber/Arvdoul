import PropTypes from 'prop-types';
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase.js";
import StoryViewer from "./StoryViewer";

const DEFAULT_AVATAR = "/default-profile.png";
const STORY_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default function StoryList() {
  const [storiesByUser, setStoriesByUser] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const grouped = {};

      snapshot.docs.forEach((doc) => {
        const story = { id: doc.id, ...doc.data() };
        const createdAt = story.createdAt?.toDate?.();
        if (!createdAt || now - createdAt.getTime() > STORY_LIFETIME) return;

        if (!grouped[story.userId]) grouped[story.userId] = [];
        grouped[story.userId].push(story);
      });

      setStoriesByUser(grouped);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const users = Object.keys(storiesByUser);

  if (!users.length) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        No stories available.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto flex gap-4 px-4 py-3 scrollbar-hide">
        {users.map((userId) => {
          const userStories = storiesByUser[userId];
          const story = userStories[0];
          const hasUnseen = userStories.some((s) => !s.seen);

          return (
            <div
              key={userId}
              role="button"
              tabIndex={0}
              title={`story.username || "User"`}
              onClick={() => setSelectedUserId(userId)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedUserId(userId)}
              className="flex flex-col items-center cursor-pointer group"
            >
              <div
                className={`w-16 h-16 p-1 rounded-full overflow-hidden transition-transform group-hover:scale-105 ${
                  hasUnseen
                    ? "bg-gradient-to-tr from-primary to-secondary animate-pulse"
                    : "border-2 border-gray-300 dark:border-gray-700"
                }`}
              >
                <img
                  src={story.userAvatar || DEFAULT_AVATAR}
                  alt={`story.username || "User"`}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-center mt-1 text-muted-foreground truncate w-16">
                {story.username || "User"}
              </p>
            </div>
          );
        })}
      </div>

      {selectedUserId && (
        <StoryViewer
          userId={selectedUserId}
          stories={storiesByUser[selectedUserId]}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </>
  );
}

DEFAULT_AVATAR.propTypes = {};
