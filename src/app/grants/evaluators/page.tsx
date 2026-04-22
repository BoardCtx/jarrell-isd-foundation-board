'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import {
  Shield, UserPlus, Search, Check, X, Clock, Ban,
  Mail, Loader2, AlertCircle, ChevronLeft, Copy,
  CheckCircle2, XCircle, Users,
} from 'lucide-react';

interface Evaluator {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  approved_at: string | null;
  created_at: string;
  assignment_count?: number;
}

export default function EvaluatorsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hasAccess, setHasAccess] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'president';

    if (!isAdmin) {
      const { data: grantAdminGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Admin')
        .single();

      if (grantAdminGroup) {
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', grantAdminGroup.id)
          .eq('profile_id', user.id)
          .single();

        if (!membership) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
      }
    }

    setHasAccess(true);
    await loadEvaluators();
  };

  const loadEvaluators = async () => {
    const { data: evals } = await supabase
      .from('grant_evaluators')
      .select('*')
      .order('created_at', { ascending: false });

    if (evals) {
      // Count assignments per evaluator
      const enriched = await Promise.all(
        evals.map(async (e) => {
          const { count } = await supabase
            .from('grant_evaluator_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('evaluator_id', e.id);
          return { ...e, assignment_count: count || 0 };
        })
      );
      setEvaluators(enriched);
    }
    setLoading(false);
  };

  const handleAction = async (evaluatorId: string, action: 'approve' | 'reject' | 'suspend') => {
    setActionLoading(evaluatorId);
    try {
      const res = await fetch('/api/grants/approve-evaluator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, evaluatorId }),
      });

      if (res.ok) {
        await loadEvaluators();
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
    setActionLoading(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMessage('');

    try {
      const res = await fetch('/api/grants/invite-evaluator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
      });

      const data = await res.json();
      if (res.ok) {
        setInviteMessage(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        setInviteName('');
        setTimeout(() => { setShowInvite(false); setInviteMessage(''); }, 2000);
      } else {
        setInviteMessage(data.error || 'Failed to send invite');
      }
    } catch (err) {
      setInviteMessage('Failed to send invite');
    }
    setInviting(false);
  };

  const copyPortalLink = () => {
    const url = `${window.location.origin}/grants/evaluator/login`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = evaluators.filter(e => {
    const matchesSearch = !searchQuery ||
      e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.organization || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = evaluators.filter(e => e.status === 'pending').length;
  const approvedCount = evaluators.filter(e => e.status === 'approved').length;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-gray-100 text-gray-600',
    };
    return `badge ${styles[status] || 'bg-gray-100 text-gray-600'}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-64">
          <div className="text-gray-500">Loading evaluators...</div>
        </div>
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="page-header text-red-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You need Grant Admin access to manage evaluators.</p>
          <button onClick={() => router.push('/grants')} className="btn-primary mt-4">
            Back to Grants
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/grants')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="page-header">Manage Evaluators</h1>
        </div>
        <p className="text-gray-600 mb-6 ml-12">Manage internal and external grant evaluators</p>

        {/* Stats & Actions */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">{evaluators.length} total</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-700 font-medium">{pendingCount} pending approval</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">{approvedCount} approved</span>
            </div>
          </div>

          <div className="flex-1" />

          <button onClick={copyPortalLink} className="btn-secondary text-sm flex items-center gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Portal Link'}
          </button>
          <button onClick={() => setShowInvite(true)} className="btn-primary text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Invite Evaluator
          </button>
        </div>

        {/* Invite Modal */}
        {showInvite && (
          <div className="card mb-6 border-2 border-emerald-200 bg-emerald-50">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              Invite External Evaluator
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Email Address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input"
                  placeholder="evaluator@example.com"
                />
              </div>
              <div>
                <label className="label">Full Name (optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="input"
                  placeholder="Jane Doe"
                />
              </div>
            </div>
            {inviteMessage && (
              <p className={`text-sm mb-4 ${inviteMessage.includes('sent') ? 'text-green-700' : 'text-red-600'}`}>
                {inviteMessage}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={handleInvite} disabled={inviting || !inviteEmail} className="btn-primary text-sm flex items-center gap-2">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
              <button onClick={() => { setShowInvite(false); setInviteMessage(''); }} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              placeholder="Search evaluators..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Evaluators Table */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-700">Evaluator</th>
                <th className="text-left p-4 font-semibold text-gray-700">Organization</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Assignments</th>
                <th className="text-left p-4 font-semibold text-gray-700">Registered</th>
                <th className="text-right p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evaluator) => (
                <tr key={evaluator.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{evaluator.full_name}</p>
                    <p className="text-gray-500 text-xs">{evaluator.email}</p>
                  </td>
                  <td className="p-4 text-gray-600">{evaluator.organization || '\u2014'}</td>
                  <td className="p-4">
                    <span className={statusBadge(evaluator.status)}>{evaluator.status}</span>
                  </td>
                  <td className="p-4 text-gray-600">{evaluator.assignment_count}</td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(evaluator.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {actionLoading === evaluator.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          {evaluator.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAction(evaluator.id, 'approve')}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded transition"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleAction(evaluator.id, 'reject')}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded transition"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {evaluator.status === 'approved' && (
                            <button
                              onClick={() => handleAction(evaluator.id, 'suspend')}
                              className="p-1.5 hover:bg-gray-100 text-gray-500 rounded transition"
                              title="Suspend"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {(evaluator.status === 'rejected' || evaluator.status === 'suspended') && (
                            <button
                              onClick={() => handleAction(evaluator.id, 'approve')}
                              className="p-1.5 hover:bg-green-50 text-green-600 rounded transition"
                              title="Re-approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    {evaluators.length === 0 ? 'No evaluators yet. Invite one to get started.' : 'No evaluators match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
