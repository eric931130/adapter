"use client";

import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCSjsjZN0Ti30z-WHntbCYfBjl4NI7xUDY",
  authDomain: "open-ac3bd.firebaseapp.com",
  projectId: "open-ac3bd",
  storageBucket: "open-ac3bd.firebasestorage.app",
  messagingSenderId: "869586666345",
  appId: "1:869586666345:web:63fbe8d49f576bb903b3f8",
  measurementId: "G-Z8CRWJV1RJ",
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  return supported ? getAnalytics(getFirebaseApp()) : null;
}
