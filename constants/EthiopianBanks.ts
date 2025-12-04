export interface EthiopianBank {
  id: string
  name: string
  code: string
  logo?: string
  isActive: boolean
  accountNumberLength: number
  accountNumberFormat: string
  description?: string
}

export interface MobileMoneyProvider {
  id: string
  name: string
  code: string
  logo?: string
  isActive: boolean
  phoneNumberLength: number
  phoneNumberFormat: string
  description?: string
}

// Ethiopian Banks - Complete List
export const ETHIOPIAN_BANKS: EthiopianBank[] = [
  {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    code: 'CBE',
    isActive: true,
    accountNumberLength: 13,
    accountNumberFormat: 'XXXX-XXXX-XXXX-X',
    description: 'The largest bank in Ethiopia'
  },
  {
    id: 'abay',
    name: 'Abay Bank',
    code: 'ABAY',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'addis_international',
    name: 'Addis International Bank',
    code: 'ADDIS_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'ahadu',
    name: 'Ahadu Bank',
    code: 'AHADU',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'amhara',
    name: 'Amhara Bank',
    code: 'AMHARA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'awash_international',
    name: 'Awash International Bank',
    code: 'AWASH_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'abyssinia',
    name: 'Bank of Abyssinia',
    code: 'ABYSSINIA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'berhan',
    name: 'Berhan Bank',
    code: 'BERHAN',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'bunna_international',
    name: 'Bunna International Bank',
    code: 'BUNNA_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'cooperative_oromia',
    name: 'Cooperative Bank of Oromia',
    code: 'COOP_OROMIA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Cooperative bank'
  },
  {
    id: 'dashen',
    name: 'Dashen Bank',
    code: 'DASHEN',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'debub_global',
    name: 'Debub Global Bank',
    code: 'DEBUB_GLOBAL',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'enat',
    name: 'Enat Bank',
    code: 'ENAT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Women-focused bank'
  },
  {
    id: 'gadaa',
    name: 'Gadaa Bank',
    code: 'GADAA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'global_ethiopia',
    name: 'Global Bank Ethiopia',
    code: 'GLOBAL_ETH',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'goh_betoch',
    name: 'Goh Betoch Bank',
    code: 'GOH_BETOCH',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'hibret',
    name: 'Hibret Bank',
    code: 'HIBRET',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'hijra',
    name: 'Hijra Bank',
    code: 'HIJRA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'lion_international',
    name: 'Lion International Bank',
    code: 'LION_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'nib_international',
    name: 'Nib International Bank',
    code: 'NIB_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'omo',
    name: 'Omo Bank',
    code: 'OMO',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'oromia_international',
    name: 'Oromia International Bank',
    code: 'OROMIA_INT',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'rammis',
    name: 'Rammis Bank',
    code: 'RAMMIS',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'shabelle',
    name: 'Shabelle Bank',
    code: 'SHABELLE',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'sidama',
    name: 'Sidama Bank',
    code: 'SIDAMA',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'siinqee',
    name: 'Siinqee Bank',
    code: 'SIINQEE',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'tsehay',
    name: 'Tsehay Bank',
    code: 'TSEHAY',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'tsedey',
    name: 'Tsedey Bank',
    code: 'TSEDEY',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'wegagen',
    name: 'Wegagen Bank',
    code: 'WEGAGEN',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'zamzam',
    name: 'ZamZam Bank',
    code: 'ZAMZAM',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  },
  {
    id: 'zemen',
    name: 'Zemen Bank',
    code: 'ZEMEN',
    isActive: true,
    accountNumberLength: 12,
    accountNumberFormat: 'XXXX-XXXX-XXXX',
    description: 'Private commercial bank'
  }
]

// Mobile Money Providers
export const MOBILE_MONEY_PROVIDERS: MobileMoneyProvider[] = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    code: 'TELEBIRR',
    isActive: true,
    phoneNumberLength: 10,
    phoneNumberFormat: '09XX-XXX-XXXX',
    description: 'Ethio Telecom mobile money service'
  },
  {
    id: 'm_pesa',
    name: 'M-Pesa',
    code: 'MPESA',
    isActive: true,
    phoneNumberLength: 10,
    phoneNumberFormat: '09XX-XXX-XXXX',
    description: 'Safaricom mobile money service'
  }
]

// Cash Pickup Locations
export const CASH_PICKUP_LOCATIONS = [
  'Addis Ababa - Bole',
  'Addis Ababa - Meskel Square',
  'Addis Ababa - Piassa',
  'Addis Ababa - Merkato',
  'Addis Ababa - CMC',
  'Addis Ababa - Saris',
  'Addis Ababa - Kazanchis',
  'Addis Ababa - Mexico Square',
  'Addis Ababa - Arat Kilo',
  'Addis Ababa - Shiro Meda',
  'Dire Dawa',
  'Hawassa',
  'Bahir Dar',
  'Gondar',
  'Mekelle',
  'Jimma',
  'Dessie',
  'Arba Minch',
  'Jijiga',
  'Harar'
]

// Helper functions
export const getBankById = (id: string): EthiopianBank | undefined => {
  return ETHIOPIAN_BANKS.find(bank => bank.id === id)
}

export const getActiveBanks = (): EthiopianBank[] => {
  return ETHIOPIAN_BANKS.filter(bank => bank.isActive)
}

export const getMobileMoneyProviderById = (id: string): MobileMoneyProvider | undefined => {
  return MOBILE_MONEY_PROVIDERS.find(provider => provider.id === id)
}

export const getActiveMobileMoneyProviders = (): MobileMoneyProvider[] => {
  return MOBILE_MONEY_PROVIDERS.filter(provider => provider.isActive)
}

// Validation functions
export const validateAccountNumber = (bankId: string, accountNumber: string): boolean => {
  const bank = getBankById(bankId)
  if (!bank) return false
  
  // Remove any non-digit characters
  const cleanNumber = accountNumber.replace(/\D/g, '')
  
  return cleanNumber.length === bank.accountNumberLength
}

export const validatePhoneNumber = (providerId: string, phoneNumber: string): boolean => {
  const provider = getMobileMoneyProviderById(providerId)
  if (!provider) return false
  
  // Remove any non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '')
  
  return cleanNumber.length === provider.phoneNumberLength && cleanNumber.startsWith('09')
}

export const formatAccountNumber = (bankId: string, accountNumber: string): string => {
  const bank = getBankById(bankId)
  if (!bank) return accountNumber
  
  const cleanNumber = accountNumber.replace(/\D/g, '')
  const format = bank.accountNumberFormat
  
  let formatted = ''
  let digitIndex = 0
  
  for (let i = 0; i < format.length; i++) {
    if (format[i] === 'X') {
      if (digitIndex < cleanNumber.length) {
        formatted += cleanNumber[digitIndex]
        digitIndex++
      } else {
        formatted += 'X'
      }
    } else {
      formatted += format[i]
    }
  }
  
  return formatted
}

export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleanNumber = phoneNumber.replace(/\D/g, '')
  
  if (cleanNumber.length === 10 && cleanNumber.startsWith('09')) {
    return `${cleanNumber.slice(0, 4)}-${cleanNumber.slice(4, 7)}-${cleanNumber.slice(7)}`
  }
  
  return phoneNumber
}
