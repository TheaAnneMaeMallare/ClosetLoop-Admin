// firebaseConfig.js (FOR WEB ADMIN DASHBOARD)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB22jajTw3kTE11nkaUsQDOXlbcbLP-FO4",
  authDomain: "closetloopapp.firebaseapp.com",
  projectId: "closetloopapp",
  storageBucket: "closetloopapp.appspot.com",
  messagingSenderId: "662092059115",
  appId: "1:662092059115:web:5bb60b4c28facec9da89ae",
  measurementId: "G-1P4D1M1XY7",
};

// Initialize Firebase app (safe check)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
