import React, { useState } from "react";
import { Image, Type, X, ArrowLeft } from "lucide-react";

export default function CreateStory() {
  const [text, setText] = useState("");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft size={22} />
        </button>

        <h1 className="font-bold text-lg">Create Story</h1>

        <button className="p-2 rounded-full hover:bg-white/10">
          <X size={22} />
        </button>
      </header>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md aspect-[9/16] rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-cyan-500 flex items-center justify-center overflow-hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="w-full h-full bg-transparent text-center text-3xl font-bold resize-none outline-none p-8 placeholder:text-white/60"
          />
        </div>
      </div>

      {/* Tools */}
      <div className="border-t border-white/10 p-4">
        <div className="flex justify-center gap-4">
          <button className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
            <Image size={24} />
          </button>

          <button className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
            <Type size={24} />
          </button>
        </div>

        <button
          className="w-full mt-4 h-12 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500"
        >
          Share Story
        </button>
      </div>

    </div>
  );
}
