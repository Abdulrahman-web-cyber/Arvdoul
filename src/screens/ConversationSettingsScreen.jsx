import React from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ConversationSettingsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-[var(--bg)] px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 transition hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 className="flex-1 text-lg font-semibold">
          Conversation Settings
        </h1>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-600/10">
            <Settings size={40} />
          </div>

          <h2 className="text-2xl font-bold">
            Conversation Settings
          </h2>

          <p className="mt-3 text-sm opacity-70 leading-6">
            This screen is temporarily unavailable while ARVDOUL's premium
            messaging experience is being completed.
          </p>

          <button
            onClick={() => navigate(-1)}
            className="mt-8 rounded-xl bg-violet-600 px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            Go Back
          </button>
        </div>
      </main>
    </div>
  );
}
