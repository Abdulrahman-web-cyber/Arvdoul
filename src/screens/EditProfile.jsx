import { motion } from "framer-motion";

export default function EditProfile() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-[90%] max-w-md p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl"
      >
        <h1 className="text-2xl font-bold mb-3">Edit Profile</h1>
        
        <p className="text-gray-400 text-sm mb-6">
          This feature is coming soon. Your profile editing system will be fully integrated with Arvdoul’s advanced user system.
        </p>

        <button className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition">
          Continue
        </button>
      </motion.div>

    </div>
  );
}
