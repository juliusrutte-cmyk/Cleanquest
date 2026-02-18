import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, query, orderByChild, equalTo } from 'firebase/database';

// Firebase-Konfiguration
// WICHTIG: Ersetze diese mit deinen eigenen Firebase-Credentials!
// Gehe zu Firebase Console (console.firebase.google.com) und erstelle ein neues Projekt
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Falls keine Firebase-Konfiguration vorhanden ist, nutze einen Fallback
const isFirebaseConfigured = !firebaseConfig.apiKey.includes('YOUR_');

let db: any = null;

if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  } catch (error) {
    console.warn('Firebase konnte nicht initialisiert werden:', error);
  }
}

// Service-Funktionen
export const firebaseService = {
  // Speichere eine Familie global
  async saveFamilyGlobally(code: string, family: any) {
    if (!db) return false;
    try {
      await set(ref(db, `families/${code}`), family);
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern der Familie:', error);
      return false;
    }
  },

  // Hole eine Familie nach Code
  async getFamilyByCode(code: string) {
    if (!db) return null;
    try {
      const snapshot = await get(ref(db, `families/${code}`));
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error('Fehler beim Abrufen der Familie:', error);
      return null;
    }
  },

  // Hole alle Familien
  async getAllFamilies() {
    if (!db) return {};
    try {
      const snapshot = await get(ref(db, 'families'));
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return {};
    } catch (error) {
      console.error('Fehler beim Abrufen von Familien:', error);
      return {};
    }
  },

  // Speichere eine Chat-Nachricht
  async saveChatMessage(familyCode: string, message: any) {
    if (!db) return false;
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await set(ref(db, `chats/${familyCode}/${messageId}`), message);
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern der Nachricht:', error);
      return false;
    }
  },

  // Hole alle Chat-Nachrichten einer Familie
  async getChatMessages(familyCode: string) {
    if (!db) return [];
    try {
      const snapshot = await get(ref(db, `chats/${familyCode}`));
      if (snapshot.exists()) {
        const messages = snapshot.val();
        const messageArray = Object.values(messages) as any[];
        return messageArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      return [];
    } catch (error) {
      console.error('Fehler beim Abrufen von Nachrichten:', error);
      return [];
    }
  },

  // Prüfe ob Firebase verfügbar ist
  isAvailable() {
    return db !== null;
  }
};

export default firebaseService;
