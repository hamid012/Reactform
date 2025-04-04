import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDrUO7T19wmJICerBdbCAjaWimsyY7n8b8",
    authDomain: "jagar-io.firebaseapp.com",
    projectId: "jagar-io",
    storageBucket: "jagar-io.appspot.com", // Corrected storage bucket URL
    messagingSenderId: "813249615673",
    appId: "1:813249615673:web:b4782ffb617810484abae8",
    measurementId: "G-B9C37PF59T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };