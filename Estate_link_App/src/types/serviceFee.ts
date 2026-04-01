export interface ServiceFeePayment {
  id: number;
  transaction_id: string;
  service_fee: number;
  resident?: number;
  unit: number;
  resident_name?: string;
  resident_email?: string;
  member_id?: number;
  unit_number: string;
  tower_name: string;
  service_fee_amount: string;
  amount: string;
  original_amount?: string;
  remaining_amount?: string;
  currency: string;
  payment_method: string;
  payment_status: string;
  service_status: string;
  service_status_display: string;
  is_overdue: boolean;
  is_fully_paid: boolean;
  is_partial_payment: boolean;
  payment_percentage: number;
  outstanding_amount: number;
  created_by_name?: string;
  payment_date?: string;
  due_date?: string;
  completion_date?: string;
  reference_number?: string;
  notes?: string;
  service_period_month: number;
  service_period_year: number;
  service_period_display: string;
  created_by?: number;
  created_at: string;
  updated_by?: number;
  updated_at: string;
}

export interface Unit {
  id: number;
  unit_name: string;
  unit_display: string;
  tower_name: string;
  tower_id: number;
  service_fee_id: number;
  fee_amount: string;
  amount: string;
  due_amount: string;
  due_day: number;
  payment_method: string;
  method_display: string;
  service_status: string;
  payment_date?: string;
  payment_status?: string;
  transaction_id?: string;
  service_period_month?: number;
  service_period_year?: number;
  reference_number?: string;
  due_date: string;
  frequency: string;
}

export interface ServiceFeeStats {
  totalPayments: number;
  totalFeeAmount: string;
  totalPaidAmount: string;
  totalDueAmount: string;
  completedCount: number;
  completedAmount: string;
  dueCount: number;
  dueAmount: string;
  overdueCount: number;
  overdueAmount: string;
}

export interface PaymentMethod {
  value: string;
  label: string;
}

export interface FilterOptions {
  towers: Array<{ value: number; label: string }>;
  status_options: Array<{ value: string; label: string }>;
  payment_methods: Array<{ value: string; label: string }>;
}

export interface ServiceFeeFilters {
  tower_id?: number[];
  status?: string[];
  payment_method?: string[];
  service_period_month?: number;
  service_period_year?: number;
  search?: string;
}
