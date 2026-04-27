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
      attendance_records: {
        Row: {
          absence_type: string | null
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          clock_in_at: string | null
          clock_out_at: string | null
          created_at: string
          employee_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          work_date: string
          workplace_id: string
        }
        Insert: {
          absence_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          work_date: string
          workplace_id: string
        }
        Update: {
          absence_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          work_date?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      break_records: {
        Row: {
          attendance_record_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at: string
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_records_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_rules: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          effective_until: string | null
          id: string
          note: string | null
          rules: Json
          tenant_id: string
          version: number
          workplace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          effective_until?: string | null
          id?: string
          note?: string | null
          rules: Json
          tenant_id: string
          version: number
          workplace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          note?: string | null
          rules?: Json
          tenant_id?: string
          version?: number
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_rules_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          deleted_at: string | null
          department: string | null
          employee_code: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          first_name_kana: string | null
          hired_at: string
          id: string
          is_active: boolean
          last_name: string
          last_name_kana: string | null
          metadata: Json
          position: string | null
          punch_token: string
          tenant_id: string
          terminated_at: string | null
          updated_at: string
          workplace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          employee_code: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          first_name_kana?: string | null
          hired_at: string
          id?: string
          is_active?: boolean
          last_name: string
          last_name_kana?: string | null
          metadata?: Json
          position?: string | null
          punch_token: string
          tenant_id: string
          terminated_at?: string | null
          updated_at?: string
          workplace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          employee_code?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          first_name_kana?: string | null
          hired_at?: string
          id?: string
          is_active?: boolean
          last_name?: string
          last_name_kana?: string | null
          metadata?: Json
          position?: string | null
          punch_token?: string
          tenant_id?: string
          terminated_at?: string | null
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      modification_requests: {
        Row: {
          after_value: Json
          attendance_record_id: string
          before_value: Json
          created_at: string
          id: string
          reason: string
          request_type: string
          requested_by: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          tenant_id: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          after_value: Json
          attendance_record_id: string
          before_value: Json
          created_at?: string
          id?: string
          reason: string
          request_type: string
          requested_by: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          after_value?: Json
          attendance_record_id?: string
          before_value?: Json
          created_at?: string
          id?: string
          reason?: string
          request_type?: string
          requested_by?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modification_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_requests_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_results: {
        Row: {
          absence_days: number
          alerts: Json
          created_at: string
          details: Json | null
          early_leave_minutes: number
          employee_id: string
          holiday_company_minutes: number
          holiday_legal_minutes: number
          id: string
          late_minutes: number
          night_work_minutes: number
          over_60h_minutes: number
          overtime_legal_minutes: number
          overtime_statutory_minutes: number
          paid_leave_days: number
          payroll_run_id: string
          regular_work_minutes: number
          total_work_minutes: number
        }
        Insert: {
          absence_days?: number
          alerts?: Json
          created_at?: string
          details?: Json | null
          early_leave_minutes?: number
          employee_id: string
          holiday_company_minutes?: number
          holiday_legal_minutes?: number
          id?: string
          late_minutes?: number
          night_work_minutes?: number
          over_60h_minutes?: number
          overtime_legal_minutes?: number
          overtime_statutory_minutes?: number
          paid_leave_days?: number
          payroll_run_id: string
          regular_work_minutes?: number
          total_work_minutes?: number
        }
        Update: {
          absence_days?: number
          alerts?: Json
          created_at?: string
          details?: Json | null
          early_leave_minutes?: number
          employee_id?: string
          holiday_company_minutes?: number
          holiday_legal_minutes?: number
          id?: string
          late_minutes?: number
          night_work_minutes?: number
          over_60h_minutes?: number
          overtime_legal_minutes?: number
          overtime_statutory_minutes?: number
          paid_leave_days?: number
          payroll_run_id?: string
          regular_work_minutes?: number
          total_work_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_results_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_results_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          calculated_at: string | null
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          rules_version: number
          status: Database["public"]["Enums"]["payroll_status"]
          summary: Json | null
          target_month: string
          tenant_id: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          calculated_at?: string | null
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          rules_version: number
          status?: Database["public"]["Enums"]["payroll_status"]
          summary?: Json | null
          target_month: string
          tenant_id: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          calculated_at?: string | null
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          rules_version?: number
          status?: Database["public"]["Enums"]["payroll_status"]
          summary?: Json | null
          target_month?: string
          tenant_id?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_name: string
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          display_name: string
          email: string
          employee_id: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          employee_id?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workplaces: {
        Row: {
          bpo_plan: string
          contract_end: string | null
          contract_start: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          settings: Json
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bpo_plan?: string
          contract_end?: string | null
          contract_start: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bpo_plan?: string
          contract_end?: string | null
          contract_start?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_status:
        | "draft"
        | "submitted"
        | "approved"
        | "locked"
        | "finalized"
      employment_type:
        | "regular"
        | "contract"
        | "part_time"
        | "arubaito"
        | "outsourcing"
      payroll_status:
        | "draft"
        | "calculated"
        | "reviewing"
        | "finalized"
        | "exported"
      request_status: "pending" | "approved" | "rejected" | "cancelled"
      user_role: "shacho" | "workplace_admin" | "employee" | "bizpla_bpo"
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
      attendance_status: [
        "draft",
        "submitted",
        "approved",
        "locked",
        "finalized",
      ],
      employment_type: [
        "regular",
        "contract",
        "part_time",
        "arubaito",
        "outsourcing",
      ],
      payroll_status: [
        "draft",
        "calculated",
        "reviewing",
        "finalized",
        "exported",
      ],
      request_status: ["pending", "approved", "rejected", "cancelled"],
      user_role: ["shacho", "workplace_admin", "employee", "bizpla_bpo"],
    },
  },
} as const
