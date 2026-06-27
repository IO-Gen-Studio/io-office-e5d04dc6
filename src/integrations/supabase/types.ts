export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          module: Database["public"]["Enums"]["app_module"]
          summary: string
          tenant_id: string
          verb: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          module: Database["public"]["Enums"]["app_module"]
          summary: string
          tenant_id?: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["app_module"]
          summary?: string
          tenant_id?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      builtin_field_labels: {
        Row: {
          created_at: string
          field_key: string
          id: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          position: number
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          field_key: string
          id?: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          position?: number
          tenant_id?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          field_key?: string
          id?: string
          label?: string
          module?: Database["public"]["Enums"]["app_module"]
          position?: number
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "builtin_field_labels_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          created_at: string
          custom: Json
          email: string | null
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          last_name: string
          lead_status: string
          notes: string | null
          organisation: string | null
          outreach: Json
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string
          lead_status?: string
          notes?: string | null
          organisation?: string | null
          outreach?: Json
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string
          lead_status?: string
          notes?: string | null
          organisation?: string | null
          outreach?: Json
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          campaign_id: string
          template_id: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          template_id: string
          tenant_id?: string
        }
        Update: {
          campaign_id?: string
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          stages: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          stages?: Json
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          stages?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          custom: Json
          email: string | null
          first_name: string
          id: string
          is_lead: boolean
          job_title: string | null
          last_name: string
          notes: string | null
          organisation_id: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          is_lead?: boolean
          job_title?: string | null
          last_name?: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          is_lead?: boolean
          job_title?: string | null
          last_name?: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_items: {
        Row: {
          created_at: string
          description: string
          final_cost: number
          id: string
          item_no: string | null
          position: number
          quantity: number
          supplier_cost: number
          version_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          final_cost?: number
          id?: string
          item_no?: string | null
          position?: number
          quantity?: number
          supplier_cost?: number
          version_id: string
        }
        Update: {
          created_at?: string
          description?: string
          final_cost?: number
          id?: string
          item_no?: string | null
          position?: number
          quantity?: number
          supplier_cost?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "cost_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_proposal_settings: {
        Row: {
          conditions_project: string[]
          conditions_subscription: string[]
          conditions_work: string[]
          template_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conditions_project?: string[]
          conditions_subscription?: string[]
          conditions_work?: string[]
          template_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conditions_project?: string[]
          conditions_subscription?: string[]
          conditions_work?: string[]
          template_path?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_proposal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          label: string | null
          parent_id: string
          parent_type: string
          tenant_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          parent_id: string
          parent_type: string
          tenant_id?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          parent_id?: string
          parent_type?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_versions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          options: Json
          position: number
          tenant_id: string
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          options?: Json
          position?: number
          tenant_id?: string
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          module?: Database["public"]["Enums"]["app_module"]
          options?: Json
          position?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["custom_field_type"]
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          approved: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          event_date: string
          event_type: string | null
          id: string
          location: string | null
          start_time: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          location?: string | null
          start_time?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          location?: string | null
          start_time?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          expiry_ts: string
          id: string
          refresh_token: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          expiry_ts: string
          id?: string
          refresh_token: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          expiry_ts?: string
          id?: string
          refresh_token?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_column_defs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_builtin: boolean
          key: string
          label: string
          options: Json
          position: number
          tenant_id: string
          type: Database["public"]["Enums"]["custom_field_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          key: string
          label: string
          options?: Json
          position?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          key?: string
          label?: string
          options?: Json
          position?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_column_defs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          custom: Json
          id: string
          issue_date: string | null
          issue_number: number
          owner: string | null
          owner_id: string | null
          priority: string | null
          status: string
          task: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          issue_date?: string | null
          issue_number: number
          owner?: string | null
          owner_id?: string | null
          priority?: string | null
          status?: string
          task: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          issue_date?: string | null
          issue_number?: number
          owner?: string | null
          owner_id?: string | null
          priority?: string | null
          status?: string
          task?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_options: {
        Row: {
          id: string
          is_default: boolean
          key: string
          label: string
          position: number
          tenant_id: string
        }
        Insert: {
          id?: string
          is_default?: boolean
          key: string
          label: string
          position?: number
          tenant_id?: string
        }
        Update: {
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_options_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_templates: {
        Row: {
          id: string
          label: string
          module: string
          position: number
          project_type: string | null
          tenant_id: string
        }
        Insert: {
          id?: string
          label: string
          module?: string
          position?: number
          project_type?: string | null
          tenant_id?: string
        }
        Update: {
          id?: string
          label?: string
          module?: string
          position?: number
          project_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_templates_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_custom: boolean
          label: string
          parent_id: string | null
          parent_type: string
          position: number
          project_id: string | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_custom?: boolean
          label: string
          parent_id?: string | null
          parent_type?: string
          position?: number
          project_id?: string | null
          tenant_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_custom?: boolean
          label?: string
          parent_id?: string | null
          parent_type?: string
          position?: number
          project_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          module: Database["public"]["Enums"]["app_module"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_access_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          tenant_id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string | null
          custom: Json
          id: string
          industry: string | null
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisations_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_status_options: {
        Row: {
          id: string
          key: string
          label: string
          position: number
          tenant_id: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          position?: number
          tenant_id?: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_status_options_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          active_tenant_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          job_title?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          business_cost: number
          client_contact_id: string | null
          client_org_id: string | null
          created_at: string
          created_by: string | null
          custom: Json
          description: string | null
          end_date: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supplier_cost: number
          team_lead_id: string | null
          tenant_id: string
          title: string
          total_cost: number
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          business_cost?: number
          client_contact_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supplier_cost?: number
          team_lead_id?: string | null
          tenant_id?: string
          title: string
          total_cost?: number
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          business_cost?: number
          client_contact_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supplier_cost?: number
          team_lead_id?: string | null
          tenant_id?: string
          title?: string
          total_cost?: number
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_plans: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approvers: string[]
          copy: string
          created_at: string
          created_by: string | null
          custom: Json
          id: string
          media_path: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_status: Database["public"]["Enums"]["post_status"]
          scheduled_at: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approvers?: string[]
          copy?: string
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          media_path?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_status?: Database["public"]["Enums"]["post_status"]
          scheduled_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approvers?: string[]
          copy?: string
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          media_path?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          post_status?: Database["public"]["Enums"]["post_status"]
          scheduled_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_plans_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_options: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_options_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          client_contact_id: string | null
          client_org_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          custom: Json
          description: string | null
          id: string
          plan_name: string
          project_id: string | null
          renewal_date: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          client_contact_id?: string | null
          client_org_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          id?: string
          plan_name: string
          project_id?: string | null
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          client_contact_id?: string | null
          client_org_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          id?: string
          plan_name?: string
          project_id?: string | null
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          parent_id: string
          parent_type: string
          position: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          parent_id: string
          parent_type: string
          position?: number
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          parent_id?: string
          parent_type?: string
          position?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_module: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      cost_version_in_current_tenant: {
        Args: { _version_id: string }
        Returns: boolean
      }
      current_tenant_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_active: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_owner: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _module: Database["public"]["Enums"]["app_module"]
          _summary: string
          _verb: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      profile_active_tenant_id: { Args: { _user_id: string }; Returns: string }
      profile_must_change_password: {
        Args: { _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_issue_columns_for_tenant: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      set_active_tenant: { Args: { _tenant_id: string }; Returns: undefined }
    }
    Enums: {
      app_module:
        | "dashboard"
        | "crm"
        | "outreach"
        | "social"
        | "projects"
        | "subscriptions"
        | "calendar"
        | "settings"
        | "issues"
      app_role: "admin" | "member"
      approval_status: "approved" | "not_approved" | "for_approval"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "dropdown"
        | "checklist"
        | "long_text"
        | "checkbox"
        | "attachment"
        | "reference"
      post_status: "posted" | "not_posted" | "cancelled"
      priority_level: "low" | "medium" | "high"
      project_status: "in_progress" | "on_hold" | "cancelled" | "completed"
      project_type: "project" | "work"
      social_platform:
        | "linkedin"
        | "instagram"
        | "x"
        | "threads"
        | "facebook"
        | "tiktok"
        | "youtube"
        | "eventbrite"
      subscription_status:
        | "active"
        | "paused"
        | "cancelled"
        | "past_due"
        | "pending_renewal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: [
        "dashboard",
        "crm",
        "outreach",
        "social",
        "projects",
        "subscriptions",
        "calendar",
        "settings",
        "issues",
      ],
      app_role: ["admin", "member"],
      approval_status: ["approved", "not_approved", "for_approval"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "dropdown",
        "checklist",
        "long_text",
        "checkbox",
        "attachment",
        "reference",
      ],
      post_status: ["posted", "not_posted", "cancelled"],
      priority_level: ["low", "medium", "high"],
      project_status: ["in_progress", "on_hold", "cancelled", "completed"],
      project_type: ["project", "work"],
      social_platform: [
        "linkedin",
        "instagram",
        "x",
        "threads",
        "facebook",
        "tiktok",
        "youtube",
        "eventbrite",
      ],
      subscription_status: [
        "active",
        "paused",
        "cancelled",
        "past_due",
        "pending_renewal",
      ],
    },
  },
} as const
