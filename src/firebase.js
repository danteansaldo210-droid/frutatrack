import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD6pQ30jWGXo1EwBqHqMi34MLu5teQMi1M",
  authDomain: "proceso-almendras.firebaseapp.com",
  databaseURL: "https://proceso-almendras-default-rtdb.firebaseio.com",
  projectId: "proceso-almendras",
  storageBucket: "proceso-almendras.firebasestorage.app",
  messagingSenderId: "428906942132",
  appId: "1:428906942132:web:21b851d4ee07584bc1d1e1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
