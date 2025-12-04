// Simple UserProfile type - only fields actually used in the app
export interface SimpleUserProfile {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  phone: string;
  role: 'customer' | 'tasker' | 'both';
  current_mode: 'customer' | 'tasker';
  currentMode?: 'customer' | 'tasker'; // alias for compatibility
  tasker_application_status?: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  avatar_url?: string; // Add avatar_url to main interface
  
  // Computed properties for compatibility
  name: string; // alias for full_name
  profile?: {
    full_name: string;
    username: string;
    phone: string;
    email?: string;
    bio?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    skills?: string[];
    languages?: string[];
    experience_years?: number;
    certifications?: string[];
    portfolio_images?: string[];
    avatar_url?: string;
  };
}
