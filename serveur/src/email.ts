// Envoi du code de connexion par e-mail, par le service Resend (https://resend.com).
// Sans clé (en développement), le code s'affiche dans la console du serveur.

export async function sendCode(email: string, code: string): Promise<boolean> {
  const key = process.env.EMAIL_API_KEY;
  if (!key) {
    console.log(`[développement] Code de connexion pour ${email} : ${code}`);
    return true;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_EXPEDITEUR ?? 'Warmup <connexion@example.com>',
        to: [email],
        subject: `${code} : votre code de connexion à Warmup`,
        text: `Bonjour,\n\nVotre code de connexion à Warmup est : ${code}\n\nIl est valable 15 minutes. Saisissez-le dans l'application.\nSi vous n'avez rien demandé, ignorez ce message : personne ne peut se connecter sans ce code.\n\nWarmup`
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
