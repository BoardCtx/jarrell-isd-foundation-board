'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  Search, CalendarDays, FolderKanban, FileText, Users, BarChart3,
  Award, X, ArrowRight, LayoutDashboard, Settings, CheckSquare,
  DollarSign, BookOpen, Loader2,
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'meeting' | 'project' | 'document' | 'member' | 'help' | 'page';
  title: string;
  subtitle?: string;
  href: string;
}

const typeIcons: Record<string, any> = {
  meeting: CalendarDays,
  project: FolderKanban,
  document: FileText,
  member: Users,
  help: BookOpen,
  page: ArrowRight,
};

const typeLabels: Record<string, string> = {
  meeting: 'Meeting',
  project: 'Project',
  document: 'Document',
  member: 'Member',
  help: 'Help',
  page: 'Page',
};

const typeColors: Record<string, string> = {
  meeting: 'bg-blue-100 text-blue-700',
  project: 'bg-purple-100 text-purple-700',
  document: 'bg-green-100 text-green-700',
  member: 'bg-orange-100 text-orange-700',
  help: 'bg-amber-100 text-amber-700',
  page: 'bg-gray-100 text-gray-700',
};

// Static pages for quick navigation
const pages: SearchResult[] = [
  { id: 'page-dashboard', type: 'page', title: 'Dashboard', href: '/dashboard' },
  { id: 'page-meetings', type: 'page', title: 'Meetings', href: '/meetings' },
  { id: 'page-projects', type: 'page', title: 'Projects', href: '/projects' },
  { id: 'page-tasks', type: 'page', title: 'Tasks', href: '/tasks' },
  { id: 'page-financial', type: 'page', title: 'Financial', href: '/budget' },
  { id: 'page-documents', type: 'page', title: 'Documents', href: '/documents' },
  { id: 'page-grants', type: 'page', title: 'Grants', href: '/grants' },
  { id: 'page-members', type: 'page', title: 'Board Members', href: '/members' },
  { id: 'page-polls', type: 'page', title: 'Polls', href: '/polls' },
  { id: 'page-settings', type: 'page', title: 'Settings', href: '/settings' },
  { id: 'page-support', type: 'help', title: 'Support & Training', href: '/support' },
];

// Static help topics
const helpResults: SearchResult[] = [
  { id: 'help-agenda', type: 'help', title: 'How to build an agenda', subtitle: 'Meetings', href: '/support?topic=meetings-agenda' },
  { id: 'help-publish', type: 'help', title: 'Publishing & locking agendas', subtitle: 'Meetings', href: '/support?topic=meetings-publishing' },
  { id: 'help-minutes', type: 'help', title: 'Recording meeting minutes', subtitle: 'Meetings', href: '/support?topic=meetings-minutes' },
  { id: 'help-attendees', type: 'help', title: 'Managing attendees', subtitle: 'Meetings', href: '/support?topic=meetings-attendees' },
  { id: 'help-projects', type: 'help', title: 'Creating & editing projects', subtitle: 'Projects', href: '/support?topic=projects-creating' },
  { id: 'help-project-detail', type: 'help', title: 'Project detail page tabs', subtitle: 'Projects', href: '/support?topic=projects-detail' },
  { id: 'help-grants', type: 'help', title: 'Managing grant applications', subtitle: 'Grants', href: '/support?topic=grants-applications' },
  { id: 'help-members', type: 'help', title: 'Inviting new members', subtitle: 'Members', href: '/support?topic=members-inviting' },
  { id: 'help-polls', type: 'help', title: 'Creating polls', subtitle: 'Polls', href: '/support?topic=polls-overview' },
  { id: 'help-search', type: 'help', title: 'Searching past meetings', subtitle: 'Meetings', href: '/support?topic=meetings-search' },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search logic
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    const lower = q.toLowerCase();

    // Filter static pages and help
    const pageMatches = pages.filter(p => p.title.toLowerCase().includes(lower));
    const helpMatches = helpResults.filter(h => h.title.toLowerCase().includes(lower) || (h.subtitle || '').toLowerCase().includes(lower));

    // Search Supabase for meetings, projects, documents, members
    const [meetingsRes, projectsRes, documentsRes, membersRes] = await Promise.all([
      supabase.from('meetings').select('id, title, date').ilike('title', `%${q}%`).limit(5),
      supabase.from('projects').select('id, title').ilike('title', `%${q}%`).limit(5),
      supabase.from('documents').select('id, title').ilike('title', `%${q}%`).limit(5),
      supabase.from('profiles').select('id, full_name, email').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).eq('is_active', true).limit(5),
    ]);

    const meetingResults: SearchResult[] = (meetingsRes.data || []).map(m => ({
      id: `meeting-${m.id}`, type: 'meeting', title: m.title, subtitle: m.date, href: `/meetings/${m.id}/agenda`,
    }));

    const projectResults: SearchResult[] = (projectsRes.data || []).map(p => ({
      id: `project-${p.id}`, type: 'project', title: p.title, href: `/projects/${p.id}`,
    }));

    const docResults: SearchResult[] = (documentsRes.data || []).map(d => ({
      id: `doc-${d.id}`, type: 'document', title: d.title, href: '/documents',
    }));

    const memberResults: SearchResult[] = (membersRes.data || []).map(m => ({
      id: `member-${m.id}`, type: 'member', title: m.full_name, subtitle: m.email, href: '/members',
    }));

    setResults([
      ...pageMatches,
      ...meetingResults,
      ...projectResults,
      ...docResults,
      ...memberResults,
      ...helpMatches,
    ]);
    setSelectedIndex(0);
    setSearching(false);
  }, [supabase]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].href);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-lg outline-none placeholder-gray-400 text-gray-800"
            placeholder="Search meetings, projects, members, help..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {searching && <Loader2 size={18} className="animate-spin text-gray-400" />}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query && results.length === 0 && !searching && (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="text-base">No results found for "{query}"</p>
            </div>
          )}

          {!query && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick navigation</p>
              {pages.slice(0, 6).map((page, i) => {
                const Icon = typeIcons[page.type] || ArrowRight;
                return (
                  <button
                    key={page.id}
                    onClick={() => { router.push(page.href); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-100 transition-colors"
                  >
                    <Icon size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-700">{page.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, i) => {
                const Icon = typeIcons[result.type] || ArrowRight;
                const isSelected = i === selectedIndex;
                return (
                  <button
                    key={result.id}
                    onClick={() => { router.push(result.href); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-gray-800'}`}>{result.title}</p>
                      {result.subtitle && <p className="text-xs text-gray-400 truncate">{result.subtitle}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[result.type] || 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[result.type]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="border border-gray-200 rounded px-1 py-0.5 bg-white">↑↓</kbd> Navigate</span>
          <span><kbd className="border border-gray-200 rounded px-1 py-0.5 bg-white">Enter</kbd> Open</span>
          <span><kbd className="border border-gray-200 rounded px-1 py-0.5 bg-white">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
