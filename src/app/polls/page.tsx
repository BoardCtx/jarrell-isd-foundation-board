'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type {
  Poll,
  PollOption,
  PollRecipient,
  PollVote,
  Profile,
  Group,
  GroupMember,
} from '@/lib/database.types';
import {
  Plus,
  Loader2,
  X,
  ArrowLeft,
  Bell,
  Lock,
  Mail,
  Trash2,
  ChevronDown,
  CheckCircle,
  Circle,
  Send,
} from 'lucide-react';

type PollWithCreator = Poll & { creator?: Profile | null };
type OptionWithVotes = PollOption & { votes?: PollVote[] };
type RecipientWithProfile = PollRecipient & { profile?: Profile | null };

interface PollDetail extends PollWithCreator {
  options?: OptionWithVotes[];
  recipients?: RecipientWithProfile[];
  votes?: (PollVote & { voter?: Profile | null })[];
}

interface VotesByOption {
  [optionId: string]: {
    count: number;
    voters: string[];
    percentage: number;
  };
}

export default function PollsPage() {
  const supabase = createClient();
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [polls, setPolls] = useState<PollWithCreator[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<PollDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    allowMultiple: false,
    options: ['', ''],
    selectedGroupIds: [] as string[],
    selectedProfileIds: [] as string[],
  });

  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Voting state
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // Dropdowns
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(data);
    }
  };

  const fetchPolls = async () => {
    const { data } = await supabase
      .from('polls')
      .select('*, creator:profiles!created_by(full_name, email)')
      .order('created_at', { ascending: false });
    setPolls((data as PollWithCreator[]) || []);
  };

  const fetchPollDetail = async (pollId: string) => {
    const [
      { data: pollData },
      { data: optionsData },
      { data: recipientsData },
      { data: votesData },
    ] = await Promise.all([
      supabase
        .from('polls')
        .select('*, creator:profiles!created_by(full_name, email)')
        .eq('id', pollId)
        .single(),
      supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollId)
        .order('sort_order'),
      supabase
        .from('poll_recipients')
        .select('*, profile:profiles(*)')
        .eq('poll_id', pollId),
      supabase
        .from('poll_votes')
        .select('*, voter:profiles(full_name)')
        .eq('poll_id', pollId),
    ]);

    const merged: PollDetail = {
      ...(pollData as PollWithCreator),
      options: (optionsData as OptionWithVotes[]) || [],
      recipients: (recipientsData as RecipientWithProfile[]) || [],
      votes: (votesData as (PollVote & { voter?: Profile | null })[]) || [],
    };

    setSelectedPoll(merged);
  };

  const fetchCreateData = async () => {
    const [{ data: groupsData }, { data: profilesData }, { data: membersData }] =
      await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true)
          .order('full_name'),
        supabase.from('group_members').select('*, profile:profiles(*)'),
      ]);

    setGroups(groupsData || []);
    setProfiles(profilesData || []);
    setGroupMembers(membersData || []);
  };

  useEffect(() => {
    const init = async () => {
      await fetchCurrentUser();
      await fetchPolls();
      await fetchCreateData();
      setLoading(false);
    };
    init();
  }, []);

  const getRecipientsFromGroups = (): string[] => {
    const groupMembers_ = groupMembers.filter((m) =>
      createForm.selectedGroupIds.includes(m.group_id)
    );
    return groupMembers_.map((m) => m.profile_id);
  };

  const getAllRecipients = (): string[] => {
    const fromGroups = getRecipientsFromGroups();
    const all = [...new Set([...fromGroups, ...createForm.selectedProfileIds])];
    return all;
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || createForm.options.filter((o) => o.trim()).length < 2) {
      alert('Poll requires a title and at least 2 options');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const recipients = getAllRecipients();
    if (recipients.length === 0) {
      alert('Please add at least one recipient');
      setSaving(false);
      return;
    }

    // Create poll
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .insert({
        title: createForm.title,
        description: createForm.description || null,
        allow_multiple: createForm.allowMultiple,
        status: 'active',
        created_by: user?.id || '',
      })
      .select()
      .single();

    if (pollError || !pollData) {
      alert('Error creating poll');
      setSaving(false);
      return;
    }

    // Create options
    const validOptions = createForm.options.filter((o) => o.trim());
    const optionsData = validOptions.map((label, i) => ({
      poll_id: pollData.id,
      label,
      sort_order: i,
    }));

    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert(optionsData);

    if (optionsError) {
      alert('Error creating poll options');
      setSaving(false);
      return;
    }

    // Create recipients
    const recipientsData = recipients.map((profileId) => ({
      poll_id: pollData.id,
      profile_id: profileId,
    }));

    const { error: recipientsError } = await supabase
      .from('poll_recipients')
      .insert(recipientsData);

    if (recipientsError) {
      alert('Error adding recipients');
      setSaving(false);
      return;
    }

    // Send notifications
    try {
      const response = await fetch('/api/polls/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId: pollData.id,
          recipientIds: recipients,
        }),
      });

      if (!response.ok) {
        console.error('Error sending notifications');
      }
    } catch (err) {
      console.error('Notification error:', err);
    }

    setSaving(false);
    setView('list');
    resetCreateForm();
    await fetchPolls();
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      description: '',
      allowMultiple: false,
      options: ['', ''],
      selectedGroupIds: [],
      selectedProfileIds: [],
    });
  };

  const handleAddOption = () => {
    setCreateForm((f) => ({ ...f, options: [...f.options, ''] }));
  };

  const handleRemoveOption = (index: number) => {
    const validOptions = createForm.options.filter((o) => o.trim());
    if (validOptions.length > 2) {
      setCreateForm((f) => ({
        ...f,
        options: f.options.filter((_, i) => i !== index),
      }));
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setCreateForm((f) => ({
      ...f,
      selectedGroupIds: f.selectedGroupIds.includes(groupId)
        ? f.selectedGroupIds.filter((id) => id !== groupId)
        : [...f.selectedGroupIds, groupId],
    }));
  };

  const handleToggleProfile = (profileId: string) => {
    setCreateForm((f) => ({
      ...f,
      selectedProfileIds: f.selectedProfileIds.includes(profileId)
        ? f.selectedProfileIds.filter((id) => id !== profileId)
        : [...f.selectedProfileIds, profileId],
    }));
  };

  const handleRemoveRecipient = (recipientId: string) => {
    const groupIds = createForm.selectedGroupIds.filter((gid) => {
      const members = groupMembers.filter((m) => m.group_id === gid);
      return !members.some((m) => m.profile_id === recipientId);
    });

    const profileIds = createForm.selectedProfileIds.filter((id) => id !== recipientId);

    setCreateForm((f) => ({
      ...f,
      selectedGroupIds: groupIds,
      selectedProfileIds: profileIds,
    }));
  };

  const handleSubmitVote = async () => {
    if (!selectedPoll || !currentUser || selectedOptions.length === 0) return;

    setSaving(true);

    // Delete existing votes for this user
    await supabase
      .from('poll_votes')
      .delete()
      .eq('poll_id', selectedPoll.id)
      .eq('voter_id', currentUser.id);

    // Insert new votes
    const votes = selectedOptions.map((optionId) => ({
      poll_id: selectedPoll.id,
      option_id: optionId,
      voter_id: currentUser.id,
    }));

    const { error } = await supabase.from('poll_votes').insert(votes);

    if (!error) {
      setSelectedOptions([]);
      setVotingPollId(null);
      await fetchPollDetail(selectedPoll.id);
    }

    setSaving(false);
  };

  const handleClosePoll = async () => {
    if (!selectedPoll || !confirm('Close this poll? Recipients will no longer be able to vote.')) return;

    setSaving(true);
    await supabase
      .from('polls')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', selectedPoll.id);

    setSaving(false);
    await fetchPollDetail(selectedPoll.id);
  };

  const handleSendReminder = async () => {
    if (!selectedPoll) return;

    setSaving(true);

    try {
      const response = await fetch('/api/polls/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: selectedPoll.id }),
      });

      if (response.ok) {
        alert('Reminder sent to non-voters');
      } else {
        alert('Error sending reminder');
      }
    } catch (err) {
      console.error('Reminder error:', err);
      alert('Error sending reminder');
    }

    setSaving(false);
  };

  const calculateVoteStats = (): VotesByOption => {
    if (!selectedPoll?.options || !selectedPoll?.votes) return {};

    const stats: VotesByOption = {};

    selectedPoll.options.forEach((option) => {
      const votes = selectedPoll.votes?.filter((v) => v.option_id === option.id) || [];
      stats[option.id] = {
        count: votes.length,
        voters: votes.map((v) => v.voter?.full_name || 'Unknown').filter(Boolean),
        percentage:
          selectedPoll.recipients && selectedPoll.recipients.length > 0
            ? Math.round((votes.length / selectedPoll.recipients.length) * 100)
            : 0,
      };
    });

    return stats;
  };

  const getTotalResponses = (): { responded: number; total: number } => {
    if (!selectedPoll?.recipients) return { responded: 0, total: 0 };

    const respondedIds = new Set(
      selectedPoll.votes?.map((v) => v.voter_id) || []
    );

    return {
      responded: respondedIds.size,
      total: selectedPoll.recipients.length,
    };
  };

  const userHasVoted = (): boolean => {
    if (!selectedPoll?.votes || !currentUser) return false;
    return selectedPoll.votes.some((v) => v.voter_id === currentUser.id);
  };

  const getUserVotes = (): string[] => {
    if (!selectedPoll?.votes || !currentUser) return [];
    return selectedPoll.votes
      .filter((v) => v.voter_id === currentUser.id)
      .map((v) => v.option_id);
  };

  const isCreator = selectedPoll?.created_by === currentUser?.id;
  const isRecipient =
    selectedPoll?.recipients?.some((r) => r.profile_id === currentUser?.id) || false;
  const isPollActive = selectedPoll?.status === 'active';
  const hasVoted = userHasVoted();
  const voteStats = calculateVoteStats();
  const responses = getTotalResponses();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // DETAIL VIEW
  if (view === 'detail' && selectedPoll) {
    return (
      <AppLayout>
        <div className="p-8">
          <button
            onClick={() => {
              setView('list');
              setSelectedPoll(null);
              setSelectedOptions([]);
              setVotingPollId(null);
            }}
            className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Polls
          </button>

          <div className="space-y-6">
            {/* Header */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="page-header">{selectedPoll.title}</h1>
                  {selectedPoll.description && (
                    <p className="text-gray-600 mt-2">{selectedPoll.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span
                    className={`badge ${
                      selectedPoll.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {selectedPoll.status === 'active' ? 'Active' : 'Closed'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Created By
                  </p>
                  <p className="font-medium text-gray-900">
                    {selectedPoll.creator?.full_name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Created
                  </p>
                  <p className="font-medium text-gray-900">
                    {formatDate(selectedPoll.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Responses
                  </p>
                  <p className="font-medium text-gray-900">
                    {responses.responded} of {responses.total}
                  </p>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-4">Results</h2>

              {selectedPoll.options && selectedPoll.options.length > 0 ? (
                <div className="space-y-4">
                  {selectedPoll.options.map((option) => {
                    const stats = voteStats[option.id];
                    return (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{option.label}</span>
                          <span className="text-sm text-gray-600">
                            {stats?.count || 0} ({stats?.percentage || 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all"
                            style={{ width: `${stats?.percentage || 0}%` }}
                          />
                        </div>

                        {stats?.voters && stats.voters.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {stats.voters.map((voter, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded"
                              >
                                {voter}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">No options available</p>
              )}
            </div>

            {/* Voting Interface */}
            {isPollActive && isRecipient && !hasVoted && votingPollId === selectedPoll.id && (
              <div className="card p-6 border-2 border-primary">
                <h2 className="font-semibold text-lg mb-4">Cast Your Vote</h2>

                <div className="space-y-3 mb-6">
                  {selectedPoll.options?.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {selectedPoll.allow_multiple ? (
                        <>
                          <input
                            type="checkbox"
                            checked={selectedOptions.includes(option.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOptions([...selectedOptions, option.id]);
                              } else {
                                setSelectedOptions(
                                  selectedOptions.filter((id) => id !== option.id)
                                );
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-primary accent-primary"
                          />
                          <span className="text-gray-900">{option.label}</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="radio"
                            name={`poll-${selectedPoll.id}`}
                            checked={selectedOptions.includes(option.id)}
                            onChange={() => setSelectedOptions([option.id])}
                            className="w-4 h-4 border-gray-300 text-primary accent-primary"
                          />
                          <span className="text-gray-900">{option.label}</span>
                        </>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitVote}
                    disabled={selectedOptions.length === 0 || saving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Send className="w-4 h-4" />
                    Submit Vote
                  </button>
                  <button
                    onClick={() => {
                      setVotingPollId(null);
                      setSelectedOptions([]);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {hasVoted && !votingPollId && (
              <div className="card p-6 bg-green-50 border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">You voted for:</p>
                    <p className="text-green-700 text-sm mt-1">
                      {getUserVotes()
                        .map(
                          (id) =>
                            selectedPoll.options?.find((o) => o.id === id)?.label
                        )
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
                {isPollActive && (
                  <button
                    onClick={() => setVotingPollId(selectedPoll.id)}
                    className="text-sm text-green-600 hover:text-green-700 mt-3 underline"
                  >
                    Change vote
                  </button>
                )}
              </div>
            )}

            {isPollActive && isRecipient && !hasVoted && votingPollId !== selectedPoll.id && (
              <div className="card p-6 bg-blue-50 border border-blue-100">
                <button
                  onClick={() => setVotingPollId(selectedPoll.id)}
                  className="btn-primary flex items-center gap-2 w-full justify-center"
                >
                  <CheckCircle className="w-4 h-4" />
                  Vote Now
                </button>
              </div>
            )}

            {!isPollActive && (
              <div className="card p-6 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Lock className="w-5 h-5" />
                  <p>This poll is closed and no longer accepting votes.</p>
                </div>
              </div>
            )}

            {/* Recipients Section */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-4">Recipients</h2>

              {selectedPoll.recipients && selectedPoll.recipients.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedPoll.recipients.map((recipient) => {
                    const hasVotedRecipient = selectedPoll.votes?.some(
                      (v) => v.voter_id === recipient.profile_id
                    );
                    return (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">
                          {recipient.profile?.full_name || 'Unknown'}
                        </p>
                        {hasVotedRecipient ? (
                          <div className="flex items-center gap-2 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Voted
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Circle className="w-4 h-4" />
                            Not Voted
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">No recipients</p>
              )}
            </div>

            {/* Creator Actions */}
            {isCreator && (
              <div className="card p-6 border border-primary/20 bg-primary/5">
                <h2 className="font-semibold text-lg mb-4">Creator Actions</h2>

                <div className="space-y-3">
                  {isPollActive && (
                    <button
                      onClick={handleSendReminder}
                      disabled={saving}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <Mail className="w-4 h-4" />
                      Send Reminder to Non-Voters
                    </button>
                  )}

                  {isPollActive && (
                    <button
                      onClick={handleClosePoll}
                      disabled={saving}
                      className="w-full btn-secondary flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <Lock className="w-4 h-4" />
                      Close Poll
                    </button>
                  )}

                  {!isPollActive && (
                    <p className="text-sm text-gray-600">
                      This poll is closed and cannot be modified.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // CREATE VIEW
  if (view === 'create') {
    const recipients = getAllRecipients();
    const recipientProfiles = profiles.filter((p) => recipients.includes(p.id));

    return (
      <AppLayout>
        <div className="p-8">
          <button
            onClick={() => {
              setView('list');
              resetCreateForm();
            }}
            className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Polls
          </button>

          <div className="card p-6 max-w-3xl">
            <h1 className="page-header mb-6">Create New Poll</h1>

            <form onSubmit={handleCreatePoll} className="space-y-6">
              {/* Title */}
              <div>
                <label className="label">
                  Poll Title <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g., Should we host a summer fundraiser?"
                  required
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none min-h-[80px]"
                  placeholder="Optional details about the poll..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              {/* Multiple Selection Toggle */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.allowMultiple}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        allowMultiple: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-primary accent-primary"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Allow Multiple Selections</p>
                    <p className="text-sm text-gray-600">
                      Recipients can select more than one option
                    </p>
                  </div>
                </label>
              </div>

              {/* Options */}
              <div>
                <label className="label">
                  Poll Options <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Minimum 2 options required
                </p>

                <div className="space-y-2">
                  {createForm.options.map((option, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder={`Option ${i + 1}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...createForm.options];
                          newOptions[i] = e.target.value;
                          setCreateForm((f) => ({ ...f, options: newOptions }));
                        }}
                      />
                      {createForm.options.filter((o) => o.trim()).length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-3 text-primary hover:text-primary/80 flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>
              </div>

              {/* Recipients Section */}
              <div className="border-t pt-6">
                <h2 className="font-semibold text-lg mb-4">Recipients</h2>

                {/* Add Group */}
                <div className="mb-6">
                  <label className="label">Add Group</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(openDropdown === 'group' ? null : 'group')
                      }
                      className="input w-full flex items-center justify-between bg-white cursor-pointer"
                    >
                      <span className="text-gray-600">
                        {createForm.selectedGroupIds.length > 0
                          ? `${createForm.selectedGroupIds.length} group${
                              createForm.selectedGroupIds.length !== 1 ? 's' : ''
                            } selected`
                          : 'Select groups...'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          openDropdown === 'group' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openDropdown === 'group' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <div className="max-h-48 overflow-y-auto">
                          {groups.map((group) => (
                            <label
                              key={group.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={createForm.selectedGroupIds.includes(
                                  group.id
                                )}
                                onChange={() => handleToggleGroup(group.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary accent-primary"
                              />
                              <span className="text-gray-900">{group.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Individual */}
                <div className="mb-6">
                  <label className="label">Add Individual</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(openDropdown === 'profile' ? null : 'profile')
                      }
                      className="input w-full flex items-center justify-between bg-white cursor-pointer"
                    >
                      <span className="text-gray-600">
                        {createForm.selectedProfileIds.length > 0
                          ? `${createForm.selectedProfileIds.length} person${
                              createForm.selectedProfileIds.length !== 1 ? 's' : ''
                            } selected`
                          : 'Select individuals...'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          openDropdown === 'profile' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openDropdown === 'profile' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <div className="max-h-48 overflow-y-auto">
                          {profiles.map((profile) => (
                            <label
                              key={profile.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={createForm.selectedProfileIds.includes(
                                  profile.id
                                )}
                                onChange={() => handleToggleProfile(profile.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary accent-primary"
                              />
                              <span className="text-gray-900">
                                {profile.full_name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Recipients */}
                {recipientProfiles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Selected Recipients ({recipientProfiles.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recipientProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3 py-1"
                        >
                          <span className="text-sm text-gray-900">
                            {profile.full_name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(profile.id)}
                            className="text-gray-400 hover:text-primary transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 flex-1 justify-center"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Bell className="w-4 h-4" />
                  Create Poll & Send Notifications
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('list');
                    resetCreateForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppLayout>
    );
  }

  // LIST VIEW (default)
  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Polls</h1>
          <button
            onClick={() => {
              setView('create');
              resetCreateForm();
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Poll
          </button>
        </div>

        {polls.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No polls yet</h3>
            <p className="text-gray-600 mb-4">
              Create a poll to gather feedback from board members
            </p>
            <button
              onClick={() => {
                setView('create');
                resetCreateForm();
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Poll
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {polls.map((poll) => {
              const pollResponses = poll.id
                ? (() => {
                    const votedIds = new Set<string>();
                    return { voted: votedIds.size, total: 0 };
                  })()
                : { voted: 0, total: 0 };

              return (
                <button
                  key={poll.id}
                  onClick={() => {
                    setView('detail');
                    fetchPollDetail(poll.id);
                  }}
                  className="card p-6 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">
                      {poll.title}
                    </h3>
                    <span
                      className={`badge whitespace-nowrap flex-shrink-0 ${
                        poll.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {poll.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  {poll.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {poll.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">By:</span>{' '}
                      {poll.creator?.full_name || 'Unknown'}
                    </p>
                    <p>
                      <span className="font-medium">Created:</span>{' '}
                      {formatDate(poll.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
