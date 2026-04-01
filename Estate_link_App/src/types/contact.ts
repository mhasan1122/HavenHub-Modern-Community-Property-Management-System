export interface Contact {
  id: number;
  name: string;
  phone_number: string;
  email: string;
  designation: string;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: number;
  created_by_name?: string;
}

export interface CreateContactData {
  name: string;
  phone_number: string;
  email: string;
  designation: string;
}

export interface UpdateContactData {
  name?: string;
  phone_number?: string;
  email?: string;
  designation?: string;
}

export interface ContactState {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  selectedContact: Contact | null;
  hasLoadedOnce: boolean;
}

