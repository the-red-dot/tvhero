import { db, doc, setDoc, getDoc } from "./firebase";
import { currentUser } from "./auth";

export async function createRating(mediaId) {
  const ratingDiv = document.createElement("div");
  ratingDiv.classList.add("rating");
  const savedRating = (await getSavedRating(mediaId)) || 0;
  for (let i = 1; i <= 5; i++) {
    const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    star.setAttribute("viewBox", "0 0 24 24");
    star.innerHTML =
      '<path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.418 8.264L12 18.896l-7.418 4.638L6 15.27 0 9.423l8.332-1.268z"/>';
    if (i <= savedRating) {
      star.classList.add("selected");
    }
    star.addEventListener("click", async (event) => {
      event.stopPropagation();
      await setRating(mediaId, i);
      updateStars(ratingDiv, i);
      console.log(`Rating for media ID ${mediaId} set to ${i} stars.`);
    });
    ratingDiv.appendChild(star);
  }
  return ratingDiv;
}

export async function setRating(mediaId, rating) {
  const user = currentUser;
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const existingData = (await getDoc(userDocRef)).data() || {};
      existingData.ratings = existingData.ratings || {};
      existingData.ratings[mediaId] = rating;
      await setDoc(userDocRef, { ratings: existingData.ratings }, { merge: true });
      console.log(`Rating for media ID ${mediaId} saved as ${rating}.`);
    } catch (error) {
      console.error("Error saving rating:", error);
    }
  } else {
    console.warn("No user signed in. Cannot save rating.");
  }
}

export async function getSavedRating(mediaId) {
  const user = currentUser;
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rating = data.ratings && data.ratings[mediaId] ? data.ratings[mediaId] : 0;
        console.log(`Retrieved saved rating for media ID ${mediaId}: ${rating}.`);
        return rating;
      }
    } catch (error) {
      console.error("Error getting rating:", error);
    }
  }
  return 0;
}

export function updateStars(ratingDiv, rating) {
  const stars = ratingDiv.querySelectorAll("svg");
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add("selected");
    } else {
      star.classList.remove("selected");
    }
  });
  console.log(`Stars updated to ${rating} for the current media.`);
}
