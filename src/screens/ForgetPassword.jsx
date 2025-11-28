import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { toast } from "sonner";
import LoadingSpinner from "@components/Shared/LoadingSpinner";

export default function ForgetPassword() {
  const [mode, setMode] = useState("email"); // "email" | "phone"
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  // Setup Invisible reCAPTCHA
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {},
        },
      );
    }
    return window.recaptchaVerifier;
  };

  // Send password reset for email
  const handleEmailReset = async () => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent. Check your inbox.");
      navigate("/login");
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  // Send OTP for phone reset
  const handlePhoneReset = async () => {
    setLoading(true);
    try {
      const appVerifier = setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(
        auth,
        phone,
        appVerifier,
      );
      window.confirmationResult = confirmation;
      setOtpSent(true);
      toast.success("OTP sent to your phone.");
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      await window.confirmationResult.confirm(otp);
      toast.success("Phone verified! Please set a new password.");
      navigate("/set-password"); // Redirect to SetPassword screen
    } catch (error) {
      toast.error("Invalid OTP. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4">
      <div className="max-w-md w-full bg-gray-50 dark:bg-gray-900 shadow-xl rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-100">
          Reset Password
        </h2>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-6 space-x-4">
          <button
            onClick={() => setMode("email")}
            className={`px-4 py-2 rounded-lg font-medium ${mode === "email" ? "bg-indigo-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
          >
            Email
          </button>
          <button
            onClick={() => setMode("phone")}
            className={`px-4 py-2 rounded-lg font-medium ${mode === "phone" ? "bg-indigo-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
          >
            Phone
          </button>
        </div>

        {/* Email Reset */}
        {mode === "email" && (
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handleEmailReset}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              {loading ? (
                <LoadingSpinner size={24} color="#fff" />
              ) : (
                "Send Reset Link"
              )}
            </button>
          </div>
        )}

        {/* Phone Reset */}
        {mode === "phone" && (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number e.g. +1234567890"
                  className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={handlePhoneReset}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  {loading ? (
                    <LoadingSpinner size={24} color="#fff" />
                  ) : (
                    "Send OTP"
                  )}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  {loading ? (
                    <LoadingSpinner size={24} color="#fff" />
                  ) : (
                    "Verify OTP"
                  )}
                </button>
              </>
            )}
            <div id="recaptcha-container"></div>
          </div>
        )}

        {/* Back to Login */}
        <p className="text-center mt-6 text-gray-600 dark:text-gray-300">
          Remember your password?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-indigo-600 cursor-pointer hover:underline"
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
}
