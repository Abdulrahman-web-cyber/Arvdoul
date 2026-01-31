import PropTypes from 'prop-types';
import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { useAuth } from "@context/AuthContext";
import { storage, db } from "../../firebase/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AddStoryModal({ onClose }) {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  \/\/ Revoke preview URL on unmount to free memory
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    \/\/ File validation: max 50MB
    if (selected.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB.");
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file || !currentUser) return;
    setUploading(true);

    try {
      const storageRef = ref(
        storage,
        `stories/${currentUser.uid}/${Date.now()}_${file.name}`,
      );
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(percent);
        },
        (error) => {
          console.error("Upload error:", error);
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "stories"), {
            userId: currentUser.uid,
            mediaUrl: downloadURL,
            mediaType: file.type.startsWith("video") ? "video" : "image",
            createdAt: serverTimestamp(),
          });
          setUploading(false);
          onClose();
        },
      );
    } catch (err) {
      console.error("Failed to upload story:", err);
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreviewUrl("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md relative p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-center">
          Add to Your Story
        </h2>

        {!file ? (
          <div
            onClick={() => fileInputRef.current.click()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange({ target: { files: e.dataTransfer.files } });
            }}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-primary/30 hover:border-primary p-6 rounded-xl cursor-pointer transition-colors"
          >
            <UploadCloud className="w-10 h-10 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              Click or drag to choose photo or video
            </p>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              hidden
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden max-h-[300px]">
              {file.type.startsWith("video") ? (
                <video
                  src={previewUrl}
                  controls
                  className="w-full h-auto rounded-xl"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto rounded-xl"
                />
              )}
            </div>

            {uploading && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={`{ width: `${progress}%` `}}
                />
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={handleRemove}
                className="text-sm text-red-500 hover:underline"
              >
                Remove
              </button>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading {Math.round(progress)}%
                  </>
                ) : (
                  "Upload Story"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
