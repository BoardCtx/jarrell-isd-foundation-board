'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { Loader2, Users, X, Pencil, Mail, Phone, UserCheck } from 'lucide-react';
import { roleLabels } from '@/lib/utils';

const roleOptions = ['admin', 'president', 'secretary', 'treasurer', 'member'];
const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  president: 'bg-purple-100 text-purple-800',
  secretary: 'bg-blue-100 text-blue-800',
  treasurer: 'bg-green-100 text-green-800',
  member: 'bg-gray-100 text-gray-700',
};

export default function MembersPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: '', role: 'member', title: '', phone: '', is_active: true });

  const fetchData = async () => {
    const [{ data: m }, { data: { user } }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.auth.getUser(),
    ]);
    setMembers(m || []);
    if (user) {
      const { data: cu } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser(cu);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (m: Profile) => {
    setEditMember(m);
    setForm({ full_name: m.full_name, role: m.role, title: m.title || '', phone: m.phone || '', is_active: m.is_active });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: form.full_name, role: form.role as Profile['role'],
      title: form.title || null, phone: form.phone || null, is_active: form.is_active,
    }).eq('id', editMember.id);
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    // Use Supabase admin invite (requires service role key in API route)
    const res = await fetch('/api/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
    });
    if (res.ok) {
      alert(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'Could not send invite'));
    }
    setInviting(false);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'president';

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Board Members</h1>
          {isAdmin && (
            <button onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Invite Member
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((m) => (
              <div key={m.id} className={`card ${!m.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {m.full_name.charAt(0)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${roleColors[m.role]}`}>{roleLabels[m.role]}</span>
                    {isAdmin && (
                      <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-primary">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900">{m.full_name}</h3>
                {m.title && <p className="text-sm text-gray-500 mt-0.5">{m.title}</p>}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />{m.email}
                  </div>
                  {m.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="w-3.5 h-3.5" />{m.phone}
                    </div>
                  )}
                </div>
                {!m.is_active && (
                  <p className="text-xs text-gray-400 mt-2 italic">Inactive</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {showForm && editMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Edit Member</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {roleOptions.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Title / Position</label>
                  <input className="input" placeholder="e.g. Chair of Scholarships" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                  <label htmlFor="active" className="text-sm text-gray-700">Active member</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Invite Board Member</h2>
                <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" required value={inviteName} onChange={e => setInviteName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Email Address *</label>
                  <input className="input" type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <p className="text-sm text-gray-500">They&apos;ll receive an email to set their password and access the board portal.</p>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={inviting} className="btn-primary flex items-center gap-2">
                    {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Invitation
                  </button>
                  <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
