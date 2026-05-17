// src/screens/VideosScreen.jsx
// Ultra Pro Max Placeholder Videos Screen

import React from "react";
import { motion } from "framer-motion";
import {
  Video,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const demoVideos = [
  {
    id: 1,
    title: "Create Your Reality",
    creator: "Arvdoul Creator",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
  },
  {
    id: 2,
    title: "Next Generation Social",
    creator: "Arvdoul Studio",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
  },
  {
    id: 3,
    title: "Ultra Reels Experience",
    creator: "Arvdoul Media",
    image:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902",
  },
];

const VideoCard = ({ item }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl"
    >
      <div className="relative h-72 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-5 rounded-full bg-white/20 backdrop-blur-md">
            <PlayCircle className="w-14 h-14 text-white" />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-white font-bold text-xl">
            {item.title}
          </h3>

          <p className="text-gray-300 text-sm mt-1">
            {item.creator}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const VideosScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white pb-28">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2">
              <Video className="w-8 h-8 text-fuchsia-500" />
              Arvdoul Videos
            </h1>

            <p className="text-gray-400 text-sm mt-1">
              Ultra immersive short-form experiences
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20">
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
            <span className="text-sm font-medium text-fuchsia-300">
              Beta
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-8 rounded-3xl border border-gray-800 bg-gradient-to-r from-fuchsia-600/20 to-indigo-600/20 p-6">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-fuchsia-400" />

            <h2 className="text-2xl font-bold">
              Trending Videos
            </h2>
          </div>

          <p className="text-gray-300">
            Explore the future of entertainment with immersive
            Arvdoul video content.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {demoVideos.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
            />
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-dashed border-gray-700 p-10 text-center">
          <Video className="w-16 h-16 mx-auto text-gray-500 mb-4" />

          <h3 className="text-2xl font-bold mb-2">
            Full Videos System Coming Soon
          </h3>

          <p className="text-gray-400 max-w-xl mx-auto">
            This placeholder screen prevents build failures while
            you continue building the complete ultra pro max
            Arvdoul video ecosystem.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideosScreen;
