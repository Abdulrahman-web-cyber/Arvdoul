import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setLoading(false);
          
          // Navigate to intro after 1 second
          setTimeout(() => {
            navigate('/intro');
          }, 1000);
          
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      {/* Logo */}
      <div style={{
        width: '100px',
        height: '100px',
        borderRadius: '20px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          fontSize: '40px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #ffffff, #e0e7ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          A
        </div>
      </div>

      {/* App Name */}
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        marginBottom: '10px',
        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        Arvdoul
      </h1>
      
      <p style={{
        fontSize: '1.2rem',
        opacity: 0.9,
        marginBottom: '30px'
      }}>
        The Future of Social Connection
      </p>

      {/* Progress Bar */}
      <div style={{
        width: '300px',
        height: '6px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '15px'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #ffffff, #c7d2fe)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Progress Text */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '300px',
        fontSize: '0.9rem',
        marginBottom: '30px',
        opacity: 0.8
      }}>
        <span>Loading...</span>
        <span>{progress}%</span>
      </div>

      {/* Loading Message */}
      <p style={{
        fontSize: '0.9rem',
        opacity: 0.7,
        marginBottom: '20px'
      }}>
        {loading ? 'Initializing secure platform...' : 'Ready! 🚀'}
      </p>

      {/* Security Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        opacity: 0.6,
        marginTop: '20px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          animation: 'pulse 1.5s infinite'
        }} />
        <span>🔒 End-to-End Encryption</span>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}
