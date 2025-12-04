import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SearchService, SearchFilters, SearchSuggestion } from '../services/SearchService'
import Colors from '../constants/Colors'

interface AdvancedSearchProps {
  visible: boolean
  onClose: () => void
  onSearch: (filters: SearchFilters) => void
  initialFilters?: SearchFilters
}

export default function AdvancedSearch({
  visible,
  onClose,
  onSearch,
  initialFilters = {}
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [searchData, setSearchData] = useState<any>(null)

  useEffect(() => {
    if (visible) {
      loadSearchData()
    }
  }, [visible])

  const loadSearchData = async () => {
    setLoading(true)
    try {
      const data = await SearchService.getSearchFilters()
      setSearchData(data)
    } catch (error) {
      console.error('Error loading search data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    onSearch(filters)
    onClose()
  }

  const handleClear = () => {
    setFilters({})
  }

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'category':
        setFilters(prev => ({ ...prev, category: suggestion.id.replace('category_', '') }))
        break
      case 'location':
        setFilters(prev => ({ ...prev, location: suggestion.text }))
        break
      case 'task':
        setFilters(prev => ({ ...prev, query: suggestion.text }))
        break
    }
  }

  const renderSuggestion = ({ item }: { item: SearchSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionSelect(item)}
    >
      <Ionicons
        name={
          item.type === 'category' ? 'folder-outline' :
          item.type === 'location' ? 'location-outline' :
          item.type === 'task' ? 'briefcase-outline' : 'search-outline'
        }
        size={16}
        color={Colors.neutral[500]}
      />
      <Text style={styles.suggestionText}>{item.text}</Text>
    </TouchableOpacity>
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
            <Ionicons name="close" size={24} color={Colors.neutral[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Advanced Search</Text>
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false} alwaysBounceVertical={false} overScrollMode="never">
          {/* Search Query */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Terms</Text>
            <TextInput
              style={styles.input}
              placeholder="What are you looking for?"
              value={filters.query || ''}
              onChangeText={(text) => setFilters(prev => ({ ...prev, query: text }))}
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          {/* Category Filter */}
          {searchData?.categories && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} alwaysBounceVertical={false} overScrollMode="never">
                {searchData.categories.map((category: any) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterChip,
                      filters.category === category.id && styles.filterChipActive
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      category: prev.category === category.id ? undefined : category.id
                    }))}
                  >
                    <Text style={[
                      styles.filterChipText,
                      filters.category === category.id && styles.filterChipTextActive
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Budget Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Range</Text>
            <View style={styles.budgetContainer}>
              <TextInput
                style={styles.budgetInput}
                placeholder="Min"
                value={filters.budgetMin?.toString() || ''}
                onChangeText={(text) => setFilters(prev => ({
                  ...prev,
                  budgetMin: text ? parseFloat(text) : undefined
                }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.neutral[400]}
              />
              <Text style={styles.budgetSeparator}>to</Text>
              <TextInput
                style={styles.budgetInput}
                placeholder="Max"
                value={filters.budgetMax?.toString() || ''}
                onChangeText={(text) => setFilters(prev => ({
                  ...prev,
                  budgetMax: text ? parseFloat(text) : undefined
                }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.neutral[400]}
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="City, State"
              value={filters.location || ''}
              onChangeText={(text) => setFilters(prev => ({ ...prev, location: text }))}
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          {/* Status */}
          {searchData?.statuses && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} alwaysBounceVertical={false} overScrollMode="never">
                {searchData.statuses.map((status: any) => (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.filterChip,
                      filters.status === status.value && styles.filterChipActive
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      status: prev.status === status.value ? undefined : status.value
                    }))}
                  >
                    <Text style={[
                      styles.filterChipText,
                      filters.status === status.value && styles.filterChipTextActive
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Sort Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.sortContainer}>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  filters.sortBy === 'created_at' && styles.sortOptionActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, sortBy: 'created_at' }))}
              >
                <Text style={[
                  styles.sortOptionText,
                  filters.sortBy === 'created_at' && styles.sortOptionTextActive
                ]}>
                  Date
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  filters.sortBy === 'budget' && styles.sortOptionActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, sortBy: 'budget' }))}
              >
                <Text style={[
                  styles.sortOptionText,
                  filters.sortBy === 'budget' && styles.sortOptionTextActive
                ]}>
                  Budget
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  filters.sortBy === 'title' && styles.sortOptionActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, sortBy: 'title' }))}
              >
                <Text style={[
                  styles.sortOptionText,
                  filters.sortBy === 'title' && styles.sortOptionTextActive
                ]}>
                  Title
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    color: Colors.primary[500],
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.neutral[900],
  },
  filterChip: {
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.neutral[700],
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  budgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.neutral[900],
  },
  budgetSeparator: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sortOptionActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  sortOptionText: {
    fontSize: 14,
    color: Colors.neutral[700],
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  suggestionText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.neutral[700],
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: 8,
    paddingVertical: 16,
    gap: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
