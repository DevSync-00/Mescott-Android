import { supabase } from '../lib/supabase'
import { ImageService } from './ImageService'
import { handleError } from '../utils/errorHandler'

export interface VerificationDocument {
  id: string
  user_id: string
  document_type: 'id_card' | 'passport' | 'drivers_license' | 'certificate' | 'portfolio'
  document_name: string
  file_url: string
  file_type: string
  file_size: number
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  verified_at?: string
  verified_by?: string
  created_at: string
  updated_at: string
}

export interface SkillVerification {
  id: string
  user_id: string
  skill_name: string
  skill_category: string
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  verification_method: 'self_claimed' | 'certificate' | 'portfolio' | 'test' | 'reference'
  verification_document_id?: string
  verified_by?: string
  verified_at?: string
  status: 'pending' | 'verified' | 'rejected'
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface VerificationStatus {
  user_id: string
  phone_verified: boolean
  email_verified: boolean
  identity_verified: boolean
  skills_verified: boolean
  background_check_passed: boolean
  overall_verification_score: number
  verification_badge: 'unverified' | 'basic' | 'verified' | 'premium'
  last_updated: string
}

export interface VerificationRequirements {
  phone_verification: boolean
  email_verification: boolean
  identity_document: boolean
  skill_verification: boolean
  background_check: boolean
  minimum_rating: number
  minimum_completed_tasks: number
}

export class ProfileVerificationService {
  // Upload verification document
  static async uploadVerificationDocument(
    userId: string,
    documentType: VerificationDocument['document_type'],
    documentName: string,
    fileUri: string
  ): Promise<VerificationDocument | null> {
    try {
      // Upload file to storage
      const uploadResult = await ImageService.uploadImage(fileUri, 'verification-documents')
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Failed to upload document')
      }

      // Get file info
      const fileInfo = await ImageService.getFileInfo(fileUri)

      // Create document record
      const { data, error } = await supabase
        .from('verification_documents')
        .insert({
          user_id: userId,
          document_type: documentType,
          document_name: documentName,
          file_url: uploadResult.url,
          file_type: fileInfo.type || 'image/jpeg',
          file_size: fileInfo.size || 0,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      const appError = handleError(error, 'uploadVerificationDocument')
      console.error('Error uploading verification document:', appError)
      return null
    }
  }

  // Get user's verification documents
  static async getUserVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    try {
      const { data, error } = await supabase
        .from('verification_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      const appError = handleError(error, 'getUserVerificationDocuments')
      console.error('Error getting verification documents:', appError)
      return []
    }
  }

  // Add skill verification
  static async addSkillVerification(
    userId: string,
    skillName: string,
    skillCategory: string,
    proficiencyLevel: SkillVerification['proficiency_level'],
    verificationMethod: SkillVerification['verification_method'],
    documentId?: string
  ): Promise<SkillVerification | null> {
    try {
      const { data, error } = await supabase
        .from('skill_verifications')
        .insert({
          user_id: userId,
          skill_name: skillName,
          skill_category: skillCategory,
          proficiency_level: proficiencyLevel,
          verification_method: verificationMethod,
          verification_document_id: documentId,
          status: verificationMethod === 'self_claimed' ? 'verified' : 'pending'
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      const appError = handleError(error, 'addSkillVerification')
      console.error('Error adding skill verification:', appError)
      return null
    }
  }

  // Get user's skill verifications
  static async getUserSkillVerifications(userId: string): Promise<SkillVerification[]> {
    try {
      const { data, error } = await supabase
        .from('skill_verifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      const appError = handleError(error, 'getUserSkillVerifications')
      console.error('Error getting skill verifications:', appError)
      return []
    }
  }

  // Get verification status for user
  static async getVerificationStatus(userId: string): Promise<VerificationStatus | null> {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_verified, email_verified, verification_score')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      // Get verification documents
      const documents = await this.getUserVerificationDocuments(userId)
      const identityVerified = documents.some(doc => 
        ['id_card', 'passport', 'drivers_license'].includes(doc.document_type) && 
        doc.status === 'approved'
      )

      // Get skill verifications
      const skills = await this.getUserSkillVerifications(userId)
      const skillsVerified = skills.some(skill => skill.status === 'verified')

      // Get background check status (placeholder - would integrate with background check service)
      const backgroundCheckPassed = false // This would be determined by actual background check

      // Calculate overall verification score
      let score = 0
      if (profile.phone_verified) score += 20
      if (profile.email_verified) score += 20
      if (identityVerified) score += 30
      if (skillsVerified) score += 20
      if (backgroundCheckPassed) score += 10

      // Determine verification badge
      let badge: VerificationStatus['verification_badge'] = 'unverified'
      if (score >= 80) badge = 'premium'
      else if (score >= 60) badge = 'verified'
      else if (score >= 30) badge = 'basic'

      return {
        user_id: userId,
        phone_verified: profile.phone_verified || false,
        email_verified: profile.email_verified || false,
        identity_verified: identityVerified,
        skills_verified: skillsVerified,
        background_check_passed: backgroundCheckPassed,
        overall_verification_score: score,
        verification_badge: badge,
        last_updated: new Date().toISOString()
      }
    } catch (error) {
      const appError = handleError(error, 'getVerificationStatus')
      console.error('Error getting verification status:', appError)
      return null
    }
  }

  // Update verification status
  static async updateVerificationStatus(
    userId: string,
    updates: Partial<VerificationStatus>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error
      return true
    } catch (error) {
      const appError = handleError(error, 'updateVerificationStatus')
      console.error('Error updating verification status:', appError)
      return false
    }
  }

  // Admin: Approve verification document
  static async approveVerificationDocument(
    documentId: string,
    approvedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({
          status: 'approved',
          verified_at: new Date().toISOString(),
          verified_by: approvedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (error) throw error

      // Update user's verification status
      const { data: document } = await supabase
        .from('verification_documents')
        .select('user_id')
        .eq('id', documentId)
        .single()

      if (document) {
        await this.updateVerificationStatus(document.user_id, {})
      }

      return true
    } catch (error) {
      const appError = handleError(error, 'approveVerificationDocument')
      console.error('Error approving verification document:', appError)
      return false
    }
  }

  // Admin: Reject verification document
  static async rejectVerificationDocument(
    documentId: string,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          verified_by: rejectedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (error) throw error
      return true
    } catch (error) {
      const appError = handleError(error, 'rejectVerificationDocument')
      console.error('Error rejecting verification document:', appError)
      return false
    }
  }

  // Admin: Approve skill verification
  static async approveSkillVerification(
    skillId: string,
    approvedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('skill_verifications')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: approvedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', skillId)

      if (error) throw error
      return true
    } catch (error) {
      const appError = handleError(error, 'approveSkillVerification')
      console.error('Error approving skill verification:', appError)
      return false
    }
  }

  // Get verification requirements for user type
  static getVerificationRequirements(userType: 'customer' | 'tasker'): VerificationRequirements {
    if (userType === 'customer') {
      return {
        phone_verification: true,
        email_verification: false,
        identity_document: false,
        skill_verification: false,
        background_check: false,
        minimum_rating: 0,
        minimum_completed_tasks: 0
      }
    } else {
      return {
        phone_verification: true,
        email_verification: true,
        identity_document: true,
        skill_verification: true,
        background_check: true,
        minimum_rating: 4.0,
        minimum_completed_tasks: 5
      }
    }
  }

  // Check if user meets verification requirements
  static async checkVerificationRequirements(
    userId: string,
    userType: 'customer' | 'tasker'
  ): Promise<{ meets: boolean; missing: string[] }> {
    try {
      const requirements = this.getVerificationRequirements(userType)
      const status = await this.getVerificationStatus(userId)
      
      if (!status) {
        return { meets: false, missing: ['Unable to check verification status'] }
      }

      const missing: string[] = []

      if (requirements.phone_verification && !status.phone_verified) {
        missing.push('Phone verification required')
      }

      if (requirements.email_verification && !status.email_verified) {
        missing.push('Email verification required')
      }

      if (requirements.identity_document && !status.identity_verified) {
        missing.push('Identity document verification required')
      }

      if (requirements.skill_verification && !status.skills_verified) {
        missing.push('Skill verification required')
      }

      if (requirements.background_check && !status.background_check_passed) {
        missing.push('Background check required')
      }

      // Check rating and task requirements
      const { data: profile } = await supabase
        .from('profiles')
        .select('rating, completed_tasks')
        .eq('id', userId)
        .single()

      if (profile) {
        if (profile.rating < requirements.minimum_rating) {
          missing.push(`Minimum rating of ${requirements.minimum_rating} required`)
        }

        if (profile.completed_tasks < requirements.minimum_completed_tasks) {
          missing.push(`Minimum ${requirements.minimum_completed_tasks} completed tasks required`)
        }
      }

      return {
        meets: missing.length === 0,
        missing
      }
    } catch (error) {
      const appError = handleError(error, 'checkVerificationRequirements')
      console.error('Error checking verification requirements:', appError)
      return { meets: false, missing: ['Error checking requirements'] }
    }
  }

  // Get verification statistics
  static async getVerificationStats(): Promise<{
    total_users: number
    verified_users: number
    pending_verifications: number
    rejected_verifications: number
  }> {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Get verified users (basic verification or higher)
      const { count: verifiedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('verification_score', 30)

      // Get pending verifications
      const { count: pendingDocs } = await supabase
        .from('verification_documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingSkills } = await supabase
        .from('skill_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      return {
        total_users: totalUsers || 0,
        verified_users: verifiedUsers || 0,
        pending_verifications: (pendingDocs || 0) + (pendingSkills || 0),
        rejected_verifications: 0 // Would need to track this separately
      }
    } catch (error) {
      const appError = handleError(error, 'getVerificationStats')
      console.error('Error getting verification stats:', appError)
      return {
        total_users: 0,
        verified_users: 0,
        pending_verifications: 0,
        rejected_verifications: 0
      }
    }
  }
}
