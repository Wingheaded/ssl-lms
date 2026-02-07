// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBGlQ8oJ3Xv1egvUyWxfXt4Rlj_t9aofTM",
    authDomain: "lms-a762e.firebaseapp.com",
    projectId: "lms-a762e",
    storageBucket: "lms-a762e.firebasestorage.app",
    messagingSenderId: "582734902668",
    appId: "1:582734902668:web:000f7f7038283176b792a9"
};

// Initialize Firebase (prevent duplicate initialization during HMR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
