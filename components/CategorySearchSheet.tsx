import React, { useMemo, useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'
import { CATEGORIES } from '../constants/Categories'
import BottomSheet, { BottomSheetRef } from './BottomSheet'

interface CategorySearchSheetProps {
  visible: boolean
  onClose: () => void
  onSelectCategory: (name: string) => void
}

function CategorySearchSheet({ visible, onClose, onSelectCategory }: CategorySearchSheetProps) {
  const [query, setQuery] = useState('')
  const bottomSheetRef = useRef<BottomSheetRef>(null)

  useEffect(() => {
    if (visible) setQuery('')
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CATEGORIES
    return CATEGORIES.filter((c) => c.name.toLowerCase().includes(q))
  }, [query])

  return (
    <BottomSheet
      ref={bottomSheetRef}
      visible={visible}
      onClose={onClose}
      snapPoints={[0.3, 0.9, 1.0]}
      initialSnapPoint={1}
      useInternalScroll={false}
    >
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <View style={styles.headerActionPlaceholder} />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Search Services</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.headerActionPlaceholder} />
          </View>
        </View>

        {/* Fixed Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.neutral[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories..."
            placeholderTextColor={Colors.neutral[400]}
            style={styles.searchInput}
            autoFocus
          />
        </View>

        {/* Scrollable List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
        >
          {filtered.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.item}
              onPress={() => onSelectCategory(item.name)}
            >
              <View style={[styles.avatar, { backgroundColor: item.color + '20' }]}>
                <Ionicons
                  name={(item.icon as any) || 'pricetag'}
                  size={18}
                  color={Colors.primary[500]}
                />
              </View>
              <Text style={styles.itemText}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.neutral[400]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
    letterSpacing: 0.3,
  },
  headerActions: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerActionPlaceholder: {
    width: 36,
    height: 36,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    marginVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})

export default React.memo(CategorySearchSheet)
