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
          is_hub: boolean
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
          is_hub?: boolean
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
          is_hub?: boolean
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
      credit_packs: {
        Row: {
          created_at: string
          credits_amount: number
          display_order: number
          id: string
          is_active: boolean
          name: string
          price_usd: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          credits_amount: number
          display_order?: number
          id: string
          is_active?: boolean
          name: string
          price_usd?: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          credits_amount?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price_usd?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          bucket: string
          created_at: string
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          bucket: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          bucket?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
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
          enabled_debug_components: string[]
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
          enabled_debug_components?: string[]
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
          enabled_debug_components?: string[]
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
          flight_results_count: number | null
          gowild_found: boolean | null
          id: string
          json_body: Json | null
          request_body: Json | null
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
          flight_results_count?: number | null
          gowild_found?: boolean | null
          id?: string
          json_body?: Json | null
          request_body?: Json | null
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
          flight_results_count?: number | null
          gowild_found?: boolean | null
          id?: string
          json_body?: Json | null
          request_body?: Json | null
          return_date?: string | null
          search_timestamp?: string
          trip_type?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          recipient_user_id: string
          requester_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_user_id: string
          requester_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_user_id?: string
          requester_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_user_id: string
          id: string
          source_request_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_user_id: string
          id?: string
          source_request_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          friend_user_id?: string
          id?: string
          source_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "friend_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "pending_friend_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      gowild_snapshots: {
        Row: {
          destination_iata: string
          gowild_avalseats: number | null
          gowild_flights: number
          id: number
          min_fare: number | null
          min_gowild_fare: number | null
          nonstop_gowild: number
          nonstop_total: number
          observed_at: string
          observed_date: string
          origin_iata: string
          raw_response: Json
          total_flights: number
          travel_date: string
        }
        Insert: {
          destination_iata: string
          gowild_avalseats?: number | null
          gowild_flights: number
          id?: number
          min_fare?: number | null
          min_gowild_fare?: number | null
          nonstop_gowild: number
          nonstop_total: number
          observed_at?: string
          observed_date?: string
          origin_iata: string
          raw_response: Json
          total_flights: number
          travel_date: string
        }
        Update: {
          destination_iata?: string
          gowild_avalseats?: number | null
          gowild_flights?: number
          id?: number
          min_fare?: number | null
          min_gowild_fare?: number | null
          nonstop_gowild?: number
          nonstop_total?: number
          observed_at?: string
          observed_date?: string
          origin_iata?: string
          raw_response?: Json
          total_flights?: number
          travel_date?: string
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          monthly_allowance_credits: number | null
          name: string
          stripe_price_id: string | null
        }
        Insert: {
          billing_period?: string
          created_at?: string
          features?: Json
          id: string
          is_active?: boolean
          monthly_allowance_credits?: number | null
          name: string
          stripe_price_id?: string | null
        }
        Update: {
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          monthly_allowance_credits?: number | null
          name?: string
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      route_favorites: {
        Row: {
          created_at: string
          dest_iata: string
          id: string
          origin_iata: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dest_iata: string
          id?: string
          origin_iata: string
          user_id: string
        }
        Update: {
          created_at?: string
          dest_iata?: string
          id?: string
          origin_iata?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_shares: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          shared_with_user_id: string
          status: string
          user_flight_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          shared_with_user_id: string
          status?: string
          user_flight_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          shared_with_user_id?: string
          status?: string
          user_flight_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_user_flight_id_fkey"
            columns: ["user_flight_id"]
            isOneToOne: false
            referencedRelation: "user_flights"
            referencedColumns: ["id"]
          },
        ]
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
      user_homepage: {
        Row: {
          component_name: string
          created_at: string
          id: string
          order: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          component_name: string
          created_at?: string
          id?: string
          order: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          component_name?: string
          created_at?: string
          id?: string
          order?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_info: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          dob: string | null
          email: string
          first_name: string | null
          home_airport: string | null
          home_city: string | null
          home_location_id: number | null
          id: number
          image_file: string
          is_discoverable: boolean
          last_name: string | null
          mobile_number: string | null
          onboarding_complete: string
          remember_me: boolean
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          dob?: string | null
          email: string
          first_name?: string | null
          home_airport?: string | null
          home_city?: string | null
          home_location_id?: number | null
          id?: number
          image_file: string
          is_discoverable?: boolean
          last_name?: string | null
          mobile_number?: string | null
          onboarding_complete: string
          remember_me?: boolean
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          dob?: string | null
          email?: string
          first_name?: string | null
          home_airport?: string | null
          home_city?: string | null
          home_location_id?: number | null
          id?: number
          image_file?: string
          is_discoverable?: boolean
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
          allow_friend_requests: boolean
          created_at: string
          default_departure_to_home: boolean
          notifications_enabled: boolean
          notify_gowild_availability: boolean
          notify_new_features: boolean
          notify_new_routes: boolean
          notify_pass_sales: boolean
          show_activity_feed_to_friends: boolean
          show_home_city_to_friends: boolean
          show_trip_overlap_alerts: boolean
          show_upcoming_trips_to_friends: boolean
          theme_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_friend_requests?: boolean
          created_at?: string
          default_departure_to_home?: boolean
          notifications_enabled?: boolean
          notify_gowild_availability?: boolean
          notify_new_features?: boolean
          notify_new_routes?: boolean
          notify_pass_sales?: boolean
          show_activity_feed_to_friends?: boolean
          show_home_city_to_friends?: boolean
          show_trip_overlap_alerts?: boolean
          show_upcoming_trips_to_friends?: boolean
          theme_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_friend_requests?: boolean
          created_at?: string
          default_departure_to_home?: boolean
          notifications_enabled?: boolean
          notify_gowild_availability?: boolean
          notify_new_features?: boolean
          notify_new_routes?: boolean
          notify_pass_sales?: boolean
          show_activity_feed_to_friends?: boolean
          show_home_city_to_friends?: boolean
          show_trip_overlap_alerts?: boolean
          show_upcoming_trips_to_friends?: boolean
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
      friends_with_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          friend_user_id: string | null
          home_airport: string | null
          home_city: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      pending_friend_requests: {
        Row: {
          created_at: string | null
          id: string | null
          recipient_user_id: string | null
          requester_avatar: string | null
          requester_user_id: string | null
          requester_username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_friend_request: { Args: { request_id: string }; Returns: Json }
      are_friends: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      consume_search_credits:
        | {
            Args: {
              p_all_destinations: boolean
              p_arrival_airports_count: number
              p_trip_type: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_all_destinations: boolean
              p_arrival_airports_count: number
              p_source_id?: string
              p_trip_type: string
            }
            Returns: Json
          }
      is_owner_of_user_row: { Args: { _user_id: number }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
