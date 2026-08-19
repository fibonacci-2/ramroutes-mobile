import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

export type ScoutReply = { text: string; eventIds: string[] };
export type ScoutHistoryMessage = { role: 'me' | 'ai'; text: string };

// Calls the scoutReply Cloud Function (functions/index.js + scoutModel.js)
// instead of OpenRouter directly - the API key only ever lives server-side,
// same reasoning as why event/profile embeddings are computed in
// scraper/embedder.js and functions/embedder.js, never on-device. The
// function grounds its reply in the student's own school's events server-side
// (via getAuth()'s uid -> users/{uid}.schoolId), so this only ever sends the
// message text and recent turn history, nothing about which school/events.
export async function askScout(message: string, history: ScoutHistoryMessage[]): Promise<ScoutReply> {
  console.log('askScout', { message, history });
  const scoutReplyFn = httpsCallable<{ message: string; history: ScoutHistoryMessage[] }, ScoutReply>(
    getFunctions(),
    'scoutReply'
  );
  const result = await scoutReplyFn({ message, history });
  console.log('askScout result', result);
  return result.data;
}
