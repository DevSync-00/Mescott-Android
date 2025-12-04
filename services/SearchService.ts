import { supabase } from '../lib/supabase'
import { handleError } from '../utils/errorHandler'

export interface SearchFilters {
  query?: string
  category?: string
  budgetMin?: number
  budgetMax?: number
  location?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'created_at' | 'budget' | 'title' | 'deadline'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchResult {
  tasks: any[]
  total: number
  hasMore: boolean
  filters: SearchFilters
}

export interface SearchSuggestion {
  id: string
  text: string
  type: 'category' | 'location' | 'skill' | 'task'
  count?: number
}

export class SearchService {
  // Search tasks with advanced filtering
  static async searchTasks(filters: SearchFilters): Promise<SearchResult> {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_customer_id_fkey(full_name, avatar_url),
          profiles!tasks_tasker_id_fkey(full_name, avatar_url),
          task_categories(name, icon, color),
          task_applications(id, status)
        `, { count: 'exact' })

      // Apply filters
      if (filters.query) {
        query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,address.ilike.%${filters.query}%`)
      }

      if (filters.category) {
        query = query.eq('category_id', filters.category)
      }

      if (filters.budgetMin !== undefined) {
        query = query.gte('budget', filters.budgetMin)
      }

      if (filters.budgetMax !== undefined) {
        query = query.lte('budget', filters.budgetMax)
      }

      if (filters.location) {
        query = query.or(`city.ilike.%${filters.location}%,state.ilike.%${filters.location}%,address.ilike.%${filters.location}%`)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'created_at'
      const sortOrder = filters.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      const tasks = data?.map(task => ({
        ...task,
        customer_name: task.profiles?.full_name,
        customer_avatar: task.profiles?.avatar_url,
        tasker_name: task.profiles?.full_name,
        tasker_avatar: task.profiles?.avatar_url,
        category_name: task.task_categories?.name,
        category_icon: task.task_categories?.icon,
        category_color: task.task_categories?.color,
        applications_count: task.task_applications?.length || 0
      })) || []

      return {
        tasks,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0),
        filters
      }
    } catch (error) {
      const appError = handleError(error, 'searchTasks')
      console.error('Error searching tasks:', appError)
      return {
        tasks: [],
        total: 0,
        hasMore: false,
        filters
      }
    }
  }

  // Get search suggestions
  static async getSearchSuggestions(query: string, limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const suggestions: SearchSuggestion[] = []

      // Search categories
      const { data: categories } = await supabase
        .from('task_categories')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(5)

      if (categories) {
        suggestions.push(...categories.map(cat => ({
          id: `category_${cat.id}`,
          text: cat.name,
          type: 'category' as const
        })))
      }

      // Search locations
      const { data: locations } = await supabase
        .from('tasks')
        .select('city, state')
        .or(`city.ilike.%${query}%,state.ilike.%${query}%`)
        .limit(5)

      if (locations) {
        const uniqueLocations = Array.from(
          new Set(locations.map(loc => `${loc.city}, ${loc.state}`))
        )
        suggestions.push(...uniqueLocations.map(loc => ({
          id: `location_${loc}`,
          text: loc,
          type: 'location' as const
        })))
      }

      // Search task titles
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .ilike('title', `%${query}%`)
        .limit(5)

      if (tasks) {
        suggestions.push(...tasks.map(task => ({
          id: `task_${task.id}`,
          text: task.title,
          type: 'task' as const
        })))
      }

      return suggestions.slice(0, limit)
    } catch (error) {
      const appError = handleError(error, 'getSearchSuggestions')
      console.error('Error getting search suggestions:', appError)
      return []
    }
  }

  // Get popular searches
  static async getPopularSearches(limit: number = 10): Promise<string[]> {
    try {
      // This would typically come from analytics data
      // For now, return some common searches
      return [
        'plumbing',
        'cleaning',
        'electrical',
        'gardening',
        'painting',
        'carpentry',
        'moving',
        'repair',
        'installation',
        'maintenance'
      ].slice(0, limit)
    } catch (error) {
      const appError = handleError(error, 'getPopularSearches')
      console.error('Error getting popular searches:', appError)
      return []
    }
  }

  // Get search filters
  static async getSearchFilters(): Promise<{
    categories: Array<{ id: string; name: string; icon?: string; color?: string }>
    budgetRanges: Array<{ label: string; min: number; max: number }>
    locations: string[]
    statuses: Array<{ value: string; label: string }>
  }> {
    try {
      // Get categories
      const { data: categories } = await supabase
        .from('task_categories')
        .select('id, name, icon, color')
        .eq('is_active', true)
        .order('sort_order')

      // Get unique locations
      const { data: locations } = await supabase
        .from('tasks')
        .select('city, state')
        .not('city', 'is', null)
        .not('state', 'is', null)

      const uniqueLocations = Array.from(
        new Set(locations?.map(loc => `${loc.city}, ${loc.state}`) || [])
      )

      // Define budget ranges
      const budgetRanges = [
        { label: 'Under $25', min: 0, max: 25 },
        { label: '$25 - $50', min: 25, max: 50 },
        { label: '$50 - $100', min: 50, max: 100 },
        { label: '$100 - $200', min: 100, max: 200 },
        { label: 'Over $200', min: 200, max: 10000 }
      ]

      // Define statuses
      const statuses = [
        { value: 'open', label: 'Open' },
        { value: 'assigned', label: 'Assigned' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' }
      ]

      return {
        categories: categories || [],
        budgetRanges,
        locations: uniqueLocations,
        statuses
      }
    } catch (error) {
      const appError = handleError(error, 'getSearchFilters')
      console.error('Error getting search filters:', appError)
      return {
        categories: [],
        budgetRanges: [],
        locations: [],
        statuses: []
      }
    }
  }

  // Save search query for analytics
  static async saveSearchQuery(query: string, filters: SearchFilters, userId?: string): Promise<void> {
    try {
      // This would typically save to an analytics table
      console.log('Search query saved:', { query, filters, userId })
    } catch (error) {
      console.error('Error saving search query:', error)
    }
  }

  // Get search history for user
  static async getSearchHistory(userId: string, limit: number = 10): Promise<string[]> {
    try {
      // This would typically come from a search history table
      // For now, return empty array
      return []
    } catch (error) {
      const appError = handleError(error, 'getSearchHistory')
      console.error('Error getting search history:', appError)
      return []
    }
  }

  // Clear search history
  static async clearSearchHistory(userId: string): Promise<void> {
    try {
      // This would typically clear from a search history table
      console.log('Search history cleared for user:', userId)
    } catch (error) {
      console.error('Error clearing search history:', error)
    }
  }

  // Advanced search with multiple criteria
  static async advancedSearch(criteria: {
    text?: string
    categories?: string[]
    budgetRange?: { min: number; max: number }
    locations?: string[]
    skills?: string[]
    dateRange?: { from: string; to: string }
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<SearchResult> {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_customer_id_fkey(full_name, avatar_url),
          task_categories(name, icon, color),
          task_applications(id, status)
        `, { count: 'exact' })

      // Text search
      if (criteria.text) {
        query = query.or(`title.ilike.%${criteria.text}%,description.ilike.%${criteria.text}%,address.ilike.%${criteria.text}%`)
      }

      // Category filter
      if (criteria.categories && criteria.categories.length > 0) {
        query = query.in('category_id', criteria.categories)
      }

      // Budget range
      if (criteria.budgetRange) {
        query = query
          .gte('budget', criteria.budgetRange.min)
          .lte('budget', criteria.budgetRange.max)
      }

      // Location filter
      if (criteria.locations && criteria.locations.length > 0) {
        const locationFilters = criteria.locations.map(loc => 
          `city.ilike.%${loc}%,state.ilike.%${loc}%,address.ilike.%${loc}%`
        ).join(',')
        query = query.or(locationFilters)
      }

      // Date range
      if (criteria.dateRange) {
        query = query
          .gte('created_at', criteria.dateRange.from)
          .lte('created_at', criteria.dateRange.to)
      }

      // Sorting
      const sortBy = criteria.sortBy || 'created_at'
      const sortOrder = criteria.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      const { data, error, count } = await query

      if (error) throw error

      const tasks = data?.map(task => ({
        ...task,
        customer_name: task.profiles?.full_name,
        customer_avatar: task.profiles?.avatar_url,
        category_name: task.task_categories?.name,
        category_icon: task.task_categories?.icon,
        category_color: task.task_categories?.color,
        applications_count: task.task_applications?.length || 0
      })) || []

      return {
        tasks,
        total: count || 0,
        hasMore: false,
        filters: criteria as SearchFilters
      }
    } catch (error) {
      const appError = handleError(error, 'advancedSearch')
      console.error('Error in advanced search:', appError)
      return {
        tasks: [],
        total: 0,
        hasMore: false,
        filters: criteria as SearchFilters
      }
    }
  }
}
