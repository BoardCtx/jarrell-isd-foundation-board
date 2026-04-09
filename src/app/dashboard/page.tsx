import { createServerClient } from '@/lib/supabase-server';
import AppLayout from '@/components/layout/AppLayout';
import { formatCurrency, formatDate, statusColors } from '@/lib/utils';
import Link from 'next/link';
import {
  FolderKanban,
  CheckSquare,
  DollarSign,
  CalendarDays,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();

  const [
    { data: projects },
    { data: tasks },
    { data: budgetItems },
    { data: meetings },
    { data: profile },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('*, assignee:profiles(full_name)').eq('status', 'in_progress').limit(5),
    supabase.from('budget_items').select('*').order('date', { ascending: false }).limit(5),
    supabase.from('meetings').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date').limit(3),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from('profiles').select('*').eq('id', user.id).single();
    }),
  ]);

  const totalRaised = budgetItems
    ?.filter(b => b.type === 'donation' || b.type === 'grant')
    .reduce((sum, b) => sum + b.amount, 0) ?? 0;

  const totalExpenses = budgetItems
    ?.filter(b => b.type === 'expense')
    .reduce((sum, b) => sum + b.amount, 0) ?? 0;

  const activeProjects = projects?.filter(p => p.status === 'active').length ?? 0;
  const openTasks = tasks?.length ?? 0;

  const stats = [
    { label: 'Active Projects', value: activeProjects, icon: FolderKanban, color: 'bg-blue-500', href: '/projects' },
    { label: 'Open Tasks', value: openTasks, icon: CheckSquare, color: 'bg-purple-500', href: '/tasks' },
    { label: 'Total Raised', value: formatCurrency(totalRaised), icon: TrendingUp, color: 'bg-green-500', href: '/budget' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: DollarSign, color: 'bg-orange-500', href: '/budget' },
  ];

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-header">
            Welcome back{profile?.data ? `, ${profile.data.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with the foundation today.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <div className="card hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-2.5 rounded-lg`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Projects */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Projects</h2>
              <Link href="/projects" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            {projects && projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link key={project.id} href={`/projects`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{project.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {project.end_date ? `Due ${formatDate(project.end_date)}` : 'No deadline'}
                        </p>
                      </div>
                      <div className="ml-4 flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500">Raised</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(project.amount_raised)}</p>
                        </div>
                        <span className={`badge ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FolderKanban className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No projects yet</p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Upcoming Meetings */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Upcoming Meetings</h2>
                <Link href="/meetings" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              {meetings && meetings.length > 0 ? (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
                        <CalendarDays className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(meeting.date)}{meeting.time ? ` at ${meeting.time}` : ''}</p>
                        {meeting.location && (
                          <p className="text-xs text-gray-400">{meeting.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-sm">No upcoming meetings</p>
                </div>
              )}
            </div>

            {/* In-Progress Tasks */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">In Progress Tasks</h2>
                <Link href="/tasks" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              {tasks && tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                        {task.due_date && (
                          <p className="text-xs text-gray-400">Due {formatDate(task.due_date)}</p>
                        )}
                      </div>
                      {task.priority === 'urgent' && (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-sm">No tasks in progress</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
