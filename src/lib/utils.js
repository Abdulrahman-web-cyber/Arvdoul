// Utility for class name merging (for Tailwind)
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Format date to readable string
export function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Capitalize first letter
export function capitalize(text) {
  if (typeof text !== "string") return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Generate a random username (fallback for users without names)
export function generateUsername(prefix = "user") {
  const random = Math.floor(Math.random() * 100000);
  return `${prefix}${random}`;
}

// Get initials from full name
export function getInitials(fullName = "") {
  return fullName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

// Convert bytes to human-readable format
export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
