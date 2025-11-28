// src/screens/SignupStep1Personal.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function SignupStep1Personal() {
  const navigate = useNavigate();
  const { signupData, updateSignupData } = useSignup();

  const [localData, setLocalData] = useState({
    ...signupData,
    dob: signupData.dob || { day: "", month: "", year: "" },
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const firstNameRef = useRef(null);

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  // Validation + username uniqueness check
  const validate = async () => {
    const newErrors = {};
    if (!localData.firstName || !localData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!localData.lastName || !localData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (!localData.gender) newErrors.gender = "Gender is required";
    if (!localData.dob?.day || !localData.dob?.month || !localData.dob?.year) newErrors.dob = "Date of Birth is required";

    if (localData.username && localData.username.trim()) {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", localData.username.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) newErrors.username = "Username already taken";
      } catch (err) {
        console.error("Username validation error:", err);
        toast.error("Could not validate username. Try again.");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (!(await validate())) {
        toast.error("Please fix errors before proceeding.");
        setLoading(false);
        return;
      }
      // commit to signup context
      updateSignupData({ ...localData });
      setLoading(false);
      // proceed to next step (make sure AppRoutes has step2)
      navigate("/signup/step2");
    } catch (err) {
      console.error("handleNext error:", err);
      toast.error(err?.message || "Unexpected error");
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      {/* floating background dots */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        {[...Array(18)].map((_, i) => {
          const size = Math.floor(Math.random() * 12) + 6;
          const top = Math.random() * 100;
          const left = Math.random() * 100;
          const duration = (Math.random() * 12 + 6).toFixed(2);
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top: `${top}%`,
                left: `${left}%`,
                background: "rgba(99,102,241,0.06)",
                filter: "blur(8px)",
              }}
              animate={{ y: [0, (Math.random() - 0.5) * 20, 0] }}
              transition={{ duration: parseFloat(duration), repeat: Infinity, ease: "easeInOut", delay: Math.random() * 4 }}
            />
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md bg-white/90 dark:bg-gray-800/85 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-200/60 dark:border-gray-700/50 p-8"
      >
        <header className="text-center mb-4">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Create your account</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Step 1 — Personal information</p>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">First name</label>
              <input
                ref={firstNameRef}
                type="text"
                value={localData.firstName || ""}
                onChange={(e) => setLocalData({ ...localData, firstName: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${errors.firstName ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                placeholder="Ada"
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Last name</label>
              <input
                type="text"
                value={localData.lastName || ""}
                onChange={(e) => setLocalData({ ...localData, lastName: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${errors.lastName ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                placeholder="Lovelace"
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Gender</label>
            <select
              value={localData.gender || ""}
              onChange={(e) => setLocalData({ ...localData, gender: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border ${errors.gender ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date of birth</label>
            <div className="flex gap-2">
              <select
                value={localData.dob.day || ""}
                onChange={(e) => setLocalData({ ...localData, dob: { ...localData.dob, day: e.target.value } })}
                className={`flex-1 px-3 py-3 rounded-xl border ${errors.dob ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">Day</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={localData.dob.month || ""}
                onChange={(e) => setLocalData({ ...localData, dob: { ...localData.dob, month: e.target.value } })}
                className={`flex-1 px-3 py-3 rounded-xl border ${errors.dob ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">Month</option>
                {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>

              <select
                value={localData.dob.year || ""}
                onChange={(e) => setLocalData({ ...localData, dob: { ...localData.dob, year: e.target.value } })}
                className={`w-28 px-3 py-3 rounded-xl border ${errors.dob ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {errors.dob && <p className="mt-1 text-xs text-red-500">{errors.dob}</p>}
          </div>

          {/* optional username */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Username (optional)</label>
            <input
              type="text"
              value={localData.username || ""}
              onChange={(e) => setLocalData({ ...localData, username: e.target.value })}
              placeholder="choose-a-username"
              className={`w-full px-4 py-3 rounded-xl border ${errors.username ? "border-red-500" : "border-gray-300 dark:border-gray-700"} bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl font-semibold shadow-lg disabled:opacity-60"
          >
            {loading ? "Checking…" : "Continue"}
          </motion.button>

          <p className="text-sm text-center text-gray-600 dark:text-gray-300 mt-2">
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} className="text-indigo-600 font-semibold">Sign in</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}