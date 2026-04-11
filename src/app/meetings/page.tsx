'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, statusColors } from '@/lib/utils';
import type { Meeting } from '@/lib/database.types';
import { Plus, Loader2, CalendarDays, X, Pencil, Trash2, FileText, Globe, Filter, ChevronRight } from 'lucide-react';

const typeOptions = ['regular', 'special', 'annual', 'committee'];

export default function MeetingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
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
  });

  const fetchData = async () => {
    const { data } = await supabase.from('meetings').select('*').order('date', { ascending: false });
    setMeetings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditMeeting(null);
    setForm({ title: '', type: 'regular', date: '', time: '', location: '', virtual_link: '', status: 'scheduled' });
    setShowForm(true);
  };

  const openEdit = (m: Meeting) => {
    setEditMeeting(m);
    setForm({ title: m.title, type: m.type, date: m.date, time: m.time || '', location: m.location || '', virtual_link: m.virtual_link || '', status: m.status });
    setShowForm(true);
  };

  const openMinutes = (m: Meeting) => {
    setMinutesMeeting(m);
    setMinutesText(m.minutes || '');
    setShowMinutes(true);
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this meeting?')) return;
    await supabase.from('meetings').delete().eq('id', id);
    fetchData();
  };

  // Date range filter state for past meetings
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const upcoming = meetings.filter(m => m.date >= new Date().toISOString().split('T')[0] && m.status === 'scheduled');
  const allPast = meetings.filter(m => m.date < new Date().toISOString().split('T')[0] || m.status === 'completed');
  const past = allPast.filter(m => {
    if (dateFrom && m.date < dateFrom) return false;
    if (dateTo && m.date > dateTo) return false;
    return true;
  });

  const MeetingCard = ({ m }: { m: Meeting }) => (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`badge ${statusColors[m.status] || 'bg-gray-100 text-gray-700'} mr-2`}>{m.status}</span>
          <span className="text-xs text-gray-400 capitalize">{m.type}</span>
        </div>
        <div className="flex gap-1">
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
          <button onClick={() => openEdit(m)} className="p-1 text-gray-400 hover:text-primary rounded">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(m.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900">{m.title}</h3>
      <p className="text-sm text-gray-500 mt-1">{formatDate(m.date)}{m.time ? ` at ${m.time}` : ''}</p>
      {m.location && <p className="text-sm text-gray-400">{m.location}</p>}
      {m.virtual_link && (
        <a href={m.virtual_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Join Online</a>
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
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{past.length} meeting{past.length !== 1 ? 's' : ''}</span>
                </div>

                {/* List view */}
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {past.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">No meetings match the selected date range.</div>
                  ) : (
                    past.map(m => (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors group">
                        {/* Date column */}
                        <div className="w-28 flex-shrink-0">
                          <span className="text-sm font-medium text-gray-700">{formatDate(m.date)}</span>
                          {m.time && <p className="text-xs text-gray-400">{m.time}</p>}
                        </div>
                        {/* Title & details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{m.title}</span>
                            <span className={`badge text-xs ${statusColors[m.status] || 'bg-gray-100 text-gray-700'}`}>{m.status}</span>
                            <span className="text-xs text-gray-400 capitalize">{m.type}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {m.location && <span className="text-xs text-gray-400 truncate">{m.location}</span>}
                            {m.agenda_published && (
                              <span className="text-xs text-green-600 flex items-center gap-0.5"><Globe className="w-3 h-3" /> Agenda</span>
                            )}
                            {m.minutes_published && (
                              <span className="text-xs text-blue-600 flex items-center gap-0.5"><FileText className="w-3 h-3" /> Minutes</span>
                            )}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/meetings/${m.id}/agenda`)} title="View Agenda" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                            <Globe className="w-4 h-4" />
                          </button>
                          <button onClick={() => openMinutes(m)} title="Minutes" className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 text-gray-400 hover:text-primary rounded">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(m.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    ))
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="font-semibold text-lg">Meeting Minutes</h2>
                  <p className="text-sm text-gray-500">{minutesMeeting.title} â {formatDate(minutesMeeting.date)}</p>
                </div>
                <button onClick={() => setShowMinutes(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <label className="label">Minutes</label>
                <textarea
                  className="input flex-1 resize-none min-h-[300px] font-mono text-sm"
                  placeholder="Record meeting minutes here..."
                  value={minutesText}
                  onChange={e => setMinutesText(e.target.value)}
                />
                <div className="flex gap-3 mt-4">
                  <button onClick={() => saveMinutes(false)} disabled={saving} className="btn-secondary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Draft
                  </button>
                  <button onClick={() => saveMinutes(true)} disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Publish Minutes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
