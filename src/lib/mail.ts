import "server-only";

// Versand über Resend per HTTP, ohne zusätzliche Bibliothek.
// Fehler werden nur protokolliert, damit Abläufe nichts über Konten verraten.
export async function sendMail(opts: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error("E-Mail nicht gesendet: RESEND_API_KEY oder MAIL_FROM fehlt.");
    } else {
      console.log(`\n[Mail, nur Entwicklung]\nAn: ${opts.to}\nBetreff: ${opts.subject}\n\n${opts.text}\n`);
    }
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    });
    if (!res.ok) console.error("E-Mail-Versand fehlgeschlagen:", res.status);
  } catch (e) {
    console.error("E-Mail-Versand fehlgeschlagen:", e);
  }
}
