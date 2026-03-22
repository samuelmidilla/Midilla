export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_production'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type CreditTransactionType =
  | 'allocation'
  | 'deduction'
  | 'topup'
  | 'refund'
  | 'expiry';

export type TierSlug = 'starter' | 'professional' | 'architect';

export type OutputTypeSlug =
  | 'white_paper'
  | 'legal_article'
  | 'email_sequence'
  | 'seo_content';

export interface Tier {
  id: string;
  slug: TierSlug;
  name: string;
  monthly_credits: number;
  price_usd_cents: number;
  credits_rollover: boolean;
  allow_topup: boolean;
  is_custom: boolean;
  created_at: string;
}

export interface OutputType {
  id: string;
  slug: OutputTypeSlug;
  name: string;
  bible_reference: string;
  created_at: string;
}

export interface OutputConfiguration {
  id: string;
  output_type_id: string;
  label: string;
  credit_cost: number;
  word_count: number | null;
  email_count: number | null;
  delivery_hours: number;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  tier_id: string;
  credit_balance: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  paystack_customer_id: string | null;
  paystack_sub_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  output_type_id: string;
  configuration_id: string;
  status: OrderStatus;
  credits_used: number;
  brief: Record<string, unknown>;
  confirmed_at: string | null;
  production_started_at: string | null;
  delivery_scheduled_at: string | null;
  delivered_at: string | null;
  delivery_filename: string | null;
  actual_word_count: number | null;
  production_bible: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  order_id: string | null;
  type: CreditTransactionType;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface OrderDetail extends Order {
  output_type_slug: OutputTypeSlug;
  output_type_name: string;
  production_bible: string;
  configuration_label: string;
  configuration_credits: number;
  configuration_word_count: number | null;
  configuration_email_count: number | null;
  configuration_delivery_hours: number;
  user_email: string;
  user_name: string | null;
  user_credit_balance: number;
  user_tier: TierSlug;
  user_tier_name: string;
}

export interface CreateOrderRequest {
  configuration_id: string;
  brief: OrderBrief;
}

export interface CreateOrderResponse {
  order: Order;
  credits_remaining: number;
}

export interface ConfirmOrderResponse {
  order: Order;
  delivery_scheduled_at: string;
  order_number: string;
  credits_remaining: number;
}

export interface GetOrderResponse {
  order: OrderDetail;
}

export interface ListOrdersResponse {
  orders: OrderDetail[];
  total: number;
}

export interface CreditBalanceResponse {
  balance: number;
  tier: TierSlug;
  tier_name: string;
  billing_cycle_end: string;
  recent_transactions: CreditTransaction[];
}

export interface WhitePaperBrief {
  topic_and_angle: string;
  primary_audience: string;
  argument_to_advance: string;
  competitor_references?: string;
  specific_sources?: string;
}

export interface LegalArticleBrief {
  topic_and_angle: string;
  primary_audience: string;
  jurisdiction?: string;
  key_points: string;
  specific_sources?: string;
}

export interface EmailSequenceBrief {
  sequence_purpose: 'onboarding' | 'nurture' | 'conversion' | 're_engagement' | 'post_purchase';
  audience_and_position: string;
  desired_outcome: string;
  product_or_service_context: string;
  tone_notes?: string;
}

export interface SeoContentBrief {
  topic_and_angle: string;
  primary_keyword: string;
  secondary_keywords?: string;
  primary_audience: string;
  search_intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  competitor_content?: string;
}

export type OrderBrief =
  | WhitePaperBrief
  | LegalArticleBrief
  | EmailSequenceBrief
  | SeoContentBrief;

export type Database = {
  public: {
    Tables: {
      tiers: {
        Row: Tier;
        Insert: Omit<Tier, 'id' | 'created_at'>;
        Update: Partial<Omit<Tier, 'id' | 'created_at'>>;
      };
      output_types: {
        Row: OutputType;
        Insert: Omit<OutputType, 'id' | 'created_at'>;
        Update: Partial<Omit<OutputType, 'id' | 'created_at'>>;
      };
      output_configurations: {
        Row: OutputConfiguration;
        Insert: Omit<OutputConfiguration, 'id' | 'created_at'>;
        Update: Partial<Omit<OutputConfiguration, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      credit_transactions: {
        Row: CreditTransaction;
        Insert: Omit<CreditTransaction, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: {
      order_detail: {
        Row: OrderDetail;
      };
    };
    Functions: {
      deduct_credits: {
        Args: {
          p_user_id: string;
          p_order_id: string;
          p_amount: number;
          p_description: string;
        };
        Returns: number;
      };
      allocate_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_description: string;
          p_order_id?: string;
        };
        Returns: number;
      };
      confirm_order: {
        Args: { p_order_id: string };
        Returns: Order;
      };
      start_production: {
        Args: { p_order_id: string };
        Returns: Order;
      };
      deliver_order: {
        Args: {
          p_order_id: string;
          p_delivery_filename: string;
          p_actual_word_count?: number;
        };
        Returns: Order;
      };
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: Order;
      };
      expire_starter_credits: {
        Args: { p_user_id: string };
        Returns: void;
      };
    };
    Enums: {
      order_status: OrderStatus;
      credit_transaction_type: CreditTransactionType;
      tier_slug: TierSlug;
      output_type_slug: OutputTypeSlug;
    };
  };
};
