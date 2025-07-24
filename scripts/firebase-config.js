// Conteúdo para /scripts/firebase-config.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyByAi0e0M0lbLiIq1h1wdrRS_E2azAKiCQ",
  authDomain: "emporiokids-bcb70.firebaseapp.com",
  projectId: "emporiokids-bcb70",
  storageBucket: "emporiokids-bcb70.appspot.com", // Use o nome correto do bucket
  messagingSenderId: "782267880563",
  appId: "1:782267880563:web:38490d1c58c293dde20606",
  measurementId: "G-DVN6TTMN2X"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);