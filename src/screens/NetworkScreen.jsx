import { motion } from "framer-motion";

export default function NetworkScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center p-6 rounded-2xl bg-white/5 border border-white/10"
      >
        <h1 className="text-2xl font-bold mb-2">Network</h1>
        <p className="text-gray-400">
          This screen is under construction.
        </p>
      </motion.div>
    </div>
  );
}
