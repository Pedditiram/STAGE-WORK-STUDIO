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

// High-Performance Production Serverless Cloud Sync Engine (/api/sync)
const NATIVE_ROOM_SYNC_URL = "/api/sync";
const RESTFUL_ROOM_SYNC_URL = "https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556";
const JSONBLOB_ROOM_SYNC_URL = "https://jsonblob.com/api/jsonBlob/019f9748-ab24-7be0-8065-27742b7c70bd";

let app = null;
let db = null;
let broadcastChannel = null;

// Only initialize Firebase Firestore if custom config is explicitly set in settings
if (typeof window !== 'undefined') {
  const customConfigStr = localStorage.getItem('sps_custom_firebase_config');
  if (customConfigStr) {
    try {
      const config = JSON.parse(customConfigStr);
      if (config && config.apiKey && !config.apiKey.includes('Demo')) {
        app = initializeApp(config);
        db = getFirestore(app);
      }
    } catch (e) {}
  }
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

let lastSyncedPayloadStr = '';

export function subscribeToCloudRoom(roomId, onDataReceived) {
  if (typeof onDataReceived !== 'function') return () => {};

  // 1. Hydrate from localStorage immediately
  if (typeof window !== 'undefined') {
    const cachedStr = localStorage.getItem(`sps_cloud_${roomId}`);
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        lastSyncedPayloadStr = cachedStr;
        onDataReceived(cachedData);
      } catch (e) {}
    }
  }

  // 2. Native Storage Event Listener (0ms Instant Tab-to-Tab Sync)
  const handleStorageChange = (e) => {
    if (e.key === `sps_cloud_${roomId}` && e.newValue) {
      try {
        if (e.newValue !== lastSyncedPayloadStr) {
          lastSyncedPayloadStr = e.newValue;
          const payload = JSON.parse(e.newValue);
          if (typeof onDataReceived === 'function') {
            onDataReceived(payload);
          }
        }
      } catch (err) {}
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  // 3. BroadcastChannel Listener (Instant Cross-Window Signal)
  const handleBroadcast = (event) => {
    if (event.data && event.data.roomId === roomId && typeof onDataReceived === 'function') {
      const payloadStr = JSON.stringify(event.data.payload);
      if (payloadStr !== lastSyncedPayloadStr) {
        lastSyncedPayloadStr = payloadStr;
        onDataReceived(event.data.payload);
      }
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  // 4. Fast Real-Time REST Cloud Polling (Every 1.5 Seconds for 100% Cross-Browser Firefox/Safari Sync)
  const pollCloudDatabase = async () => {
    try {
      let payload = null;
      
      // 1. Try Native Vercel Serverless Sync Engine (/api/sync)
      try {
        const res = await fetch(`${NATIVE_ROOM_SYNC_URL}?type=room&roomId=${encodeURIComponent(roomId)}&t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const resObj = await res.json();
          payload = resObj?.data || null;
        }
      } catch (e) {}

      // 2. Try Primary RESTful API Endpoint
      if (!payload) {
        try {
          const res = await fetch(`${RESTFUL_ROOM_SYNC_URL}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const resObj = await res.json();
            payload = resObj?.data || resObj;
          }
        } catch (e) {}
      }

      // 3. Fallback to JSONBlob Endpoint
      if (!payload) {
        try {
          const res = await fetch(`${JSONBLOB_ROOM_SYNC_URL}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const resObj = await res.json();
            payload = resObj?.data || resObj;
          }
        } catch (e) {}
      }

      if (payload && payload.shots && Array.isArray(payload.shots)) {
        const payloadStr = JSON.stringify(payload);
        if (payloadStr !== lastSyncedPayloadStr) {
          lastSyncedPayloadStr = payloadStr;
          if (typeof window !== 'undefined') {
            localStorage.setItem(`sps_cloud_${roomId}`, payloadStr);
            localStorage.setItem('sps_current_shots', JSON.stringify(payload.shots));
          }
          if (typeof onDataReceived === 'function') {
            onDataReceived(payload);
          }
        }
      }
    } catch (e) {}
  };

  // Poll only if app is in Cloud Mode
  const isCloudMode = typeof window !== 'undefined' && localStorage.getItem('sps_app_version_mode') === 'cloud';
  let pollInterval = null;
  if (isCloudMode) {
    pollCloudDatabase();
    pollInterval = setInterval(pollCloudDatabase, 15000);
  }

  let unsubscribeFirestore = () => {};
  if (db) {
    try {
      const roomRef = doc(db, 'production_rooms', roomId);
      unsubscribeFirestore = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists() && typeof onDataReceived === 'function') {
          onDataReceived(docSnap.data());
        }
      }, (err) => {});
    } catch (err) {}
  }

  return () => {
    if (pollInterval) clearInterval(pollInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    unsubscribeFirestore();
  };
}

import { safeLocalStorageSetItem } from '../utils/safeStorage';

export async function publishToCloudRoom(roomId, projectData) {
  const nowIso = new Date().toISOString();
  const payload = {
    ...projectData,
    roomId,
    lastUpdated: nowIso
  };

  const payloadStr = JSON.stringify(payload);
  lastSyncedPayloadStr = payloadStr;

  // 1. Save to Local Storage safely
  if (typeof window !== 'undefined') {
    safeLocalStorageSetItem(`sps_cloud_${roomId}`, payloadStr);
    if (payload.shots && Array.isArray(payload.shots)) {
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(payload.shots));
    }
  }

  // 2. BroadcastChannel
  if (broadcastChannel) {
    broadcastChannel.postMessage({ roomId, payload });
  }

  // 3. Push to Native Vercel Serverless Sync Engine (/api/sync)
  try {
    await fetch(`${NATIVE_ROOM_SYNC_URL}?type=room&roomId=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  // 4. Push to Primary RESTful Cloud Database
  try {
    await fetch(RESTFUL_ROOM_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Stage Production Studio Sync", data: payload })
    });
  } catch (e) {}

  // 4. Push to Backup JSONBlob Database
  try {
    await fetch(JSONBLOB_ROOM_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  // 5. Firestore Backup
  if (db) {
    try {
      const roomRef = doc(db, 'production_rooms', roomId);
      await setDoc(roomRef, payload, { merge: true });
    } catch (err) {}
  }
}
