//  1. IMPORT FIREBASE TOOLS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
//  2. PASTE YOUR FIREBASE KEYS BELOW
// ==========================================
// 👇👇👇 PASTE YOUR CONFIG HERE 👇👇👇
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { firebaseConfig } from './config.js';
// 👆👆👆 PASTE YOUR CONFIG HERE 👆👆👆

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null; // Stores the logged-in user

// ==========================================
//  3. LOGIN & LOGOUT LOGIC
// ==========================================

// Login Button
document.getElementById('login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Logged in as:", result.user.email);
        })
        .catch((error) => {
            alert("Login Failed: " + error.message);
        });
});

// Logout Button
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
    location.reload(); 
});

// Check if User is Logged In
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Show Dashboard, Hide Login
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('user-name').innerText = user.displayName;
        
        // Load History immediately
        loadHistory(); 
    } else {
        // Show Login, Hide Dashboard
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

// ==========================================
//  4. THE AI DOCTOR (Analyze & Save)
// ==========================================

document.getElementById('analyze-btn').addEventListener('click', async () => {
    const btn = document.getElementById('analyze-btn');
    const originalText = btn.innerHTML;
    
    // START LOADING SPINNER
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        // 1. Collect Data from HTML Forms
        // We call this 'healthData' (Fixed variable name)
        const healthData = {
            bp_sys: document.getElementById('bp_sys').value,
            bp_dia: document.getElementById('bp_dia').value,
            glucose: document.getElementById('glucose').value,
            heart: document.getElementById('heart').value,
            chronic: document.getElementById('chronic').value,
            symptoms: document.getElementById('symptoms').value,
            date: new Date().toLocaleDateString(),
            timestamp: new Date()
        };

        // 2. Get Old History to make Gemini Smarter
        const historyContext = await getHistorySummary();

        // 3. Send to Python Backend
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: `
                PATIENT HISTORY: ${historyContext}
                CURRENT VITALS: BP ${healthData.bp_sys}/${healthData.bp_dia}, Heart Rate ${healthData.heart}, Glucose ${healthData.glucose}.
                CHRONIC CONDITIONS: ${healthData.chronic}
                CURRENT SYMPTOMS: ${healthData.symptoms}
                
                TASK: act as a senior doctor. Analyze the risk. Be kind but direct. 
                If the history shows a worsening trend, mention it.
                Keep the response under 100 words.`
            })
        });

        const result = await response.json();
        
        // 4. Show Result on Screen
        document.getElementById('result-card').classList.remove('hidden');
        document.getElementById('ai-response').innerText = result.analysis;

        // 5. Save this new record to the "Vault" (Firebase)
        await addDoc(collection(db, "health_records"), {
            uid: currentUser.uid,
            ...healthData,  // Saving the 'healthData' object
            ai_analysis: result.analysis
        });

        // 6. Refresh the history list
        loadHistory();
        
    } catch (error) {
        console.error(error);
        alert("Error connecting to AI: " + error.message);
    } finally {
        // STOP LOADING SPINNER
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// ==========================================
//  5. THE VAULT (Load History)
// ==========================================

async function loadHistory() {
    if (!currentUser) return; // Safety Check

    const q = query(collection(db, "health_records"), where("uid", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    const list = document.getElementById('history-list');
    list.innerHTML = ""; 

    if(snapshot.empty) {
        list.innerHTML = "<p>No records found.</p>";
        return;
    }

    snapshot.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `
            <div class="history-item">
                <div class="history-date">📅 ${d.date}</div>
                <strong>${d.symptoms ? d.symptoms.substring(0, 30) + "..." : "Checkup"}</strong><br>
                <span style="font-size: 0.8rem">BP: ${d.bp_sys}/${d.bp_dia} | Glucose: ${d.glucose}</span>
            </div>
        `;
    });
}

// Helper: Summarize history for the AI
async function getHistorySummary() {
    if (!currentUser) return "No history.";

    const q = query(collection(db, "health_records"), where("uid", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    let summary = "";
    let count = 0;
    
    snapshot.forEach(doc => {
        if(count < 3) {
            const d = doc.data();
            summary += `[Date: ${d.date}, BP: ${d.bp_sys}/${d.bp_dia}, Sugar: ${d.glucose}, Symptoms: ${d.symptoms}] \n`;
            count++;
        }
    });
    return summary || "No previous history available.";
}