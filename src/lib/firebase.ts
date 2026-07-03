import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "edupassfmipa",
  appId: "1:740299773688:web:ffda22a83f5c95fafb8d0d",
  apiKey: "AIzaSyDhsNaG88jdoxiAra28M2hepHwTVHnqnSQ",
  authDomain: "edupassfmipa.firebaseapp.com",
  storageBucket: "edupassfmipa.firebasestorage.app",
  messagingSenderId: "740299773688"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-9ff111a7-d5ed-4476-97da-21971c21945d");
export const auth = getAuth(app);
