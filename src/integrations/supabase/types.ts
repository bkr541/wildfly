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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      airports: {
        Row: {
          iata_code: string
          icao_code: string | null
          id: number
          latitude: number | null
          location_id: number | null
          longitude: number | null
          name: string
          timezone: string | null
        }
        Insert: {
          iata_code: string
          icao_code?: string | null
          id?: number
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          name: string
          timezone?: string | null
        }
        Update: {
          iata_code?: string
          icao_code?: string | null
          id?: number
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          name?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_allowlist: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      developer_settings: {
        Row: {
          created_at: string
          debug_enabled: boolean
          enabled_component_logging: string[]
          flags: Json
          log_level: string
          logging_enabled: boolean
          show_raw_payload: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debug_enabled?: boolean
          enabled_component_logging?: string[]
          flags?: Json
          log_level?: string
          logging_enabled?: boolean
          show_raw_payload?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debug_enabled?: boolean
          enabled_component_logging?: string[]
          flags?: Json
          log_level?: string
          logging_enabled?: boolean
          show_raw_payload?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_search_cache: {
        Row: {
          arr_iata: string | null
          cache_key: string
          canonical_request: Json
          created_at: string
          dep_iata: string | null
          error: string | null
          id: string
          payload: Json | null
          provider: string
          reset_bucket: string
          status: string
          updated_at: string
        }
        Insert: {
          arr_iata?: string | null
          cache_key: string
          canonical_request: Json
          created_at?: string
          dep_iata?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          provider?: string
          reset_bucket: string
          status?: string
          updated_at?: string
        }
        Update: {
          arr_iata?: string | null
          cache_key?: string
          canonical_request?: Json
          created_at?: string
          dep_iata?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          provider?: string
          reset_bucket?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      flight_searches: {
        Row: {
          all_destinations: string
          arrival_airport: string | null
          arrival_airports_count: number | null
          credits_cost: number | null
          departure_airport: string
          departure_date: string
          id: string
          json_body: Json | null
          return_date: string | null
          search_timestamp: string
          trip_type: string
          user_id: string
        }
        Insert: {
          all_destinations?: string
          arrival_airport?: string | null
          arrival_airports_count?: number | null
          credits_cost?: number | null
          departure_airport: string
          departure_date: string
          id?: string
          json_body?: Json | null
          return_date?: string | null
          search_timestamp?: string
          trip_type: string
          user_id: string
        }
        Update: {
          all_destinations?: string
          arrival_airport?: string | null
          arrival_airports_count?: number | null
          credits_cost?: number | null
          departure_airport?: string
          departure_date?: string
          id?: string
          json_body?: Json | null
          return_date?: string | null
          search_timestamp?: string
          trip_type?: string
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string | null
          country: string | null
          edmtrain_locationid: number | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          state: string | null
          state_code: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          edmtrain_locationid?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          state?: string | null
          state_code?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          edmtrain_locationid?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          state?: string | null
          state_code?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          monthly_allowance_credits: number | null
          name: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          monthly_allowance_credits?: number | null
          name: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          monthly_allowance_credits?: number | null
          name?: string
        }
        Relationships: []
      }
      user_credit_wallet: {
        Row: {
          monthly_period_end: string
          monthly_period_start: string
          monthly_used: number
          purchased_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          monthly_period_end?: string
          monthly_period_start?: string
          monthly_used?: number
          purchased_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          monthly_period_end?: string
          monthly_period_start?: string
          monthly_used?: number
          purchased_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_flights: {
        Row: {
          arrival_airport: string
          arrival_time: string
          created_at: string
          departure_airport: string
          departure_time: string
          flight_json: Json
          id: string
          type: string
          user_id: string
        }
        Insert: {
          arrival_airport: string
          arrival_time: string
          created_at?: string
          departure_airport: string
          departure_time: string
          flight_json: Json
          id?: string
          type: string
          user_id: string
        }
        Update: {
          arrival_airport?: string
          arrival_time?: string
          created_at?: string
          departure_airport?: string
          departure_time?: string
          flight_json?: Json
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_info: {
        Row: {
          auth_user_id: string | null
          bio: string | null
          dob: string | null
          email: string
          first_name: string | null
          home_location_id: number | null
          id: number
          image_file: string
          last_name: string | null
          mobile_number: string | null
          onboarding_complete: string
          remember_me: boolean
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          bio?: string | null
          dob?: string | null
          email: string
          first_name?: string | null
          home_location_id?: number | null
          id?: number
          image_file: string
          last_name?: string | null
          mobile_number?: string | null
          onboarding_complete: string
          remember_me?: boolean
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          bio?: string | null
          dob?: string | null
          email?: string
          first_name?: string | null
          home_location_id?: number | null
          id?: number
          image_file?: string
          last_name?: string | null
          mobile_number?: string | null
          onboarding_complete?: string
          remember_me?: boolean
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_home_location_id_fkey"
            columns: ["home_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          location_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          notifications_enabled: boolean
          notify_gowild_availability: boolean
          notify_new_features: boolean
          notify_new_routes: boolean
          notify_pass_sales: boolean
          theme_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notifications_enabled?: boolean
          notify_gowild_availability?: boolean
          notify_new_features?: boolean
          notify_new_routes?: boolean
          notify_pass_sales?: boolean
          theme_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notifications_enabled?: boolean
          notify_gowild_availability?: boolean
          notify_new_features?: boolean
          notify_new_routes?: boolean
          notify_pass_sales?: boolean
          theme_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          current_period_end: string | null
          current_period_start: string | null
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          current_period_start?: string | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          current_period_start?: string | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_search_credits: {
        Args: {
          p_all_destinations: boolean
          p_arrival_airports_count: number
          p_trip_type: string
        }
        Returns: Json
      }
      is_owner_of_user_row: { Args: { _user_id: number }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
