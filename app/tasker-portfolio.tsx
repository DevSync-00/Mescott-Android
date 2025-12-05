import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import {
  PortfolioService,
  TaskerPortfolio,
  PortfolioProject,
  PortfolioSkill,
  PortfolioCertification,
  PortfolioTestimonial,
} from '../services/PortfolioService'
import { ImageService } from '../services/ImageService'
import * as ImagePicker from 'expo-image-picker'
import Colors from '../constants/Colors'

const { width } = Dimensions.get('window')

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const PROJECT_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Design',
  'Photography',
  'Writing',
  'Marketing',
  'Consulting',
  'Cleaning',
  'Handyman',
  'Delivery',
  'Tutoring',
]

interface PortfolioData {
  portfolio_title: string
  portfolio_description: string
  portfolio_website: string
  portfolio_linkedin: string
  portfolio_instagram: string
  portfolio_facebook: string
  portfolio_youtube: string
  portfolio_twitter: string
  portfolio_github: string
  portfolio_behance: string
  portfolio_dribbble: string
  portfolio_other_links: any[]
  portfolio_video_urls: string[]
}

interface FormData {
  title?: string
  description?: string
  category?: string
  project_url?: string
  github_url?: string
  client_name?: string
  skill_name?: string
  skill_level?: string
  years_experience?: number
  skill_description?: string
  certification_name?: string
  issuing_organization?: string
  certification_number?: string
  issue_date?: string
  credential_url?: string
  client_title?: string
  client_company?: string
  testimonial_text?: string
  rating?: number
}

export default function TaskerPortfolioPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [portfolio, setPortfolio] = useState<TaskerPortfolio | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'skills' | 'certifications'>(
    'overview',
  )

  // Form states
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    portfolio_title: '',
    portfolio_description: '',
    portfolio_website: '',
    portfolio_linkedin: '',
    portfolio_instagram: '',
    portfolio_facebook: '',
    portfolio_youtube: '',
    portfolio_twitter: '',
    portfolio_github: '',
    portfolio_behance: '',
    portfolio_dribbble: '',
    portfolio_other_links: [],
    portfolio_video_urls: [],
  })

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showCertificationModal, setShowCertificationModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Form data for modals
  const [projectData, setProjectData] = useState<FormData>({})
  const [skillData, setSkillData] = useState<FormData>({})
  const [certificationData, setCertificationData] = useState<FormData>({})

  // File upload states
  const [certificateImage, setCertificateImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadPortfolio()
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    router.replace('/auth')
    return null
  }

  const loadPortfolio = async () => {
    if (!user?.user_id) {
      console.log('No user ID available')
      return
    }

    try {
      setLoading(true)
      console.log('Loading portfolio for user:', user.user_id)
      const portfolioData = await PortfolioService.getTaskerPortfolioByUserId(user.user_id)
      console.log('Portfolio data received:', portfolioData)

      if (portfolioData) {
        setPortfolio(portfolioData)
        setPortfolioData({
          portfolio_title: portfolioData.portfolio_title || '',
          portfolio_description: portfolioData.portfolio_description || '',
          portfolio_website: portfolioData.portfolio_website || '',
          portfolio_linkedin: portfolioData.portfolio_linkedin || '',
          portfolio_instagram: portfolioData.portfolio_instagram || '',
          portfolio_facebook: portfolioData.portfolio_facebook || '',
          portfolio_youtube: portfolioData.portfolio_youtube || '',
          portfolio_twitter: portfolioData.portfolio_twitter || '',
          portfolio_github: portfolioData.portfolio_github || '',
          portfolio_behance: portfolioData.portfolio_behance || '',
          portfolio_dribbble: portfolioData.portfolio_dribbble || '',
          portfolio_other_links: portfolioData.portfolio_other_links || [],
          portfolio_video_urls: portfolioData.portfolio_video_urls || [],
        })
      } else {
        console.log('No portfolio data found - user may not have completed tasker application')
        // Create a basic portfolio structure for new users
        const basicPortfolio = {
          id: 'temp-' + Date.now(),
          user_id: user.user_id,
          full_name: user.name || 'User',
          portfolio_title: '',
          portfolio_description: '',
          portfolio_website: '',
          portfolio_linkedin: '',
          portfolio_instagram: '',
          portfolio_facebook: '',
          portfolio_youtube: '',
          portfolio_twitter: '',
          portfolio_github: '',
          portfolio_behance: '',
          portfolio_dribbble: '',
          portfolio_other_links: [],
          portfolio_video_urls: [],
          projects: [],
          portfolio_skills: [],
          certifications: [],
          testimonials: [],
        }
        setPortfolio(basicPortfolio as TaskerPortfolio)
      }
    } catch (error) {
      console.error('Error loading portfolio:', error)
      Alert.alert('Error', 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePortfolio = async () => {
    if (!portfolio?.id) {
      Alert.alert('Error', 'No portfolio found. Please complete your tasker application first.')
      return
    }

    try {
      setLoading(true)
      const success = await PortfolioService.updatePortfolioBasicInfo(portfolio.id, portfolioData)
      if (success) {
        Alert.alert('Success', 'Portfolio updated successfully!')
        loadPortfolio()
      } else {
        Alert.alert('Error', 'Failed to update portfolio')
      }
    } catch (error) {
      console.error('Error saving portfolio:', error)
      Alert.alert('Error', 'Failed to save portfolio')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProject = async () => {
    if (!portfolio?.id) return

    try {
      setLoading(true)
      const newProject = await PortfolioService.createProject({
        ...projectData,
        tasker_application_id: portfolio.id,
      } as PortfolioProject)

      if (newProject) {
        Alert.alert('Success', 'Project added successfully!')
        setShowProjectModal(false)
        setProjectData({})
        loadPortfolio()
      } else {
        Alert.alert('Error', 'Failed to add project')
      }
    } catch (error) {
      console.error('Error adding project:', error)
      Alert.alert('Error', 'Failed to add project')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = async () => {
    if (!portfolio?.id) return

    try {
      setLoading(true)
      const newSkill = await PortfolioService.createSkill({
        ...skillData,
        tasker_application_id: portfolio.id,
      } as PortfolioSkill)

      if (newSkill) {
        Alert.alert('Success', 'Skill added successfully!')
        setShowSkillModal(false)
        setSkillData({})
        loadPortfolio()
      } else {
        Alert.alert('Error', 'Failed to add skill')
      }
    } catch (error) {
      console.error('Error adding skill:', error)
      Alert.alert('Error', 'Failed to add skill')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCertification = async () => {
    if (!portfolio?.id) return

    try {
      setLoading(true)
      const newCertification = await PortfolioService.createCertification({
        ...certificationData,
        certificate_image_url: certificateImage,
        tasker_application_id: portfolio.id,
      } as PortfolioCertification)

      if (newCertification) {
        Alert.alert('Success', 'Certification added successfully!')
        setShowCertificationModal(false)
        setCertificationData({})
        setCertificateImage(null)
        loadPortfolio()
      } else {
        Alert.alert('Error', 'Failed to add certification')
      }
    } catch (error) {
      console.error('Error adding certification:', error)
      Alert.alert('Error', 'Failed to add certification')
    } finally {
      setLoading(false)
    }
  }

  const pickCertificateImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true)
        const uploadResult = await ImageService.uploadImage(result.assets[0].uri, 'certificates')
        if (uploadResult.success && uploadResult.url) {
          setCertificateImage(uploadResult.url)
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload image')
        }
        setUploadingImage(false)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      setUploadingImage(false)
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  const handleEditItem = (item: any, type: string) => {
    setEditingItem(item)
    switch (type) {
      case 'project':
        setProjectData(item)
        setShowProjectModal(true)
        break
      case 'skill':
        setSkillData(item)
        setShowSkillModal(true)
        break
      case 'certification':
        setCertificationData(item)
        setShowCertificationModal(true)
        break
    }
  }

  const handleDeleteItem = async (id: string, type: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true)
            let success = false

            switch (type) {
              case 'project':
                success = await PortfolioService.deleteProject(id)
                break
              case 'skill':
                success = await PortfolioService.deleteSkill(id)
                break
              case 'certification':
                success = await PortfolioService.deleteCertification(id)
                break
            }

            if (success) {
              Alert.alert('Success', 'Item deleted successfully!')
              loadPortfolio()
            } else {
              Alert.alert('Error', 'Failed to delete item')
            }
          } catch (error) {
            console.error('Error deleting item:', error)
            Alert.alert('Error', 'Failed to delete item')
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Portfolio Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Portfolio Title *</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_title}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_title: text }))
            }
            placeholder="e.g., Professional Web Developer"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Portfolio Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={portfolioData.portfolio_description}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_description: text }))
            }
            placeholder="Tell potential clients about your expertise and what makes you unique..."
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_website}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_website: text }))
            }
            placeholder="https://yourwebsite.com"
            keyboardType="url"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Media & Links</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>LinkedIn</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_linkedin}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_linkedin: text }))
            }
            placeholder="https://linkedin.com/in/yourprofile"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>GitHub</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_github}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_github: text }))
            }
            placeholder="https://github.com/yourusername"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_instagram}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_instagram: text }))
            }
            placeholder="https://instagram.com/yourusername"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>YouTube</Text>
          <TextInput
            style={styles.input}
            value={portfolioData.portfolio_youtube}
            onChangeText={(text) =>
              setPortfolioData((prev: PortfolioData) => ({ ...prev, portfolio_youtube: text }))
            }
            placeholder="https://youtube.com/yourchannel"
            keyboardType="url"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSavePortfolio}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Portfolio'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  const renderProjectsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Portfolio Projects</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setProjectData({})
            setEditingItem(null)
            setShowProjectModal(true)
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Project</Text>
        </TouchableOpacity>
      </View>

      {portfolio?.projects && portfolio.projects.length > 0 ? (
        <FlatList
          data={portfolio.projects}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditItem(item, 'project')}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.primary[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteItem(item.id!, 'project')}
                  >
                    <Ionicons name="trash" size={16} color={Colors.error[500]} />
                  </TouchableOpacity>
                </View>
              </View>
              {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
              {item.category && <Text style={styles.itemCategory}>{item.category}</Text>}
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="folder-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No projects yet</Text>
          <Text style={styles.emptyStateSubtext}>Add your first project to showcase your work</Text>
        </View>
      )}
    </View>
  )

  const renderSkillsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Skills & Expertise</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setSkillData({})
            setEditingItem(null)
            setShowSkillModal(true)
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Skill</Text>
        </TouchableOpacity>
      </View>

      {portfolio?.portfolio_skills && portfolio.portfolio_skills.length > 0 ? (
        <FlatList
          data={portfolio.portfolio_skills}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.skill_name}</Text>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditItem(item, 'skill')}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.primary[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteItem(item.id!, 'skill')}
                  >
                    <Ionicons name="trash" size={16} color={Colors.error[500]} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.skillInfo}>
                <Text style={styles.skillLevel}>{item.skill_level}</Text>
                {item.years_experience && (
                  <Text style={styles.skillExperience}>{item.years_experience} years</Text>
                )}
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No skills added yet</Text>
          <Text style={styles.emptyStateSubtext}>Add your skills to showcase your expertise</Text>
        </View>
      )}
    </View>
  )

  const renderCertificationsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Certifications</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setCertificationData({})
            setEditingItem(null)
            setShowCertificationModal(true)
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Certification</Text>
        </TouchableOpacity>
      </View>

      {portfolio?.certifications && portfolio.certifications.length > 0 ? (
        <FlatList
          data={portfolio.certifications}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.certification_name}</Text>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditItem(item, 'certification')}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.primary[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteItem(item.id!, 'certification')}
                  >
                    <Ionicons name="trash" size={16} color={Colors.error[500]} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.itemDescription}>{item.issuing_organization}</Text>
              {item.issue_date && (
                <Text style={styles.itemDate}>
                  Issued: {new Date(item.issue_date).toLocaleDateString()}
                </Text>
              )}
              {item.certificate_image_url && (
                <View style={styles.certificateImageContainer}>
                  <Image
                    source={{ uri: item.certificate_image_url }}
                    style={styles.certificateImage}
                  />
                </View>
              )}
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="ribbon-outline" size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No certifications yet</Text>
          <Text style={styles.emptyStateSubtext}>Add your certifications to build trust</Text>
        </View>
      )}
    </View>
  )

  const renderProjectModal = () => (
    <Modal
      visible={showProjectModal}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowProjectModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowProjectModal(false)}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Project</Text>
          <TouchableOpacity
            style={[styles.modalSaveButton, loading && styles.modalSaveButtonDisabled]}
            onPress={handleAddProject}
            disabled={loading}
          >
            <Text style={styles.modalSaveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Project Title *</Text>
            <TextInput
              style={styles.input}
              value={projectData.title || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, title: text }))
              }
              placeholder="Enter project title"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={projectData.description || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, description: text }))
              }
              placeholder="Describe your project..."
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={projectData.category || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, category: text }))
              }
              placeholder="e.g., Web Development"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Project URL</Text>
            <TextInput
              style={styles.input}
              value={projectData.project_url || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, project_url: text }))
              }
              placeholder="https://yourproject.com"
              keyboardType="url"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>GitHub URL</Text>
            <TextInput
              style={styles.input}
              value={projectData.github_url || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, github_url: text }))
              }
              placeholder="https://github.com/username/project"
              keyboardType="url"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Client Name</Text>
            <TextInput
              style={styles.input}
              value={projectData.client_name || ''}
              onChangeText={(text) =>
                setProjectData((prev: FormData) => ({ ...prev, client_name: text }))
              }
              placeholder="Client or company name"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )

  const renderSkillModal = () => (
    <Modal
      visible={showSkillModal}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSkillModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSkillModal(false)}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Skill</Text>
          <TouchableOpacity
            style={[styles.modalSaveButton, loading && styles.modalSaveButtonDisabled]}
            onPress={handleAddSkill}
            disabled={loading}
          >
            <Text style={styles.modalSaveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skill Name *</Text>
            <TextInput
              style={styles.input}
              value={skillData.skill_name || ''}
              onChangeText={(text) =>
                setSkillData((prev: FormData) => ({ ...prev, skill_name: text }))
              }
              placeholder="e.g., React Development"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skill Level *</Text>
            <View style={styles.levelButtons}>
              {SKILL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    skillData.skill_level === level && styles.levelButtonSelected,
                  ]}
                  onPress={() =>
                    setSkillData((prev: FormData) => ({ ...prev, skill_level: level }))
                  }
                >
                  <Text
                    style={[
                      styles.levelButtonText,
                      skillData.skill_level === level && styles.levelButtonTextSelected,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={skillData.years_experience?.toString() || ''}
              onChangeText={(text) =>
                setSkillData((prev: FormData) => ({
                  ...prev,
                  years_experience: parseInt(text) || 0,
                }))
              }
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={skillData.skill_description || ''}
              onChangeText={(text) =>
                setSkillData((prev: FormData) => ({ ...prev, skill_description: text }))
              }
              placeholder="Describe your expertise in this skill..."
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )

  const renderCertificationModal = () => (
    <Modal
      visible={showCertificationModal}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCertificationModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCertificationModal(false)}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Certification</Text>
          <TouchableOpacity
            style={[styles.modalSaveButton, loading && styles.modalSaveButtonDisabled]}
            onPress={handleAddCertification}
            disabled={loading}
          >
            <Text style={styles.modalSaveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Certification Name *</Text>
            <TextInput
              style={styles.input}
              value={certificationData.certification_name || ''}
              onChangeText={(text) =>
                setCertificationData((prev: FormData) => ({ ...prev, certification_name: text }))
              }
              placeholder="e.g., AWS Certified Solutions Architect"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Issuing Organization *</Text>
            <TextInput
              style={styles.input}
              value={certificationData.issuing_organization || ''}
              onChangeText={(text) =>
                setCertificationData((prev: FormData) => ({ ...prev, issuing_organization: text }))
              }
              placeholder="e.g., Amazon Web Services"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Certification Number</Text>
            <TextInput
              style={styles.input}
              value={certificationData.certification_number || ''}
              onChangeText={(text) =>
                setCertificationData((prev: FormData) => ({ ...prev, certification_number: text }))
              }
              placeholder="Enter certification number"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Issue Date</Text>
            <TextInput
              style={styles.input}
              value={certificationData.issue_date || ''}
              onChangeText={(text) =>
                setCertificationData((prev: FormData) => ({ ...prev, issue_date: text }))
              }
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Credential URL</Text>
            <TextInput
              style={styles.input}
              value={certificationData.credential_url || ''}
              onChangeText={(text) =>
                setCertificationData((prev: FormData) => ({ ...prev, credential_url: text }))
              }
              placeholder="https://credential.url"
              keyboardType="url"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Certificate Image *</Text>
            <TouchableOpacity
              style={styles.imageUploadButton}
              onPress={pickCertificateImage}
              disabled={uploadingImage}
            >
              {certificateImage ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: certificateImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setCertificateImage(null)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons
                    name={uploadingImage ? 'hourglass' : 'cloud-upload'}
                    size={32}
                    color={uploadingImage ? Colors.warning[500] : Colors.primary[500]}
                  />
                  <Text style={styles.uploadText}>
                    {uploadingImage ? 'Uploading...' : 'Upload Certificate Image'}
                  </Text>
                  <Text style={styles.uploadSubtext}>Tap to select an image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Save Button */}
          <View style={styles.modalBottomActions}>
            <TouchableOpacity
              style={[
                styles.modalBottomSaveButton,
                loading && styles.modalBottomSaveButtonDisabled,
              ]}
              onPress={handleAddCertification}
              disabled={loading}
            >
              <Text style={styles.modalBottomSaveButtonText}>
                {loading ? 'Saving...' : 'Save Certification'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )

  if (loading && !portfolio) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!portfolio) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Portfolio</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={Colors.neutral[300]} />
          <Text style={styles.emptyStateText}>No Portfolio Found</Text>
          <Text style={styles.emptyStateSubtext}>
            You need to complete your tasker application first to create a portfolio.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/tasker-application')}
          >
            <Text style={styles.primaryButtonText}>Apply to Become a Tasker</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      {/* Modern Header */}
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Portfolio</Text>
        <TouchableOpacity onPress={handleSavePortfolio} style={styles.headerSaveButton}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Compact Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {(['overview', 'projects', 'skills', 'certifications'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={
                  tab === 'overview'
                    ? 'person'
                    : tab === 'projects'
                      ? 'briefcase'
                      : tab === 'skills'
                        ? 'star'
                        : 'ribbon'
                }
                size={14}
                color={activeTab === tab ? '#fff' : Colors.neutral[600]}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'projects' && renderProjectsTab()}
        {activeTab === 'skills' && renderSkillsTab()}
        {activeTab === 'certifications' && renderCertificationsTab()}
      </View>

      {renderProjectModal()}
      {renderSkillModal()}
      {renderCertificationModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
    textAlign: 'center',
  },
  headerSaveButton: {
    backgroundColor: Colors.primary[500],
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  activeTab: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[600],
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabContent: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral[900],
    letterSpacing: -0.3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.neutral[900],
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 4,
    lineHeight: 20,
  },
  itemCategory: {
    fontSize: 12,
    color: Colors.primary[500],
    fontWeight: '600',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  skillInfo: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  skillLevel: {
    fontSize: 12,
    color: Colors.primary[500],
    fontWeight: '600',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  skillExperience: {
    fontSize: 12,
    color: Colors.neutral[600],
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemDate: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  cancelButton: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  modalSaveButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalSaveButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBottomActions: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  modalBottomSaveButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBottomSaveButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  modalBottomSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  levelButtonSelected: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  levelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  levelButtonTextSelected: {
    color: '#fff',
  },
  imageUploadButton: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  imagePreview: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  certificateImageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  certificateImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
})
