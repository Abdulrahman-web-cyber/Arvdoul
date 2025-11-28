import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
signInWithEmailAndPassword,
signInWithPopup,
GoogleAuthProvider,
} from "firebase/auth";
import {
getFirestore,
collection,
query,
where,
getDocs,
} from "firebase/firestore";
import { auth } from "../firebase/firebase.js";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail, Phone, Lock } from "lucide-react";

// -----------------------------------------------------
// Small utilities
// -----------------------------------------------------
function LoadingSpinner({ size = 20, color = "currentColor" }) {
return <Loader2 className="animate-spin" size={size} color={color} />;
}

// ✅ Correct Firestore initialization
const db = getFirestore();

const isEmail = (val) => /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(val.trim());
const looksLikePhone = (val) => /^+?[0-9][0-9\s-]{5,}$/.test(val.trim());
const normalizeUsername = (val) => val.trim().toLowerCase();

const mapAuthError = (error) => {
const code = error?.code || "";
switch (code) {
case "auth/invalid-email":
return "That email address looks invalid.";
case "auth/user-disabled":
return "This account has been disabled. Contact support.";
case "auth/user-not-found":
case "auth/invalid-credential":
return "We couldn't find an account with those credentials.";
case "auth/wrong-password":
return "Incorrect password. Please try again.";
case "auth/too-many-requests":
return "Too many attempts. Please try again later.";
case "auth/popup-closed-by-user":
return "Sign-in was cancelled.";
default:
return error?.message || "Something went wrong. Please try again.";
}
};

// -----------------------------------------------------
// Resolve identifier → email
// -----------------------------------------------------
async function resolveIdentifierToEmail(identifier, hint /* "email" | "phone" */) {
const raw = identifier.trim();
if (!raw) return null;

// Direct email login
if (isEmail(raw)) return raw;

const usersRef = collection(db, "users");

if (hint === "email") {
// Username → email
let q1 = query(usersRef, where("username", "==", normalizeUsername(raw)));
let snap1 = await getDocs(q1);
if (!snap1.empty) return snap1.docs[0].data()?.email || null;

// Phone → email  
let q2 = query(usersRef, where("phone", "==", raw));  
let snap2 = await getDocs(q2);  
if (!snap2.empty) return snap2.docs[0].data()?.email || null;

}

if (hint === "phone") {
// Phone → email
if (looksLikePhone(raw)) {
let q1 = query(usersRef, where("phone", "==", raw));
let snap1 = await getDocs(q1);
if (!snap1.empty) return snap1.docs[0].data()?.email || null;
}

// Username → email  
let q2 = query(usersRef, where("username", "==", normalizeUsername(raw)));  
let snap2 = await getDocs(q2);  
if (!snap2.empty) return snap2.docs[0].data()?.email || null;

}

return null;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------
export default function LoginScreen() {
const navigate = useNavigate();

const [method, setMethod] = useState("email"); // "email" | "phone"
const [identifier, setIdentifier] = useState("");
const [password, setPassword] = useState("");

const [loading, setLoading] = useState(false);
const [googleLoading, setGoogleLoading] = useState(false);
const [showPassword, setShowPassword] = useState(false);

const [errors, setErrors] = useState({});

// 🔑 Core login function
const doLoginWithResolvedEmail = async (hint) => {
setErrors({});
const newErrors = {};

if (!identifier.trim()) {  
  newErrors.identifier =  
    hint === "email"  
      ? "Enter your email or username"  
      : "Enter your phone or username";  
}  
if (!password.trim()) newErrors.password = "Enter your password";  

setErrors(newErrors);  
if (Object.keys(newErrors).length) return;  

setLoading(true);  
try {  
  const email = await resolveIdentifierToEmail(identifier, hint);  
  if (!email) {  
    toast.error(  
      hint === "email"  
        ? "No account found for that email/username."  
        : "No account found for that phone/username."  
    );  
    return;  
  }  

  await signInWithEmailAndPassword(auth, email, password);  
  toast.success("Welcome back to Arvdoul! 🚀");  
  navigate("/home"); // ✅ redirect after login  
} catch (error) {  
  toast.error(mapAuthError(error));  
} finally {  
  setLoading(false);  
}

};

// 🔑 Google login
const handleGoogleLogin = async () => {
setGoogleLoading(true);
try {
const provider = new GoogleAuthProvider();
await signInWithPopup(auth, provider);
toast.success("Logged in with Google!");
navigate("/home");
} catch (error) {
toast.error(mapAuthError(error));
} finally {
setGoogleLoading(false);
}
};

return (
<div className="w-full h-screen flex items-center justify-center relative overflow-hidden bg-gray-100 dark:bg-gray-900">
{/* Floating particles background */}
{[...Array(25)].map((_, i) => (
<motion.div
key={i}
className="absolute rounded-full"
style={{
width: ${Math.random() * 8 + 4}px,
height: ${Math.random() * 8 + 4}px,
top: ${Math.random() * 100}%,
left: ${Math.random() * 100}%,
background: "rgba(99,102,241,0.08)",
}}
animate={{
y: [0, (Math.random() - 0.5) * 30],
x: [0, (Math.random() - 0.5) * 30],
opacity: [0.1, 0.5, 0.1],
}}
transition={{
duration: Math.random() * 12 + 6,
repeat: Infinity,
ease: "easeInOut",
delay: Math.random() * 5,
}}
/>
))}

{/* Login box */}  
  <motion.div  
    initial={{ scale: 0.92, opacity: 0 }}  
    animate={{ scale: 1, opacity: 1 }}  
    transition={{ duration: 0.6 }}  
    className="relative z-10 w-11/12 sm:w-[420px] bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 flex flex-col gap-6 border border-gray-200/60 dark:border-gray-700/50"  
  >  
    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 text-center">  
      Welcome Back 👋  
    </h1>  
    <p className="text-gray-600 dark:text-gray-300 text-center -mt-2">  
      Login to continue to Arvdoul  
    </p>  

    {/* Toggle login method */}  
    <div className="flex gap-3 justify-center mb-1">  
      <button  
        onClick={() => {  
          setMethod("email");  
          setIdentifier("");  
          setPassword("");  
          setErrors({});  
        }}  
        className={`px-4 py-2 rounded-xl font-semibold transition ${  
          method === "email"  
            ? "bg-indigo-500 text-white shadow-lg"  
            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"  
        }`}  
      >  
        Email or Username  
      </button>  
      <button  
        onClick={() => {  
          setMethod("phone");  
          setIdentifier("");  
          setPassword("");  
          setErrors({});  
        }}  
        className={`px-4 py-2 rounded-xl font-semibold transition ${  
          method === "phone"  
            ? "bg-indigo-500 text-white shadow-lg"  
            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"  
        }`}  
      >  
        Phone or Username  
      </button>  
    </div>  

    {/* Login Form */}  
    <form  
      className="flex flex-col gap-4"  
      onSubmit={(e) => {  
        e.preventDefault();  
        doLoginWithResolvedEmail(method);  
      }}  
    >  
      {/* Identifier */}  
      <div className="relative">  
        {method === "email" ? (  
          <Mail className="absolute left-3 top-3.5 text-gray-400" size={20} />  
        ) : (  
          <Phone className="absolute left-3 top-3.5 text-gray-400" size={20} />  
        )}  
        <input  
          type="text"  
          value={identifier}  
          onChange={(e) => setIdentifier(e.target.value)}  
          placeholder={  
            method === "email"  
              ? "Email or username"  
              : "Phone (+1234567890) or username"  
          }  
          autoComplete="username"  
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"  
        />  
        {errors.identifier && (  
          <p className="text-xs text-red-500 mt-1">{errors.identifier}</p>  
        )}  
      </div>  

      {/* Password */}  
      <div className="relative">  
        <Lock className="absolute left-3 top-3.5 text-gray-400" size={20} />  
        <input  
          type={showPassword ? "text" : "password"}  
          value={password}  
          onChange={(e) => setPassword(e.target.value)}  
          placeholder="Password"  
          autoComplete="current-password"  
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"  
        />  
        <button  
          type="button"  
          onClick={() => setShowPassword((v) => !v)}  
          className="absolute right-3 top-3 text-gray-500"  
        >  
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}  
        </button>  
        {errors.password && (  
          <p className="text-xs text-red-500 mt-1">{errors.password}</p>  
        )}  
      </div>  

      {/* Forgot password */}  
      <div className="text-right">  
        <button  
          type="button"  
          onClick={() => navigate("/forget-password")}  
          className="text-sm text-indigo-500 hover:underline"  
        >  
          Forgot Password?  
        </button>  
      </div>  

      {/* Login button */}  
      <button  
        type="submit"  
        disabled={loading}  
        className="w-full py-3 rounded-2xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition flex items-center justify-center gap-2 disabled:opacity-70"  
      >  
        {loading ? <LoadingSpinner /> : "Login"}  
      </button>  
    </form>  

    {/* Divider */}  
    <div className="flex items-center gap-3 text-gray-400 text-sm font-semibold">  
      <hr className="flex-1 border-gray-300 dark:border-gray-600" /> OR{" "}  
      <hr className="flex-1 border-gray-300 dark:border-gray-600" />  
    </div>  

    {/* Google Login */}  
    <button  
      onClick={handleGoogleLogin}  
      disabled={googleLoading}  
      className="w-full py-3 rounded-2xl font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-md flex items-center justify-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-70"  
    >  
      {googleLoading ? (  
        <LoadingSpinner size={22} color="black" />  
      ) : (  
        <>  
          <img  
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"  
            alt="Google"  
            className="w-6 h-6"  
          />  
          <span className="text-gray-700 dark:text-gray-100 font-medium">  
            Continue with Google  
          </span>  
        </>  
      )}  
    </button>  
  </motion.div>  
</div>

);
}