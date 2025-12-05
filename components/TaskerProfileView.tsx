import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Dimensions,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PortfolioService, TaskerPortfolio } from '../services/PortfolioService'
import Colors from '../constants/Colors'

interface TaskerProfileViewProps {
  taskerId: string
  visible: boolean
  onClose: () => void
}

const { width } = Dimensions.get('window')

export default function TaskerProfileView({ taskerId, visible, onClose }: TaskerProfileViewProps) {
  const [portfolio, setPortfolio] = useState<TaskerPortfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'skills' | 'certifications'>(
    'overview',
  )

  useEffect(() => {
    if (visible && taskerId) {
      loadPortfolio()
    }
  }, [visible, taskerId])

  const loadPortfolio = async () => {
    try {
      setLoading(true)
      console.log('Loading portfolio for tasker ID (profile ID):', taskerId)

      // Since taskerId is actually a profile ID from task applications, use the profile ID method
      const portfolioData = await PortfolioService.getTaskerPortfolioByProfileId(taskerId)

      if (portfolioData) {
        console.log('Portfolio found:', portfolioData)
        setPortfolio(portfolioData)
      } else {
        console.log('No portfolio found for profile ID:', taskerId)
        setPortfolio(null)
      }
    } catch (error) {
      console.error('Error loading portfolio:', error)
      setPortfolio(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLinkPress = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch (error) {
      console.error('Error opening link:', error)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <View style={styles.ratingContainer}>
        {[...Array(5)].map((_, i) => (
          <Ionicons
            key={i}
            name={i < rating ? 'star' : 'star-outline'}
            size={16}
            color={Colors.warning[500]}
          />
        ))}
        <Text style={styles.ratingText}>({rating})</Text>
      </View>
    )
  }

  const renderTabButton = (tab: string, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Ionicons
        name={icon as any}
        size={16}
        color={activeTab === tab ? Colors.primary[500] : Colors.neutral[600]}
      />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {portfolio?.portfolio_description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{portfolio.portfolio_description}</Text>
        </View>
      )}

      {portfolio?.portfolio_website && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Website</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => handleLinkPress(portfolio.portfolio_website!)}
          >
            <Ionicons name="globe-outline" size={16} color={Colors.primary[500]} />
            <Text style={styles.linkText}>{portfolio.portfolio_website}</Text>
            <Ionicons name="open-outline" size={14} color={Colors.neutral[400]} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Media</Text>
        <View style={styles.socialLinks}>
          {portfolio?.portfolio_linkedin && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleLinkPress(portfolio.portfolio_linkedin!)}
            >
              <Ionicons name="logo-linkedin" size={20} color={Colors.primary[500]} />
              <Text style={styles.socialText}>LinkedIn</Text>
            </TouchableOpacity>
          )}
          {portfolio?.portfolio_github && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleLinkPress(portfolio.portfolio_github!)}
            >
              <Ionicons name="logo-github" size={20} color={Colors.neutral[700]} />
              <Text style={styles.socialText}>GitHub</Text>
            </TouchableOpacity>
          )}
          {portfolio?.portfolio_instagram && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleLinkPress(portfolio.portfolio_instagram!)}
            >
              <Ionicons name="logo-instagram" size={20} color={Colors.primary[500]} />
              <Text style={styles.socialText}>Instagram</Text>
            </TouchableOpacity>
          )}
          {portfolio?.portfolio_youtube && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleLinkPress(portfolio.portfolio_youtube!)}
            >
              <Ionicons name="logo-youtube" size={20} color={Colors.error[500]} />
              <Text style={styles.socialText}>YouTube</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {portfolio?.portfolio_video_urls && portfolio.portfolio_video_urls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Videos</Text>
          {portfolio.portfolio_video_urls.map((url, index) => (
            <TouchableOpacity
              key={index}
              style={styles.videoButton}
              onPress={() => handleLinkPress(url)}
            >
              <Ionicons name="play-circle-outline" size={20} color={Colors.primary[500]} />
              <Text style={styles.videoText}>Portfolio Video {index + 1}</Text>
              <Ionicons name="open-outline" size={14} color={Colors.neutral[400]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  )

  const renderProjectsTab = () => (
    <View style={styles.tabContent}>
      {portfolio?.projects && portfolio.projects.length > 0 ? (
        <FlatList
          data={portfolio.projects}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.projectCard}>
              <Text style={styles.projectTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.projectDescription}>{item.description}</Text>
              )}
              {item.category && (
                <View style={styles.projectCategory}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              )}
              <View style={styles.projectLinks}>
                {item.project_url && (
                  <TouchableOpacity
                    style={styles.projectLink}
                    onPress={() => handleLinkPress(item.project_url!)}
                  >
                    <Ionicons name="globe-outline" size={16} color={Colors.primary[500]} />
                    <Text style={styles.projectLinkText}>View Project</Text>
                  </TouchableOpacity>
                )}
                {item.github_url && (
                  <TouchableOpacity
                    style={styles.projectLink}
                    onPress={() => handleLinkPress(item.github_url!)}
                  >
                    <Ionicons name="logo-github" size={16} color={Colors.neutral[700]} />
                    <Text style={styles.projectLinkText}>GitHub</Text>
                  </TouchableOpacity>
                )}
              </View>
              {item.client_name && (
                <Text style={styles.projectClientName}>Client: {item.client_name}</Text>
              )}
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="folder-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No projects showcased yet</Text>
        </View>
      )}
    </View>
  )

  const renderSkillsTab = () => (
    <View style={styles.tabContent}>
      {portfolio?.portfolio_skills && portfolio.portfolio_skills.length > 0 ? (
        <View style={styles.skillsGrid}>
          {portfolio.portfolio_skills.map((skill) => (
            <View key={skill.id} style={styles.skillCard}>
              <Text style={styles.skillName}>{skill.skill_name}</Text>
              <View style={styles.skillLevel}>
                <Text style={styles.skillLevelText}>{skill.skill_level}</Text>
                {skill.years_experience && (
                  <Text style={styles.skillExperience}>{skill.years_experience}y exp</Text>
                )}
              </View>
              {skill.skill_description && (
                <Text style={styles.skillDescription}>{skill.skill_description}</Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No skills listed yet</Text>
        </View>
      )}
    </View>
  )

  const renderCertificationsTab = () => (
    <View style={styles.tabContent}>
      {portfolio?.certifications && portfolio.certifications.length > 0 ? (
        <FlatList
          data={portfolio.certifications}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.certificationCard}>
              <View style={styles.certificationHeader}>
                <Ionicons name="ribbon" size={24} color={Colors.primary[500]} />
                <View style={styles.certificationInfo}>
                  <Text style={styles.certificationName}>{item.certification_name}</Text>
                  <Text style={styles.certificationOrg}>{item.issuing_organization}</Text>
                </View>
              </View>
              {item.issue_date && (
                <Text style={styles.certificationDate}>
                  Issued: {new Date(item.issue_date).toLocaleDateString()}
                </Text>
              )}
              {item.credential_url && (
                <TouchableOpacity
                  style={styles.credentialLink}
                  onPress={() => handleLinkPress(item.credential_url!)}
                >
                  <Ionicons name="link-outline" size={16} color={Colors.primary[500]} />
                  <Text style={styles.credentialLinkText}>View Credential</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="ribbon-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No certifications listed yet</Text>
        </View>
      )}
    </View>
  )

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tasker Profile</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : portfolio ? (
          <>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                {portfolio.avatar_url ? (
                  <Image source={{ uri: portfolio.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {portfolio.full_name?.charAt(0)?.toUpperCase() || 'T'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{portfolio.full_name}</Text>
                <Text style={styles.profileTitle}>{portfolio.portfolio_title || 'Tasker'}</Text>
                {portfolio.rating && (
                  <View style={styles.ratingRow}>
                    {renderStars(Math.floor(portfolio.rating))}
                    <Text style={styles.ratingCount}>({portfolio.total_tasks || 0} tasks)</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              {renderTabButton('overview', 'Overview', 'person-outline')}
              {renderTabButton('projects', 'Projects', 'folder-outline')}
              {renderTabButton('skills', 'Skills', 'bulb-outline')}
              {renderTabButton('certifications', 'Certs', 'ribbon-outline')}
            </View>

            {/* Tab Content */}
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'projects' && renderProjectsTab()}
            {activeTab === 'skills' && renderSkillsTab()}
            {activeTab === 'certifications' && renderCertificationsTab()}
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="person-outline" size={48} color={Colors.neutral[400]} />
            <Text style={styles.errorText}>Profile not found</Text>
            <Text style={styles.errorSubtext}>
              This tasker hasn&apos;t completed their profile setup yet.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[50],
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginTop: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 4,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary[500],
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.neutral[600],
  },
  tabButtonTextActive: {
    color: Colors.primary[500],
  },
  tabContent: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary[500],
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  socialText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  videoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[700],
  },
  projectCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  projectDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 8,
    lineHeight: 20,
  },
  projectCategory: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary[700],
  },
  projectLinks: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  projectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectLinkText: {
    fontSize: 12,
    color: Colors.primary[500],
  },
  projectClientName: {
    fontSize: 12,
    color: Colors.neutral[500],
    fontStyle: 'italic',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  skillCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    width: (width - 64) / 2,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  skillLevel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  skillLevelText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary[500],
  },
  skillExperience: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  skillDescription: {
    fontSize: 12,
    color: Colors.neutral[600],
    lineHeight: 16,
  },
  certificationCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  certificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  certificationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  certificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  certificationOrg: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  certificationDate: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 8,
  },
  credentialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  credentialLinkText: {
    fontSize: 12,
    color: Colors.primary[500],
  },
  testimonialCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  testimonialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  testimonialClient: {
    flex: 1,
  },
  testimonialClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  clientTitle: {
    fontSize: 12,
    color: Colors.neutral[600],
  },
  clientCompany: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  testimonialText: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  testimonialProjectTitle: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginTop: 12,
  },
})
