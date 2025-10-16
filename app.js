// --- Firebase ---
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

// --- Elementos ---
const bookForm = document.getElementById('book-form');
const booksDiv = document.getElementById('books');

// --- Login/Logout ---
const loginBtn = document.createElement('button');
loginBtn.textContent = 'Entrar com Google';
const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'Sair';
logoutBtn.style.display = 'none';

bookForm.parentNode.insertBefore(loginBtn, bookForm);
bookForm.parentNode.insertBefore(logoutBtn, bookForm);

const provider = new firebase.auth.GoogleAuthProvider();

loginBtn.onclick = () => auth.signInWithPopup(provider);
logoutBtn.onclick = () => auth.signOut();

let currentUser = null;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if(user){
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    bookForm.style.display = 'block';
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    bookForm.style.display = 'none';
  }
});

// --- Adicionar livro ---
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!currentUser) return alert('Faça login para adicionar livros');

  const title = document.getElementById('title').value.trim();
  const author = document.getElementById('author').value.trim();
  const description = document.getElementById('description').value.trim();

  await db.collection('books').add({
    title,
    author,
    description,
    status: 'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// --- Listar livros ---
db.collection('books').orderBy('createdAt','desc').onSnapshot(snapshot => {
  booksDiv.innerHTML = '';
  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    const div = document.createElement('div');
    div.className = 'book-card';

    div.innerHTML = `
      <h3>${escapeHtml(data.title)}</h3>
      <div><strong>${escapeHtml(data.author)}</strong></div>
      <p>${escapeHtml(data.description||'')}</p>
      <p>Status: ${data.status}</p>
      <small>Adicionado por: ${escapeHtml(data.userName||'Usuário')}</small>
    `;

    // Só o dono pode editar/remover
    if(currentUser && currentUser.uid === data.uid){
      const actions = document.createElement('div');
      actions.className = 'book-actions';

      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = data.status === 'available' ? 'Marcar como emprestado' : 'Marcar como devolvido';
      toggleBtn.onclick = async () => {
        const newStatus = data.status === 'available' ? 'borrowed' : 'available';
        await db.collection('books').doc(id).update({ status: newStatus });
      };

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Remover';
      delBtn.onclick = async () => {
        if(confirm('Remover este livro?')) await db.collection('books').doc(id).delete();
      };

      actions.appendChild(toggleBtn);
      actions.appendChild(delBtn);
      div.appendChild(actions);
    }

    booksDiv.appendChild(div);
  });
});

function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
