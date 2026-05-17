import React from "react";

export default function HomeScreen() {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f5f5f5",
      fontFamily: "Arial, sans-serif"
    }}>
      
      <div style={{
        textAlign: "center",
        padding: "24px",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        width: "90%",
        maxWidth: "420px"
      }}>
        
        <h1 style={{
          fontSize: "28px",
          marginBottom: "10px",
          color: "#111"
        }}>
          Home Screen
        </h1>

        <p style={{
          fontSize: "14px",
          color: "#666",
          marginBottom: "20px"
        }}>
          This is a clean placeholder. Ready for feed, stories, and navigation integration.
        </p>

        <div style={{
          height: "120px",
          borderRadius: "12px",
          border: "2px dashed #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "13px"
        }}>
          Future Feed Area
        </div>

        <div style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#888"
        }}>
          <span>🏠 Home</span>
          <span>🔍 Explore</span>
          <span>➕ Post</span>
          <span>💬 Chats</span>
          <span>👤 Profile</span>
        </div>

      </div>
    </div>
  );
}
