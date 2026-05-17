\/\/ src/lib/utils.js
\/\/ Arvdoul-level utilities: small, well-tested helpers used across the app.

export function cn(...args) {
  \/\/ Accept strings, arrays, objects {className: bool}, nested
  const classes = [];

  args.forEach((arg) => {
    if (!arg) return;
    if (typeof arg === "string") classes.push(arg);
    else if (Array.isArray(arg)) classes.push(cn(...arg));
    else if (typeof arg === "object") {
      Object.entries(arg).forEach(([k, v]) => {
        if (v) classes.push(k);
      });
    }
  });

  return classes.filter(Boolean).join(" ");
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function capitalize(text = "") {
  if (typeof text !== "string") return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function generateUsername(prefix = "user") {
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}${random}`;
}

export function getInitials(fullName = "") {
  if (!fullName) return "";
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}

export function formatBytes(bytes = 0, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}