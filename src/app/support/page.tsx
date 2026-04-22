'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  LayoutDashboard, CalendarDays, FolderKanban, CheckSquare, DollarSign,
  FileText, Users, BarChart3, Settings, Award, Search,
  Globe, Plus, Pencil, Trash2, Eye, Copy, Lock, Paperclip, GripVertical,
  ChevronDown, ChevronRight, LifeBuoy, BookOpen, Printer, Download,
  Mail, UserPlus, Upload, FolderOpen, Filter, ArrowLeft, MessageSquare,
  Target, Clock, RotateCcw, Ban,
} from 'lucide-react';

// ── Help content data ─────────────────────────────────────────────────────────

interface HelpSection {
  id: string;
  title: string;
  icon: any;
  topics: HelpTopic[];
}

interface HelpTopic {
  id: string;
  title: string;
  content: React.ReactNode;
}

const IconBadge = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 rounded px-2 py-1 text-sm font-medium">
    <Icon size={14} /> {label}
  </span>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="my-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <p className="text-base text-amber-800 leading-relaxed"><strong>Tip:</strong> {children}</p>
  </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <p className="text-base text-blue-800 leading-relaxed"><strong>Note:</strong> {children}</p>
  </div>
);

const StepList = ({ steps }: { steps: string[] }) => (
  <ol className="my-4 space-y-3 pl-0 list-none counter-reset-steps">
    {steps.map((step, i) => (
      <li key={i} className="flex gap-3 items-start">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
        <span className="text-base text-gray-700 leading-relaxed pt-1">{step}</span>
      </li>
    ))}
  </ol>
);

const helpSections: HelpSection[] = [
  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    topics: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Dashboard is your home page after logging in. It gives you a quick snapshot of everything that needs your attention.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">What you will see:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Upcoming Meetings</strong> — Your next scheduled meetings with dates and times. Click any meeting to go to its agenda.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Recent Activity</strong> — A feed of the latest actions across the portal, such as new documents uploaded, meetings scheduled, or projects updated.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>My Project To-Dos</strong> — Any to-do items assigned to you across all projects. Click one to jump directly to that project.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Quick Stats</strong> — Summary counts of active projects, upcoming meetings, and pending tasks.
            </p>
            <Tip>The dashboard updates automatically when you visit it. If someone adds a meeting or assigns you a task, you will see it the next time you load the page.</Tip>
          </>
        ),
      },
    ],
  },

  // ── MEETINGS ────────────────────────────────────────────────────────────────
  {
    id: 'meetings',
    title: 'Meetings',
    icon: CalendarDays,
    topics: [
      {
        id: 'meetings-overview',
        title: 'Meetings Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Meetings section is where you schedule meetings, build agendas, record minutes, and manage attendees. Upcoming meetings appear as cards at the top, and past meetings are listed below with search and date filtering.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Meeting card icons:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Globe} label="Globe icon" /> — Opens the Agenda Builder for this meeting.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={FileText} label="Document icon" /> — Opens the Minutes Editor to record or edit meeting minutes.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Pencil} label="Pencil icon" /> — Edit the meeting details (title, date, time, location, etc.).
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Ban} label="Circle-slash icon" /> — Cancel the meeting. The meeting will remain visible but marked as cancelled.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={RotateCcw} label="Restore icon" /> — Appears on cancelled meetings. Click to restore it to scheduled status.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Trash2} label="Trash icon" /> — Permanently delete the meeting. This cannot be undone.
            </p>
          </>
        ),
      },
      {
        id: 'meetings-scheduling',
        title: 'Scheduling a Meeting',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              To schedule a new meeting, click the <IconBadge icon={Plus} label="Schedule Meeting" /> button in the top right.
            </p>
            <StepList steps={[
              'Click "Schedule Meeting" to open the form.',
              'Enter a title (required) and select the meeting type (regular, special, annual, or committee).',
              'Pick a date and optionally a time.',
              'Add a location (physical address or room name) and/or a virtual meeting link (Zoom, Teams, etc.).',
              'Select the time zone and optionally assign a Minutes Taker — the person responsible for recording minutes.',
              'Click "Schedule" to create the meeting.',
            ]} />
            <Tip>You can always edit the meeting details later by clicking the pencil icon on the meeting card.</Tip>
          </>
        ),
      },
      {
        id: 'meetings-agenda',
        title: 'Building an Agenda',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Agenda Builder is a drag-and-drop tool for creating structured meeting agendas with sections, items, and sub-items.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Getting started:</h4>
            <StepList steps={[
              'From the Meetings page, click the globe icon on a meeting card to open its Agenda Builder.',
              'Click "Add Section" to create your first section (e.g., "Call to Order", "Old Business", "New Business").',
              'Inside each section, click "Add item" to add agenda items.',
              'Inside each item, click "Add sub-item" for more detail.',
              'Drag items using the grip handle to reorder them.',
            ]} />
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Agenda Builder icons:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={GripVertical} label="Grip handle" /> — Click and drag to reorder sections, items, or sub-items.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Paperclip} label="Paperclip" /> — Attach a document from the Documents library to this section, item, or sub-item.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Pencil} label="Pencil" /> — Edit the title, description, or duration of this item.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Trash2} label="Trash" /> — Delete this section, item, or sub-item.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Clock} label="Clock" /> — Shows the estimated duration in minutes for an agenda item.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={ChevronDown} label="Chevron" /> — Expand or collapse a section or item to show/hide its children.
            </p>
          </>
        ),
      },
      {
        id: 'meetings-publishing',
        title: 'Publishing & Locking the Agenda',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              When your agenda is ready, you can publish it to share with attendees. Publishing does several things at once.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">What happens when you publish:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              All attendees receive an email with a link to view the agenda, along with a calendar invite (.ics file) they can add to their calendar app.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              A public link is generated that can be shared with anyone — this shows a text-only version without attachments and does not require a login.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>The agenda becomes locked.</strong> Once published, no one can edit, reorder, add, or delete agenda items until it is unpublished. This prevents accidental changes after the agenda has been distributed.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Toolbar buttons:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Globe} label="Publish & Notify" /> — Publishes the agenda and emails all attendees.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Globe} label="Published" /> — Shows the agenda is live. Click to unpublish (admin, secretary, or meeting creator only).
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Copy} label="Public Link" /> — Copies the public agenda link to your clipboard for sharing.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Eye} label="Preview" /> — Opens a preview of the full agenda with attachments (requires login).
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Download} label="PDF" /> — Downloads the agenda as a PDF file for offline use or printing.
            </p>
            <Note>Only admins, the secretary, and the meeting creator can publish or unpublish an agenda. Other users will see the published agenda as read-only.</Note>
          </>
        ),
      },
      {
        id: 'meetings-attendees',
        title: 'Managing Attendees',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              You can add attendees to a meeting individually or by group. Attendees are notified when the agenda is published.
            </p>
            <StepList steps={[
              'Open the Agenda Builder for the meeting.',
              'Click the people icon in the top right to open the Attendees panel.',
              'Search for individual members or select an entire group (e.g., "Board Members").',
              'Choose whether each attendee is "Required" or "Optional".',
              'Close the panel when done. Attendees will be emailed when you publish the agenda.',
            ]} />
            <Tip>Add your attendees before publishing the agenda. When you click "Publish & Notify," everyone on the attendee list receives the email with the calendar invite.</Tip>
          </>
        ),
      },
      {
        id: 'meetings-minutes',
        title: 'Recording Meeting Minutes',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Minutes are recorded using a rich text editor with formatting tools. You can start from scratch or use the agenda as a template.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Opening the Minutes Editor:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Click the <IconBadge icon={FileText} label="Document icon" /> on any meeting card to open the minutes editor.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Using the Agenda Template:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              If the meeting has a published agenda, you will see a blue banner offering to pre-populate the minutes with the agenda outline. This creates a structured document with all the agenda sections, items, and placeholder fields for your notes. Click <strong>"Use Agenda Template"</strong> to apply it.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Editor toolbar features:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              The toolbar at the top of the editor provides: <strong>Undo/Redo</strong>, <strong>Font family and size</strong>, <strong>Bold, Italic, Underline, Strikethrough</strong>, <strong>Text color</strong>, <strong>Bullet and numbered lists</strong>, <strong>Indent and outdent</strong>, and <strong>Horizontal lines</strong>.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Saving:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Auto-save:</strong> Minutes are automatically saved every 30 seconds while the editor is open.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Save Draft:</strong> Saves the minutes without publishing them. Only you and other editors can see drafts.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Publish Minutes:</strong> Saves and marks the minutes as published, making them visible to all members.
            </p>
            <Note>To clear all minutes content, click "Clear All" and type <strong>CLEAR</strong> to confirm. This safety step prevents accidental deletion.</Note>
          </>
        ),
      },
      {
        id: 'meetings-search',
        title: 'Searching Past Meetings',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Past Meetings section includes a deep search feature that searches across meeting titles, agenda sections, agenda items, sub-items, and attached document names.
            </p>
            <StepList steps={[
              'Scroll down to the "Past Meetings" section.',
              'Type your search term in the search bar. Results update as you type (after a short delay).',
              'Matching meetings will show colored badges indicating where the match was found (e.g., "Agenda Item: Budget Review").',
              'Use the date range filters to narrow results to a specific time period.',
              'Click "Clear all filters" to reset both search and date filters.',
            ]} />
          </>
        ),
      },
    ],
  },

  // ── PROJECTS ────────────────────────────────────────────────────────────────
  {
    id: 'projects',
    title: 'Projects',
    icon: FolderKanban,
    topics: [
      {
        id: 'projects-overview',
        title: 'Projects Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Projects are organized in a Basecamp-style layout. Each project has its own page with tabs for messages, to-dos, milestones, documents, budget, team, and activity.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Project cards show:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Status badge</strong> — Planning, Active, On Hold, Completed, or Cancelled.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Budget progress bar</strong> — Shows amount raised vs. goal (if a budget goal is set).
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Project lead</strong> — The person responsible for this project, shown at the bottom with their avatar.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <IconBadge icon={Lock} label="Lock icon" /> — Appears if the project is set to "Team only" visibility, meaning only project team members can see it.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Click any project card to open its full detail page.
            </p>
          </>
        ),
      },
      {
        id: 'projects-creating',
        title: 'Creating & Editing Projects',
        content: (
          <>
            <StepList steps={[
              'Click "New Project" in the top right.',
              'Enter a title (required) and optional description.',
              'Set the status, category (Academic, Arts, Athletics, STEM, Community, Scholarships, Other), and budget goal.',
              'Choose start and end dates, assign a project lead, and set visibility (Public or Team Only).',
              'Click "Create Project."',
            ]} />
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              To edit a project, click the <IconBadge icon={Pencil} label="pencil icon" /> on the project card. To delete, click the <IconBadge icon={Trash2} label="trash icon" />.
            </p>
          </>
        ),
      },
      {
        id: 'projects-detail',
        title: 'Project Detail Page',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Each project has a full detail page with tabs along the top. Here is what each tab does:
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Overview</strong> — Project description, status, dates, budget progress, and recent activity at a glance.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Messages</strong> — A message board for project discussions. Post updates, ask questions, and comment on posts. Similar to a forum.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>To-Dos</strong> — Task lists organized into groups. Each to-do can be assigned to a team member with a due date and notes. Click a to-do to expand it and see/edit details.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Milestones</strong> — Key dates and goals for the project. Mark them complete as you reach them.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Documents</strong> — Upload and manage files related to this project. Click to download any document.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Budget</strong> — Track income and expenses with a summary showing total income, total expenses, and net balance. Add budget line items with amounts and categories.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Team</strong> — Manage who is on the project team. Add or remove members and assign roles.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Activity</strong> — A chronological log of everything that has happened on this project.
            </p>
          </>
        ),
      },
    ],
  },

  // ── TASKS ───────────────────────────────────────────────────────────────────
  {
    id: 'tasks',
    title: 'Tasks',
    icon: CheckSquare,
    topics: [
      {
        id: 'tasks-overview',
        title: 'Tasks Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Tasks page shows all tasks across the portal. You can create standalone tasks (not tied to a project) or view all tasks assigned to you in one place.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Tasks can have a title, description, assignee, due date, priority level, and status. Check off tasks as you complete them.
            </p>
            <Tip>Project-specific to-dos are managed within each project's To-Dos tab. The Tasks page is for general tasks that apply to the whole foundation.</Tip>
          </>
        ),
      },
    ],
  },

  // ── FINANCIAL ───────────────────────────────────────────────────────────────
  {
    id: 'financial',
    title: 'Financial',
    icon: DollarSign,
    topics: [
      {
        id: 'financial-overview',
        title: 'Financial Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Financial section provides a centralized view of the foundation's budget across all projects. It shows total income, expenses, and balances.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Individual project budgets are managed within each project's Budget tab. The Financial page aggregates this data so the treasurer and board can see the big picture.
            </p>
          </>
        ),
      },
    ],
  },

  // ── DOCUMENTS ───────────────────────────────────────────────────────────────
  {
    id: 'documents',
    title: 'Documents',
    icon: FileText,
    topics: [
      {
        id: 'documents-overview',
        title: 'Documents Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Documents section is a central file library for the foundation. You can upload, organize, and share documents with board members.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Document categories:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Documents can be categorized as: Agenda, Minutes, Financial, Policy, Grant, General, or Other.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Folders:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Documents can be organized into folders for easy navigation. Create folders with the <IconBadge icon={FolderOpen} label="Folder" /> button and move documents into them.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Uploading:</h4>
            <StepList steps={[
              'Click the upload button or drag and drop files onto the page.',
              'Give the document a title and select a category.',
              'Optionally assign it to a meeting or project.',
              'Click "Upload" to save.',
            ]} />
            <Tip>Documents attached to agenda items are stored here and linked to the relevant meeting. You can find them both in the Documents library and on the agenda.</Tip>
          </>
        ),
      },
    ],
  },

  // ── GRANTS ──────────────────────────────────────────────────────────────────
  {
    id: 'grants',
    title: 'Grants',
    icon: Award,
    topics: [
      {
        id: 'grants-overview',
        title: 'Grants Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Grants section manages the full grant application lifecycle — from accepting applications to committee review and scoring to follow-up.
            </p>
            <Note>The Grants section is only visible to users with grant access: admins, the president, Grant Admin group members, and Grant Committee group members.</Note>
          </>
        ),
      },
      {
        id: 'grants-applications',
        title: 'Managing Applications',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Grant applications come in through the public-facing applicant portal. As an admin or committee member, you can review, score, and manage applications from the Grants page.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Application workflow:</h4>
            <StepList steps={[
              'Applicants register and submit their applications through the public grant portal.',
              'Applications appear in the Grants section for review.',
              'Committee members can score applications on multiple criteria.',
              'Admins can approve, deny, or request additional information.',
              'Follow-up requests and documents can be tracked within each application.',
            ]} />
          </>
        ),
      },
      {
        id: 'grants-applicant-portal',
        title: 'Applicant Portal',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Applicant Portal is a separate, public-facing section where grant applicants create accounts, fill out applications, upload supporting documents, and check the status of their submissions.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Applicants have their own login system separate from board members. They can only see their own applications and cannot access any other part of the board portal.
            </p>
          </>
        ),
      },
    ],
  },

  // ── BOARD MEMBERS ───────────────────────────────────────────────────────────
  {
    id: 'members',
    title: 'Board Members',
    icon: Users,
    topics: [
      {
        id: 'members-overview',
        title: 'Members Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Board Members page shows all members of the foundation with their roles, contact information, and avatars.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Member roles:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Admin</strong> — Full access to all features, including managing members, grants, and settings.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>President</strong> — Same access as admin, representing the board president.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Secretary</strong> — Can publish/unpublish agendas and manage meeting-related features.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Member</strong> — Standard access to view and participate in meetings, projects, and documents.
            </p>
          </>
        ),
      },
      {
        id: 'members-inviting',
        title: 'Inviting New Members',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Admins and the president can invite new members to the portal.
            </p>
            <StepList steps={[
              'Go to Board Members and click "Invite Member."',
              'Enter the person\'s name, email address, and role.',
              'They will receive an email invitation with a link to set up their account.',
              'Once they log in, they will appear in the members list with their assigned role.',
            ]} />
          </>
        ),
      },
    ],
  },

  // ── POLLS ───────────────────────────────────────────────────────────────────
  {
    id: 'polls',
    title: 'Polls',
    icon: BarChart3,
    topics: [
      {
        id: 'polls-overview',
        title: 'Polls Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Polls let you collect votes and feedback from board members on any topic. Create a poll with multiple options, send it to specific members or groups, and see results in real time.
            </p>
            <StepList steps={[
              'Click "New Poll" to create a poll.',
              'Enter a question and add your options (at least two).',
              'Choose who should receive the poll — individual members or entire groups.',
              'Optionally attach documents for context.',
              'Publish the poll to notify recipients by email.',
            ]} />
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              Results update in real time as members vote. You can see who has voted and who has not, and send reminders to those who have not responded.
            </p>
          </>
        ),
      },
    ],
  },

  // ── SETTINGS ────────────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    topics: [
      {
        id: 'settings-overview',
        title: 'Settings Overview',
        content: (
          <>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Settings page lets you manage your personal profile and account preferences.
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">What you can change:</h4>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Profile Photo</strong> — Upload or change your avatar. You can crop and reposition the image before saving.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Display Name</strong> — Your name as it appears throughout the portal.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Email</strong> — Your contact email address.
            </p>
            <p className="text-base text-gray-700 leading-relaxed mb-3">
              <strong>Password</strong> — Change your login password.
            </p>
            <Tip>Your avatar appears on meeting cards, project teams, task assignments, and anywhere your name is shown. Adding a photo helps other board members recognize you.</Tip>
          </>
        ),
      },
    ],
  },
];

// ── Main Component ────────────────────────────────────────────────────────────

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeTopic, setActiveTopic] = useState('dashboard-overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(helpSections.map(s => s.id));

  // Handle ?topic= query param from command palette links
  useEffect(() => {
    const topic = searchParams.get('topic');
    if (topic) {
      for (const section of helpSections) {
        const found = section.topics.find(t => t.id === topic);
        if (found) {
          setActiveSection(section.id);
          setActiveTopic(found.id);
          break;
        }
      }
    }
  }, [searchParams]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectTopic = (sectionId: string, topicId: string) => {
    setActiveSection(sectionId);
    setActiveTopic(topicId);
  };

  // Find active content
  const currentSection = helpSections.find(s => s.id === activeSection);
  const currentTopic = currentSection?.topics.find(t => t.id === activeTopic);

  // Search filtering
  const filteredSections = searchQuery
    ? helpSections.map(section => ({
        ...section,
        topics: section.topics.filter(topic =>
          topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(section => section.topics.length > 0)
    : helpSections;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-0px)]">
        {/* Left sidebar — section navigation */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Support & Training</h1>
                <p className="text-sm text-gray-500">Learn how to use the portal</p>
              </div>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Search help topics..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            {filteredSections.map(section => {
              const Icon = section.icon;
              const isExpanded = expandedSections.includes(section.id);
              return (
                <div key={section.id} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-semibold transition-colors ${
                      activeSection === section.id ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="flex-1">{section.title}</span>
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="ml-7 mt-0.5 space-y-0.5">
                      {section.topics.map(topic => (
                        <button
                          key={topic.id}
                          onClick={() => selectTopic(section.id, topic.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            activeTopic === topic.id
                              ? 'bg-primary text-white font-medium'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          {topic.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-10 py-10">
            {currentSection && currentTopic ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span>{currentSection.title}</span>
                  <ChevronRight size={14} />
                  <span className="text-gray-600">{currentTopic.title}</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-8">{currentTopic.title}</h2>
                <div className="prose-custom">
                  {currentTopic.content}
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">Select a topic</h2>
                <p className="text-gray-400">Choose a section from the sidebar to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Loading...</p></div></AppLayout>}>
      <SupportPageContent />
    </Suspense>
  );
}
