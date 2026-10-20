const nodemailer = require('nodemailer');

// One place for sending email.
//   BREVO_API_KEY set  -> Brevo's HTTPS API (works on hosts that block SMTP, like Render's free plan)
//   MAIL_USER/MAIL_PASS -> Gmail SMTP with an app password (handy for local development)
// MAIL_FROM is the sender address (must be a verified sender in Brevo); MAIL_FROM_NAME its name.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 15000;
const MAX_BCC_PER_MESSAGE = 90; // Brevo allows up to 99 recipients per message

const provider = () => {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.MAIL_USER && process.env.MAIL_PASS) return 'smtp';
  return null;
};
const mailConfigured = () => Boolean(provider());
const sender = () => ({
  email: process.env.MAIL_FROM || process.env.MAIL_USER,
  name: process.env.MAIL_FROM_NAME || 'Vihari',
});

let smtp = null;
const smtpTransport = () => {
  if (!smtp) {
    smtp = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      // Fail fast instead of hanging for minutes when the host blocks SMTP.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: TIMEOUT_MS,
    });
  }
  return smtp;
};

// Reserved test domains (RFC 2606) never receive mail; skipping them avoids bounce emails when
// demo accounts like user@example.com make bookings.
const RESERVED = /@(?:[^@]*\.)?(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;
const deliverable = (email) => !RESERVED.test(String(email).trim());

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

const sendViaBrevo = async ({ to, bcc, subject, text, html, attachments }) => {
  const from = sender();
  const body = {
    sender: from,
    // Brevo needs at least one "to"; bulk mails go to the sender with everyone else in BCC.
    to: list(to).length ? list(to).map((email) => ({ email })) : [{ email: from.email, name: from.name }],
    subject,
    textContent: text,
    ...(html ? { htmlContent: html } : {}),
    ...(list(bcc).length ? { bcc: list(bcc).map((email) => ({ email })) } : {}),
    ...(attachments?.length ? { attachment: attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content).toString('base64') })) } : {}),
  };
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${res.status}: ${detail.message || detail.code || 'request failed'}`);
  }
};

const sendViaSmtp = ({ to, bcc, subject, text, html, attachments }) => {
  const from = sender();
  return smtpTransport().sendMail({
    from: `"${from.name}" <${from.email}>`,
    to: list(to).length ? list(to).join(',') : from.email,
    ...(list(bcc).length ? { bcc: list(bcc) } : {}),
    subject,
    text,
    ...(html ? { html } : {}),
    ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) } : {}),
  });
};

// Sends one email. Returns true when sent, false when email isn't configured or sending failed
// (the reason is logged). Pass { throwOnError: true } to get the error instead.
// message: { to, bcc?, subject, text, html?, attachments?: [{ filename, content: Buffer }] }
const sendMail = async (message, { throwOnError = false } = {}) => {
  const via = provider();
  if (!via) {
    if (throwOnError) throw new Error('Email is not configured');
    return false;
  }
  const to = list(message.to).filter(deliverable);
  const recipients = list(message.bcc).filter(deliverable);
  if (list(message.to).length && !to.length && !recipients.length) {
    console.log(`Email to ${list(message.to).join(', ')} skipped (test address): ${message.subject}`);
    return false;
  }
  message = { ...message, to, bcc: recipients }; // eslint-disable-line no-param-reassign
  try {
    if (recipients.length > MAX_BCC_PER_MESSAGE) {
      for (let i = 0; i < recipients.length; i += MAX_BCC_PER_MESSAGE) {
        const chunk = { ...message, bcc: recipients.slice(i, i + MAX_BCC_PER_MESSAGE) };
        await (via === 'brevo' ? sendViaBrevo(chunk) : sendViaSmtp(chunk));
      }
    } else {
      await (via === 'brevo' ? sendViaBrevo(message) : sendViaSmtp(message));
    }
    return true;
  } catch (error) {
    console.log(`Email to ${list(message.to).join(', ') || `${recipients.length} recipients`} failed (${via}):`, error.message);
    if (throwOnError) throw error;
    return false;
  }
};

module.exports = { sendMail, mailConfigured };
