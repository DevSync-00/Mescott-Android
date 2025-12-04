import { supabase } from '../lib/supabase'

export interface PortfolioProject {
  id?: string
  tasker_application_id: string
  title: string
  description?: string
  category?: string
  skills_used?: string[]
  project_images?: string[]
  project_videos?: string[]
  project_url?: string
  github_url?: string
  demo_url?: string
  start_date?: string
  end_date?: string
  client_name?: string
  client_feedback?: string
  project_status?: 'completed' | 'in_progress' | 'on_hold' | 'cancelled'
  is_featured?: boolean
  created_at?: string
  updated_at?: string
}

export interface PortfolioSkill {
  id?: string
  tasker_application_id: string
  skill_name: string
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  years_experience?: number
  skill_description?: string
  skill_certifications?: string[]
  skill_projects?: string[]
  is_primary?: boolean
  is_verified?: boolean
  verified_at?: string
  created_at?: string
  updated_at?: string
}

export interface PortfolioCertification {
  id?: string
  tasker_application_id: string
  certification_name: string
  issuing_organization: string
  certification_number?: string
  issue_date?: string
  expiry_date?: string
  credential_url?: string
  verification_url?: string
  certificate_image_url?: string
  is_verified?: boolean
  verified_at?: string
  created_at?: string
  updated_at?: string
}

export interface PortfolioTestimonial {
  id?: string
  tasker_application_id: string
  client_name: string
  client_title?: string
  client_company?: string
  testimonial_text: string
  rating?: number
  project_title?: string
  project_date?: string
  client_photo_url?: string
  is_verified?: boolean
  is_featured?: boolean
  created_at?: string
  updated_at?: string
}

export interface PortfolioAvailability {
  id?: string
  tasker_application_id: string
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  start_time?: string
  end_time?: string
  is_available: boolean
  timezone?: string
  created_at?: string
  updated_at?: string
}

export interface TaskerPortfolio {
  id: string
  user_id: string
  full_name: string
  phone?: string
  bio?: string
  skills?: string[]
  experience_years?: number
  portfolio_title?: string
  portfolio_description?: string
  portfolio_website?: string
  portfolio_linkedin?: string
  portfolio_instagram?: string
  portfolio_facebook?: string
  portfolio_youtube?: string
  portfolio_twitter?: string
  portfolio_github?: string
  portfolio_behance?: string
  portfolio_dribbble?: string
  portfolio_other_links?: any[]
  portfolio_video_urls?: string[]
  portfolio_testimonials?: any[]
  portfolio_awards?: any[]
  portfolio_education?: any[]
  portfolio_work_experience?: any[]
  portfolio_services?: any[]
  portfolio_availability?: any
  portfolio_rates?: any
  portfolio_preferences?: any
  portfolio_verification_status?: string
  portfolio_verified_at?: string
  portfolio_updated_at?: string
  avatar_url?: string
  rating?: number
  total_tasks?: number
  completed_tasks?: number
  created_at?: string
  updated_at?: string
  // Related data
  projects?: PortfolioProject[]
  portfolio_skills?: PortfolioSkill[]
  certifications?: PortfolioCertification[]
  testimonials?: PortfolioTestimonial[]
  availability?: PortfolioAvailability[]
}

export class PortfolioService {
  // Get tasker portfolio by application ID
  static async getTaskerPortfolio(applicationId: string): Promise<TaskerPortfolio | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          projects:portfolio_projects(*),
          portfolio_skills:portfolio_skills(*),
          certifications:portfolio_certifications(*),
          testimonials:portfolio_testimonials(*),
          availability:portfolio_availability(*)
        `)
        .eq('id', applicationId)
        .single()

      if (error) {
        console.error('Error fetching tasker portfolio:', error)
        return null
      }

      return data as TaskerPortfolio
    } catch (error) {
      console.error('Error fetching tasker portfolio:', error)
      return null
    }
  }

  // Get tasker portfolio by user ID
  static async getTaskerPortfolioByUserId(userId: string): Promise<TaskerPortfolio | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          projects:portfolio_projects(*),
          portfolio_skills:portfolio_skills(*),
          certifications:portfolio_certifications(*),
          testimonials:portfolio_testimonials(*),
          availability:portfolio_availability(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching tasker portfolio by user ID:', error)
        return null
      }

      if (!data || data.length === 0) {
        console.log('No tasker application found for user ID:', userId)
        return null
      }

      return data[0] as TaskerPortfolio
    } catch (error) {
      console.error('Error fetching tasker portfolio by user ID:', error)
      return null
    }
  }

  // Get tasker portfolio by profile ID
  static async getTaskerPortfolioByProfileId(profileId: string): Promise<TaskerPortfolio | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          projects:portfolio_projects(*),
          portfolio_skills:portfolio_skills(*),
          certifications:portfolio_certifications(*),
          testimonials:portfolio_testimonials(*),
          availability:portfolio_availability(*)
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching tasker portfolio by profile ID:', error)
        return null
      }

      if (!data || data.length === 0) {
        console.log('No tasker application found for profile ID:', profileId)
        return null
      }

      return data[0] as TaskerPortfolio
    } catch (error) {
      console.error('Error fetching tasker portfolio by profile ID:', error)
      return null
    }
  }

  // Update tasker portfolio basic information
  static async updatePortfolioBasicInfo(applicationId: string, portfolioData: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tasker_applications')
        .update({
          portfolio_title: portfolioData.portfolio_title,
          portfolio_description: portfolioData.portfolio_description,
          portfolio_website: portfolioData.portfolio_website,
          portfolio_linkedin: portfolioData.portfolio_linkedin,
          portfolio_instagram: portfolioData.portfolio_instagram,
          portfolio_facebook: portfolioData.portfolio_facebook,
          portfolio_youtube: portfolioData.portfolio_youtube,
          portfolio_twitter: portfolioData.portfolio_twitter,
          portfolio_github: portfolioData.portfolio_github,
          portfolio_behance: portfolioData.portfolio_behance,
          portfolio_dribbble: portfolioData.portfolio_dribbble,
          portfolio_other_links: portfolioData.portfolio_other_links,
          portfolio_video_urls: portfolioData.portfolio_video_urls,
          portfolio_testimonials: portfolioData.portfolio_testimonials,
          portfolio_awards: portfolioData.portfolio_awards,
          portfolio_education: portfolioData.portfolio_education,
          portfolio_work_experience: portfolioData.portfolio_work_experience,
          portfolio_services: portfolioData.portfolio_services,
          portfolio_availability: portfolioData.portfolio_availability,
          portfolio_rates: portfolioData.portfolio_rates,
          portfolio_preferences: portfolioData.portfolio_preferences,
          portfolio_updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) {
        console.error('Error updating portfolio basic info:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating portfolio basic info:', error)
      return false
    }
  }

  // Portfolio Projects Management
  static async createProject(projectData: Omit<PortfolioProject, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioProject | null> {
    try {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .insert(projectData)
        .select()
        .single()

      if (error) {
        console.error('Error creating project:', error)
        return null
      }

      return data as PortfolioProject
    } catch (error) {
      console.error('Error creating project:', error)
      return null
    }
  }

  static async updateProject(projectId: string, projectData: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_projects')
        .update(projectData)
        .eq('id', projectId)

      if (error) {
        console.error('Error updating project:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating project:', error)
      return false
    }
  }

  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        console.error('Error deleting project:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  }

  // Portfolio Skills Management
  static async createSkill(skillData: Omit<PortfolioSkill, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioSkill | null> {
    try {
      const { data, error } = await supabase
        .from('portfolio_skills')
        .insert(skillData)
        .select()
        .single()

      if (error) {
        console.error('Error creating skill:', error)
        return null
      }

      return data as PortfolioSkill
    } catch (error) {
      console.error('Error creating skill:', error)
      return null
    }
  }

  static async updateSkill(skillId: string, skillData: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_skills')
        .update(skillData)
        .eq('id', skillId)

      if (error) {
        console.error('Error updating skill:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating skill:', error)
      return false
    }
  }

  static async deleteSkill(skillId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_skills')
        .delete()
        .eq('id', skillId)

      if (error) {
        console.error('Error deleting skill:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting skill:', error)
      return false
    }
  }

  // Portfolio Certifications Management
  static async createCertification(certData: Omit<PortfolioCertification, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioCertification | null> {
    try {
      const { data, error } = await supabase
        .from('portfolio_certifications')
        .insert(certData)
        .select()
        .single()

      if (error) {
        console.error('Error creating certification:', error)
        return null
      }

      return data as PortfolioCertification
    } catch (error) {
      console.error('Error creating certification:', error)
      return null
    }
  }

  static async updateCertification(certId: string, certData: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_certifications')
        .update(certData)
        .eq('id', certId)

      if (error) {
        console.error('Error updating certification:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating certification:', error)
      return false
    }
  }

  static async deleteCertification(certId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_certifications')
        .delete()
        .eq('id', certId)

      if (error) {
        console.error('Error deleting certification:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting certification:', error)
      return false
    }
  }

  // Portfolio Testimonials Management
  static async createTestimonial(testimonialData: Omit<PortfolioTestimonial, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioTestimonial | null> {
    try {
      const { data, error } = await supabase
        .from('portfolio_testimonials')
        .insert(testimonialData)
        .select()
        .single()

      if (error) {
        console.error('Error creating testimonial:', error)
        return null
      }

      return data as PortfolioTestimonial
    } catch (error) {
      console.error('Error creating testimonial:', error)
      return null
    }
  }

  static async updateTestimonial(testimonialId: string, testimonialData: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_testimonials')
        .update(testimonialData)
        .eq('id', testimonialId)

      if (error) {
        console.error('Error updating testimonial:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating testimonial:', error)
      return false
    }
  }

  static async deleteTestimonial(testimonialId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('portfolio_testimonials')
        .delete()
        .eq('id', testimonialId)

      if (error) {
        console.error('Error deleting testimonial:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting testimonial:', error)
      return false
    }
  }

  // Portfolio Availability Management
  static async updateAvailability(applicationId: string, availabilityData: Omit<PortfolioAvailability, 'id' | 'tasker_application_id' | 'created_at' | 'updated_at'>[]): Promise<boolean> {
    try {
      // First, delete existing availability records
      await supabase
        .from('portfolio_availability')
        .delete()
        .eq('tasker_application_id', applicationId)

      // Then insert new availability records
      const availabilityRecords = availabilityData.map(record => ({
        ...record,
        tasker_application_id: applicationId
      }))

      const { error } = await supabase
        .from('portfolio_availability')
        .insert(availabilityRecords)

      if (error) {
        console.error('Error updating availability:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating availability:', error)
      return false
    }
  }

  // Get featured portfolios for homepage
  static async getFeaturedPortfolios(limit: number = 10): Promise<TaskerPortfolio[]> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          projects:portfolio_projects(*),
          portfolio_skills:portfolio_skills(*),
          certifications:portfolio_certifications(*),
          testimonials:portfolio_testimonials(*),
          availability:portfolio_availability(*)
        `)
        .eq('status', 'approved')
        .not('portfolio_title', 'is', null)
        .order('portfolio_updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching featured portfolios:', error)
        return []
      }

      return data as TaskerPortfolio[]
    } catch (error) {
      console.error('Error fetching featured portfolios:', error)
      return []
    }
  }

  // Search portfolios by skills or categories
  static async searchPortfolios(searchTerm: string, skills?: string[], categories?: string[]): Promise<TaskerPortfolio[]> {
    try {
      let query = supabase
        .from('tasker_applications')
        .select(`
          *,
          projects:portfolio_projects(*),
          portfolio_skills:portfolio_skills(*),
          certifications:portfolio_certifications(*),
          testimonials:portfolio_testimonials(*),
          availability:portfolio_availability(*)
        `)
        .eq('status', 'approved')
        .not('portfolio_title', 'is', null)

      if (searchTerm) {
        query = query.or(`portfolio_title.ilike.%${searchTerm}%,portfolio_description.ilike.%${searchTerm}%`)
      }

      if (skills && skills.length > 0) {
        query = query.contains('skills', skills)
      }

      if (categories && categories.length > 0) {
        // This would need to be implemented based on how categories are stored
        // For now, we'll search in project categories
        query = query.in('projects.category', categories)
      }

      const { data, error } = await query.order('portfolio_updated_at', { ascending: false })

      if (error) {
        console.error('Error searching portfolios:', error)
        return []
      }

      return data as TaskerPortfolio[]
    } catch (error) {
      console.error('Error searching portfolios:', error)
      return []
    }
  }
}
