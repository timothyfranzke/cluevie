import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db, QUIZZES_COLLECTION } from "./firebase";
import type { Quiz, Result } from "../game/types";

export { searchMovies, prefetchMovieIndex } from "./movieIndex";

export async function loadTodayQuiz(): Promise<Quiz | null> {
  const q = query(
    collection(db, QUIZZES_COLLECTION),
    where("date", "<=", Timestamp.now()),
    orderBy("date", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  const doc = snap.docs[0];
  if (!doc) return null;
  const data = doc.data();
  return {
    id: doc.id,
    ...(data as Omit<Quiz, "id">),
  };
}

export async function persistResult(result: Result): Promise<void> {
  try {
    await addDoc(collection(db, "results"), {
      ...result,
      completedOn: Timestamp.now(),
    });
  } catch (err) {
    console.warn("persistResult failed (non-fatal)", err);
  }
}
