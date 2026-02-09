// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCRakMbIAtwkg7xlaxuyNfdVUADwx5S-0s",
  authDomain: "test-194d9.firebaseapp.com",
  projectId: "test-194d9",
  storageBucket: "test-194d9.firebasestorage.app",
  messagingSenderId: "709373549581",
  appId: "1:709373549581:web:069f53bd9d09a21fbc8944"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================= PÁGINA ATUAL =================
const page = document.body.getAttribute("data-page");

// ================= LOGIN =================
const provider = new firebase.auth.GoogleAuthProvider();
let currentUser = null;

// ================= AUTH STATE =================
auth.onAuthStateChanged(async user => {
  currentUser = user;

  if (!user) {
    if (page !== "home") {
      window.location.href = "index.html";
    }
    return;
  }

  // Verifica email UNIOESTE
  if (!user.email.endsWith("@unioeste.br")) {
    alert("Use apenas email institucional da UNIOESTE");
    await auth.signOut();
    return;
  }

  // Cria perfil se não existir
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      name: user.displayName,
      email: user.email,
      points: 0,
      ratingSum: 0,
      ratingCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // Carrega conteúdo conforme página
  if (page === "home") carregarHome();
  if (page === "profile") carregarPerfil();
  if (page === "ranking") carregarRanking();
  if (page === "wishlist") carregarWishlist();
});

// ================= LOGIN BUTTON (HOME) =================
if (page === "home") {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.onclick = async () => {
      await auth.signInWithPopup(provider);
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await auth.signOut();
    };
  }
}

// ================= HOME =================
function carregarHome() {
  const bookForm = document.getElementById("book-form");
  const booksDiv = document.getElementById("books");
  const buscaInput = document.getElementById("buscaLivro");

  // Adicionar livro
  if (bookForm) {
    bookForm.addEventListener("submit", async e => {
      e.preventDefault();

      const title = document.getElementById("title").value.trim();
      const author = document.getElementById("author").value.trim();
      const category = document.getElementById("category").value.trim();
      const description = document.getElementById("description").value.trim();

      await db.collection("books").add({
        title,
        author,
        category,
        description,
        status: "available",
        ownerId: currentUser.uid,
        ownerName: currentUser.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      bookForm.reset();
    });
  }

  // Listar livros
  db.collection("books")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      booksDiv.innerHTML = "";

      snapshot.forEach(doc => {
        const b = doc.data();
        const div = document.createElement("div");
        div.className = "book-card";

        div.innerHTML = `
          <h3>${escapeHtml(b.title)}</h3>
          <strong>${escapeHtml(b.author)}</strong>
          <p>${escapeHtml(b.category || "")}</p>
          <p>Status: ${b.status}</p>
          <small>Dono: ${escapeHtml(b.ownerName)}</small>
        `;

        if (currentUser.uid === b.ownerId) {
          const btn = document.createElement("button");
          btn.textContent =
            b.status === "available" ? "Marcar emprestado" : "Marcar disponível";

          btn.onclick = async () => {
            const novo = b.status === "available" ? "borrowed" : "available";
            await doc.ref.update({ status: novo });

            if (novo === "borrowed") {
              await db.collection("users").doc(currentUser.uid).update({
                points: firebase.firestore.FieldValue.increment(10)
              });
            }
          };

          div.appendChild(btn);
        }

        booksDiv.appendChild(div);
      });
    });

  // Busca
  if (buscaInput) {
    buscaInput.addEventListener("keyup", () => {
      const f = buscaInput.value.toLowerCase();
      document.querySelectorAll(".book-card").forEach(c => {
        c.style.display = c.textContent.toLowerCase().includes(f)
          ? "block"
          : "none";
      });
    });
  }
}

// ================= PERFIL =================
async function carregarPerfil() {
  const userSnap = await db.collection("users").doc(currentUser.uid).get();
  const u = userSnap.data();

  document.getElementById("userName").textContent = u.name;
  document.getElementById("userEmail").textContent = u.email;
  document.getElementById("userPoints").textContent = u.points;

  const rating =
    u.ratingCount > 0 ? (u.ratingSum / u.ratingCount).toFixed(1) : "0";
  document.getElementById("userRating").textContent = rating;

  // Meus livros
  const myBooksDiv = document.getElementById("myBooks");
  db.collection("books")
    .where("ownerId", "==", currentUser.uid)
    .onSnapshot(snap => {
      myBooksDiv.innerHTML = "";
      snap.forEach(doc => {
        const b = doc.data();
        myBooksDiv.innerHTML += `<p>📘 ${b.title} (${b.status})</p>`;
      });
    });
}

// ================= RANKING =================
function carregarRanking() {
  const list = document.getElementById("rankingList");

  db.collection("users")
    .orderBy("points", "desc")
    .limit(10)
    .onSnapshot(snapshot => {
      list.innerHTML = "";
      let pos = 1;

      snapshot.forEach(doc => {
        const u = doc.data();
        const li = document.createElement("li");
        li.textContent = `${pos++}º ${u.name} — ${u.points} pts`;
        list.appendChild(li);
      });
    });
}

// ================= WISHLIST =================
function carregarWishlist() {
  const form = document.getElementById("wishlistForm");
  const list = document.getElementById("wishlistItems");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const title = document.getElementById("wishTitle").value.trim();

    await db.collection("wishlists").add({
      userId: currentUser.uid,
      title
    });

    form.reset();
  });

  db.collection("wishlists")
    .where("userId", "==", currentUser.uid)
    .onSnapshot(snapshot => {
      list.innerHTML = "";
      snapshot.forEach(doc => {
        list.innerHTML += `<p>❤️ ${doc.data().title}</p>`;
      });
    });
}

// ================= UTIL =================
function escapeHtml(str) {
  return str
    ? str.replace(/[&<>"']/g, s =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
          s
        ])
      )
    : "";
}
