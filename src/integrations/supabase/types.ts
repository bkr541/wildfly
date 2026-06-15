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
          frontier_image_url: string | null
          frontier_last_seen_at: string | null
          frontier_source: string | null
          iata_code: string
          icao_code: string | null
          id: number
          is_active: boolean
          is_hub: boolean
          latitude: number | null
          location_id: number | null
          longitude: number | null
          metadata_status: string
          name: string
          timezone: string | null
        }
        Insert: {
          frontier_image_url?: string | null
          frontier_last_seen_at?: string | null
          frontier_source?: string | null
          iata_code: string
          icao_code?: string | null
          id?: number
          is_active?: boolean
          is_hub?: boolean
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          metadata_status?: string
          name: string
          timezone?: string | null
        }
        Update: {
          frontier_image_url?: string | null
          frontier_last_seen_at?: string | null
          frontier_source?: string | null
          iata_code?: string
          icao_code?: string | null
          id?: number
          is_active?: boolean
          is_hub?: boolean
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          metadata_status?: string
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
      announcement_views: {
        Row: {
          announcement_id: string
          dismissed_at: string | null
          id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string | null
          id?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string | null
          id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_published: boolean
          priority: number
          publish_at: string | null
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          priority?: number
          publish_at?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          priority?: number
          publish_at?: string | null
          title?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config_key: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beta_applications: {
        Row: {
          additional_notes: string | null
          auth_user_id: string | null
          beta_testing_details: string | null
          beta_testing_experience: string
          created_at: string
          email: string
          feedback_commitment: boolean
          frequent_destinations: string | null
          frontier_flight_frequency: string
          full_name: string
          gowild_pass_duration: string | null
          gowild_search_frequency: string
          gowild_search_tool_name: string | null
          gowild_status: string
          home_airport: string
          id: string
          interested_features: string[]
          internal_notes: string | null
          invited_at: string | null
          normalized_email: string | null
          preferred_feedback_method: string | null
          primary_device: string
          provisioned_at: string | null
          referrer: string | null
          selected_at: string | null
          source: string
          status: string
          updated_at: string
          uses_gowild_search_tool: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          value_expectation: string | null
          welcome_delivery_status: string
          welcome_last_error: string | null
          welcome_message_id: string | null
          welcome_sent_at: string | null
        }
        Insert: {
          additional_notes?: string | null
          auth_user_id?: string | null
          beta_testing_details?: string | null
          beta_testing_experience: string
          created_at?: string
          email: string
          feedback_commitment?: boolean
          frequent_destinations?: string | null
          frontier_flight_frequency: string
          full_name: string
          gowild_pass_duration?: string | null
          gowild_search_frequency: string
          gowild_search_tool_name?: string | null
          gowild_status: string
          home_airport: string
          id?: string
          interested_features?: string[]
          internal_notes?: string | null
          invited_at?: string | null
          normalized_email?: string | null
          preferred_feedback_method?: string | null
          primary_device: string
          provisioned_at?: string | null
          referrer?: string | null
          selected_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          uses_gowild_search_tool: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_expectation?: string | null
          welcome_delivery_status?: string
          welcome_last_error?: string | null
          welcome_message_id?: string | null
          welcome_sent_at?: string | null
        }
        Update: {
          additional_notes?: string | null
          auth_user_id?: string | null
          beta_testing_details?: string | null
          beta_testing_experience?: string
          created_at?: string
          email?: string
          feedback_commitment?: boolean
          frequent_destinations?: string | null
          frontier_flight_frequency?: string
          full_name?: string
          gowild_pass_duration?: string | null
          gowild_search_frequency?: string
          gowild_search_tool_name?: string | null
          gowild_status?: string
          home_airport?: string
          id?: string
          interested_features?: string[]
          internal_notes?: string | null
          invited_at?: string | null
          normalized_email?: string | null
          preferred_feedback_method?: string | null
          primary_device?: string
          provisioned_at?: string | null
          referrer?: string | null
          selected_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          uses_gowild_search_tool?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_expectation?: string | null
          welcome_delivery_status?: string
          welcome_last_error?: string | null
          welcome_message_id?: string | null
          welcome_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_applications_welcome_message_id_fkey"
            columns: ["welcome_message_id"]
            isOneToOne: false
            referencedRelation: "messaging_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_search_job_logs: {
        Row: {
          airports_failed: number
          airports_succeeded: number
          airports_total: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          gowild_found_count: number
          id: string
          started_at: string
          status: string
          target_date: string
          timezone_group: string
          triggered_by: string
        }
        Insert: {
          airports_failed?: number
          airports_succeeded?: number
          airports_total?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          gowild_found_count?: number
          id?: string
          started_at?: string
          status: string
          target_date: string
          timezone_group: string
          triggered_by?: string
        }
        Update: {
          airports_failed?: number
          airports_succeeded?: number
          airports_total?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          gowild_found_count?: number
          id?: string
          started_at?: string
          status?: string
          target_date?: string
          timezone_group?: string
          triggered_by?: string
        }
        Relationships: []
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
          provider_observed_at: string | null
          request_body: Json | null
          result_source: string | null
          return_date: string | null
          search_timestamp: string
          triggered_by: string | null
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
          provider_observed_at?: string | null
          request_body?: Json | null
          result_source?: string | null
          return_date?: string | null
          search_timestamp?: string
          triggered_by?: string | null
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
          provider_observed_at?: string | null
          request_body?: Json | null
          result_source?: string | null
          return_date?: string | null
          search_timestamp?: string
          triggered_by?: string | null
          trip_type?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_snapshots: {
        Row: {
          airline: string | null
          arrival_at: string
          availability_status: string
          currency: string | null
          departure_at: string
          discount_den_available_seats: number | null
          discount_den_fare_status: number | null
          discount_den_loyalty_points: number | null
          discount_den_total: number | null
          display_cabin: string | null
          display_price: number | null
          flight_number: string
          flight_search_id: string
          flight_type: string | null
          go_wild_available_seats: number | null
          go_wild_fare_status: number | null
          go_wild_loyalty_points: number | null
          go_wild_total: number | null
          has_go_wild: boolean
          id: string
          leg_destination_iata: string
          leg_index: number
          leg_origin_iata: string
          leg_route: string | null
          miles_available_seats: number | null
          miles_fare_status: number | null
          miles_loyalty_points: number | null
          miles_total: number | null
          notes: string | null
          origin_iata: string
          snapshot_at: string
          source_itinerary_id: string
          stable_itinerary_key: string | null
          standard_available_seats: number | null
          standard_fare_status: number | null
          standard_loyalty_points: number | null
          standard_total: number | null
          stops: number | null
          total_duration_display: string | null
          updated_at: string
        }
        Insert: {
          airline?: string | null
          arrival_at: string
          availability_status?: string
          currency?: string | null
          departure_at: string
          discount_den_available_seats?: number | null
          discount_den_fare_status?: number | null
          discount_den_loyalty_points?: number | null
          discount_den_total?: number | null
          display_cabin?: string | null
          display_price?: number | null
          flight_number: string
          flight_search_id: string
          flight_type?: string | null
          go_wild_available_seats?: number | null
          go_wild_fare_status?: number | null
          go_wild_loyalty_points?: number | null
          go_wild_total?: number | null
          has_go_wild?: boolean
          id?: string
          leg_destination_iata: string
          leg_index: number
          leg_origin_iata: string
          leg_route?: string | null
          miles_available_seats?: number | null
          miles_fare_status?: number | null
          miles_loyalty_points?: number | null
          miles_total?: number | null
          notes?: string | null
          origin_iata: string
          snapshot_at?: string
          source_itinerary_id: string
          stable_itinerary_key?: string | null
          standard_available_seats?: number | null
          standard_fare_status?: number | null
          standard_loyalty_points?: number | null
          standard_total?: number | null
          stops?: number | null
          total_duration_display?: string | null
          updated_at?: string
        }
        Update: {
          airline?: string | null
          arrival_at?: string
          availability_status?: string
          currency?: string | null
          departure_at?: string
          discount_den_available_seats?: number | null
          discount_den_fare_status?: number | null
          discount_den_loyalty_points?: number | null
          discount_den_total?: number | null
          display_cabin?: string | null
          display_price?: number | null
          flight_number?: string
          flight_search_id?: string
          flight_type?: string | null
          go_wild_available_seats?: number | null
          go_wild_fare_status?: number | null
          go_wild_loyalty_points?: number | null
          go_wild_total?: number | null
          has_go_wild?: boolean
          id?: string
          leg_destination_iata?: string
          leg_index?: number
          leg_origin_iata?: string
          leg_route?: string | null
          miles_available_seats?: number | null
          miles_fare_status?: number | null
          miles_loyalty_points?: number | null
          miles_total?: number | null
          notes?: string | null
          origin_iata?: string
          snapshot_at?: string
          source_itinerary_id?: string
          stable_itinerary_key?: string | null
          standard_available_seats?: number | null
          standard_fare_status?: number | null
          standard_loyalty_points?: number | null
          standard_total?: number | null
          stops?: number | null
          total_duration_display?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_snapshots_flight_search_id_fkey"
            columns: ["flight_search_id"]
            isOneToOne: false
            referencedRelation: "flight_searches"
            referencedColumns: ["id"]
          },
        ]
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
      frontier_market_snapshots: {
        Row: {
          created_at: string
          id: string
          origin_count: number
          raw_json: Json
          route_pair_count: number
          source_checksum: string | null
          source_path: string | null
          source_type: string
          station_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          origin_count?: number
          raw_json: Json
          route_pair_count?: number
          source_checksum?: string | null
          source_path?: string | null
          source_type?: string
          station_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          origin_count?: number
          raw_json?: Json
          route_pair_count?: number
          source_checksum?: string | null
          source_path?: string | null
          source_type?: string
          station_count?: number
        }
        Relationships: []
      }
      frontier_routes: {
        Row: {
          created_at: string
          destination_iata: string
          first_seen_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          last_snapshot_id: string | null
          origin_iata: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_iata: string
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          last_snapshot_id?: string | null
          origin_iata: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_iata?: string
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          last_snapshot_id?: string | null
          origin_iata?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frontier_routes_last_snapshot_id_fkey"
            columns: ["last_snapshot_id"]
            isOneToOne: false
            referencedRelation: "frontier_market_snapshots"
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
      market_offering_sync_logs: {
        Row: {
          airports_created: number
          airports_deactivated: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          routes_deactivated: number
          routes_upserted: number
          snapshot_id: string | null
          started_at: string
          stations_upserted: number
          status: string
          triggered_by: string
        }
        Insert: {
          airports_created?: number
          airports_deactivated?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          routes_deactivated?: number
          routes_upserted?: number
          snapshot_id?: string | null
          started_at?: string
          stations_upserted?: number
          status: string
          triggered_by?: string
        }
        Update: {
          airports_created?: number
          airports_deactivated?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          routes_deactivated?: number
          routes_upserted?: number
          snapshot_id?: string | null
          started_at?: string
          stations_upserted?: number
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_offering_sync_logs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "frontier_market_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_audiences: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          filter_definition: Json
          id: string
          is_active: boolean
          last_estimated_at: string | null
          last_estimated_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_definition?: Json
          id?: string
          is_active?: boolean
          last_estimated_at?: string | null
          last_estimated_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_definition?: Json
          id?: string
          is_active?: boolean
          last_estimated_at?: string | null
          last_estimated_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      messaging_messages: {
        Row: {
          audience_definition: Json
          audience_id: string | null
          cancelled_at: string | null
          category: string
          channels: string[]
          classification: string
          completed_at: string | null
          created_at: string
          created_by: string
          eligible_count: number
          email_cta_label: string | null
          email_cta_url: string | null
          email_html: string | null
          email_preheader: string | null
          email_subject: string | null
          email_text: string | null
          id: string
          idempotency_key: string | null
          internal_description: string | null
          internal_name: string
          invalid_count: number
          last_error: string | null
          notification_body: string | null
          notification_cta_label: string | null
          notification_cta_url: string | null
          notification_detail_text: string | null
          notification_title: string | null
          notification_type: string | null
          queued_at: string | null
          recipient_count: number
          reply_to: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          suppressed_count: number
          template_id: string | null
          template_version: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience_definition?: Json
          audience_id?: string | null
          cancelled_at?: string | null
          category?: string
          channels?: string[]
          classification?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          eligible_count?: number
          email_cta_label?: string | null
          email_cta_url?: string | null
          email_html?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          email_text?: string | null
          id?: string
          idempotency_key?: string | null
          internal_description?: string | null
          internal_name: string
          invalid_count?: number
          last_error?: string | null
          notification_body?: string | null
          notification_cta_label?: string | null
          notification_cta_url?: string | null
          notification_detail_text?: string | null
          notification_title?: string | null
          notification_type?: string | null
          queued_at?: string | null
          recipient_count?: number
          reply_to?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          suppressed_count?: number
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience_definition?: Json
          audience_id?: string | null
          cancelled_at?: string | null
          category?: string
          channels?: string[]
          classification?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          eligible_count?: number
          email_cta_label?: string | null
          email_cta_url?: string | null
          email_html?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          email_text?: string | null
          id?: string
          idempotency_key?: string | null
          internal_description?: string | null
          internal_name?: string
          invalid_count?: number
          last_error?: string | null
          notification_body?: string | null
          notification_cta_label?: string | null
          notification_cta_url?: string | null
          notification_detail_text?: string | null
          notification_title?: string | null
          notification_type?: string | null
          queued_at?: string | null
          recipient_count?: number
          reply_to?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          suppressed_count?: number
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_messages_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "messaging_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "messaging_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_provider_events: {
        Row: {
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          message_id: string | null
          occurred_at: string
          provider: string
          provider_event_id: string | null
          provider_message_id: string | null
          recipient_id: string | null
        }
        Insert: {
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          provider: string
          provider_event_id?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
        }
        Update: {
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          provider?: string
          provider_event_id?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_provider_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messaging_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_provider_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "messaging_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_recipients: {
        Row: {
          attempt_count: number
          beta_application_id: string | null
          bounced_at: string | null
          channel: string
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          email: string | null
          failed_at: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          message_id: string
          next_attempt_at: string | null
          normalized_email: string | null
          opened_at: string | null
          personalization: Json
          provider: string | null
          provider_message_id: string | null
          queued_at: string | null
          recipient_name: string | null
          sent_at: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          beta_application_id?: string | null
          bounced_at?: string | null
          channel: string
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          message_id: string
          next_attempt_at?: string | null
          normalized_email?: string | null
          opened_at?: string | null
          personalization?: Json
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          beta_application_id?: string | null
          bounced_at?: string | null
          channel?: string
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          message_id?: string
          next_attempt_at?: string | null
          normalized_email?: string | null
          opened_at?: string | null
          personalization?: Json
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_recipients_beta_application_id_fkey"
            columns: ["beta_application_id"]
            isOneToOne: false
            referencedRelation: "beta_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messaging_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      messaging_suppressions: {
        Row: {
          created_at: string
          id: string
          normalized_email: string
          notes: string | null
          provider: string | null
          reason: string
          removed_at: string | null
          scope: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_email: string
          notes?: string | null
          provider?: string | null
          reason: string
          removed_at?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_email?: string
          notes?: string | null
          provider?: string | null
          reason?: string
          removed_at?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_templates: {
        Row: {
          archived_at: string | null
          available_variables: string[]
          category: string
          created_at: string
          created_by: string | null
          default_reply_to: string
          description: string | null
          email_cta_label: string | null
          email_cta_url: string | null
          email_html: string | null
          email_preheader: string | null
          email_subject: string | null
          email_text: string | null
          id: string
          is_active: boolean
          is_transactional: boolean
          name: string
          notification_body: string | null
          notification_cta_label: string | null
          notification_cta_url: string | null
          notification_detail_text: string | null
          notification_title: string | null
          notification_type: string | null
          required_variables: string[]
          slug: string
          supported_channels: string[]
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          available_variables?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          default_reply_to?: string
          description?: string | null
          email_cta_label?: string | null
          email_cta_url?: string | null
          email_html?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          email_text?: string | null
          id?: string
          is_active?: boolean
          is_transactional?: boolean
          name: string
          notification_body?: string | null
          notification_cta_label?: string | null
          notification_cta_url?: string | null
          notification_detail_text?: string | null
          notification_title?: string | null
          notification_type?: string | null
          required_variables?: string[]
          slug: string
          supported_channels?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          available_variables?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          default_reply_to?: string
          description?: string | null
          email_cta_label?: string | null
          email_cta_url?: string | null
          email_html?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          email_text?: string | null
          id?: string
          is_active?: boolean
          is_transactional?: boolean
          name?: string
          notification_body?: string | null
          notification_cta_label?: string | null
          notification_cta_url?: string | null
          notification_detail_text?: string | null
          notification_title?: string | null
          notification_type?: string | null
          required_variables?: string[]
          slug?: string
          supported_channels?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notification_type_configs: {
        Row: {
          audience: string
          authority: string
          background_color: string | null
          border_color: string | null
          created_at: string
          default_body: string | null
          default_detail_text: string | null
          default_title: string | null
          description: string | null
          display_type: string | null
          group_color: string
          icon_name: string | null
          id: string
          is_active: boolean
          label: string
          main_color: string | null
          notification_group: string
          severity: string
          show_in_admin: boolean
          show_in_user_notifications: boolean
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          audience?: string
          authority?: string
          background_color?: string | null
          border_color?: string | null
          created_at?: string
          default_body?: string | null
          default_detail_text?: string | null
          default_title?: string | null
          description?: string | null
          display_type?: string | null
          group_color?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          label: string
          main_color?: string | null
          notification_group?: string
          severity?: string
          show_in_admin?: boolean
          show_in_user_notifications?: boolean
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          audience?: string
          authority?: string
          background_color?: string | null
          border_color?: string | null
          created_at?: string
          default_body?: string | null
          default_detail_text?: string | null
          default_title?: string | null
          description?: string | null
          display_type?: string | null
          group_color?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          label?: string
          main_color?: string | null
          notification_group?: string
          severity?: string
          show_in_admin?: boolean
          show_in_user_notifications?: boolean
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          data: Json | null
          detail_text: string | null
          id: string
          is_read: boolean
          notification_group: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          data?: Json | null
          detail_text?: string | null
          id?: string
          is_read?: boolean
          notification_group?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          data?: Json | null
          detail_text?: string | null
          id?: string
          is_read?: boolean
          notification_group?: string
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
      shared_flight_results: {
        Row: {
          all_destinations: boolean
          arrival_airport: string | null
          created_at: string
          departure_airport: string | null
          departure_date: string | null
          display_model: Json
          display_model_version: number
          expires_at: string | null
          flight_count: number
          id: string
          last_viewed_at: string | null
          owner_user_id: string
          payload_version: number
          public_token_hash: string
          raw_search_payload: Json
          return_date: string | null
          revoked_at: string | null
          source_flight_search_id: string | null
          trip_type: string | null
          view_count: number
        }
        Insert: {
          all_destinations?: boolean
          arrival_airport?: string | null
          created_at?: string
          departure_airport?: string | null
          departure_date?: string | null
          display_model: Json
          display_model_version?: number
          expires_at?: string | null
          flight_count?: number
          id?: string
          last_viewed_at?: string | null
          owner_user_id: string
          payload_version?: number
          public_token_hash: string
          raw_search_payload: Json
          return_date?: string | null
          revoked_at?: string | null
          source_flight_search_id?: string | null
          trip_type?: string | null
          view_count?: number
        }
        Update: {
          all_destinations?: boolean
          arrival_airport?: string | null
          created_at?: string
          departure_airport?: string | null
          departure_date?: string | null
          display_model?: Json
          display_model_version?: number
          expires_at?: string | null
          flight_count?: number
          id?: string
          last_viewed_at?: string | null
          owner_user_id?: string
          payload_version?: number
          public_token_hash?: string
          raw_search_payload?: Json
          return_date?: string | null
          revoked_at?: string | null
          source_flight_search_id?: string | null
          trip_type?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shared_flight_results_source_flight_search_id_fkey"
            columns: ["source_flight_search_id"]
            isOneToOne: false
            referencedRelation: "flight_searches"
            referencedColumns: ["id"]
          },
        ]
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
      user_email_preferences: {
        Row: {
          created_at: string
          email_account_messages: boolean
          email_beta_updates: boolean
          email_enabled: boolean
          email_gowild_updates: boolean
          email_marketing: boolean
          email_product_updates: boolean
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_account_messages?: boolean
          email_beta_updates?: boolean
          email_enabled?: boolean
          email_gowild_updates?: boolean
          email_marketing?: boolean
          email_product_updates?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_account_messages?: boolean
          email_beta_updates?: boolean
          email_enabled?: boolean
          email_gowild_updates?: boolean
          email_marketing?: boolean
          email_product_updates?: boolean
          unsubscribed_at?: string | null
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          last_login: string | null
          last_name: string | null
          mobile_number: string | null
          onboarding_complete: string
          remember_me: boolean
          signup_type: string
          status: string
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
          last_login?: string | null
          last_name?: string | null
          mobile_number?: string | null
          onboarding_complete: string
          remember_me?: boolean
          signup_type?: string
          status?: string
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
          last_login?: string | null
          last_name?: string | null
          mobile_number?: string | null
          onboarding_complete?: string
          remember_me?: boolean
          signup_type?: string
          status?: string
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
          cancel_at_period_end: boolean
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
          cancel_at_period_end?: boolean
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
          cancel_at_period_end?: boolean
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
      frontier_active_airports: {
        Row: {
          city: string | null
          country: string | null
          frontier_image_url: string | null
          frontier_last_seen_at: string | null
          frontier_source: string | null
          iata_code: string | null
          icao_code: string | null
          id: number | null
          is_active: boolean | null
          is_hub: boolean | null
          latitude: number | null
          location_id: number | null
          location_name: string | null
          longitude: number | null
          metadata_status: string | null
          name: string | null
          region: string | null
          state: string | null
          state_code: string | null
          timezone: string | null
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
      frontier_active_route_map: {
        Row: {
          destinations: string[] | null
          origin_iata: string | null
        }
        Relationships: []
      }
      notification_feed_view: {
        Row: {
          audience: string | null
          authority: string | null
          background_color: string | null
          body: string | null
          border_color: string | null
          config_is_active: boolean | null
          config_label: string | null
          created_at: string | null
          data: Json | null
          detail_text: string | null
          display_type: string | null
          icon_name: string | null
          id: string | null
          is_read: boolean | null
          main_color: string | null
          notification_group: string | null
          severity: string | null
          show_in_admin: boolean | null
          show_in_user_notifications: boolean | null
          title: string | null
          type: string | null
          user_id: string | null
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
      user_public_profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          display_name: string | null
          first_name: string | null
          home_airport: string | null
          home_city: string | null
          is_discoverable: boolean | null
          last_name: string | null
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          display_name?: string | null
          first_name?: string | null
          home_airport?: string | null
          home_city?: string | null
          is_discoverable?: boolean | null
          last_name?: string | null
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          display_name?: string | null
          first_name?: string | null
          home_airport?: string | null
          home_city?: string | null
          is_discoverable?: boolean | null
          last_name?: string | null
          username?: string | null
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
      authorize_paid_search: {
        Args: {
          p_all_destinations: boolean
          p_arrival_airports_count: number
          p_source_id: string
          p_trip_type: string
          p_user_id: string
        }
        Returns: Json
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
      exec_sql: { Args: { query: string }; Returns: Json }
      fulfill_stripe_credit_pack: {
        Args: {
          p_credits: number
          p_pack_id: string
          p_stripe_customer_id: string
          p_stripe_event_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      get_friend_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          auth_user_id: string
          avatar_url: string
          display_name: string
          first_name: string
          home_airport: string
          home_city: string
          last_name: string
          username: string
        }[]
      }
      get_global_gowild_insight_snapshots: {
        Args: { p_limit?: number; p_offset?: number; p_since?: string }
        Returns: {
          arrival_at: string
          departure_at: string
          go_wild_available_seats: number
          go_wild_total: number
          has_go_wild: boolean
          id: string
          leg_destination_iata: string
          leg_index: number
          leg_origin_iata: string
          origin_iata: string
          snapshot_at: string
          source_itinerary_id: string
          standard_total: number
          stops: number
        }[]
      }
      get_notification_type_stats: {
        Args: never
        Returns: {
          last_sent: string
          total_count: number
          type: string
        }[]
      }
      get_route_gowild_inventory_calendar: {
        Args: {
          p_destination_iata: string
          p_end_date: string
          p_origin_iata: string
          p_start_date: string
        }
        Returns: {
          available_flights_now: number
          available_seats_now: number
          has_current_gowild_availability: boolean
          has_observation: boolean
          last_provider_observed_at: string
          lowest_gowild_fare_now: number
          lowest_standard_fare_now: number
          original_available_flights: number
          original_available_seats: number
          seat_change: number
          travel_date: string
        }[]
      }
      get_route_gowild_inventory_day_details: {
        Args: {
          p_destination_iata: string
          p_origin_iata: string
          p_travel_date: string
        }
        Returns: {
          airline: string
          arrival_at: string
          current_gowild_fare: number
          current_seats: number
          current_standard_fare: number
          departure_at: string
          first_observed_at: string
          first_seats: number
          flight_number: string
          is_currently_available: boolean
          latest_availability_status: string
          latest_observed_at: string
          seat_change: number
          stable_itinerary_key: string
          stops: number
          total_duration_display: string
        }[]
      }
      get_route_gowild_seat_calendar: {
        Args: {
          p_destination_iata: string
          p_end_date: string
          p_origin_iata: string
          p_start_date: string
        }
        Returns: {
          available_flights: number
          available_seats: number
          last_observed_at: string
          travel_date: string
        }[]
      }
      get_shared_flight_result: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      is_owner_of_user_row: { Args: { _user_id: number }; Returns: boolean }
      mark_disappeared_gowild_observations: {
        Args: {
          p_destination_iata: string
          p_flight_search_id: string
          p_origin_iata: string
          p_returned_stable_keys: string[]
          p_travel_date: string
        }
        Returns: number
      }
      mark_disappeared_gowild_observations_admin: {
        Args: {
          p_destination_iata: string
          p_flight_search_id: string
          p_origin_iata: string
          p_returned_stable_keys: string[]
          p_travel_date: string
        }
        Returns: number
      }
      notify_bulk_search_issues: { Args: never; Returns: number }
      refund_paid_search: {
        Args: { p_reason?: string; p_source_id: string; p_user_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigger_market_offering_search: { Args: never; Returns: undefined }
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
