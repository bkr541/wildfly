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
      artist_genres: {
        Row: {
          artist_id: number
          genre_id: number
        }
        Insert: {
          artist_id: number
          genre_id: number
        }
        Update: {
          artist_id?: number
          genre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "artist_genres_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          display_name: string
          edmtrain_id: number | null
          genres: string | null
          id: number
          image_url: string | null
          normalized_name: string
          spotify_id: string | null
        }
        Insert: {
          display_name: string
          edmtrain_id?: number | null
          genres?: string | null
          id?: number
          image_url?: string | null
          normalized_name: string
          spotify_id?: string | null
        }
        Update: {
          display_name?: string
          edmtrain_id?: number | null
          genres?: string | null
          id?: number
          image_url?: string | null
          normalized_name?: string
          spotify_id?: string | null
        }
        Relationships: []
      }
      genres: {
        Row: {
          energy: number | null
          genre_name: string
          id: number
          mood_tags: string | null
          parent_genre: string | null
        }
        Insert: {
          energy?: number | null
          genre_name: string
          id?: number
          mood_tags?: string | null
          parent_genre?: string | null
        }
        Update: {
          energy?: number | null
          genre_name?: string
          id?: number
          mood_tags?: string | null
          parent_genre?: string | null
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
      user_events: {
        Row: {
          edmtrain_event_id: number
          end_time: string | null
          id: number
          saved_at: string
          snapshot_json: Json | null
          start_time: string
          user_id: number
        }
        Insert: {
          edmtrain_event_id: number
          end_time?: string | null
          id?: number
          saved_at: string
          snapshot_json?: Json | null
          start_time: string
          user_id: number
        }
        Update: {
          edmtrain_event_id?: number
          end_time?: string | null
          id?: number
          saved_at?: string
          snapshot_json?: Json | null
          start_time?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_artists: {
        Row: {
          artist_id: number
          user_id: number
        }
        Insert: {
          artist_id: number
          user_id: number
        }
        Update: {
          artist_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_artists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_genres: {
        Row: {
          genre_id: number
          user_id: number
        }
        Insert: {
          genre_id: number
          user_id: number
        }
        Update: {
          genre_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_genres_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_locations: {
        Row: {
          location_id: number
          user_id: number
        }
        Insert: {
          location_id: number
          user_id: number
        }
        Update: {
          location_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flights: {
        Row: {
          airline: string | null
          cabin_class: string | null
          currency: string | null
          destination_iata: string
          duration_minutes: number | null
          end_time: string
          flight_key: string
          flight_number: string | null
          gowild_eligible: boolean | null
          id: number
          nonstop: boolean | null
          origin_iata: string
          price_total: number | null
          provider: string | null
          provider_offer_id: string | null
          saved_at: string
          seats_remaining: number | null
          snapshot_json: Json
          snapshot_updated_at: string | null
          start_time: string
          stops: number | null
          trip_type: string | null
          user_id: number
        }
        Insert: {
          airline?: string | null
          cabin_class?: string | null
          currency?: string | null
          destination_iata: string
          duration_minutes?: number | null
          end_time: string
          flight_key: string
          flight_number?: string | null
          gowild_eligible?: boolean | null
          id?: number
          nonstop?: boolean | null
          origin_iata: string
          price_total?: number | null
          provider?: string | null
          provider_offer_id?: string | null
          saved_at: string
          seats_remaining?: number | null
          snapshot_json: Json
          snapshot_updated_at?: string | null
          start_time: string
          stops?: number | null
          trip_type?: string | null
          user_id: number
        }
        Update: {
          airline?: string | null
          cabin_class?: string | null
          currency?: string | null
          destination_iata?: string
          duration_minutes?: number | null
          end_time?: string
          flight_key?: string
          flight_number?: string | null
          gowild_eligible?: boolean | null
          id?: number
          nonstop?: boolean | null
          origin_iata?: string
          price_total?: number | null
          provider?: string | null
          provider_offer_id?: string | null
          saved_at?: string
          seats_remaining?: number | null
          snapshot_json?: Json
          snapshot_updated_at?: string | null
          start_time?: string
          stops?: number | null
          trip_type?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_flights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bio: string | null
          dob: string | null
          email: string
          first_name: string | null
          home_location_id: number | null
          id: number
          image_file: string
          last_name: string | null
          onboarding_complete: string
          password: string
          username: string | null
        }
        Insert: {
          bio?: string | null
          dob?: string | null
          email: string
          first_name?: string | null
          home_location_id?: number | null
          id?: number
          image_file: string
          last_name?: string | null
          onboarding_complete: string
          password: string
          username?: string | null
        }
        Update: {
          bio?: string | null
          dob?: string | null
          email?: string
          first_name?: string | null
          home_location_id?: number | null
          id?: number
          image_file?: string
          last_name?: string | null
          onboarding_complete?: string
          password?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
