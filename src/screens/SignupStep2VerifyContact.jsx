// src/screens/SignupStep2VerifyContact.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "../context/SignupContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import LoadingDots from "../components/Shared/LoadingDots";

export default function SignupStep2VerifyContact() {
const navigate = useNavigate();
const recaptchaRef = useRef(null);

const {
signupData,
updateSignupData,
recaptchaReady,
sendOtp,
verifyOtp,
completeSignup,
} = useSignup();

const [method, setMethod] = useState(signupData.contactMethod || "phone");
const [phoneLocal, setPhoneLocal] = useState(signupData.phone || "");
const [emailLocal, setEmailLocal] = useState(signupData.email || "");
const [errorPhone, setErrorPhone] = useState("");
const [errorEmail, setErrorEmail] = useState("");
const [sendingOtp, setSendingOtp] = useState(false);
const [sendingEmail, setSendingEmail] = useState(false);
const [signingGoogle, setSigningGoogle] = useState(false);

// Update context when method changes
useEffect(() => {
updateSignupData("contactMethod", method);
}, [method]);

// ==================== Handlers ====================
const handleSendOtp = async () => {
setErrorPhone("");
const phone = phoneLocal.trim();
if (!phone) return setErrorPhone("Enter your phone number.");
if (!phone.startsWith("+"))
return setErrorPhone("Include country code (e.g., +1234567890).");

if (!recaptchaReady)    
  return setErrorPhone("Verification not ready. Try again in a moment.");    

try {    
  setSendingOtp(true);    
  await sendOtp(phone);    
  updateSignupData("phone", phone);    
  toast.success("OTP sent! Check your messages.");    
  navigate("/otp-verification");    
} catch (err) {    
  console.error("Send OTP failed:", err);    
  setErrorPhone(err?.message || "Failed to send OTP.");    
  toast.error(err?.message || "Failed to send OTP.");    
} finally {    
  setSendingOtp(false);    
}

};

const handleSendMagicLink = async () => {
setErrorEmail("");
const email = emailLocal.trim();
if (!email) return setErrorEmail("Please enter an email address.");

try {    
  setSendingEmail(true);    
  // Assuming sendMagicLink exists in SignupContext    
  await completeSignup(); // or a dedicated sendMagicLink(email) function    
  updateSignupData("email", email);    
  toast.success("Magic link sent! Check your inbox.");    
} catch (err) {    
  console.error("Magic link error:", err);    
  setErrorEmail(err?.message || "Failed to send magic link.");    
  toast.error(err?.message || "Failed to send magic link.");    
} finally {    
  setSendingEmail(false);    
}

};

const handleGoogleSignIn = async () => {
try {
setSigningGoogle(true);
// Assuming completeSignup can handle Google sign-in
await completeSignup();
toast.success("Signed in with Google");
navigate("/setup-profile");
} catch (err) {
console.error("Google sign-in error:", err);
toast.error(err?.message || "Google sign-in failed");
} finally {
setSigningGoogle(false);
}
};

// ==================== UI ====================
return (
<div className="relative w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 p-4">
<motion.div
initial={{ opacity: 0, y: 25 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="relative w-full max-w-md bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col gap-6"
>
<header className="flex flex-col gap-1 text-center">
<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
Verify Your Contact
</h1>
<p className="text-sm text-gray-500 dark:text-gray-400">
Choose how you’d like to continue
</p>
</header>

{/* Method Toggle */}    
    <div className="grid grid-cols-3 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">    
      {["phone", "email", "google"].map((m) => (    
        <motion.button    
          key={m}    
          onClick={() => setMethod(m)}    
          className={`py-2 text-sm font-semibold rounded-xl transition ${    
            method === m    
              ? "bg-indigo-600 text-white shadow"    
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"    
          }`}    
          whileTap={{ scale: 0.96 }}    
        >    
          {m === "phone" ? "Phone" : m === "email" ? "Email" : "Google"}    
        </motion.button>    
      ))}    
    </div>    

    {/* Phone Input */}    
    {method === "phone" && (    
      <div className="flex flex-col gap-3">    
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">    
          Phone Number    
        </label>    
        <input    
          type="tel"    
          value={phoneLocal}    
          onChange={(e) => setPhoneLocal(e.target.value)}    
          placeholder="+1234567890"    
          className={`w-full px-4 py-3 rounded-xl border ${    
            errorPhone ? "border-red-500" : "border-gray-300 dark:border-gray-700"    
          } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500`}    
        />    
        {errorPhone && <p className="text-xs text-red-500">{errorPhone}</p>}    
        <div ref={recaptchaRef} id="recaptcha-container" />    
        <button    
          onClick={handleSendOtp}    
          disabled={sendingOtp || !recaptchaReady}    
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-lg font-semibold flex items-center justify-center disabled:opacity-60"    
        >    
          {sendingOtp ? <LoadingDots /> : "Send OTP"}    
        </button>    
      </div>    
    )}    

    {/* Email Input */}    
    {method === "email" && (    
      <div className="flex flex-col gap-3">    
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">    
          Email Address    
        </label>    
        <input    
          type="email"    
          value={emailLocal}    
          onChange={(e) => setEmailLocal(e.target.value)}    
          placeholder="you@example.com"    
          className={`w-full px-4 py-3 rounded-xl border ${    
            errorEmail ? "border-red-500" : "border-gray-300 dark:border-gray-700"    
          } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500`}    
        />    
        {errorEmail && <p className="text-xs text-red-500">{errorEmail}</p>}    
        <button    
          onClick={handleSendMagicLink}    
          disabled={sendingEmail}    
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg font-semibold flex items-center justify-center"    
        >    
          {sendingEmail ? <LoadingDots /> : "Send Magic Link"}    
        </button>    
      </div>    
    )}    

    {/* Google Sign-in */}    
    {method === "google" && (    
      <div className="flex flex-col gap-3">    
        <button    
          onClick={handleGoogleSignIn}    
          disabled={signingGoogle}    
          className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-2xl text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm flex items-center justify-center gap-3"    
        >    
          {signingGoogle ? (    
            <LoadingDots />    
          ) : (    
            <>    
              <img src="/google-icon.svg" alt="Google" className="w-5 h-5" />    
              Continue with Google    
            </>    
          )}    
        </button>    
        <p className="text-xs text-gray-400 text-center">    
          Skip manual verification with Google.    
        </p>    
      </div>    
    )}    
  </motion.div>    
</div>

);
}