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
        }
        Update: {
          full_name?: string
          role?: 'admin' | 'president' | 'secretary' | 'treasurer' | 'member'
          title?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
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
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>
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
