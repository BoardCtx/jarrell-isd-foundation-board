# Jarrell ISD Education Foundation — Board Management App

A full-featured board management application for the Jarrell ISD Education Foundation. Built with Next.js, Supabase, and Tailwind CSS.

## Features

- 🔐 **Secure Multi-User Auth** — Board members login with email/password
- 📁 **Projects** — Track foundation projects with budgets, leads, and status
- ✅ **Tasks** — Kanban board and list view with priorities and assignments
- 💰 **Budget & Finances** — Track donations, grants, and expenses
- 📅 **Meetings** — Schedule meetings, publish agendas, record minutes
- 📄 **Documents** — Upload and share files, organized by category
- 👥 **Board Members** — Directory with roles and contact info
- 🔔 **Invite Members** — Admins can invite new board members by email

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **File Storage**: Supabase Storage
- **Deployment**: Vercel

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and fill in the details
3. Once created, go to **Settings → API** and copy:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role secret key)

### 2. Set Up the Database

1. In your Supabase project, go to **SQL Editor**
2. Open and run the file: `supabase/schema.sql`
3. This creates all tables, relationships, and security policies

### 3. Set Up Storage

1. In Supabase, go to **Storage**
2. Click **New Bucket**, name it `documents`
3. Set it to **Private** (not public)
4. Set file size limit to 50MB

### 4. Create Your Admin Account

1. In Supabase, go to **Authentication → Users**
2. Click **Invite User** and enter your email
3. Check your email and set your password
4. Then go to **SQL Editor** and run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```

### 5. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** and import `jarrell-isd-foundation-board`
3. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**

### 6. Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/jarrell-isd-foundation-board

# Install dependencies
npm install

# Create .env.local from the example
cp .env.local.example .env.local
# Fill in your Supabase credentials

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, invite members, manage all data |
| **President** | Same as admin |
| **Secretary** | Manage meetings, publish agendas & minutes |
| **Treasurer** | Manage budget entries |
| **Member** | View all, create tasks, upload documents |

---

## Inviting Board Members

Once deployed, admins can invite new members from the **Board Members** page → **Invite Member** button. They'll receive an email to set their password.
