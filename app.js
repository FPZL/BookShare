// Firebase config
}


currentUser = user;
loginBtn.style.display = 'none';


const ref = db.collection('usuarios').doc(user.uid);
const snap = await ref.get();


if (!snap.exists) {
await ref.set({
nome: user.displayName,
email: user.email,
pontos: 10,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
}
});


// ---------- ADICIONAR LIVRO ----------
const form = document.getElementById('book-form');
form.addEventListener('submit', async e => {
e.preventDefault();


await db.collection('books').add({
title: title.value,
author: author.value,
category: category.value,
description: description.value,
status: 'available',
uid: currentUser.uid,
owner: currentUser.displayName,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});


await db.collection('usuarios').doc(currentUser.uid)
.update({ pontos: firebase.firestore.FieldValue.increment(5) });


form.reset();
});


// ---------- LISTAGEM ----------
db.collection('books').orderBy('createdAt','desc')
.onSnapshot(snapshot => {
books.innerHTML = '';
snapshot.forEach(doc => {
const b = doc.data();
const div = document.createElement('div');
div.className = 'book-card';


div.innerHTML = `
<h3>${b.title}</h3>
<strong>${b.author}</strong>
<p>${b.description || ''}</p>
<small>${b.owner}</small>
<button onclick="reservar('${doc.id}')">Reservar</button>
`;


books.appendChild(div);
});
});


// ---------- RESERVA + HISTÓRICO ----------
async function reservar(bookId) {
await db.collection('emprestimos').add({
bookId,
userId: currentUser.uid,
data: firebase.firestore.FieldValue.serverTimestamp()
});


await db.collection('usuarios').doc(currentUser.uid)
.update({ pontos: firebase.firestore.FieldValue.increment(-3) });


alert('Livro reservado!');
}


// ---------- BUSCA ----------
buscaLivro.onkeyup = () => {
const f = buscaLivro.value.toLowerCase();
document.querySelectorAll('.book-card').forEach(c => {
c.style.display = c.innerText.toLowerCase().includes(f) ? 'block' : 'none';
});
};
