import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  db,
  collection,
  getDocs,
} from './firebase';

export let currentUser = null;

/** Listen to Firebase Auth state changes */
export function listenToAuthChanges(onUserChanged) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    onUserChanged(user);
  });
}

/** Log in with email/password */
export async function handleLogin(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  if (!userCredential.user.emailVerified) {
    await signOut(auth);
    throw new Error('אנא אמת את כתובת האימייל שלך לפני הכניסה.');
  }
  console.log('User logged in:', userCredential.user.email);
}

/** Sign up with email/password */
export async function handleSignup(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  console.log('User registered. Verification email sent to:', userCredential.user.email);
}

/** Send password reset email */
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
  alert('נשלח אימייל לאיפוס סיסמה. אנא בדוק את תיבת הדואר שלך.');
  console.log(`Password reset email sent to ${email}.`);
}

/** Load user data (libraries) from Firestore given a uid */
export async function loadUserData(uid) {
  try {
    const userDocRef = collection(db, 'users', uid, 'libraries');
    const librariesSnapshot = await getDocs(userDocRef);
    const libs = {};
    librariesSnapshot.forEach((docSnap) => {
      libs[docSnap.id] = docSnap.data().media || [];
    });
    return libs;
  } catch (error) {
    console.error('Error loading user data:', error);
    return {};
  }
}

/** Log out the current user */
export async function handleLogout() {
  await signOut(auth);
  console.log('User signed out');
}
