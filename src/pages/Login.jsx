import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FaCheck, FaEnvelope, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import { auth } from "../firebase/firebaseConfig";
import { clearAdminSession, initializeAdminSession } from "../utils/adminSession";

const PRIMARY = "#de638a";
const PRIMARY_HOVER = "#ca547f";
const TEXT_MAIN = "#344054";
const TEXT_SUBTLE = "#667085";
const BORDER = "#dde3ea";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeField, setActiveField] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const navigate = useNavigate();

  const getAuthErrorMessage = (err) => {
    const code = err?.code || "";

    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-email"
    ) {
      return "Invalid credentials. Check your email and password and try again.";
    }

    if (code === "auth/too-many-requests") {
      return "Too many login attempts. Try again in a few minutes.";
    }

    return "Login failed. Please try again.";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCred.user.getIdTokenResult();

      if (token.claims.isAdmin) {
        initializeAdminSession(rememberMe);
        navigate("/admin/dashboard", { state: { loginSuccess: true } });
      } else {
        clearAdminSession();
        await signOut(auth);
        setError("Access denied. You are not an admin.");
      }
    } catch (err) {
      clearAdminSession();
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background:
      "linear-gradient(90deg, rgba(250, 220, 230, 1) 0%, rgba(247, 239, 231, 1) 46%, rgba(220, 240, 223, 1) 100%)",
    padding: "28px 20px",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: 430,
    background: "#ffffff",
    padding: "36px 30px 28px",
    borderRadius: 22,
    boxShadow: "0 18px 48px rgba(77, 64, 73, 0.13)",
    textAlign: "center",
  };

  const getFieldStyle = (fieldName) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
    borderRadius: 13,
    border: activeField === fieldName ? `1px solid ${PRIMARY}` : `1px solid ${BORDER}`,
    background: "#fff",
    boxShadow:
      activeField === fieldName ? "0 0 0 3px rgba(222, 99, 138, 0.10)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
  });

  const inputStyle = {
    flex: 1,
    width: "auto",
    minWidth: 0,
    margin: 0,
    border: "none",
    borderRadius: 0,
    outline: "none",
    boxShadow: "none",
    background: "transparent",
    color: TEXT_MAIN,
    fontSize: 14,
    padding: "13px 0",
    appearance: "none",
    WebkitAppearance: "none",
    WebkitBoxShadow: "none",
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2
          style={{
            margin: 0,
            color: PRIMARY,
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          ClosetLoop Admin
        </h2>

        <p
          style={{
            margin: "8px 0 24px",
            fontSize: 14,
            color: TEXT_SUBTLE,
            lineHeight: 1.5,
          }}
        >
          Sign in to manage the platform.
        </p>

        <form
          onSubmit={handleLogin}
          autoComplete="on"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={getFieldStyle("email")}>
            <FaEnvelope style={{ color: "#98a2b3", flexShrink: 0, fontSize: 14 }} />
            <input
              id="admin-email"
              name="email"
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setActiveField("email")}
              onBlur={() => setActiveField("")}
              autoComplete="username"
              required
              style={inputStyle}
            />
          </div>

          <div style={getFieldStyle("password")}>
            <FaLock style={{ color: "#98a2b3", flexShrink: 0, fontSize: 14 }} />
            <input
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setActiveField("password")}
              onBlur={() => setActiveField("")}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                border: "none",
                background: "transparent",
                color: "#98a2b3",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 15,
              }}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: TEXT_MAIN,
              cursor: "pointer",
              marginTop: 2,
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                border: rememberMe ? `1px solid ${PRIMARY}` : "1px solid #c8d0da",
                background: rememberMe ? PRIMARY : "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {rememberMe && <FaCheck size={10} color="#fff" />}
            </span>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ display: "none" }}
            />
            Remember me
          </label>

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            style={{
              marginTop: 4,
              background: buttonHovered && !loading ? PRIMARY_HOVER : PRIMARY,
              border: "none",
              padding: "13px 0",
              color: "#fff",
              borderRadius: 13,
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
              fontSize: 15,
              opacity: loading ? 0.65 : 1,
              boxShadow: "0 10px 24px rgba(222, 99, 138, 0.20)",
              transition: "background 0.18s ease",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && (
          <p
            style={{
              margin: "14px 0 0",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #f3c7c7",
              background: "#fff4f4",
              color: "#c24141",
              fontSize: 13,
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            margin: "18px 0 0",
            fontSize: 13,
            color: TEXT_SUBTLE,
            lineHeight: 1.5,
          }}
        >
          Can&apos;t access your account?{" "}
          <a
            href="mailto:closetloopcaps@gmail.com"
            style={{
              color: PRIMARY,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Contact support here
          </a>
        </p>
      </div>

      <p
        style={{
          margin: "18px 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "#667085",
          padding: "0 12px",
        }}
      >
        © 2026 ClosetLoop. All rights reserved.
      </p>
    </div>
  );
}
