import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyStageProductionStudioKeyDemo",
  authDomain: "stage-production-studio.firebaseapp.com",
  projectId: "stage-production-studio",
  storageBucket: "stage-production-studio.appspot.com",
  messagingSenderId: "98127391273",
  appId: "1:98127391273:web:stageproductionstudio"
};

let app = null;
let db = null;
let broadcastChannel = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialized with local fallback real-time channel.");
}

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('sps_cloud_sync_channel');
}

export const ROLES = [
  { id: 'director', label: '🎬 Director', color: 'text-amber-400 border-amber-500/40 bg-amber-950/80' },
  { id: 'dp', label: '🎥 Director of Photography', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/80' },
  { id: 'lighting', label: '💡 Lighting Lead', color: 'text-pink-400 border-pink-500/40 bg-pink-950/80' },
  { id: 'choreographer', label: '🎭 Choreographer', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/80' },
  { id: 'sound', label: '🎵 Audio / Sync Lead', color: 'text-purple-400 border-purple-500/40 bg-purple-950/80' }
];

export function subscribeToCloudRoom(roomId, onDataReceived) {
  // Load cached room data from localStorage immediately on subscribe
  if (typeof window !== 'undefined') {
    const cachedStr = localStorage.getItem(`sps_cloud_${roomId}`);
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        onDataReceived(cachedData);
      } catch (e) {}
    }
  }

  const handleBroadcast = (event) => {
    if (event.data && event.data.roomId === roomId) {
      onDataReceived(event.data.payload);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  let unsubscribeFirestore = () => {};
  if (db) {
    try {
      const roomRef = doc(db, 'production_rooms', roomId);
      unsubscribeFirestore = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
          onDataReceived(docSnap.data());
        }
      }, (err) => {
        console.log("Firestore offline snapshot mode active:", err.message);
      });
    } catch (err) {
      console.log("Firestore fallback active:", err);
    }
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    unsubscribeFirestore();
  };
}

export async function publishToCloudRoom(roomId, projectData) {
  const payload = {
    ...projectData,
    lastUpdated: new Date().toISOString()
  };

  // Always save to localStorage room cache
  if (typeof window !== 'undefined') {
    localStorage.setItem(`sps_cloud_${roomId}`, JSON.stringify(payload));
  }

  if (broadcastChannel) {
    broadcastChannel.postMessage({ roomId, payload });
  }

  if (db) {
    try {
      const roomRef = doc(db, 'production_rooms', roomId);
      await setDoc(roomRef, payload, { merge: true });
    } catch (err) {
      // Handled by localStorage
    }
  }
}
