import { createHash } from 'node:crypto';

// Compte admin : le seul qui garde la version de test (jeux, amis et chiffres d'exemple).
// Tout autre compte ouvre une application vierge, qui ne montre que ce qui est lu sur le PC.
// L'adresse n'est pas écrite ici : seule son empreinte (SHA-256) l'est.
const ADMIN_HASHES = ['04cac0a92c15a81a74c1393c490589e29a948135e5119fa3684fed7d89d8439f'];

export function isAdmin(email: string): boolean {
  const value = email.trim().toLowerCase();
  return value !== '' && ADMIN_HASHES.includes(createHash('sha256').update(value).digest('hex'));
}
