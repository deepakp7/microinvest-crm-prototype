import { writable, get } from 'svelte/store';

// Default dynamic fields configured for Lead/Opportunity models (Low-Code configuration)
const defaultFields = [
  { id: 'firstName', label: 'First name', type: 'text', required: true, placeholder: 'e.g. Jane' },
  { id: 'lastName', label: 'Last name', type: 'text', required: true, placeholder: 'e.g. Doe' },
  { id: 'jobTitle', label: 'Job title', type: 'text', required: true, placeholder: 'e.g. CEO' },
  { id: 'phone', label: 'Phone number', type: 'tel', required: false, placeholder: 'e.g. +44 20 7946 0199' },
  { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'e.g. jane@company.com' },
  { id: 'companyName', label: 'Organisation name', type: 'text', required: true, placeholder: 'e.g. MicroInvest Corp' },
  { id: 'postcode', label: 'Postcode (registered address)', type: 'text', required: true, placeholder: 'e.g. SW1A 1AA' },
  { id: 'registrationNumber', label: 'Companies House / FCA registration number', type: 'text', required: true, placeholder: 'Registration number' },
  { id: 'charityNumber', label: 'Charity Commission number (if applicable)', type: 'text', required: false, placeholder: '' },
  { id: 'website', label: 'Organisation website', type: 'text', required: false, placeholder: 'https://example.org' },
  { id: 'legalStructure', label: 'Legal structure', type: 'select', required: true, placeholder: 'Select legal structure', options: [
    'Limited Company', 'Charity', 'Community Interest Company (CIC)', 'Co-operative', 'Social Enterprise', 'Partnership', 'Sole Trader', 'Limited Liability Partnership (LLP)', 'Charitable Incorporated Organisation (CIO)', 'Trust', 'Branch of overseas company', 'Unincorporated Association', 'PLC', 'Other', 'Not sure'
  ] },
  { id: 'startedOperating', label: 'Started operating (year)', type: 'text', required: true, placeholder: 'e.g. 2018' },
  { id: 'socialMissionInArticles', label: 'Social mission / asset lock / dividend cap in articles?', type: 'select', required: true, placeholder: 'Select', options: ['Yes, already in place','Not yet in place but open to consider','Not in place and not able to add','Unsure'] },
  { id: 'missionDescription', label: 'Describe your organisation’s social mission', type: 'textarea', required: true, placeholder: 'Short description of social mission' },
  { id: 'unrelatedDirectors', label: 'At least two unrelated directors?', type: 'select', required: true, placeholder: 'Yes / No', options: ['Yes','No'] },
  { id: 'tradingIncomePercent', label: 'Percentage of income from trading (%)', type: 'number', required: true, placeholder: 'e.g. 75' },
  { id: 'uploadedAccounts', label: 'Upload last 2 years accounts', type: 'file', required: true, placeholder: '' },
  { id: 'noTwoYearsAccounts', label: 'No two years of accounts', type: 'checkbox', required: false, checkboxLabel: 'I don\'t have 2 years of accounts' },
  { id: 'miscUploads', label: 'Upload additional documents', type: 'file', required: false, multiple: true, placeholder: '' },

  // Investment requirement fields
  { id: 'investmentAmount', label: 'How much investment are you looking for?', type: 'select', required: true, placeholder: 'Select ticket size', options: ['25-200k','201k-500k','501k-1m','1m+'] },
  { id: 'investmentPurpose', label: 'What do you hope to achieve with the investment?', type: 'textarea', required: true, placeholder: 'Describe intended use' },
  { id: 'repaymentMethod', label: 'How do you expect to repay the investment?', type: 'textarea', required: true, placeholder: '' },

  // Communication
  { id: 'howHeard', label: 'How did you hear about MicroInvest?', type: 'select', required: true, placeholder: 'Select one', options: ['Referral','Search engine','Social media','Event','Newsletter','Partner organisation','Press','Existing client','Other','AI search (ChatGPT/Copilot)'] },
  { id: 'consentNewsletter', label: 'I consent to receiving the MicroInvest Newsletter', type: 'checkbox', required: false, checkboxLabel: 'Subscribe to newsletter' },

  // Additional questions for > £500k
  { id: 'propertyOwner', label: 'Do you own / plan to buy a property as part of this transaction?', type: 'select', required: true, placeholder: 'Yes / No', options: ['Yes','No'] },
  { id: 'propertyDeposit', label: 'For property purchases: Do you have a deposit?', type: 'select', required: false, placeholder: 'Yes / No', options: ['Yes','No'] },
  { id: 'breakdownSpend', label: 'Please give a breakdown of how the investment will be spent', type: 'textarea', required: true, placeholder: 'Budget breakdown' },

  // Keep some existing CRM convenience fields
  { id: 'investmentFacility', label: 'Investment Facility', type: 'select', required: true, options: ['Renewable Energy Dev Loan', 'Urban Housing Fund', 'Tech Innovation Venture', 'Green Microfinance Fund'], placeholder: 'Select a facility' },
  { id: 'dealSize', label: 'Proposed Deal Size (£)', type: 'number', required: false, placeholder: 'e.g. 1500000' },
  { id: 'esgRating', label: 'ESG Impact Rating', type: 'select', required: false, options: ['AAA (Exceptional)', 'AA (High Impact)', 'A (Moderate)', 'B (Minimum Standard)'], placeholder: 'Select impact level' }
];

// Default lifecycle pipeline stages
const defaultStages = [
  { id: 'pre_dd', label: 'Pre-Due Diligence', probability: 10, color: '#f39c12' },
  { id: 'dd', label: 'Due Diligence', probability: 30, color: '#3498db' },
  { id: 'ic', label: 'Ready for Investment Committee', probability: 60, color: '#9b59b6' },
  { id: 'approved', label: 'Loan Approved', probability: 80, color: '#8e44ad' },
  { id: 'signed', label: 'Deal Signed', probability: 90, color: '#d35400' },
  { id: 'won', label: 'Disbursed/Won', probability: 100, color: '#2ecc71' },
  { id: 'lost', label: 'Lost', probability: 0, color: '#e74c3c' }
];

// Initial mock leads
const defaultLeads = [
  {
    id: 'ld-1',
    companyName: 'SolarTech Solutions',
    contactName: 'Alice Vane',
    email: 'alice@solartech.io',
    phone: '+44 20 7946 2631',
    investmentFacility: 'Renewable Energy Dev Loan',
    dealSize: 1200000,
    esgRating: 'AAA (Exceptional)',
    createdAt: '2026-06-10T10:14:00Z',
    status: 'converted'
  },
  {
    id: 'ld-2',
    companyName: 'Apex Housing Group',
    contactName: 'Bob Miller',
    email: 'bob@apexhousing.com',
    phone: '+44 20 7946 9012',
    investmentFacility: 'Urban Housing Fund',
    dealSize: 4500000,
    esgRating: 'AA (High Impact)',
    createdAt: '2026-06-11T14:30:00Z',
    status: 'active'
  },
  {
    id: 'ld-3',
    companyName: 'NextGen Bio',
    contactName: 'Clara Chen',
    email: 'clara@nextgenbio.co',
    phone: '+44 20 7946 4432',
    investmentFacility: 'Tech Innovation Venture',
    dealSize: 850000,
    esgRating: 'A (Moderate)',
    createdAt: '2026-06-12T09:00:00Z',
    status: 'converted'
  },
  {
    id: 'ld-4',
    companyName: 'Ecotech Microgrid',
    contactName: 'Elena Rostova',
    email: 'elena@ecotech.net',
    phone: '+44 20 7946 0958',
    investmentFacility: 'Renewable Energy Dev Loan',
    dealSize: 620000,
    esgRating: 'AAA (Exceptional)',
    createdAt: '2026-06-14T08:15:00Z',
    status: 'active'
  }
];

// Initial opportunities linked to stages
const defaultOpportunities = [
  {
    id: 'opp-1',
    companyName: 'SolarTech Solutions',
    contactName: 'Alice Vane',
    email: 'alice@solartech.io',
    phone: '+44 20 7946 2631',
    investmentFacility: 'Renewable Energy Dev Loan',
    dealSize: 1200000,
    esgRating: 'AAA (Exceptional)',
    stage: 'pre_dd',
    probability: 10,
    emailsTriggered: [
      { date: '2026-06-10T10:15:00Z', subject: 'Welcome to MicroInvest Lead Portal', recipient: 'alice@solartech.io' }
    ],
    notes: 'Initial discussion on funding solar microgrid expansion in California.',
    checklist: {
      pre_dd: [
        { id: 'kyc_pass', label: 'KYC & AML Pass Verification', completed: true },
        { id: 'fca_check', label: 'FCA Registration Verification', completed: false }
      ],
      dd: [
        { id: 'financial_dd', label: 'Financial Due Diligence Report Signed Off', completed: false },
        { id: 'esg_review', label: 'ESG Sizing & Impact Assessment Done', completed: false }
      ],
      ic: [
        { id: 'ic_proposal', label: 'IC Investment Memorandum Submitted', completed: false },
        { id: 'ic_approval', label: 'IC Approval Minute Uploaded', completed: false }
      ],
      approved: [
        { id: 'facility_letter', label: 'Facility Letter Issued to Borrower', completed: false },
        { id: 'credit_committee', label: 'Credit Committee Minute Signed', completed: false }
      ],
      signed: [
        { id: 'debenture', label: 'Debenture signed & received', completed: false },
        { id: 'charge_agreement', label: 'Charge Agreement signed', completed: false },
        { id: 'director_guarantees', label: 'Director Personal Guarantees signed', completed: false },
        { id: 'legal_opinion', label: 'Borrower Legal Opinion letter received', completed: false }
      ]
    }
  },
  {
    id: 'opp-2',
    companyName: 'NextGen Bio',
    contactName: 'Clara Chen',
    email: 'clara@nextgenbio.co',
    phone: '+44 20 7946 4432',
    investmentFacility: 'Tech Innovation Venture',
    dealSize: 850000,
    esgRating: 'A (Moderate)',
    stage: 'ic',
    probability: 60,
    emailsTriggered: [
      { date: '2026-06-12T09:05:00Z', subject: 'Welcome to MicroInvest Lead Portal', recipient: 'clara@nextgenbio.co' },
      { date: '2026-06-13T11:00:00Z', subject: 'Investment Proposal Request - NextGen Bio', recipient: 'clara@nextgenbio.co' }
    ],
    notes: 'Proposal submitted. Executive committee reviewing alignment with regional tech dev directives.',
    checklist: {
      pre_dd: [
        { id: 'kyc_pass', label: 'KYC & AML Pass Verification', completed: true },
        { id: 'fca_check', label: 'FCA Registration Verification', completed: true }
      ],
      dd: [
        { id: 'financial_dd', label: 'Financial Due Diligence Report Signed Off', completed: true },
        { id: 'esg_review', label: 'ESG Sizing & Impact Assessment Done', completed: true }
      ],
      ic: [
        { id: 'ic_proposal', label: 'IC Investment Memorandum Submitted', completed: true },
        { id: 'ic_approval', label: 'IC Approval Minute Uploaded', completed: false }
      ],
      approved: [
        { id: 'facility_letter', label: 'Facility Letter Issued to Borrower', completed: false },
        { id: 'credit_committee', label: 'Credit Committee Minute Signed', completed: false }
      ],
      signed: [
        { id: 'debenture', label: 'Debenture signed & received', completed: false },
        { id: 'charge_agreement', label: 'Charge Agreement signed', completed: false },
        { id: 'director_guarantees', label: 'Director Personal Guarantees signed', completed: false },
        { id: 'legal_opinion', label: 'Borrower Legal Opinion letter received', completed: false }
      ]
    }
  },
  {
    id: 'opp-3',
    companyName: 'Greenfield Wind Farm',
    contactName: 'David Wright',
    email: 'david@greenfieldwind.com',
    phone: '+44 20 7946 0144',
    investmentFacility: 'Renewable Energy Dev Loan',
    dealSize: 8000000,
    esgRating: 'AAA (Exceptional)',
    stage: 'won',
    probability: 100,
    emailsTriggered: [
      { date: '2026-06-01T08:00:00Z', subject: 'Welcome to MicroInvest Lead Portal', recipient: 'david@greenfieldwind.com' },
      { date: '2026-06-05T15:30:00Z', subject: 'Investment Proposal Request', recipient: 'david@greenfieldwind.com' },
      { date: '2026-06-09T09:12:00Z', subject: 'Loan Booking Confirmation - Greenfield Wind Farm', recipient: 'david@greenfieldwind.com' }
    ],
    notes: 'Loan confirmed and booked. Handed over to operations for disbursement.',
    booked: true,
    loanId: 'LN-2026-0043',
    margillSynced: true,
    accountingSynced: true,
    checklist: {
      pre_dd: [
        { id: 'kyc_pass', label: 'KYC & AML Pass Verification', completed: true },
        { id: 'fca_check', label: 'FCA Registration Verification', completed: true }
      ],
      dd: [
        { id: 'financial_dd', label: 'Financial Due Diligence Report Signed Off', completed: true },
        { id: 'esg_review', label: 'ESG Sizing & Impact Assessment Done', completed: true }
      ],
      ic: [
        { id: 'ic_proposal', label: 'IC Investment Memorandum Submitted', completed: true },
        { id: 'ic_approval', label: 'IC Approval Minute Uploaded', completed: true }
      ],
      approved: [
        { id: 'facility_letter', label: 'Facility Letter Issued to Borrower', completed: true },
        { id: 'credit_committee', label: 'Credit Committee Minute Signed', completed: true }
      ],
      signed: [
        { id: 'debenture', label: 'Debenture signed & received', completed: true },
        { id: 'charge_agreement', label: 'Charge Agreement signed', completed: true },
        { id: 'director_guarantees', label: 'Director Personal Guarantees signed', completed: true },
        { id: 'legal_opinion', label: 'Borrower Legal Opinion letter received', completed: true }
      ]
    }
  },
  {
    id: 'opp-4',
    companyName: 'Apex Housing Group',
    contactName: 'Bob Miller',
    email: 'bob@apexhousing.com',
    phone: '+44 20 7946 9012',
    investmentFacility: 'Urban Housing Fund',
    dealSize: 4500000,
    esgRating: 'AA (High Impact)',
    stage: 'signed',
    probability: 90,
    emailsTriggered: [
      { date: '2026-06-11T14:30:00Z', subject: 'Welcome to MicroInvest Lead Portal', recipient: 'bob@apexhousing.com' },
      { date: '2026-06-13T10:00:00Z', subject: 'Investment Proposal Request - Apex Housing Group', recipient: 'bob@apexhousing.com' },
      { date: '2026-06-14T16:45:00Z', subject: 'Deal Won - Loan Booking Confirmation Pending', recipient: 'bob@apexhousing.com' }
    ],
    notes: 'Deal successfully closed. Awaiting Operations to book and disburse via Margill.',
    booked: false,
    checklist: {
      pre_dd: [
        { id: 'kyc_pass', label: 'KYC & AML Pass Verification', completed: true },
        { id: 'fca_check', label: 'FCA Registration Verification', completed: true }
      ],
      dd: [
        { id: 'financial_dd', label: 'Financial Due Diligence Report Signed Off', completed: true },
        { id: 'esg_review', label: 'ESG Sizing & Impact Assessment Done', completed: true }
      ],
      ic: [
        { id: 'ic_proposal', label: 'IC Investment Memorandum Submitted', completed: true },
        { id: 'ic_approval', label: 'IC Approval Minute Uploaded', completed: true }
      ],
      approved: [
        { id: 'facility_letter', label: 'Facility Letter Issued to Borrower', completed: true },
        { id: 'credit_committee', label: 'Credit Committee Minute Signed', completed: true }
      ],
      signed: [
        { id: 'debenture', label: 'Debenture signed & received', completed: true },
        { id: 'charge_agreement', label: 'Charge Agreement signed', completed: true },
        { id: 'director_guarantees', label: 'Director Personal Guarantees signed', completed: false },
        { id: 'legal_opinion', label: 'Borrower Legal Opinion letter received', completed: false }
      ]
    }
  }
];

// Initial active booked loans
// Initial active booked loans
const defaultLoans = [
  {
    id: 'loan-1101',
    opportunityId: 'opp-3',
    companyName: 'Laing Project Limited',
    loanId: '1101',
    facility: 'Urban Housing Fund',
    amount: 58734,
    esgRating: 'AA (High Impact)',
    status: 'Active',
    bookedAt: '2021-09-09T09:12:00Z',
    interestRate: '6.00%',
    termMonths: 54,
    remainingBalance: 49936.91,
    nextPaymentNum: 32,
    originationDate: '09/09/2021',
    firstPaymentDate: '18/09/2021',
    fund: 'ACCESS2',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1101',
    fileNo: 'F-2021-101',
    maxCredit: 100000,
    uniqueIdentifier1: 'LN-1101-M',
    uniqueIdentifier2: 'CO-982138',
    otherInfo: 'This is the Laing Project affordable housing development.',
    borrower: {
      firstName: 'Jane',
      lastName: 'Laing',
      businessName: 'Laing Project Limited',
      address: '12 High Street',
      city: 'London',
      stateProv: 'Greater London',
      postcode: 'SW1A 1AA',
      country: 'United Kingdom',
      phone: '+44 20 7946 0122',
      mobile: '+44 7700 900077',
      email: 'jane@laingproject.co.uk',
      socialSec: 'QQ 12 34 56 A',
      birthDate: '1978-04-12',
      maritalStatus: 'Married',
      uniqueIdentifier1: 'B-9921',
      uniqueIdentifier2: '09812421',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 6000,
      rateType: 'Fixed'
    }
  },
  {
    id: 'loan-1102',
    opportunityId: 'opp-1',
    companyName: 'SolarTech Solutions',
    loanId: '1102',
    facility: 'Renewable Energy Dev Loan',
    amount: 30000,
    esgRating: 'AAA (Exceptional)',
    status: 'Active',
    bookedAt: '2021-09-09T10:14:00Z',
    interestRate: '6.00%',
    termMonths: 60,
    remainingBalance: 22000,
    nextPaymentNum: 12,
    originationDate: '09/09/2021',
    firstPaymentDate: '18/09/2021',
    fund: 'ACCESS2',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1102',
    fileNo: 'F-2021-102',
    maxCredit: 50000,
    uniqueIdentifier1: 'LN-1102-M',
    uniqueIdentifier2: 'CO-110239',
    otherInfo: 'Solar array expansion on community center.',
    borrower: {
      firstName: 'Alice',
      lastName: 'Vane',
      businessName: 'SolarTech Solutions',
      address: '1 Broad Street',
      city: 'Birmingham',
      stateProv: 'West Midlands',
      postcode: 'B1 1BB',
      country: 'United Kingdom',
      phone: '+44 121 496 0199',
      email: 'alice@solartech.io',
      socialSec: 'AB 98 76 54 C',
      maritalStatus: 'Single',
      uniqueIdentifier1: 'B-4412',
      uniqueIdentifier2: '11023912',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 0,
      rateType: 'Fixed'
    }
  },
  {
    id: 'loan-1103',
    opportunityId: 'opp-2',
    companyName: 'NextGen Bio',
    loanId: '1103',
    facility: 'Tech Innovation Venture',
    amount: 65000,
    esgRating: 'A (Moderate)',
    status: 'Active',
    bookedAt: '2021-09-23T11:00:00Z',
    interestRate: '6.00%',
    termMonths: 48,
    remainingBalance: 41212.99,
    nextPaymentNum: 22,
    originationDate: '23/09/2021',
    firstPaymentDate: '01/10/2021',
    fund: 'ACCESS2',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1103',
    fileNo: 'F-2021-103',
    maxCredit: 100000,
    uniqueIdentifier1: 'LN-1103-M',
    uniqueIdentifier2: 'CO-223912',
    otherInfo: 'Bio-waste processing facility expansion.',
    borrower: {
      firstName: 'Clara',
      lastName: 'Chen',
      businessName: 'NextGen Bio',
      address: 'Science Park Rd',
      city: 'Cambridge',
      stateProv: 'Cambridgeshire',
      postcode: 'CB4 0EY',
      country: 'United Kingdom',
      phone: '+44 1223 496011',
      email: 'clara@nextgenbio.co',
      uniqueIdentifier1: 'B-2891',
      uniqueIdentifier2: '22391231',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 0,
      rateType: 'Fixed'
    }
  },
  {
    id: 'loan-1104',
    opportunityId: '',
    companyName: 'Newton Community Trust',
    loanId: '1104',
    facility: 'Urban Housing Fund',
    amount: 42000,
    esgRating: 'AA (High Impact)',
    status: 'Active',
    bookedAt: '2021-09-28T09:00:00Z',
    interestRate: '6.00%',
    termMonths: 72,
    remainingBalance: 35000,
    nextPaymentNum: 15,
    originationDate: '28/09/2021',
    firstPaymentDate: '05/10/2021',
    fund: 'PFP',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1104',
    fileNo: 'F-2021-104',
    maxCredit: 50000,
    uniqueIdentifier1: 'LN-1104-M',
    uniqueIdentifier2: 'CO-771239',
    otherInfo: 'Community hall renovation loan.',
    borrower: {
      firstName: 'Isaac',
      lastName: 'Newton',
      businessName: 'Newton Community Trust',
      address: 'Gravity Lane',
      city: 'Woolsthorpe',
      stateProv: 'Lincolnshire',
      postcode: 'NG33 5PD',
      country: 'United Kingdom',
      email: 'isaac@newtoncommunity.org',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 0,
      rateType: 'Fixed'
    }
  },
  {
    id: 'loan-1106',
    opportunityId: 'opp-4',
    companyName: 'Apex Housing Group',
    loanId: '1106',
    facility: 'Urban Housing Fund',
    amount: 50000,
    esgRating: 'AA (High Impact)',
    status: 'Bad debt',
    bookedAt: '2021-09-30T15:30:00Z',
    interestRate: '6.00%',
    termMonths: 60,
    remainingBalance: 50000,
    nextPaymentNum: 1,
    originationDate: '30/09/2021',
    firstPaymentDate: '15/10/2021',
    fund: 'ACCESS2',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1106',
    fileNo: 'F-2021-106',
    maxCredit: 50000,
    uniqueIdentifier1: 'LN-1106-M',
    uniqueIdentifier2: 'CO-998811',
    otherInfo: 'Defaulted housing project. In collections.',
    borrower: {
      firstName: 'Bob',
      lastName: 'Miller',
      businessName: 'Apex Housing Group',
      address: 'Construction Way',
      city: 'Leeds',
      stateProv: 'West Yorkshire',
      postcode: 'LS1 1BA',
      country: 'United Kingdom',
      email: 'bob@apexhousing.com',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 0,
      rateType: 'Fixed'
    }
  },
  {
    id: 'loan-1107',
    opportunityId: '',
    companyName: 'Southend Cooperative',
    loanId: '1107',
    facility: 'Urban Housing Fund',
    amount: 63000,
    esgRating: 'A (Moderate)',
    status: 'Closed',
    bookedAt: '2021-09-30T10:00:00Z',
    interestRate: '6.00%',
    termMonths: 60,
    remainingBalance: 0,
    nextPaymentNum: 61,
    originationDate: '30/09/2021',
    firstPaymentDate: '10/10/2021',
    fund: 'ACCESS2',
    creditor: 'Big Issue Invest',
    compoundingPeriod: 'Annually',
    paymentFrequency: 'Monthly',
    paymentMethod: 'Normal (Principal + Interest)',
    subStatus: 'AUTO',
    accountingId: 'ACC-1107',
    fileNo: 'F-2021-107',
    maxCredit: 75000,
    uniqueIdentifier1: 'LN-1107-M',
    uniqueIdentifier2: 'CO-112233',
    otherInfo: 'Fully repaid community store loan.',
    borrower: {
      firstName: 'George',
      lastName: 'Coop',
      businessName: 'Southend Cooperative',
      address: 'Retail Row',
      city: 'Southend-on-Sea',
      stateProv: 'Essex',
      postcode: 'SS1 1AA',
      country: 'United Kingdom',
      email: 'george@southendcoop.org.uk',
      ownerCreator: 'Linda Wickstrom'
    },
    customFields: {
      investmentManager: 'Linda Wickstrom',
      grant: 0,
      rateType: 'Fixed'
    }
  }
];

// Audit trail
const defaultAuditLogs = [
  { timestamp: '2026-06-09T09:12:00Z', role: 'Operations', action: 'Booked Loan LN-2026-0043 in servicing system (Amount: £8,000,000)' },
  { timestamp: '2026-06-09T09:12:05Z', role: 'Operations', action: 'Created accounting ledger entries: DR Asset (Loans Receivable), CR Cash' },
  { timestamp: '2026-06-10T10:14:00Z', role: 'Sales Rep', action: 'Captured new lead "SolarTech Solutions" via online Zoho Webhook' },
  { timestamp: '2026-06-11T14:30:00Z', role: 'Sales Rep', action: 'Manually logged lead "Apex Housing Group"' },
  { timestamp: '2026-06-12T09:00:00Z', role: 'Sales Rep', action: 'Promoted "NextGen Bio" to Qualified Stage' },
  { timestamp: '2026-06-14T08:15:00Z', role: 'Sales Rep', action: 'Captured new lead "Ecotech Microgrid" via manual entry' }
];

// KYC Task Alerts
const defaultNotifications = [
  { id: 'not-1', type: 'KYC Check', client: 'SolarTech Solutions', message: 'Annual KYC check due in 30 days', urgent: false },
  { id: 'not-2', type: 'KYC Check', client: 'Apex Housing Group', message: 'AML validation query flagged on address matching', urgent: true },
  { id: 'not-3', type: 'Operations Task', client: 'NextGen Bio', message: 'Upload signed facility letter', urgent: false }
];

// Default NCM Funds data
const defaultNcmFunds = [
  { fundCode: 'ACCESS2', name: 'Access 2 Growth Fund', totalFundValue: 10000000, adminFeeRate: '0.95%', custodianBank: 'Royal Bank of Scotland', lastValuationSync: new Date().toISOString() },
  { fundCode: 'PFP', name: "People's Fund Portfolio", totalFundValue: 5000000, adminFeeRate: '1.20%', custodianBank: 'HSBC UK', lastValuationSync: new Date().toISOString() },
  { fundCode: 'ESM', name: 'Enterprise Social Microfinance', totalFundValue: 4000000, adminFeeRate: '1.10%', custodianBank: 'Barclays Bank', lastValuationSync: new Date().toISOString() },
  { fundCode: 'BIIGLA', name: 'Big Issue Growth Loan Admin', totalFundValue: 3000000, adminFeeRate: '0.85%', custodianBank: 'Lloyds Bank', lastValuationSync: new Date().toISOString() },
  { fundCode: 'RGFBII2', name: 'Regional Growth Fund II', totalFundValue: 2000000, adminFeeRate: '1.00%', custodianBank: 'NatWest', lastValuationSync: new Date().toISOString() }
];

// Default Covenants and Conditions Subsequent
const defaultCovenants = [
  { id: 'cov-1', loanId: '1101', companyName: 'Laing Project Limited', manager: 'Linda Wickstrom', type: 'Covenant', title: 'Q1 2026 Management Accounts', description: 'Submit Q1 unaudited management accounts within 45 days of quarter end.', dueDate: '2026-06-30', status: 'Pending', collectedDate: null, attachedFile: null, notes: '' },
  { id: 'cov-2', loanId: '1101', companyName: 'Laing Project Limited', manager: 'Linda Wickstrom', type: 'Covenant', title: 'Annual Audited Accounts', description: 'Submit annual audited financial statements within 6 months of financial year end.', dueDate: '2026-09-30', status: 'Pending', collectedDate: null, attachedFile: null, notes: '' },
  { id: 'cov-3', loanId: '1102', companyName: 'SolarTech Solutions', manager: 'Linda Wickstrom', type: 'Condition Subsequent', title: 'Charge Registration with Companies House', description: 'Register first legal charge over solar asset array with Companies House (Form MR01).', dueDate: '2026-05-15', status: 'Overdue', collectedDate: null, attachedFile: null, notes: '' },
  { id: 'cov-4', loanId: '1102', companyName: 'SolarTech Solutions', manager: 'Linda Wickstrom', type: 'Covenant', title: 'Q2 2026 Management Accounts', description: 'Submit Q2 unaudited management accounts.', dueDate: '2026-07-31', status: 'Pending', collectedDate: null, attachedFile: null, notes: '' },
  { id: 'cov-5', loanId: '1103', companyName: 'NextGen Bio', manager: 'Linda Wickstrom', type: 'Condition Subsequent', title: 'Proof of Opening Reserve Account', description: 'Provide bank statement showing opening of the debt service reserve account with £10,000.', dueDate: '2026-06-20', status: 'Collected', collectedDate: '2026-06-20T14:30:00Z', attachedFile: 'reserve_acct_statement.pdf', notes: 'Verified statement showing £10,000 balance in RBS reserve account. Confirmed satisfying Condition Subsequent.' },
  { id: 'cov-6', loanId: '1103', companyName: 'NextGen Bio', manager: 'Linda Wickstrom', type: 'Covenant', title: 'Quarterly Environmental Impact Report', description: 'Submit quarterly bio-waste processing ESG report.', dueDate: '2026-07-15', status: 'Pending', collectedDate: null, attachedFile: null, notes: '' },
  { id: 'cov-7', loanId: '1104', companyName: 'Newton Community Trust', manager: 'Linda Wickstrom', type: 'Covenant', title: 'Q1 2026 Management Accounts', description: 'Submit Q1 unaudited management accounts.', dueDate: '2026-05-31', status: 'Collected', collectedDate: '2026-05-28T10:15:00Z', attachedFile: 'Newton_Q1_26_Accounts.xlsx', notes: 'Received and reviewed. Operating surplus is in line with forecasts.' },
  { id: 'cov-8', loanId: '1104', companyName: 'Newton Community Trust', manager: 'Linda Wickstrom', type: 'Condition Subsequent', title: 'Board Resolution for Grant Allocation', description: 'Provide signed copy of board resolution approving allocation of grant funds.', dueDate: '2026-06-10', status: 'Overdue', collectedDate: null, attachedFile: null, notes: '' }
];

// Reactive Svelte Stores
export const customFields = writable(defaultFields);
export const pipelineStages = writable(defaultStages);
// Persist leads into localStorage so manual captures survive reloads
let initialLeads = defaultLeads;
try {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('bii_leads');
    if (raw) initialLeads = JSON.parse(raw);
  }
} catch (e) {
  // ignore and fallback to defaults
}

export const leads = writable(initialLeads);

// Subscribe and persist updates
if (typeof window !== 'undefined') {
  leads.subscribe(val => {
    try { localStorage.setItem('bii_leads', JSON.stringify(val)); } catch (e) { /* ignore */ }
  });
}
export const opportunities = writable(defaultOpportunities);
export const loans = writable(defaultLoans);
export const auditLogs = writable(defaultAuditLogs);
export const notifications = writable(defaultNotifications);
export const covenants = writable(defaultCovenants);
export const ncmFunds = writable(defaultNcmFunds);

// Persona Selection (Defaulting to Administrator so all controls are visible)
export const userRole = writable('Admin');

// Helper to push audit logs easily
export const addAuditLog = (role, action) => {
  auditLogs.update(logs => [
    { timestamp: new Date().toISOString(), role, action },
    ...logs
  ]);
};

// Helper to add notification alert
export const addNotification = (type, client, message, urgent = false) => {
  notifications.update(notifs => [
    { id: 'not-' + Math.random().toString(36).substr(2, 9), type, client, message, urgent },
    ...notifs
  ]);
};

// Covenant helper actions
export const addCovenant = (cov) => {
  covenants.update(list => [
    {
      id: 'cov-' + Math.random().toString(36).substr(2, 9),
      collectedDate: null,
      attachedFile: null,
      notes: '',
      ...cov
    },
    ...list
  ]);
};

export const collectCovenant = (id, attachedFile, notes) => {
  covenants.update(list =>
    list.map(c => c.id === id ? {
      ...c,
      status: 'Collected',
      collectedDate: new Date().toISOString(),
      attachedFile,
      notes
    } : c)
  );
};

export const requestCovenantData = (id) => {
  covenants.update(list =>
    list.map(c => {
      if (c.id === id) {
        addAuditLog('Relationship Manager', `Simulated reminder email dispatched to client for: "${c.title}" (${c.companyName})`);
        return {
          ...c,
          notes: c.notes ? `${c.notes}\n[Sent Email Reminder on ${new Date().toLocaleDateString()}]` : `[Sent Email Reminder on ${new Date().toLocaleDateString()}]`
        };
      }
      return c;
    })
  );
};

// Opportunity checklist helpers
export const toggleChecklistItem = (oppId, stageId, itemId) => {
  opportunities.update(list =>
    list.map(opp => {
      if (opp.id === oppId) {
        const stageList = opp.checklist?.[stageId] || [];
        const updatedStageList = stageList.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        const updatedChecklist = { ...opp.checklist, [stageId]: updatedStageList };
        
        const itemLabel = stageList.find(i => i.id === itemId)?.label || itemId;
        const isCompletedNow = updatedStageList.find(i => i.id === itemId)?.completed;
        addAuditLog(get(userRole), `Marked checklist item "${itemLabel}" as ${isCompletedNow ? 'Completed' : 'Pending'} for ${opp.companyName}`);
        
        return { ...opp, checklist: updatedChecklist };
      }
      return opp;
    })
  );
};

export const addChecklistItem = (oppId, stageId, label) => {
  if (!label.trim()) return;
  opportunities.update(list =>
    list.map(opp => {
      if (opp.id === oppId) {
        const stageList = opp.checklist?.[stageId] || [];
        const newItem = {
          id: 'task-' + Math.random().toString(36).substr(2, 9),
          label: label.trim(),
          completed: false
        };
        const updatedChecklist = {
          ...opp.checklist,
          [stageId]: [...stageList, newItem]
        };
        addAuditLog(get(userRole), `Added new checklist item "${label}" to stage [${stageId}] for ${opp.companyName}`);
        return { ...opp, checklist: updatedChecklist };
      }
      return opp;
    })
  );
};


