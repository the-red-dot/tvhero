import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { getPerformance, trace } from 'firebase/performance';

const firebaseConfig = {
  apiKey: "AIzaSyAdNHOiFP6pEWy45mvVOecWUgzgBvHIwic",
  authDomain: "tivheromovie.firebaseapp.com",
  projectId: "tivheromovie",
  storageBucket: "tivheromovie.appspot.com",
  messagingSenderId: "602356910655",
  appId: "1:602356910655:web:039e53c5d80e822a3e868a",
  measurementId: "G-9R1PC96WYD",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  cacheSizeBytes: 10485760, // 10MB cache
});
const perf = getPerformance(app);

console.log('Firestore initialized with cache settings.');

export {
  app,
  analytics,
  auth,
  db,
  perf,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
  trace,
};
