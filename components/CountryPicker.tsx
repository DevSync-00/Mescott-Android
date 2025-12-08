import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet from './BottomSheet'
import { Colors } from '../constants/Colors'

export interface Country {
  code: string
  name: string
  dialCode: string
  flag: string
}

// Helper function to get high-resolution flag URL
const getFlagUrl = (countryCode: string) => {
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`
}

// Popular countries list with flags from flagcdn.com
const COUNTRIES: Country[] = [
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: getFlagUrl('ET') },
  { code: 'US', name: 'United States', dialCode: '+1', flag: getFlagUrl('US') },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: getFlagUrl('GB') },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: getFlagUrl('KE') },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: getFlagUrl('TZ') },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: getFlagUrl('UG') },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: getFlagUrl('RW') },
  { code: 'SD', name: 'Sudan', dialCode: '+249', flag: getFlagUrl('SD') },
  { code: 'ER', name: 'Eritrea', dialCode: '+291', flag: getFlagUrl('ER') },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: getFlagUrl('DJ') },
  { code: 'SO', name: 'Somalia', dialCode: '+252', flag: getFlagUrl('SO') },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: getFlagUrl('EG') },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: getFlagUrl('NG') },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: getFlagUrl('ZA') },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: getFlagUrl('GH') },
  { code: 'IN', name: 'India', dialCode: '+91', flag: getFlagUrl('IN') },
  { code: 'CN', name: 'China', dialCode: '+86', flag: getFlagUrl('CN') },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: getFlagUrl('AE') },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: getFlagUrl('SA') },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: getFlagUrl('CA') },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: getFlagUrl('AU') },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: getFlagUrl('DE') },
  { code: 'FR', name: 'France', dialCode: '+33', flag: getFlagUrl('FR') },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: getFlagUrl('IT') },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: getFlagUrl('ES') },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: getFlagUrl('NL') },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: getFlagUrl('BE') },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: getFlagUrl('CH') },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: getFlagUrl('AT') },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: getFlagUrl('SE') },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: getFlagUrl('NO') },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: getFlagUrl('DK') },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: getFlagUrl('FI') },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: getFlagUrl('PL') },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: getFlagUrl('BR') },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: getFlagUrl('MX') },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: getFlagUrl('AR') },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: getFlagUrl('JP') },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: getFlagUrl('KR') },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: getFlagUrl('SG') },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: getFlagUrl('MY') },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: getFlagUrl('TH') },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: getFlagUrl('PH') },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: getFlagUrl('ID') },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: getFlagUrl('VN') },
]

interface CountryPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (country: Country) => void
  selectedCountry?: Country
}

export default function CountryPicker({ visible, onClose, onSelect, selectedCountry }: CountryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const defaultCountry = selectedCountry || COUNTRIES[0] // Default to Ethiopia

  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery) ||
      country.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectCountry = (country: Country) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(country)
    onClose()
    setSearchQuery('')
  }

  return (
    <BottomSheet 
      visible={visible} 
      onClose={onClose} 
      snapPoints={[0.9]} 
      initialSnapPoint={0}
      useInternalScroll={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.neutral[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country..."
            placeholderTextColor={Colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={Colors.neutral[400]} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.countryItem,
                defaultCountry.code === item.code && styles.countryItemSelected,
              ]}
              onPress={() => handleSelectCountry(item)}
              activeOpacity={0.7}
            >
              <View style={styles.flagContainer}>
                <Image
                  source={{ uri: item.flag }}
                  style={styles.countryFlag}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </View>
              <View style={styles.countryInfo}>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDialCode}>{item.dialCode}</Text>
              </View>
              {defaultCountry.code === item.code && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary[500]} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No countries found</Text>
            </View>
          }
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  countryItemSelected: {
    backgroundColor: Colors.primary[50],
  },
  flagContainer: {
    width: 40,
    height: 30,
    borderRadius: 6,
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 0.5,
    borderColor: Colors.border.light,
  },
  countryFlag: {
    width: 40,
    height: 30,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  countryDialCode: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.neutral[500],
  },
})

export { COUNTRIES }

