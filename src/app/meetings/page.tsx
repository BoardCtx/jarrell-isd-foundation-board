'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, statusColors } from '@/lib/utils';
import type { Meeting, Profile } from '@/lib/database.types';
import { Plus, Loader2, CalendarDays, X, Pencil, Trash2, FileText, Globe, Filter, ChevronRight, Search, Ban, RotateCcw } from 'lucide-react';
import Avatar from '@/components/Avatar';
import RichTextEditor from '@/components/RichTextEditor';

const typeOptions = ['regular', 'special', 'annual', 'committee'];

export default function MeetingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [meetings, setMeetings] = useState<(Meeting & { minutes_taker?: Profile | null })[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMinutes, setShowMinutes] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [minutesText, setMinutesText] = useState('');
  const [form, setForm] = useState({
    title: '',
    type: 'regular',
    date: '',
    time: '',
    location: '',
    virtual_link: '',
    status: 'scheduled',
    time_zone: 'America/Chicago',
    minutes_taker_id: '',
  });

  const commonTimeZones = [
    { value: 'America/New_York', label: 'Eastern (ET)' },
    { value: 'America/Chicago', label: 'Central (CT)' },
    { value: 'America/Denver', label: 'Mountain (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
    { value: 'America/Anchorage', label: 'Alaska (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
    { value: 'America/Phoenix', label: 'Arizona' },
    { value: 'UTC', label: 'UTC' },
  ];

  const fetchData = async () => {
    const [{ data }, { data: mem }] = await Promise.all([
      supabase.from('meetings').select('*, minutes_taker:profiles!meetings_minutes_taker_id_fkey(*)').order('date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ]);
    setMeetings((data as any[]) || []);
    setMembers(mem || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditMeeting(null);
    setForm({ title: '', type: 'regular', date: '', time: '', location: '', virtual_link: '', status: 'scheduled', time_zone: 'America/Chicago', minutes_taker_id: '' });
    setShowForm(true);
  };

  const openEdit = (m: Meeting) => {
    setEditMeeting(m);
    setForm({ title: m.title, type: m.type, date: m.date, time: m.time || '', location: m.location || '', virtual_link: m.virtual_link || '', status: m.status, time_zone: (m as any).time_zone || 'America/Chicago', minutes_taker_id: (m as any).minutes_taker_id || '' });
    setShowForm(true);
  };

  const [agendaTemplate, setAgendaTemplate] = useState('');
  const [minutesAutoSaveTimer, setMinutesAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [minutesLastSaved, setMinutesLastSaved] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  const openMinutes = async (m: Meeting) => {
    setMinutesMeeting(m);
    setMinutesText(m.minutes || '');
    setMinutesLastSaved('');
    setShowClearConfirm(false);
    setClearConfirmText('');
    setShowMinutes(true);

    // Fetch agenda sections to build template
    const { data: sectionsData } = await supabase
      .from('agenda_sections')
      .select('*, agenda_items(*, agenda_sub_items(*))')
      .eq('meeting_id', m.id)
      .order('position');

    if (sectionsData && sectionsData.length > 0) {
      const secs = sectionsData.map((s: any) => ({
        ...s,
        agenda_items: (s.agenda_items || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((item: any) => ({
            ...item,
            agenda_sub_items: (item.agenda_sub_items || []).sort((a: any, b: any) => a.position - b.position),
          })),
      }));

      let html = `<h2 style="text-align:center; margin-bottom: 4px;">Meeting Minutes</h2>`
      html += `<p style="text-align:center; color: #666; font-size: 14px; margin-bottom: 20px;">${m.title} &mdash; ${formatDate(m.date)}</p>`
      html += `<hr/>`

      secs.forEach((s: any, si: number) => {
        html += `<h3>${si + 1}. ${s.title || 'Untitled Section'}</h3>`
        if (s.description) html += `<p style="color: #666; font-size: 13px;">${s.description}</p>`
        if (s.agenda_items.length > 0) {
          s.agenda_items.forEach((item: any, ii: number) => {
            html += `<p><strong>${si + 1}.${ii + 1} ${item.title || 'Untitled Item'}</strong>`
            if (item.duration_minutes) html += ` <span style="color: #999; font-size: 12px;">(${item.duration_minutes}m)</span>`
            html += `</p>`
            if (item.description) html += `<p style="color: #666; font-size: 13px; margin-left: 16px;">${item.description}</p>`
            html += `<p style="margin-left: 16px; color: #aaa; font-style: italic;">Notes: </p>`
            if (item.agenda_sub_items.length > 0) {
              html += `<ul style="margin-left: 16px;">`
              item.agenda_sub_items.forEach((sub: any) => {
                html += `<li>${sub.title || 'Untitled'}${sub.description ? ` — <span style="color: #666;">${sub.description}</span>` : ''}</li>`
              })
              html += `</ul>`
            }
          })
        }
        html += `<br/>`
      })

      html += `<hr/>`
      html += `<p><strong>Action Items:</strong></p><ul><li>&nbsp;</li></ul>`
      html += `<p><strong>Next Meeting:</strong> </p>`

      setAgendaTemplate(html)
    } else {
      setAgendaTemplate('')
    }
  };

  const applyAgendaTemplate = () => {
    setMinutesText(agendaTemplate);
  };

  const handleClearMinutes = () => {
    if (clearConfirmText === 'CLEAR') {
      setMinutesText('');
      setShowClearConfirm(false);
      setClearConfirmText('');
    }
  };

  // Auto-save minutes every 30 seconds
  useEffect(() => {
    if (!showMinutes || !minutesMeeting) return;

    const timer = setInterval(async () => {
      if (minutesText && minutesMeeting) {
        await supabase.from('meetings').update({ minutes: minutesText }).eq('id', minutesMeeting.id);
        setMinutesLastSaved(new Date().toLocaleTimeString());
      }
    }, 30000);

    setMinutesAutoSaveTimer(timer);
    return () => clearInterval(timer);
  }, [showMinutes, minutesMeeting, minutesText]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title,
      type: form.type as Meeting['type'],
      date: form.date,
      time: form.time || null,
      location: form.location || null,
      virtual_link: form.virtual_link || null,
      status: form.status as Meeting['status'],
      time_zone: form.time_zone,
      minutes_taker_id: form.minutes_taker_id || null,
      created_by: user?.id || null,
    };
    if (editMeeting) {
      await supabase.from('meetings').update(payload).eq('id', editMeeting.id);
    } else {
      await supabase.from('meetings').insert({ ...payload, agenda_published: false, minutes_published: false });
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const saveMinutes = async (publish: boolean) => {
    if (!minutesMeeting) return;
    setSaving(true);
    await supabase.from('meetings').update({
      minutes: minutesText,
      minutes_published: publish,
      status: 'completed',
    }).eq('id', minutesMeeting.id);
    setSaving(false);
    setShowMinutes(false);
    fetchData();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this meeting? It will remain visible but marked as cancelled.')) return;
    await supabase.from('meetings').update({ status: 'cancelled' }).eq('id', id);
    fetchData();
  };

  const handleRestore = async (id: string) => {
    await supabase.from('meetings').update({ status: 'scheduled' }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this meeting? This cannot be undone.')) return;
    await supabase.from('meetings').delete().eq('id', id);
    fetchData();
  };

  // Date range filter state for past meetings
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Deep search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, { type: string; text: string }[]>>({});
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      setSearchResults({});
      setSearchPerformed(false);
      setSearchQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!searchQuery) return;
    let cancelled = false;
    const doSearch = async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/meetings/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (cancelled) return;
        const map: Record<string, { type: string; text: string }[]> = {};
        for (const r of data.results || []) {
          map[r.meetingId] = r.matches;
        }
        setSearchResults(map);
        setSearchPerformed(true);
      } catch {
        if (!cancelled) { setSearchResults({}); setSearchPerformed(true); }
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    doSearch();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = meetings.filter(m => m.date >= today && m.status !== 'completed');
  const allPast = meetings.filter(m => m.date < today || m.status === 'completed');

  // Apply both date filter and search filter
  const past = allPast.filter(m => {
    if (dateFrom && m.date < dateFrom) return false;
    if (dateTo && m.date > dateTo) return false;
    if (searchPerformed && !searchResults[m.id]) return false;
    return true;
  });

  // Helper to highlight matched text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const matchTypeLabels: Record<string, string> = {
    meeting: 'Title',
    section: 'Agenda Section',
    item: 'Agenda Item',
    sub_item: 'Sub-Item',
    document: 'Attachment',
  };

  const matchTypeColors: Record<string, string> = {
    meeting: 'bg-blue-50 text-blue-700',
    section: 'bg-purple-50 text-purple-700',
    item: 'bg-green-50 text-green-700',
    sub_item: 'bg-teal-50 text-teal-700',
    document: 'bg-orange-50 text-orange-700',
  };

  const isCancelled = (m: Meeting) => m.status === 'cancelled';

  const MeetingCard = ({ m }: { m: Meeting }) => (
    <div className={`card hover:shadow-md transition-shadow ${isCancelled(m) ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`badge ${statusColors[m.status] || 'bg-gray-100 text-gray-700'} mr-2`}>{m.status}</span>
          <span className="text-xs text-gray-400 capitalize">{m.type}</span>
        </div>
        <div className="flex gap-1">
          {!isCancelled(m) && (
            <>
              <button
                onClick={() => router.push(`/meetings/${m.id}/agenda`)}
                title="Build Agenda"
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
              >
                <Globe className="w-4 h-4" />
              </button>
              <button onClick={() => openMinutes(m)} title="Record Minutes" className="p-1 text-gray-400 hover:text-green-600 rounded">
                <FileText className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => openEdit(m)} className="p-1 text-gray-400 hover:text-primary rounded" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          {isCancelled(m) ? (
            <button onClick={() => handleRestore(m.id)} className="p-1 text-gray-400 hover:text-green-600 rounded" title="Restore Meeting">
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => handleCancel(m.id)} className="p-1 text-gray-400 hover:text-orange-500 rounded" title="Cancel Meeting">
              <Ban className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => handleDelete(m.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Delete Meeting">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h3 className={`font-semibold ${isCancelled(m) ? 'text-red-600 line-through' : 'text-gray-900'}`}>{m.title}</h3>
      {isCancelled(m) && <p className="text-sm font-semibold text-red-600 mt-1">CANCELLED</p>}
      <p className={`text-sm mt-1 ${isCancelled(m) ? 'text-red-400' : 'text-gray-500'}`}>{formatDate(m.date)}{m.time ? ` at ${m.time}` : ''}</p>
      {m.location && <p className={`text-sm ${isCancelled(m) ? 'text-red-300' : 'text-gray-400'}`}>{m.location}</p>}
      {m.virtual_link && !isCancelled(m) && (
        <a href={m.virtual_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Join Online</a>
      )}
      {(m as any).minutes_taker && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
          <Pencil className="w-3 h-3" />
          Minutes: <Avatar src={(m as any).minutes_taker.avatar_url} name={(m as any).minutes_taker.full_name} size="sm" /> {(m as any).minutes_taker.full_name}
        </p>
      )}
      <div className="flex gap-3 mt-3">
        {m.agenda_published && (
          <span className="text-xs text-green-600 flex items-center gap-1"><Globe className="w-3 h-3" /> Agenda Published</span>
        )}
        {m.minutes_published && (
          <span className="text-xs text-blue-600 flex items-center gap-1"><FileText className="w-3 h-3" /> Minutes Published</span>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Meetings</h1>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" /> Upcoming Meetings
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map(m => <MeetingCard key={m.id} m={m} />)}
                </div>
              </div>
            )}
            {allPast.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-700 mb-3">Past Meetings</h2>

                {/* Search bar */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    className="input !pl-10 !pr-10"
                    placeholder="Search meetings, agenda items, attached files..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                  {searching && (
                    <Loader2 className="w-4 h-4 text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                  {!searching && searchInput && (
                    <button
                      onClick={() => { setSearchInput(''); setSearchResults({}); setSearchPerformed(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Date range filter */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">From</label>
                    <input
                      type="date"
                      className="input !py-1.5 !px-2 text-sm w-auto"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">To</label>
                    <input
                      type="date"
                      className="input !py-1.5 !px-2 text-sm w-auto"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                    />
                  </div>
                  {(dateFrom || dateTo || searchPerformed) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo(''); setSearchInput(''); setSearchResults({}); setSearchPerformed(false); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {past.length} of {allPast.length} meeting{allPast.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* List view */}
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {past.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">
                      {searchPerformed
                        ? `No meetings found matching "${searchInput}".`
                        : 'No meetings match the selected date range.'}
                    </div>
                  ) : (
                    past.map(m => {
                      const matches = searchResults[m.id];
                      const cancelled = isCancelled(m);
                      return (
                        <div key={m.id} className={`hover:bg-gray-50 transition-colors group ${cancelled ? 'bg-red-50/30' : ''}`}>
                          <div className="flex items-center gap-4 px-5 py-3">
                            {/* Date column */}
                            <div className="w-28 flex-shrink-0">
                              <span className={`text-sm font-medium ${cancelled ? 'text-red-400' : 'text-gray-700'}`}>{formatDate(m.date)}</span>
                              {m.time && <p className={`text-xs ${cancelled ? 'text-red-300' : 'text-gray-400'}`}>{m.time}</p>}
                            </div>
                            {/* Title & details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium truncate ${cancelled ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                  {searchQuery ? highlightMatch(m.title, searchQuery) : m.title}
                                </span>
                                <span className={`badge text-xs ${statusColors[m.status] || 'bg-gray-100 text-gray-700'}`}>{m.status}</span>
                                <span className="text-xs text-gray-400 capitalize">{m.type}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {m.location && <span className={`text-xs truncate ${cancelled ? 'text-red-300' : 'text-gray-400'}`}>{m.location}</span>}
                                {m.agenda_published && (
                                  <span className="text-xs text-green-600 flex items-center gap-0.5"><Globe className="w-3 h-3" /> Agenda</span>
                                )}
                                {m.minutes_published && (
                                  <span className="text-xs text-blue-600 flex items-center gap-0.5"><FileText className="w-3 h-3" /> Minutes</span>
                                )}
                              </div>
                              {/* Search match context */}
                              {matches && matches.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {matches.map((match, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${matchTypeColors[match.type] || 'bg-gray-50 text-gray-600'}`}
                                    >
                                      <span className="font-medium">{matchTypeLabels[match.type] || match.type}:</span>
                                      {highlightMatch(match.text.length > 50 ? match.text.slice(0, 50) + '…' : match.text, searchQuery)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!cancelled && (
                                <>
                                  <button onClick={() => router.push(`/meetings/${m.id}/agenda`)} title="View Agenda" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                                    <Globe className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => openMinutes(m)} title="Minutes" className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                                    <FileText className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 text-gray-400 hover:text-primary rounded">
                                <Pencil className="w-4 h-4" />
                              </button>
                              {cancelled ? (
                                <button onClick={() => handleRestore(m.id)} title="Restore Meeting" className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              ) : (
                                <button onClick={() => handleCancel(m.id)} title="Cancel Meeting" className="p-1.5 text-gray-400 hover:text-orange-500 rounded">
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => handleDelete(m.id)} title="Delete Meeting" className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {meetings.length === 0 && (
              <div className="card text-center py-16 text-gray-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No meetings yet</p>
              </div>
            )}
          </div>
        )}

        {/* Meeting Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">{editMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="label">Title *</label>
                  <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Type</label>
                    <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {['scheduled', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date *</label>
                    <input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Time</label>
                    <input className="input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input className="input" placeholder="Room, address, etc." value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Virtual Meeting Link</label>
                  <input className="input" type="url" placeholder="https://zoom.us/..." value={form.virtual_link} onChange={e => setForm(f => ({ ...f, virtual_link: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Time Zone</label>
                    <select className="input" value={form.time_zone} onChange={e => setForm(f => ({ ...f, time_zone: e.target.value }))}>
                      {commonTimeZones.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Minutes Taker</label>
                    <select className="input" value={form.minutes_taker_id} onChange={e => setForm(f => ({ ...f, minutes_taker_id: e.target.value }))}>
                      <option value="">Select member...</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editMeeting ? 'Save Changes' : 'Schedule'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Minutes Modal */}
        {showMinutes && minutesMeeting && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="font-semibold text-lg">Meeting Minutes</h2>
                  <p className="text-sm text-gray-500">{minutesMeeting.title} â {formatDate(minutesMeeting.date)}</p>
                </div>
                <button onClick={() => setShowMinutes(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto flex flex-col">
                {/* Template options — show when minutes are empty */}
                {!minutesText && agendaTemplate && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Start from agenda template?</p>
                    <p className="text-xs text-blue-600 mb-3">Pre-populate minutes with the agenda outline, including sections, items, and placeholders for notes.</p>
                    <div className="flex gap-2">
                      <button onClick={applyAgendaTemplate} className="btn-primary text-sm px-3 py-1.5">
                        Use Agenda Template
                      </button>
                      <button onClick={() => setAgendaTemplate('')} className="btn-secondary text-sm px-3 py-1.5">
                        Start Blank
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <label className="label">Minutes</label>
                  <div className="flex items-center gap-3">
                    {minutesLastSaved && (
                      <span className="text-xs text-green-600">Auto-saved at {minutesLastSaved}</span>
                    )}
                    {minutesText && (
                      <button
                        onClick={() => setShowClearConfirm(!showClearConfirm)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Clear confirmation */}
                {showClearConfirm && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Type <strong>CLEAR</strong> to confirm clearing all minutes content:</p>
                    <div className="flex gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder='Type "CLEAR" to confirm'
                        value={clearConfirmText}
                        onChange={e => setClearConfirmText(e.target.value)}
                      />
                      <button
                        onClick={handleClearMinutes}
                        disabled={clearConfirmText !== 'CLEAR'}
                        className="btn-primary text-sm px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button onClick={() => { setShowClearConfirm(false); setClearConfirmText(''); }} className="btn-secondary text-sm px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <RichTextEditor
                  value={minutesText}
                  onChange={setMinutesText}
                  placeholder="Record meeting minutes here..."
                  minHeight="350px"
                />
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => saveMinutes(false)} disabled={saving} className="btn-secondary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Draft
                  </button>
                  <button onClick={() => saveMinutes(true)} disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Publish Minutes
                  </button>
                  <span className="text-xs text-gray-400 ml-auto">Auto-saves every 30 seconds</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
