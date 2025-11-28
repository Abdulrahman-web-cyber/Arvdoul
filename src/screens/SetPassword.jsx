// src/screens/SetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { toast } from "sonner";
import LoadingDots from "@components/Shared/LoadingDots";
import { auth } from "../firebase/firebase.js";
import { updatePassword, reload } from "firebase/auth";
import { motion } from "framer-motion";

export default function SetPassword() {
  const navigate = useNavigate();
  const { signupData, updateSignupData } = useSignup();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    setPasswordError("");
    setConfirmError("");

    if (password && password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
    }
    if (confirmPassword && confirmPassword !== password) {
      setConfirmError("Passwords do not match.");
    }
  }, [password, confirmPassword]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      toast.error("Please fill in both fields.");
      return;
    }
    if (passwordError || confirmError) {
      toast.error("Please fix the errors before continuing.");
      return;
    }

    setLoading(true);
    updateSignupData({ password }); // store locally if needed

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("No signed-in user found. Please verify your phone first.");
        return;
      }

      // Reload user to avoid stale state
      await reload(user);
      await updatePassword(user, password);

      toast.success("Password set successfully!");
      navigate("/setup-profile");
    } catch (err) {
      console.error(err);
      let message = "Failed to set password.";
      if (err.code === "auth/weak-password") message = "Password is too weak.";
      if (err.code === "auth/requires-recent-login") {
        message = "Session expired. Please log in again.";
        navigate("/login");
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );

  const EyeSlashIcon = () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.477 10.477a3 3 0 0 0 4.243 4.243M9.88 5.882C7.532 7.438 5.423 9.983 4.036 12.322a1.012 1.012 0 0 0 0 .639C5.423 16.49 9.36 19.5 14 19.5c1.06 0 2.07-.18 3.015-.518"
      />
    </svg>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-50 dark:bg-gray-900">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center"
      >
        Set your password
      </motion.h2>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-4 w-full max-w-md bg-white/80 dark:bg-gray-800/70 rounded-2xl shadow-xl p-6"
      >
        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200 ${
              passwordError
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-700"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          >
            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
          {passwordError && (
            <p className="text-red-500 mt-1 text-sm">{passwordError}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200 ${
              confirmError
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-700"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          >
            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
          {confirmError && (
            <p className="text-red-500 mt-1 text-sm">{confirmError}</p>
          )}
        </div>

        {/* Submit */}
        {loading ? (
          <LoadingDots />
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={loading || passwordError || confirmError}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl shadow-lg mt-4 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set Password & Continue
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
