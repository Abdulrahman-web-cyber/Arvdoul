import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase/firebase";
import {
  RecaptchaVerifier,
  setPersistence,
  browserLocalPersistence,
  signInWithPhoneNumber,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "../context/UserContext"; // ✅ Updated
import LoadingDots from "../components/Shared/LoadingDots";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function OtpVerification() {
  const navigate = useNavigate();
  const { signupData } = useUser(); // ✅ Updated

  const [otp, setOtp] = useState(Array(6).fill(""));
  const inputRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [errorShake, setErrorShake] = useState(false);

  const phoneNumber = signupData?.phone;

  // Initialize reCAPTCHA + send OTP
  useEffect(() => {
    if (!phoneNumber) {
      toast.error("Phone number missing. Please go back and enter it.");
      navigate("/signup/step2");
      return;
    }

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => toast.error("Recaptcha expired, please try again."),
      });
    }

    sendOtp();
    inputRefs.current[0]?.focus();

    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const sendOtp = async () => {
    if (!phoneNumber) return;

    // ✅ Ensure recaptcha is always initialized
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
      });
    }

    setLoading(true);
    setResendTimer(60);
    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      window.confirmationResult = result;
      toast.success("OTP sent!");
      inputRefs.current[0]?.focus();
    } catch (err) {
      console.error("Send OTP error:", err);
      toast.error(`Failed to send OTP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value, index) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 5) inputRefs.current[index + 1]?.focus();
      if (!value && index > 0) inputRefs.current[index - 1]?.focus();

      if (index === 5 && value) verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code = otp.join("")) => {
    if (code.length < 6) {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      toast.error("Please enter the full 6-digit OTP.");
      return;
    }
    if (!window.confirmationResult) {
      toast.error("OTP session expired. Please resend OTP.");
      return;
    }

    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await window.confirmationResult.confirm(code);
      const user = userCredential.user;

      if (!user) throw new Error("User not found after OTP verification.");
      toast.success("Phone verified!");

      try {
        const userRef = doc(db, "users", user.uid);
        const existing = await getDoc(userRef);

        if (!existing.exists()) {
          await setDoc(
            userRef,
            {
              phone: user.phoneNumber || "",
              ...(signupData?.email && { email: signupData.email }),
              ...(signupData?.firstName && { firstName: signupData.firstName }),
              ...(signupData?.lastName && { lastName: signupData.lastName }),
              nickname: "",
              bio: "",
              profilePicture: "",
              coins: 100,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (firestoreErr) {
        console.error("Firestore user creation failed:", firestoreErr);
        toast.error("Account saved partially, please try again in profile setup.");
      }

      navigate("/set-password");
    } catch (err) {
      console.error("Verify OTP error:", err);
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);

      let msg = "OTP verification failed.";
      switch (err.code) {
        case "auth/invalid-verification-code":
          msg = "Invalid code. Please try again.";
          break;
        case "auth/code-expired":
          msg = "Code expired. Please resend OTP.";
          break;
        case "auth/too-many-requests":
          msg = "Too many attempts. Please wait before retrying.";
          break;
        case "auth/user-disabled":
          msg = "This account has been disabled.";
          break;
        case "auth/network-request-failed":
          msg = "Network error. Please check your connection.";
          break;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-50 dark:bg-gray-900 overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">
        Verify your phone
      </h2>
      <p className="mb-6 text-center text-gray-700 dark:text-gray-300">
        Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
      </p>

      {/* OTP Inputs */}
      <motion.div
        className="flex justify-between w-full max-w-md gap-2 mb-6"
        animate={errorShake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        {otp.map((digit, index) => (
          <motion.input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`Digit ${index + 1}`}
            autoComplete="one-time-code" // ✅ Autofill
            role="textbox"
            value={digit}
            maxLength={1}
            disabled={loading} // ✅ Disable during verify
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            whileFocus={{ scale: 1.1 }}
            className={`flex-1 w-0 min-w-[40px] h-14 text-center text-xl border rounded-xl focus:outline-none transition-all duration-200
              ${
                otp[index]
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                  : "border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              }`}
          />
        ))}
      </motion.div>

      {/* Verify OTP Button */}
      <motion.button
        onClick={() => verifyOtp()}
        disabled={otp.join("").length < 6 || loading}
        className={`w-full max-w-md py-3 rounded-2xl shadow-lg mb-4 flex items-center justify-center transition-all
          ${
            otp.join("").length < 6 || loading
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:shadow-xl"
          }`}
        whileTap={{ scale: 0.97 }}
      >
        {loading ? <LoadingDots /> : "Verify OTP"}
      </motion.button>

      {/* Resend Timer */}
      <div className="relative w-full max-w-md h-2 mb-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="absolute h-2 bg-primary-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${((60 - resendTimer) / 60) * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>

      <button
        onClick={sendOtp}
        disabled={resendTimer > 0 || loading}
        className={`font-semibold ${
          resendTimer > 0 || loading
            ? "text-gray-400 cursor-not-allowed"
            : "text-primary-500 hover:underline"
        }`}
      >
        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
      </button>

      <div id="recaptcha-container" />
    </motion.div>
  );
}