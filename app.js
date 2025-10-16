const firebaseConfig = {
  apiKey: "AIzaSyCRakMbIAtwkg7xlaxuyNfdVUADwx5S-0s",
  authDomain: "test-194d9.firebaseapp.com",
  projectId: "test-194d9",
  storageBucket: "test-194d9.firebasestorage.app",
  messagingSenderId: "709373549581",
  appId: "1:709373549581:web:069f53bd9d09a21fbc8944"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


const bookForm = document.getElementById('book-form');
const booksDiv = document.getElementById('books');


bookForm.addEventListener('submit', async (e) => {
e.preventDefault();
const title = document.getElementById('title').value.trim();
const author = document.getElementById('author').value.trim();
const description = document.getElementById('description').value.trim();


await db.collection('books').add({
title,
author,
description,
status: 'available',
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});


bookForm.reset();
});


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
`;


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
if (confirm('Remover este livro?')) await db.collection('books').doc(id).delete();
};


actions.appendChild(toggleBtn);
actions.appendChild(delBtn);
div.appendChild(actions);


booksDiv.appendChild(div);
});
});


function escapeHtml(str){
if(!str) return '';
return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}