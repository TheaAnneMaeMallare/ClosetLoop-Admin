// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useEffect, useState } from "react";
import {
  clearAdminSession,
  isAdminSessionExpired,
  touchAdminSession,
} from "../utils/adminSession";

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const expireSession = async () => {
      clearAdminSession();
      await signOut(auth);
      setUser(null);
    };

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        clearAdminSession();
        setUser(null);
        return;
      }

      if (isAdminSessionExpired()) {
        await expireSession();
        return;
      }

      touchAdminSession();
      setUser(u);
    });

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    const handleActivity = async () => {
      if (!auth.currentUser) return;

      if (isAdminSessionExpired()) {
        await expireSession();
        return;
      }

      touchAdminSession();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const intervalId = window.setInterval(async () => {
      if (!auth.currentUser) return;

      if (isAdminSessionExpired()) {
        await expireSession();
      }
    }, 60 * 1000);

    return () => {
      unsub();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.clearInterval(intervalId);
    };
  }, []);

  if (user === undefined) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#f5f6fa",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#555",
          fontSize: 15,
        }}
      >
        Checking authentication...
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return children;
}
