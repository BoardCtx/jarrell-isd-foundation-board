export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'president' | 'secretary' | 'treasurer' | 'member'
          title: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          time_zone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'president' | 'secretary' | 'treasurer' | 'member'
          title?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          time_zone?: string | null
        }
        Update: {
          full_name?: string
          role?: 'admin' | 'president' | 'secretary' | 'treasurer' | 'member'
          title?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          time_zone?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
          category: string | null
          budget_goal: number
          amount_raised: number
          start_date: string | null
          end_date: string | null
          lead_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'review' | 'done'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          project_id: string | null
          assignee_id: string | null
          due_date: string | null
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      budget_items: {
        Row: {
          id: string
          type: 'donation' | 'grant' | 'expense' | 'transfer'
          description: string
          amount: number
          project_id: string | null
          donor_name: string | null
          date: string
          category: string | null
          notes: string | null
          receipt_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['budget_items']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['budget_items']['Insert']>
      }
      meetings: {
        Row: {
          id: string
          title: string
          type: 'regular' | 'special' | 'annual' | 'committee'
          date: string
          time: string | null
          location: string | null
          virtual_link: string | null
          status: 'scheduled' | 'completed' | 'cancelled'
          agenda: string | null
          agenda_published: boolean
          minutes: string | null
          minutes_published: boolean
          attendees: string[] | null
          time_zone: string | null
          public_token: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>
      }
      meeting_attendees: {
        Row: {
          id: string
          meeting_id: string
          profile_id: string
          attendance_type: 'required' | 'optional'
          notified_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['meeting_attendees']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['meeting_attendees']['Insert']>
      }
      documents: {
        Row: {
          id: string
          title: string
          description: string | null
          category: 'agenda' | 'minutes' | 'financial' | 'policy' | 'grant' | 'general' | 'other'
          file_path: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          project_id: string | null
          meeting_id: string | null
          folder_id: string | null
          is_public: boolean
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      agenda_sections: {
        Row: {
          id: string
          meeting_id: string
          title: string
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['agenda_sections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agenda_sections']['Insert']>
      }
      agenda_items: {
        Row: {
          id: string
          section_id: string
          title: string
          description: string | null
          duration_minutes: number | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['agenda_items']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agenda_items']['Insert']>
      }
      agenda_sub_items: {
        Row: {
          id: string
          item_id: string
          title: string
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['agenda_sub_items']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agenda_sub_items']['Insert']>
      }
      agenda_document_links: {
        Row: {
          id: string
          document_id: string
          entity_type: 'section' | 'item' | 'sub_item'
          entity_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['agenda_document_links']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['agenda_document_links']['Insert']>
      }
      document_folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          icon: string
          color: string
          is_system: boolean
          meeting_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['document_folders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['document_folders']['Insert']>
      }
      document_folder_links: {
        Row: {
          id: string
          document_id: string
          folder_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['document_folder_links']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['document_folder_links']['Insert']>
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          profile_id: string
          added_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['group_members']['Insert']>
      }
      polls: {
        Row: {
          id: string
          title: string
          description: string | null
          allow_multiple: boolean
          status: 'active' | 'closed'
          created_by: string
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['polls']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['polls']['Insert']>
      }
      poll_options: {
        Row: {
          id: string
          poll_id: string
          label: string
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['poll_options']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['poll_options']['Insert']>
      }
      poll_document_links: {
        Row: {
          id: string
          poll_id: string
          document_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['poll_document_links']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['poll_document_links']['Insert']>
      }
      poll_recipients: {
        Row: {
          id: string
          poll_id: string
          profile_id: string
          notified_at: string | null
          reminded_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['poll_recipients']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['poll_recipients']['Insert']>
      }
      poll_votes: {
        Row: {
          id: string
          poll_id: string
          option_id: string
          voter_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['poll_votes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['poll_votes']['Insert']>
      }
      task_assignees: {
        Row: {
          id: string
          task_id: string
          profile_id: string
          assigned_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_assignees']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['task_assignees']['Insert']>
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_comments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['task_comments']['Insert']>
      }
      task_documents: {
        Row: {
          id: string
          task_id: string
          uploaded_by: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['task_documents']['Insert']>
      }
      grant_applicants: {
        Row: {
          id: string
          email: string
          full_name: string
          organization: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_applicants']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['grant_applicants']['Insert']>
      }
      grant_applications: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'draft' | 'open' | 'closed' | 'scoring' | 'decided' | 'awarded' | 'archived'
          form_schema: Json
          scoring_schema: Json | null
          deadline: string | null
          followup_open: boolean
          followup_deadline: string | null
          show_decisions_to_applicants: boolean
          max_award_amount: number | null
          created_by: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_applications']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['grant_applications']['Insert']>
      }
      grant_requests: {
        Row: {
          id: string
          application_id: string
          applicant_id: string
          form_data: Json
          status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'partial_funding' | 'awarded'
          decision_visible: boolean
          awarded_amount: number | null
          submitted_at: string | null
          decided_at: string | null
          decided_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['grant_requests']['Insert']>
      }
      grant_request_files: {
        Row: {
          id: string
          request_id: string
          field_id: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_request_files']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['grant_request_files']['Insert']>
      }
      grant_scores: {
        Row: {
          id: string
          request_id: string
          application_id: string
          scorer_id: string
          score_data: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_scores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['grant_scores']['Insert']>
      }
      grant_followups: {
        Row: {
          id: string
          request_id: string
          applicant_id: string
          report_data: Json
          status: 'draft' | 'submitted'
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_followups']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['grant_followups']['Insert']>
      }
      grant_followup_files: {
        Row: {
          id: string
          followup_id: string
          field_id: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_followup_files']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['grant_followup_files']['Insert']>
      }
      grant_notifications: {
        Row: {
          id: string
          application_id: string | null
          notification_type: 'scoring_ready' | 'decision_made' | 'followup_open' | 'followup_reminder' | 'application_open' | 'application_closing'
          sent_to: string[]
          sent_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['grant_notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['grant_notifications']['Insert']>
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type BudgetItem = Database['public']['Tables']['budget_items']['Row']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type AgendaSection = Database['public']['Tables']['agenda_sections']['Row']
export type AgendaItem = Database['public']['Tables']['agenda_items']['Row']
export type AgendaSubItem = Database['public']['Tables']['agenda_sub_items']['Row']
export type AgendaDocumentLink = Database['public']['Tables']['agenda_document_links']['Row']
export type DocumentFolder = Database['public']['Tables']['document_folders']['Row']
export type DocumentFolderLink = Database['public']['Tables']['document_folder_links']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Poll = Database['public']['Tables']['polls']['Row']
export type PollOption = Database['public']['Tables']['poll_options']['Row']
export type PollDocumentLink = Database['public']['Tables']['poll_document_links']['Row']
export type PollRecipient = Database['public']['Tables']['poll_recipients']['Row']
export type PollVote = Database['public']['Tables']['poll_votes']['Row']
export type MeetingAttendee = Database['public']['Tables']['meeting_attendees']['Row']
export type TaskAssignee = Database['public']['Tables']['task_assignees']['Row']
export type TaskComment = Database['public']['Tables']['task_comments']['Row']
export type TaskDocument = Database['public']['Tables']['task_documents']['Row']
export type GrantApplicant = Database['public']['Tables']['grant_applicants']['Row']
export type GrantApplication = Database['public']['Tables']['grant_applications']['Row']
export type GrantRequest = Database['public']['Tables']['grant_requests']['Row']
export type GrantRequestFile = Database['public']['Tables']['grant_request_files']['Row']
export type GrantScore = Database['public']['Tables']['grant_scores']['Row']
export type GrantFollowup = Database['public']['Tables']['grant_followups']['Row']
export type GrantFollowupFile = Database['public']['Tables']['grant_followup_files']['Row']
export type GrantNotification = Database['public']['Tables']['grant_notifications']['Row']
