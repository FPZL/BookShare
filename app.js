// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================= ELEMENTOS =================
const bookForm = document.getElementById("book-form");
const booksDiv = document.getElementById("books");
const buscaInput = document.getElementById("buscaLivro");

// ================= LOGIN =================
const loginBtn = document.createElement("button");
loginBtn.textContent = "Entrar com email UNIOESTE";

const logoutBtn = document.createElement("button");
logoutBtn.textContent = "Sair";
logoutBtn.style.display = "none";

bookForm.parentNode.insertBefore(loginBtn, bookForm);
bookForm.parentNode.insertBefore(logoutBtn, bookForm);

const provider = new firebase.auth.GoogleAuthProvider();
let currentUser = null;

// ---------- LOGIN RESTRITO ----------
loginBtn.onclick = async () => {
  const result = await auth.signInWithPopup(provider);
  if (!result.user.email.endsWith("@unioeste.br")) {
    alert("Apenas email institucional UNIOESTE");
    await auth.signOut();
  }
};

logoutBtn.onclick = () => auth.signOut();

// ================= AUTH STATE =================
auth.onAuthStateChanged(async user => {
  currentUser = user;

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    bookForm.style.display = "block";

    const ref = db.collection("users").doc(user.uid);
    if (!(await ref.get()).exists) {
      await ref.set({
        name: user.displayName,
        email: user.email,
        points: 0,
        rating: 0,
        reviews: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    bookForm.style.display = "none";
  }
});

// ================= ADICIONAR LIVRO =================
bookForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return;

  await db.collection("books").add({
    title: title.value,
    author: author.value,
    category: category.value,
    description: description.value,
    status: "available",
    ownerId: currentUser.uid,
    ownerName: currentUser.displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// ================= LISTAGEM + EMPRÉSTIMO =================
db.collection("books").orderBy("createdAt", "desc").onSnapshot(snapshot => {
  booksDiv.innerHTML = "";

  snapshot.forEach(doc => {
    const b = doc.data();
    const div = document.createElement("div");
    div.className = "book-card";

    div.innerHTML = `
      <h3>${b.title}</h3>
      <strong>${b.author}</strong>
      <p>${b.category || ""}</p>
      <p>Status: ${b.status}</p>
      <small>Dono: ${b.ownerName}</small>
    `;

    if (currentUser && currentUser.uid === b.ownerId) {
      const btn = document.createElement("button");
      btn.textContent = b.status === "available" ? "Emprestar" : "Devolver";

      btn.onclick = async () => {
        const novo = b.status === "available" ? "borrowed" : "available";
        await doc.ref.update({ status: novo });

        if (novo === "borrowed") {
          await db.collection("loans").add({
            bookId: doc.id,
            ownerId: b.ownerId,
            status: "active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await db.collection("users").doc(b.ownerId).update({
            points: firebase.firestore.FieldValue.increment(10)
          });
        }
      };

      div.appendChild(btn);
    }

    booksDiv.appendChild(div);
  });
});

// ================= AVALIAÇÃO =================
async function avaliar(ownerId, stars, comment) {
  await db.collection("reviews").add({
    ownerId,
    reviewerId: currentUser.uid,
    stars,
    comment,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("users").doc(ownerId).update({
    rating: firebase.firestore.FieldValue.increment(stars),
    reviews: firebase.firestore.FieldValue.increment(1)
  });
}

// ================= WISHLIST =================
async function addWishlist(title) {
  await db.collection("wishlists").add({
    userId: currentUser.uid,
    title
  });
}

// ================= DENÚNCIA =================
async function denunciar(userId, motivo) {
  await db.collection("reports").add({
    userId,
    motivo,
    reporter: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ================= RANKING =================
db.collection("users")
  .orderBy("points", "desc")
  .limit(10)
  .onSnapshot(snap => {
    console.log("Ranking atualizado");
  });

// ================= BUSCA =================
buscaInput.addEventListener("keyup", () => {
  const f = buscaInput.value.toLowerCase();
  document.querySelectorAll(".book-card").forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(f) ? "block" : "none";
  });
});
