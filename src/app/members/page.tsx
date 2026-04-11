'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import type { Profile, Group, GroupMember } from '@/lib/database.types';
import {
  Loader2, Users, X, Pencil, Mail, Phone, UserCheck, Plus, Trash2, AlertCircle, Check,
} from 'lucide-react';
import { roleLabels } from '@/lib/utils';
import { getEffectiveUserId } from '@/lib/getEffectiveUser';

const roleOptions = ['admin', 'president', 'secretary', 'treasurer', 'member'];
const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  president: 'bg-purple-100 text-purple-800',
  secretary: 'bg-blue-100 text-blue-800',
  treasurer: 'bg-green-100 text-green-800',
  member: 'bg-gray-100 text-gray-700',
};

const statusColors: Record<boolean, string> = {
  true: 'bg-green-100 text-green-800',
  false: 'bg-gray-100 text-gray-700',
};

export default function MembersPage() {
  const supabase = createClient();
  const [currentTab, setCurrentTab] = useState<'members' | 'groups'>('members');
  const [members, setMembers] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Members tab states
  const [showEditForm, setShowEditForm] = useState(false);
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', role: 'member', title: '', phone: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Invite states
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);

  // Groups tab states
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ profile_id: '' });
  const [addingMember, setAddingMember] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'president';

  const fetchData = async () => {
    try {
      const [{ data: profilesData }, { data: { user } }, { data: groupsData }, { data: groupMembersData }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.auth.getUser(),
        supabase.from('groups').select('*').order('name'),
        supabase.from('group_members').select('*, profile:profiles(*)'),
      ]);

      setMembers(profilesData || []);
      setGroups(groupsData || []);
      setGroupMembers(groupMembersData || []);

      if (user) {
        const effectiveId = getEffectiveUserId(user.id);
        const { data: cu } = await supabase.from('profiles').select('*').eq('id', effectiveId).single();
        setCurrentUser(cu);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // MEMBERS TAB FUNCTIONS
  const openEditMember = (member: Profile) => {
    setEditMember(member);
    setEditForm({
      full_name: member.full_name,
      role: member.role,
      title: member.title || '',
      phone: member.phone || '',
      is_active: member.is_active,
    });
    setResetMessage('');
    setShowEditForm(true);
  };

  const canEditField = (fieldName: string) => {
    if (isAdmin) return true;
    if (editMember?.id !== currentUser?.id) return false;
    return ['full_name', 'title', 'phone'].includes(fieldName);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;

    const updateData: any = { full_name: editForm.full_name };

    if (isAdmin) {
      updateData.role = editForm.role as Profile['role'];
      updateData.is_active = editForm.is_active;
    }

    updateData.title = editForm.title || null;
    updateData.phone = editForm.phone || null;

    setSaving(true);
    try {
      await supabase.from('profiles').update(updateData).eq('id', editMember.id);
      setShowEditForm(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editMember) return;
    setResetLoading(true);
    setResetMessage('');
    try {
      const res = await fetch('/api/members/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editMember.email }),
      });
      if (res.ok) {
        setResetMessage('Password reset email sent successfully');
      } else {
        const err = await res.json();
        setResetMessage(`Error: ${err.error || 'Could not send reset email'}`);
      }
    } catch (error) {
      setResetMessage('Error: Could not send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
      });
      if (res.ok) {
        alert(`Invitation sent to ${inviteEmail}`);
        setShowInviteForm(false);
        setInviteEmail('');
        setInviteName('');
        await fetchData();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Could not send invite'));
      }
    } finally {
      setInviting(false);
    }
  };

  // GROUPS TAB FUNCTIONS
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;

    setCreatingGroup(true);
    try {
      const { data: newGroup } = await supabase
        .from('groups')
        .insert([{ name: groupForm.name, description: groupForm.description }])
        .select()
        .single();

      if (newGroup) {
        setGroups([...groups, newGroup]);
        setGroupForm({ name: '', description: '' });
        setShowCreateGroupForm(false);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !addMemberForm.profile_id) return;

    setAddingMember(true);
    try {
      await supabase.from('group_members').insert([
        { group_id: selectedGroup.id, profile_id: addMemberForm.profile_id },
      ]);
      setAddMemberForm({ profile_id: '' });
      setShowAddMemberForm(false);
      await fetchData();
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveGroupMember = async (groupMemberId: string) => {
    if (!confirm('Remove this member from the group?')) return;

    try {
      await supabase.from('group_members').delete().eq('id', groupMemberId);
      await fetchData();
    } catch (error) {
      alert('Error removing member');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? This action cannot be undone.')) return;

    setDeletingGroupId(groupId);
    try {
      await supabase.from('groups').delete().eq('id', groupId);
      setSelectedGroup(null);
      await fetchData();
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getGroupMemberCount = (groupId: string) => {
    return groupMembers.filter(gm => gm.group_id === groupId).length;
  };

  const getGroupMembersWithProfiles = (groupId: string) => {
    return groupMembers
      .filter(gm => gm.group_id === groupId)
      .map(gm => ({ ...gm, profile: gm.profile as any }));
  };

  const getAvailableMembersForGroup = () => {
    const groupMemberIds = new Set(groupMembers
      .filter(gm => gm.group_id === selectedGroup?.id)
      .map(gm => gm.profile_id));
    return members.filter(m => !groupMemberIds.has(m.id));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Board Members</h1>
          {currentTab === 'members' && isAdmin && (
            <button onClick={() => setShowInviteForm(true)} className="btn-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Invite Member
            </button>
          )}
          {currentTab === 'groups' && isAdmin && (
            <button onClick={() => setShowCreateGroupForm(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Group
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 mb-6 border-b border-gray-200">
          <button
            onClick={() => setCurrentTab('members')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              currentTab === 'members'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setCurrentTab('groups')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              currentTab === 'groups'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Groups
          </button>
        </div>

        {/* MEMBERS TAB */}
        {currentTab === 'members' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => openEditMember(member)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">{member.full_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{member.email}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${roleColors[member.role]} text-xs`}>
                        {roleLabels[member.role]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{member.title || '-'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${statusColors[member.is_active ? 'true' : 'false']} text-xs`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMember(member);
                          }}
                          className="text-primary hover:text-primary/80 font-medium text-sm"
                        >
                          Edit
                        </button>
                      )}
                      {!isAdmin && member.id === currentUser?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMember(member);
                          }}
                          className="text-primary hover:text-primary/80 font-medium text-sm"
                        >
                          Edit Profile
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GROUPS TAB */}
        {currentTab === 'groups' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Groups List */}
            <div className="lg:col-span-1">
              <h2 className="font-semibold text-lg mb-4">All Groups</h2>
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-4 rounded-lg border transition ${
                      selectedGroup?.id === group.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{group.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {getGroupMemberCount(group.id)} members
                    </div>
                  </button>
                ))}
                {groups.length === 0 && (
                  <p className="text-sm text-gray-500 py-4">No groups yet</p>
                )}
              </div>
            </div>

            {/* Group Details */}
            {selectedGroup && (
              <div className="lg:col-span-2">
                <div className="card">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">{selectedGroup.name}</h2>
                      {selectedGroup.description && (
                        <p className="text-gray-600 mt-2">{selectedGroup.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteGroup(selectedGroup.id)}
                        disabled={deletingGroupId === selectedGroup.id}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Members</h3>
                      {isAdmin && (
                        <button
                          onClick={() => setShowAddMemberForm(true)}
                          className="btn-primary flex items-center gap-1 text-sm"
                        >
                          <Plus className="w-3 h-3" /> Add Member
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {getGroupMembersWithProfiles(selectedGroup.id).map((gm) => (
                        <div
                          key={gm.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-gray-900">
                              {(gm.profile as any)?.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {(gm.profile as any)?.email}
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemoveGroupMember(gm.id)}
                              className="text-gray-400 hover:text-red-600 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {getGroupMembersWithProfiles(selectedGroup.id).length === 0 && (
                        <p className="text-sm text-gray-500 py-4">No members in this group</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedGroup && groups.length > 0 && (
              <div className="lg:col-span-2 flex items-center justify-center">
                <p className="text-gray-500">Select a group to view details</p>
              </div>
            )}
          </div>
        )}

        {/* EDIT MEMBER MODAL */}
        {showEditForm && editMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
                <h2 className="font-semibold text-lg">Edit Member</h2>
                <button
                  onClick={() => setShowEditForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMember} className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    className="input"
                    required
                    disabled={!canEditField('full_name')}
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="label">Role *</label>
                    <select
                      className="input"
                      value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {roleLabels[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Title / Position</label>
                  <input
                    className="input"
                    disabled={!canEditField('title')}
                    placeholder="e.g. Chair of Scholarships"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input"
                    disabled={!canEditField('phone')}
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="active"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="active" className="text-sm text-gray-700">
                      Active member
                    </label>
                  </div>
                )}

                {resetMessage && (
                  <div
                    className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                      resetMessage.startsWith('Error')
                        ? 'bg-red-50 text-red-800'
                        : 'bg-green-50 text-green-800'
                    }`}
                  >
                    {resetMessage.startsWith('Error') ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{resetMessage}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 flex-1">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      className="btn-secondary flex items-center gap-2"
                    >
                      {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Reset Password
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="w-full text-gray-600 hover:text-gray-900 py-2"
                >
                  Close
                </button>
              </form>
            </div>
          </div>
        )}

        {/* INVITE MEMBER MODAL */}
        {showInviteForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Invite Board Member</h2>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInviteMember} className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    className="input"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Email Address *</label>
                  <input
                    className="input"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <p className="text-sm text-gray-500">
                  They&apos;ll receive an email to set their password and access the board portal.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={inviting}
                    className="btn-primary flex items-center gap-2 flex-1"
                  >
                    {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE GROUP MODAL */}
        {showCreateGroupForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Create Group</h2>
                <button
                  onClick={() => setShowCreateGroupForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
                <div>
                  <label className="label">Group Name *</label>
                  <input
                    className="input"
                    required
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Scholarship Committee"
                  />
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional group description"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={creatingGroup}
                    className="btn-primary flex items-center gap-2 flex-1"
                  >
                    {creatingGroup && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD MEMBER TO GROUP MODAL */}
        {showAddMemberForm && selectedGroup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Add Member to {selectedGroup.name}</h2>
                <button
                  onClick={() => setShowAddMemberForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMemberToGroup} className="p-6 space-y-4">
                <div>
                  <label className="label">Select Member *</label>
                  <select
                    className="input"
                    required
                    value={addMemberForm.profile_id}
                    onChange={(e) => setAddMemberForm({ profile_id: e.target.value })}
                  >
                    <option value="">Choose a member...</option>
                    {getAvailableMembersForGroup().map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="btn-primary flex items-center gap-2 flex-1"
                  >
                    {addingMember && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddMemberForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
