# Tilt UGC — Setup Guide

## 1. Supabase SQL Setup

Open Supabase → SQL Editor → paste and run everything in `supabase-setup.sql`.

After running the SQL, update your creators' auth emails:
```sql
UPDATE creators SET auth_email = 'kofi-actual-email@gmail.com' WHERE name = 'Kofi';
UPDATE creators SET auth_email = 'neya-actual-email@gmail.com' WHERE name = 'Neya';
UPDATE creators SET auth_email = 'yzzy-actual-email@gmail.com' WHERE name = 'Yzzy';
```

---

## 2. Google OAuth in Supabase

### Step 1: Create Google OAuth credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing one)
3. Go to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Name: `Tilt UGC`
7. Under **Authorized redirect URIs**, add:
   ```
   https://poluaucqywnvcdgeytdr.supabase.co/auth/v1/callback
   ```
8. Click **Create** — copy the **Client ID** and **Client Secret**

### Step 2: Configure Supabase Auth
1. Go to your Supabase dashboard → **Authentication → Providers**
2. Find **Google** and toggle it ON
3. Paste your **Client ID** and **Client Secret**
4. Click **Save**

### Step 3: Set redirect URL
1. In Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to: `https://tilt-ugc.vercel.app`
3. Add to **Redirect URLs**: `https://tilt-ugc.vercel.app`
4. Also add `http://localhost:5173` if you want local dev to work

---

## 3. Update App.jsx Config

Open `src/App.jsx` and fill in the constants at the top:

```js
const ADMIN_EMAIL = "your-google-email@gmail.com";  // Your Google login email
const ADMIN_NOTIFY_EMAIL = "your-google-email@gmail.com";  // Where idea notifications go
```

---

## 4. EmailJS Setup

### Step 1: Create account
1. Go to [emailjs.com](https://www.emailjs.com/) and sign up (free tier: 200 emails/month)

### Step 2: Add email service
1. Go to **Email Services → Add New Service**
2. Choose **Gmail** (or whichever provider you use)
3. Connect your email account
4. Copy the **Service ID** (e.g., `service_abc123`)

### Step 3: Create email template
1. Go to **Email Templates → Create New Template**
2. Set up the template:
   - **To email**: `{{to_email}}`
   - **Subject**: `New brief idea from {{creator_name}}`
   - **Body**:
     ```
     {{creator_name}} submitted a new brief idea:

     Title: {{idea_title}}

     Description:
     {{idea_description}}

     — Tilt UGC
     ```
3. Save and copy the **Template ID** (e.g., `template_xyz789`)

### Step 4: Get your public key
1. Go to **Account → General**
2. Copy your **Public Key** (e.g., `user_AbCdEfG123`)

### Step 5: Update App.jsx
Fill in the EmailJS constants at the top of `src/App.jsx`:

```js
const EMAILJS_SERVICE_ID = "service_abc123";     // Your service ID
const EMAILJS_TEMPLATE_ID = "template_xyz789";   // Your template ID
const EMAILJS_PUBLIC_KEY = "user_AbCdEfG123";    // Your public key
```

---

## 5. What's in index.html

The EmailJS CDN script is already added to `index.html`:
```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
```

The Inter font is also loaded via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

No additional changes needed to `index.html`.

---

## 6. Deploy

Push to GitHub → Vercel auto-deploys:
```bash
git add -A
git commit -m "Add auth, redesign, creator portal"
git push origin main
```

---

## Summary of what changed

| File | Change |
|------|--------|
| `src/App.jsx` | Full rewrite: auth, redesigned admin UI, creator portal, brief ideas |
| `index.html` | Added Inter font, EmailJS CDN, white background |
| `supabase-setup.sql` | New file: SQL to run in Supabase SQL Editor |
| `src/supabase.js` | No changes |
