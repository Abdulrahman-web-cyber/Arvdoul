// src/screens/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
} from "firebase/auth";
import { auth } from "../firebase/firebase.js";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";
import { motion } from "framer-motion";
import LoadingSpinner from "@components/Shared/LoadingSpinner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const [oobCode, setOobCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Parse query params & validate oobCode
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const code = query.get("oobCode");

    if (code) {
      setOobCode(code);
      verifyPasswordResetCode(auth, code)
        .then(() => setLoading(false))
        .catch(() => {
          toast.error("Invalid or expired reset link.");
          navigate("/login");
        });
    } else {
      setLoading(false); // phone reset case
    }
  }, [location, navigate]);

  // Handle reset submit
  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match!");
      return;
    }
    setLoading(true);
    try {
      if (oobCode) {
        // Email reset flow
        await confirmPasswordReset(auth, oobCode, password);
      } else {
        // Phone reset flow → user must already be logged in via OTP
        if (!auth.currentUser) {
          toast.error("No authenticated user found.");
          setLoading(false);
          return;
        }
        await updatePassword(auth.currentUser, password);
      }
      toast.success("Password has been reset successfully!");
      navigate("/"); // ✅ Go to Home instead of Login
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const backgroundGradient =
    resolvedTheme === "dark"
      ? "radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)"
      : "radial-gradient(circle at 50% 50%, #f8fafc 0%, #e2e8f0 100%)";

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: backgroundGradient }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-11/12 sm:w-96 bg-white/60 dark:bg-gray-900/70 backdrop-blur-lg rounded-3xl shadow-2xl p-10 flex flex-col gap-6"
      >
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 text-center mb-4">
          Set New Password
        </h1>

        <form className="flex flex-col gap-5" onSubmit={handleReset}>
          {/* New Password */}
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="peer w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="New Password"
            />
            <label className="absolute left-4 top-3 text-gray-400 text-sm peer-focus:-top-2 peer-focus:text-xs peer-focus:text-primary-500 transition-all">
              New Password
            </label>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="peer w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Confirm Password"
            />
            <label className="absolute left-4 top-3 text-gray-400 text-sm peer-focus:-top-2 peer-focus:text-xs peer-focus:text-primary-500 transition-all">
              Confirm Password
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner /> : "Reset Password"}
          </button>
        </form>

        <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
          Remembered your password?{" "}
          <span
            className="text-primary-600 dark:text-primary-400 font-semibold cursor-pointer"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </motion.div>
    </div>
  );
}
