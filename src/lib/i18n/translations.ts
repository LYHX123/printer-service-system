export type Language = "en" | "zh"

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
]

export const DEFAULT_LANGUAGE: Language = "en"

export type TranslationKey =
  // Common
  | "dashboard"
  | "customers"
  | "equipment"
  | "jobs"
  | "quotations"
  | "invoice"
  | "invoiceModule"
  | "invoiceStatusDraft"
  | "invoiceStatusConfirmed"
  | "invoiceStatusCancelled"
  | "shopAccount"
  | "inventory"
  | "reports"
  | "productivity"
  | "settings"
  | "users"
  | "login"
  | "logout"
  | "save"
  | "cancel"
  | "create"
  | "edit"
  | "delete"
  | "search"
  | "filter"
  | "actions"
  | "export"
  | "download"
  | "downloadPdf"
  | "downloadExcel"
  | "exportPdf"
  | "print"
  // Customers
  | "customerName"
  | "companyName"
  | "shortName"
  | "pinNumber"
  | "phone"
  | "email"
  | "address"
  // Equipment
  | "brand"
  | "model"
  | "itemName"
  | "serialNumber"
  | "assetNumber"
  // Jobs
  | "jobNumber"
  | "status"
  | "engineer"
  | "problemReported"
  | "diagnosis"
  | "workPerformed"
  // Quotations
  | "quotationNumber"
  | "vat"
  | "total"
  | "approved"
  | "rejected"
  // Inventory
  | "partNumber"
  | "partName"
  | "quantity"
  | "minimumQuantity"
  | "supplier"
  | "unitCost"
  | "sellingPrice"
  | "unitSingular"
  | "unitPlural"
  | "consumableSingular"
  | "consumablePlural"
  | "specification"
  | "picture"
  | "removePicture"
  | "pictureUpdated"
  | "pictureRemoved"
  | "viewPicture"
  | "quantityCannotBeNegative"
  // General / page chrome
  | "view"
  | "clear"
  | "noResultsFor"
  | "tryDifferentSearchTerm"
  | "tryAdjustingFilters"
  | "exportCsv"
  | "registered"
  | "detail"
  | "overview"
  | "branches"
  | "name"
  | "type"
  | "category"
  | "date"
  | "selectDate"
  | "reference"
  | "job"
  | "by"
  | "role"
  | "code"
  | "branch"
  | "description"
  | "priority"
  | "searchCustomersPlaceholder"
  | "searchJobsPlaceholder"
  | "searchQuotationsPlaceholder"
  | "searchPartsPlaceholder"
  // Customer detail
  | "contactInformation"
  | "summary"
  | "customerCode"
  | "totalJobs"
  | "newQuotation"
  | "newJob"
  | "newCustomer"
  | "newUser"
  | "inYourCompany"
  | "addPart"
  | "noServiceJobs"
  | "createJobForCustomerDesc"
  | "noQuotations"
  | "createQuotationDesc"
  // Equipment detail
  | "deviceDetails"
  | "purchaseDate"
  | "warrantyExpiry"
  | "owner"
  | "specifications"
  | "meterReadings"
  | "black"
  | "colour"
  | "source"
  | "recordedBy"
  | "serviceHistory"
  | "noServiceHistory"
  | "serviceJobsWillAppear"
  | "received"
  | "completed"
  | "warranty"
  | "noMeterReadings"
  | "manual"
  // Job detail
  | "customer"
  | "jobDetails"
  | "assignedTo"
  | "due"
  | "createdBy"
  | "problemDescription"
  | "internalNotes"
  | "technicianNotes"
  | "statusHistory"
  | "photos"
  | "signature"
  | "repairReport"
  | "warrantyTo"
  // Quotation detail
  | "details"
  | "createdLabel"
  | "validUntil"
  | "unitPrice"
  | "subtotal"
  | "remarks"
  | "convertedToJob"
  | "costSummary"
  | "parts"
  // Inventory detail / list
  | "compatibleWith"
  | "storageLocation"
  | "stock"
  | "currentQuantity"
  | "stockValue"
  | "lastCounted"
  | "transactionHistory"
  | "noStockTransactions"
  | "archived"
  | "location"
  | "minQty"
  | "inStock"
  | "lowStock"
  | "outOfStock"
  | "noPartsFound"
  | "addFirstPart"
  | "inCatalog"
  | "equipmentEmptyTitle"
  | "equipmentEmptyDesc"
  | "consumptionEmptyTitle"
  | "consumptionEmptyDesc"
  | "partsEmptyTitle"
  | "partsEmptyDesc"
  | "addEquipmentItem"
  | "addConsumptionItem"
  | "addPartItem"
  // List pages — empty states & filters
  | "noCustomersFound"
  | "registerFirstCustomer"
  | "noJobsFound"
  | "createFirstJob"
  | "noQuotationsFound"
  | "createFirstQuotation"
  | "createAndManageQuotations"
  | "tryAdjustingSearchOrFilter"
  | "serviceJobs"
  | "allTypes"
  | "allCustomers"
  | "allStatuses"
  | "allPriorities"
  | "allCategories"
  | "allStockLevels"
  | "allEngineers"
  | "allStaff"
  | "allUsers"
  // Reports
  | "reportsDesc"
  | "completedJobs"
  | "inventoryValuationCost"
  | "lowStockItems"
  | "viewReport"
  | "stockMovements"
  | "pdf"
  | "noRepairReportsDesc"
  | "noQuotationsReportsDesc"
  | "repairReports"
  | "inventoryReports"
  | "inventoryReportsDesc"
  | "inventoryValuation"
  | "lowStockReportTitle"
  | "stockMovementReport"
  | "totalParts"
  | "stockValueAtCost"
  | "stockValueAtSelling"
  | "partsNeedingReorder"
  | "engineerProductivity"
  | "engineerProductivityDesc"
  | "days"
  | "jobsCompleted"
  | "jobsAssigned"
  | "avgCompletionTime"
  | "revenueGenerated"
  | "partsUsed"
  | "costValue"
  | "sellingValue"
  | "reportDate"
  | "totalCost"
  | "serviceType"
  | "noPartsInInventory"
  | "addPartsToSeeValuation"
  | "noLowStockItems"
  | "allPartsAboveMin"
  | "noStockMovementsFound"
  | "currentQty"
  | "part"
  | "noRepairReportsFound"
  | "noQuotationsFoundReport"
  | "noProductivityData"
  // Tasks
  | "tasks"
  // Ledger
  | "ledger"
  | "ledgerDesc"
  | "incomeExpenseBook"
  | "incomeExpenseBookDesc"
  | "salesLedger"
  | "salesLedgerDesc"
  | "income"
  | "expense"
  | "amount"
  | "paymentMethod"
  | "referenceNo"
  | "remark"
  | "totalIncome"
  | "totalExpense"
  | "addIncome"
  | "addExpense"
  | "editEntry"
  | "archiveRecord"
  | "restoreRecord"
  | "addCategory"
  | "categoryName"
  | "newCategory"
  | "noLedgerEntriesFound"
  | "noLedgerEntriesDesc"
  | "deleteEntryConfirm"
  | "receivingMethod"
  | "paymentOrReceivingMethod"
  | "allPaymentMethods"
  | "paymentMethodMpesa"
  | "paymentMethodCash"
  | "paymentMethodBankTransfer"
  | "paymentMethodCheque"
  | "paymentMethodCard"
  | "paymentMethodOther"
  | "salesCustomerName"
  | "orderNo"
  | "invoiceAmount"
  | "amountReceived"
  | "balance"
  | "paymentStatus"
  | "paid"
  | "partial"
  | "unpaid"
  | "allPaymentStatuses"
  | "totalInvoiceAmount"
  | "totalReceived"
  | "totalBalance"
  // Shop Account
  | "shopAccountDesc"
  | "supplierPayee"
  | "attachment"
  | "attachmentUploadLabel"
  | "attachmentUploaded"
  | "attachmentRemoved"
  | "recordSaved"
  | "recordUpdated"
  | "recordDeleted"
  | "noShopAccountEntriesFound"
  | "noShopAccountEntriesDesc"
  | "amountMustBeGreaterThanZero"
  | "insufficientStock"
  | "invoiceAlreadyConfirmed"
  | "invoiceAlreadyCancelled"
  | "fileUploadFailed"
  | "permissionDenied"
  | "nameAlreadyExists"
  | "nameRequired"
  | "quotationNumberExists"
  | "invoiceNumberExists"
  | "addSalesRecord"
  | "editSalesRecord"
  | "noSalesLedgerFound"
  | "noSalesLedgerDesc"
  | "searchSalesLedgerPlaceholder"
  | "searchLedgerPlaceholder"
  | "currentMonth"
  | "fromDate"
  | "toDate"
  | "statusActive"
  | "statusArchived"
  // Settings
  | "companySettings"
  | "companySettingsDesc"
  | "phoneNumber"
  | "website"
  | "kraPin"
  | "vatPercentage"
  | "currency"
  | "timezone"
  | "uploadLogo"
  | "saveChanges"
  | "companySettingsSaved"
  | "logoUpdated"
  | "failedToUploadLogo"
  | "logoFormatHint"
  | "fullCompanyAddress"
  // Dropbox Integration
  | "dropboxIntegration"
  | "dropboxIntegrationDesc"
  | "dropboxConfiguration"
  | "dropboxConfigured"
  | "dropboxConfigMissing"
  | "dropboxConfigMissingDesc"
  | "dropboxConnectionStatus"
  | "dropboxConnected"
  | "dropboxDisconnected"
  | "dropboxAccount"
  | "dropboxEmail"
  | "dropboxRootFolder"
  | "dropboxLastConnected"
  | "connectDropbox"
  | "testConnection"
  | "initializeFolders"
  | "disconnectDropbox"
  | "dropboxDisconnectConfirmTitle"
  | "dropboxDisconnectConfirmDesc"
  | "dropboxConnectionSuccessful"
  | "dropboxFoldersInitialized"
  | "dropboxConnectedToast"
  // Users
  | "active"
  | "disabledStatus"
  | "joined"
  | "you"
  | "noUsersFound"
  | "createFirstStaffAccount"
  | "roleUpdated"
  | "userDisabled"
  | "userEnabled"
  | "disable"
  | "enable"
  | "disableUser"
  | "enableUser"
  | "disableUserDesc"
  | "enableUserDesc"
  | "backToUsers"
  | "newUserDesc"
  | "fullName"
  | "username"
  | "nameIsLoginId"
  | "emailAddress"
  | "password"
  | "minimum8Characters"
  | "createUser"
  // User permissions
  | "moduleAccess"
  | "editPermissions"
  | "savePermissions"
  | "permissionsUpdated"
  | "adminFullAccess"
  | "selfProtectedModules"
  | "allModules"
  // User security / lockout
  | "locked"
  | "accountLockedDesc"
  | "unlock"
  | "unlockUser"
  | "unlockUserDesc"
  | "userUnlocked"
  // User profile
  | "editProfile"
  | "profileUpdated"
  | "department"
  | "position"
  | "saveProfile"
  | "displayName"
  // Tasks module
  | "taskNewTask"
  | "taskCreateTask"
  | "taskSelectATask"
  | "taskClickToView"
  | "taskNoTasksYet"
  | "taskNoTasksDesc"
  | "taskNoTasksAssigned"
  | "taskStatusActive"
  | "taskStatusCompleted"
  | "taskCreatedByLabel"
  | "taskParticipantsLabel"
  | "taskAddNextStep"
  | "taskAddNextStepHint"
  | "taskMarkCompleted"
  | "taskReopen"
  | "taskBy"
  | "taskNoSteps"
  | "taskModalDesc"
  | "taskTitleField"
  | "taskInitialStep"
  | "taskStepTitleField"
  | "taskSearchStaff"
  | "taskNoUsersFound"
  | "taskAddStepAction"
  | "taskAddStepModalDesc"
  | "taskCreatedSuccess"
  | "taskStepAdded"
  | "taskCompletedSuccess"
  | "taskReopenedSuccess"
  | "taskDeletedSuccess"
  | "taskTitleRequired"
  | "taskStepTitleRequired"
  | "taskParticipantRequired"
  | "addParticipant"
  | "addParticipantModalDesc"
  | "removeParticipant"
  | "confirmRemoveParticipantQuestion"
  | "participantAddedSuccess"
  | "participantRemovedSuccess"
  | "allUsersAlreadyParticipants"
  | "taskNoParticipantsYet"
  // Task step images
  | "taskUploadImages"
  | "taskImagesLabel"
  | "taskImagePreview"
  | "taskRemoveImage"
  | "taskImageUploadFailed"
  // Task step edit/delete
  | "editProgressNode"
  | "deleteProgressNode"
  | "confirmDeleteProgressNodeQuestion"
  | "actionCannotBeUndone"
  | "progressNodeUpdated"
  | "progressNodeDeleted"
  | "noPermissionForAction"
  // Invoices
  | "unit"
  | "exportExcel"
  | "generateInvoice"
  | "generateInvoiceDesc"
  | "invoiceNumberLabel"
  | "invoiceDateLabel"
  | "invoiceCustomerPinLabel"
  | "invoiceVatPercentLabel"
  | "invoices"
  | "invoicesDesc"
  | "searchInvoicesPlaceholder"
  | "noInvoicesFound"
  | "noInvoicesDesc"
  | "invoiceItems"
  | "receivedBy"
  | "viewInvoice"
  | "directInvoice"
  | "fromQuotation"
  | "createInvoice"
  | "paidAmount"
  | "applyToSalesRecords"
  | "allocateAmount"
  | "allocatedAmount"
  | "unallocatedAmount"
  | "receiptAllocation"
  | "paymentHistory"
  | "createSalesRecord"
  | "viewSalesRecord"
  | "confirm"
  | "receiptAmount"
  | "lineTotal"
  | "product"
  | "stockCategoryLabel"
  | "noItemsAdded"
  | "invoiceDateLabel2"
  | "stockShortfallDesc"
  | "confirmInvoiceConfirm"
  | "cancelInvoiceConfirm"
  | "deleteInvoiceConfirm"
  | "deleteQuotationConfirmTitle"
  | "deleteQuotationConfirmDesc"
  | "quotationDeleted"
  | "invoiceDeleted"
  | "invoiceConfirmed"
  | "invoiceCancelled"
  | "salesRecordCreated"
  | "stockStatus"
  | "salesLedgerLinkage"
  | "notLinkedToSalesLedger"
  | "noUnpaidInvoicesForCustomer"
  | "allocationExceedsBalance"
  | "allocationExceedsReceipt"
  | "amountReceivedLockedHint"
  | "salesLedgerDetail"
  | "backToSalesLedger"
  // Notification popup
  | "overdueTasksLabel"
  | "taskOverdueNotice"
  | "lastActivityLabel"
  | "daysInactiveLabel"
  | "viewTask"
  | "lowStockAlertsLabel"
  | "overdueTaskAlertsLabel"
  | "noAlertsLabel"
  | "noDashboardInformationForPermissions"
  // Dashboard homepage
  | "welcomeBack"
  | "dashboardIntro"
  | "alertsLabel"
  | "customersDesc"
  | "stockDesc"
  | "tasksDesc"
  | "usersDesc"
  | "activeTasksLabel"
  | "lowStockItemsLabel"
  | "unpaidSalesBalanceLabel"
  | "activeQuotationsLabel"
  | "invoicesLabel"
  | "equipmentQuantityLabel"
  | "consumptionQuantityLabel"
  | "partsQuantityLabel"
  | "currentMonthIncomeLabel"
  | "currentMonthExpenseLabel"
  | "currentMonthShopExpenseLabel"
  | "recentQuotationsLabel"
  | "recentSalesLabel"
  | "recentTasksLabel"
  | "recentShopEntriesLabel"
  | "businessOverviewSection"
  | "stockOverviewSection"
  | "financialOverviewSection"
  | "recentActivitySection"
  | "noRecentRecords"
  | "viewAllLink"
  // Customer restructure: Company / Project / Document
  | "mainContactName"
  | "mainContactPhone"
  | "mainContactEmail"
  | "mainAddress"
  | "notes"
  | "companyInformation"
  | "headOfficeContact"
  | "projectsAndContacts"
  | "addProject"
  | "editProject"
  | "removeProject"
  | "projectName"
  | "contactName"
  | "contactPhone"
  | "contactEmail"
  | "projectAddress"
  | "headOfficeMainContact"
  | "deactivate"
  | "reactivate"
  | "confirmDeactivateProject"
  | "noProjectsYet"
  | "numberOfProjects"
  | "numberOfDocuments"
  | "inactiveLabel"
  | "documents"
  | "uploadFile"
  | "documentType"
  | "relatedProject"
  | "generalDocument"
  | "uploadDate"
  | "uploadedBy"
  | "noDocumentsYet"
  | "confirmDeleteDocument"
  | "documentTypeContract"
  | "documentTypeIdDocument"
  | "documentTypeCorrespondence"
  | "documentTypeOther"
  | "customerDocuments"
  | "registrationCertificate"
  | "pinCertificate"
  | "cr12"
  | "vatCertificate"
  | "companyProfile"
  | "dropboxFileName"
  | "dropboxPath"
  | "originalLabel"
  | "documentTypeRequired"
  | "documentNotUploaded"
  | "replace"
  | "documentUploaded"
  | "documentUploadFailed"
  | "documentDeleted"
  | "documentDeleteFailed"
  | "documentTypeNotAllowed"
  | "documentTooLarge"
  | "pleaseChooseFile"
  | "replaceDocumentPartial"
  | "otherDocuments"
  | "viewCustomer"
  | "customerShortNameRequiredForUpload"
  | "dropboxFiles"
  | "notYetSyncedToDropbox"
  | "syncToDropbox"
  | "etrTaxInvoice"
  | "etrTypeNotAllowed"
  | "confirmDeleteEtr"
  | "etrUploadFailed"
  | "dropboxSyncSuccess"
  | "quotationShortNameRequiredForSync"
  | "adjustQuotation"
  | "retrySync"
  | "dropboxSyncFailedBanner"
  | "pdfConversionUnavailableBanner"
  | "invoiceDropboxSyncFailedBanner"
  | "invoicePdfConversionUnavailableBanner"
  | "final"
  | "current"
  | "historical"
  | "historicalDataUnavailable"
  | "backToCurrentVersion"
  | "confirmApprove"

export const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  en: {
    // Common
    dashboard: "Dashboard",
    customers: "Customers",
    equipment: "Equipment",
    jobs: "Jobs",
    quotations: "Quotations",
    invoice: "Invoice",
    invoiceModule: "Invoice Module",
    invoiceStatusDraft: "Draft",
    invoiceStatusConfirmed: "Confirmed",
    invoiceStatusCancelled: "Cancelled",
    shopAccount: "Shop Account",
    inventory: "Stock",
    reports: "Reports",
    productivity: "Productivity",
    settings: "Settings",
    users: "Users",
    login: "Login",
    logout: "Logout",
    save: "Save",
    cancel: "Cancel",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    search: "Search",
    filter: "Filter",
    actions: "Actions",
    export: "Export",
    download: "Download",
    downloadPdf: "Download PDF",
    downloadExcel: "Download Excel",
    exportPdf: "Export PDF",
    print: "Print",
    // Customers
    customerName: "Contact Name",
    companyName: "Company Name",
    shortName: "Short Name",
    pinNumber: "PIN No",
    phone: "Phone",
    email: "Email",
    address: "Address",
    // Equipment
    brand: "Brand",
    model: "Model",
    itemName: "Item Name",
    serialNumber: "Serial Number",
    assetNumber: "Asset Number",
    // Jobs
    jobNumber: "Job Number",
    status: "Status",
    engineer: "Engineer",
    problemReported: "Problem Reported",
    diagnosis: "Diagnosis",
    workPerformed: "Work Performed",
    // Quotations
    quotationNumber: "Quotation #",
    vat: "VAT",
    total: "Total",
    approved: "Approved",
    rejected: "Rejected",
    // Inventory
    partNumber: "Part Number",
    partName: "Part Name",
    quantity: "Quantity",
    minimumQuantity: "Minimum Quantity",
    supplier: "Supplier",
    unitCost: "Unit Cost",
    sellingPrice: "Selling Price",
    unitSingular: "Unit",
    unitPlural: "Units",
    consumableSingular: "Consumable",
    consumablePlural: "Consumables",
    specification: "Specification",
    picture: "Picture",
    removePicture: "Remove Picture",
    pictureUpdated: "Picture updated",
    pictureRemoved: "Picture removed",
    viewPicture: "View Picture",
    quantityCannotBeNegative: "Quantity cannot be negative",
    // General / page chrome
    view: "View",
    clear: "Clear",
    noResultsFor: 'No results for "{search}".',
    tryDifferentSearchTerm: "Try a different search term.",
    tryAdjustingFilters: "Try adjusting your filters.",
    exportCsv: "Export CSV",
    registered: "Registered",
    detail: "Detail",
    overview: "Overview",
    branches: "Branches",
    name: "Name",
    type: "Type",
    category: "Category",
    date: "Date",
    selectDate: "Select Date",
    reference: "Reference",
    job: "Job",
    by: "By",
    role: "Role",
    code: "Code",
    branch: "Branch",
    description: "Description",
    priority: "Priority",
    searchCustomersPlaceholder: "Search by name, code or company…",
    searchJobsPlaceholder: "Job #, customer, equipment…",
    searchQuotationsPlaceholder: "Search by Q# or customer…",
    searchPartsPlaceholder: "Search by brand, name or model…",
    // Customer detail
    contactInformation: "Contact Information",
    summary: "Summary",
    customerCode: "Customer Code",
    totalJobs: "Total Jobs",
    newQuotation: "New Quotation",
    newJob: "New Job",
    newCustomer: "New Customer",
    newUser: "New User",
    inYourCompany: "in your company",
    addPart: "Add Part",
    noServiceJobs: "No service jobs",
    createJobForCustomerDesc: "Create a job for this customer when equipment needs servicing.",
    noQuotations: "No quotations",
    createQuotationDesc: "Create a quotation for this customer.",
    // Equipment detail
    deviceDetails: "Device Details",
    purchaseDate: "Purchase Date",
    warrantyExpiry: "Warranty Expiry",
    owner: "Owner",
    specifications: "Specifications",
    meterReadings: "Meter Readings",
    black: "Black",
    colour: "Colour",
    source: "Source",
    recordedBy: "Recorded by",
    serviceHistory: "Service History",
    noServiceHistory: "No service history",
    serviceJobsWillAppear: "Service jobs will appear here once created.",
    received: "Received",
    completed: "Completed",
    warranty: "Warranty",
    noMeterReadings: "No meter readings recorded yet.",
    manual: "Manual",
    // Job detail
    customer: "Customer",
    jobDetails: "Job Details",
    assignedTo: "Assigned To",
    due: "Due",
    createdBy: "Created By",
    problemDescription: "Problem Description",
    internalNotes: "Internal Notes",
    technicianNotes: "Technician Notes",
    statusHistory: "Status History",
    photos: "Photos",
    signature: "Signature",
    repairReport: "Repair Report",
    warrantyTo: "Warranty to",
    // Quotation detail
    details: "Details",
    createdLabel: "Created",
    validUntil: "Valid until",
    unitPrice: "Unit Price",
    subtotal: "Subtotal",
    remarks: "Remarks",
    convertedToJob: "Converted to job",
    costSummary: "Cost Summary",
    parts: "Parts",
    // Inventory detail / list
    compatibleWith: "Compatible With",
    storageLocation: "Storage Location",
    stock: "Stock",
    currentQuantity: "Current Quantity",
    stockValue: "Stock Value (at cost)",
    lastCounted: "Last Counted",
    transactionHistory: "Transaction History",
    noStockTransactions: "No stock transactions recorded yet.",
    archived: "Archived",
    location: "Location",
    minQty: "Min Qty",
    inStock: "In Stock",
    lowStock: "Low Stock",
    outOfStock: "Out of Stock",
    noPartsFound: "No parts found",
    addFirstPart: "Add your first spare part to start tracking inventory.",
    inCatalog: "in catalog",
    equipmentEmptyTitle: "No equipment found",
    equipmentEmptyDesc: "Add your first equipment item to start tracking inventory.",
    consumptionEmptyTitle: "No consumption item found",
    consumptionEmptyDesc: "Add your first consumption item to start tracking inventory.",
    partsEmptyTitle: "No part found",
    partsEmptyDesc: "Add your first part to start tracking inventory.",
    addEquipmentItem: "Add Equipment Item",
    addConsumptionItem: "Add Consumption Item",
    addPartItem: "Add Part Item",
    // List pages — empty states & filters
    noCustomersFound: "No customers found",
    registerFirstCustomer: "Register your first customer to get started.",
    noJobsFound: "No jobs found",
    createFirstJob: "Create your first service job to get started.",
    noQuotationsFound: "No quotations found",
    createFirstQuotation: "Create your first quotation to get started.",
    createAndManageQuotations: "Create and manage customer quotations.",
    tryAdjustingSearchOrFilter: "Try adjusting your search or filter.",
    serviceJobs: "Service Jobs",
    allTypes: "All Types",
    allCustomers: "All Customers",
    allStatuses: "All Statuses",
    allPriorities: "All Priorities",
    allCategories: "All Categories",
    allStockLevels: "All Stock Levels",
    allEngineers: "All Engineers",
    allStaff: "All Staff",
    allUsers: "All Users",
    // Reports
    repairReports: "Repair Reports",
    inventoryReports: "Inventory Reports",
    inventoryReportsDesc: "Valuation, low stock, and stock movement reports.",
    inventoryValuation: "Inventory Valuation",
    lowStockReportTitle: "Low Stock Report",
    stockMovementReport: "Stock Movement Report",
    totalParts: "Total Parts",
    stockValueAtCost: "Stock Value (at cost)",
    stockValueAtSelling: "Stock Value (at selling price)",
    partsNeedingReorder: "Parts Needing Reorder",
    engineerProductivity: "Engineer Productivity",
    engineerProductivityDesc: "Track jobs completed, average completion time, revenue, and parts used per engineer.",
    days: "days",
    jobsCompleted: "Jobs Completed",
    jobsAssigned: "Jobs Assigned",
    avgCompletionTime: "Avg. Completion Time",
    revenueGenerated: "Revenue Generated",
    partsUsed: "Parts Used",
    costValue: "Cost Value",
    sellingValue: "Selling Value",
    reportDate: "Report Date",
    totalCost: "Total Cost",
    serviceType: "Service Type",
    noPartsInInventory: "No parts in inventory",
    addPartsToSeeValuation: "Add spare parts to see their valuation here.",
    noLowStockItems: "No low stock items",
    allPartsAboveMin: "All parts are above their minimum stock levels.",
    noStockMovementsFound: "No stock movements found",
    currentQty: "Current Qty",
    part: "Part",
    noRepairReportsFound: "No repair reports found",
    noRepairReportsDesc: "Try adjusting your filters, or repair reports will appear here once jobs are completed.",
    noQuotationsFoundReport: "No quotations found",
    noQuotationsReportsDesc: "Try adjusting your filters, or quotations will appear here once created.",
    reportsDesc: "View service performance, revenue, and operational reports.",
    completedJobs: "Completed Jobs",
    inventoryValuationCost: "Inventory Valuation (cost)",
    lowStockItems: "Low Stock Items",
    viewReport: "View report",
    stockMovements: "Stock Movements",
    pdf: "PDF",
    noProductivityData: "No productivity data found",
    // Tasks
    tasks: "Tasks",
    taskNewTask: "New Task",
    taskCreateTask: "Create Task",
    taskSelectATask: "Select a task",
    taskClickToView: "Click a task on the left to view its workflow.",
    taskNoTasksYet: "No tasks yet",
    taskNoTasksDesc: "Create the first task to get started.",
    taskNoTasksAssigned: "You have no tasks assigned to you.",
    taskStatusActive: "Active",
    taskStatusCompleted: "Completed",
    taskCreatedByLabel: "Created by",
    taskParticipantsLabel: "Participants",
    taskAddNextStep: "Add Next Step",
    taskAddNextStepHint: "Add next step…",
    taskMarkCompleted: "Mark as Completed",
    taskReopen: "Reopen",
    taskBy: "by",
    taskNoSteps: "No steps yet.",
    taskModalDesc: "Create a new task and assign participants.",
    taskTitleField: "Task Title",
    taskInitialStep: "Initial Step",
    taskStepTitleField: "Step Title",
    taskSearchStaff: "Search staff…",
    taskNoUsersFound: "No users found",
    taskAddStepAction: "Add Step",
    taskAddStepModalDesc: "Describe what was done or what happens next.",
    taskCreatedSuccess: "Task created successfully",
    taskStepAdded: "Step added successfully",
    taskCompletedSuccess: "Task completed successfully",
    taskReopenedSuccess: "Task reopened",
    taskDeletedSuccess: "Task deleted",
    taskTitleRequired: "Task title is required",
    taskStepTitleRequired: "Step title is required",
    taskParticipantRequired: "Select at least one participant",
    addParticipant: "Add Participant",
    addParticipantModalDesc: "Select one or more staff to add to this task.",
    removeParticipant: "Remove",
    confirmRemoveParticipantQuestion: "Remove this participant from the task?",
    participantAddedSuccess: "Participant added",
    participantRemovedSuccess: "Participant removed",
    allUsersAlreadyParticipants: "Everyone is already a participant",
    taskNoParticipantsYet: "No participants yet",
    // Task step images
    taskUploadImages: "Upload Images",
    taskImagesLabel: "Images",
    taskImagePreview: "Preview",
    taskRemoveImage: "Remove Image",
    taskImageUploadFailed: "Some images failed to upload",
    editProgressNode: "Edit Progress Node",
    deleteProgressNode: "Delete Progress Node",
    confirmDeleteProgressNodeQuestion: "Are you sure you want to delete this progress node?",
    actionCannotBeUndone: "This action cannot be undone.",
    progressNodeUpdated: "Progress node updated successfully.",
    progressNodeDeleted: "Progress node deleted successfully.",
    noPermissionForAction: "You do not have permission to perform this action.",
    // Invoices
    unit: "Unit",
    exportExcel: "Export Excel",
    generateInvoice: "Generate Invoice",
    generateInvoiceDesc: "Create an invoice from this quotation's items. You can adjust the invoice number, date, customer PIN, and VAT rate before generating.",
    invoiceNumberLabel: "Invoice No.",
    invoiceDateLabel: "Date",
    invoiceCustomerPinLabel: "Customer PIN",
    invoiceVatPercentLabel: "VAT %",
    invoices: "Invoices",
    invoicesDesc: "Invoices generated from quotations.",
    searchInvoicesPlaceholder: "Search invoice no., customer, or quotation…",
    noInvoicesFound: "No invoices found",
    noInvoicesDesc: "Invoices generated from approved quotations will appear here.",
    invoiceItems: "Invoice Items",
    receivedBy: "Received By",
    viewInvoice: "View Invoice",
    directInvoice: "Direct Invoice",
    fromQuotation: "From Quotation",
    createInvoice: "Create Invoice",
    paidAmount: "Paid Amount",
    applyToSalesRecords: "Apply to Sales Records",
    allocateAmount: "Allocate",
    allocatedAmount: "Allocated",
    unallocatedAmount: "Unallocated",
    receiptAllocation: "Receipt Allocation",
    paymentHistory: "Payment History",
    createSalesRecord: "Create Sales Record",
    viewSalesRecord: "View Sales Record",
    confirm: "Confirm",
    receiptAmount: "Receipt Amount",
    lineTotal: "Line Total",
    product: "Product",
    stockCategoryLabel: "Stock Category",
    noItemsAdded: "No items added yet. Search for a stock item above to add it.",
    invoiceDateLabel2: "Invoice Date",
    stockShortfallDesc: "Insufficient stock for one or more items",
    confirmInvoiceConfirm: "Confirm this invoice? Stock will be deducted for all stock-linked items.",
    cancelInvoiceConfirm: "Cancel this invoice? Any deducted stock will be restored.",
    deleteInvoiceConfirm: "Delete this invoice? This cannot be undone.",
    invoiceDeleted: "Invoice deleted",
    deleteQuotationConfirmTitle: "Are you sure you want to delete this quotation?",
    deleteQuotationConfirmDesc: "This action will remove the quotation from the system.",
    quotationDeleted: "Quotation deleted",
    invoiceConfirmed: "Invoice confirmed",
    invoiceCancelled: "Invoice cancelled",
    salesRecordCreated: "Sales record created",
    stockStatus: "Stock Status",
    salesLedgerLinkage: "Sales Ledger",
    notLinkedToSalesLedger: "Not yet added to Sales Ledger",
    noUnpaidInvoicesForCustomer: "This customer has no unpaid or partially paid invoices",
    allocationExceedsBalance: "Allocation cannot exceed this invoice's balance",
    allocationExceedsReceipt: "Total allocated cannot exceed the receipt amount",
    amountReceivedLockedHint: "Computed from Receipt Allocations — edit via the Income record instead",
    salesLedgerDetail: "Sales Ledger Detail",
    backToSalesLedger: "Sales Ledger",
    // Notification popup
    overdueTasksLabel: "Overdue Tasks",
    taskOverdueNotice: "Task overdue",
    lastActivityLabel: "Last activity",
    daysInactiveLabel: "Days inactive",
    viewTask: "View Task",
    lowStockAlertsLabel: "Low Stock Alerts",
    overdueTaskAlertsLabel: "Overdue Task Alerts",
    noAlertsLabel: "No alerts",
    noDashboardInformationForPermissions: "No dashboard information available for your permissions.",
    // Ledger
    ledger: "Ledger",
    ledgerDesc: "Track company income, expenses, and sales invoices.",
    incomeExpenseBook: "Income & Expense Book",
    incomeExpenseBookDesc: "Simple tracking of company income and expenses.",
    salesLedger: "Sales Ledger",
    salesLedgerDesc: "Track sales invoices and customer payment status.",
    income: "Income",
    expense: "Expense",
    amount: "Amount",
    paymentMethod: "Payment Method",
    referenceNo: "Reference No",
    remark: "Remark",
    totalIncome: "Total Income",
    totalExpense: "Total Expense",
    addIncome: "Add Income",
    addExpense: "Add Expense",
    editEntry: "Edit Entry",
    archiveRecord: "Archive",
    restoreRecord: "Restore",
    addCategory: "Add Category",
    categoryName: "Category Name",
    newCategory: "+ Create new category…",
    noLedgerEntriesFound: "No records found",
    noLedgerEntriesDesc: "Add your first income or expense record to get started.",
    deleteEntryConfirm: "Are you sure you want to delete this record? This action cannot be undone.",
    receivingMethod: "Receiving Method",
    paymentOrReceivingMethod: "Payment / Receiving Method",
    allPaymentMethods: "All Payment Methods",
    paymentMethodMpesa: "MPESA",
    paymentMethodCash: "Cash",
    paymentMethodBankTransfer: "Bank Transfer",
    paymentMethodCheque: "Cheque",
    paymentMethodCard: "Card",
    paymentMethodOther: "Other",
    salesCustomerName: "Customer Name",
    orderNo: "Order No / Reference No",
    invoiceAmount: "Invoice Amount",
    amountReceived: "Amount Received",
    balance: "Balance",
    paymentStatus: "Payment Status",
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
    allPaymentStatuses: "All Payment Statuses",
    totalInvoiceAmount: "Total Invoice Amount",
    totalReceived: "Total Received",
    totalBalance: "Total Balance",
    // Shop Account
    shopAccountDesc: "Daily shop purchases, expenses, and income — independent from the company Ledger.",
    supplierPayee: "Supplier / Payee",
    attachment: "Receipt / Attachment",
    attachmentUploadLabel: "Drag & drop a receipt (image or PDF), or click to browse",
    attachmentUploaded: "Attachment uploaded",
    attachmentRemoved: "Attachment removed",
    recordSaved: "Record saved",
    recordUpdated: "Record updated",
    recordDeleted: "Record deleted",
    noShopAccountEntriesFound: "No shop account entries found",
    noShopAccountEntriesDesc: "Add your first income or expense entry to get started.",
    amountMustBeGreaterThanZero: "Amount must be greater than zero",
    insufficientStock: "Insufficient stock",
    invoiceAlreadyConfirmed: "Invoice is already confirmed",
    invoiceAlreadyCancelled: "Invoice is already cancelled",
    fileUploadFailed: "File upload failed",
    permissionDenied: "Permission denied",
    nameAlreadyExists: "Name already exists",
    quotationNumberExists: "Quotation number already exists.",
    invoiceNumberExists: "Invoice number already exists.",
    nameRequired: "Name is required",
    addSalesRecord: "Add Sales Record",
    editSalesRecord: "Edit Sales Record",
    noSalesLedgerFound: "No sales ledger records found",
    noSalesLedgerDesc: "Add your first sales record to get started.",
    searchSalesLedgerPlaceholder: "Search by customer name or order no…",
    searchLedgerPlaceholder: "Search income or expense...",
    currentMonth: "Current Month",
    fromDate: "From Date",
    toDate: "To Date",
    statusActive: "Active",
    statusArchived: "Archived",
    // Settings
    companySettings: "Company Settings",
    companySettingsDesc: "Manage your company profile, branding, and regional preferences.",
    phoneNumber: "Phone Number",
    website: "Website",
    kraPin: "KRA PIN",
    vatPercentage: "VAT Percentage",
    currency: "Currency",
    timezone: "Timezone",
    uploadLogo: "Upload Logo",
    saveChanges: "Save Changes",
    companySettingsSaved: "Company settings saved",
    logoUpdated: "Logo updated",
    failedToUploadLogo: "Failed to upload logo",
    logoFormatHint: "PNG, JPG or WEBP. Max 5MB.",
    fullCompanyAddress: "Full company address",
    // Dropbox Integration
    dropboxIntegration: "Dropbox Integration",
    dropboxIntegrationDesc: "Connect Dropbox to store Customer, Quotation, and Invoice files.",
    dropboxConfiguration: "Configuration",
    dropboxConfigured: "Configured",
    dropboxConfigMissing: "Configuration Missing",
    dropboxConfigMissingDesc: "Dropbox environment variables are not set on this server. Contact your administrator.",
    dropboxConnectionStatus: "Connection",
    dropboxConnected: "Connected",
    dropboxDisconnected: "Disconnected",
    dropboxAccount: "Account",
    dropboxEmail: "Email",
    dropboxRootFolder: "Root Folder",
    dropboxLastConnected: "Last Connected",
    connectDropbox: "Connect Dropbox",
    testConnection: "Test Connection",
    initializeFolders: "Initialize Folders",
    disconnectDropbox: "Disconnect",
    dropboxDisconnectConfirmTitle: "Disconnect Dropbox?",
    dropboxDisconnectConfirmDesc: "Disconnecting Dropbox will stop synchronization but will not delete files already stored in Dropbox.",
    dropboxConnectionSuccessful: "Connection successful",
    dropboxFoldersInitialized: "Dropbox folders initialized successfully",
    dropboxConnectedToast: "Dropbox connected",
    // Users
    active: "Active",
    disabledStatus: "Disabled",
    joined: "Joined",
    you: "you",
    noUsersFound: "No users found",
    createFirstStaffAccount: "Create your first staff account to get started.",
    roleUpdated: "Role updated",
    userDisabled: "User disabled",
    userEnabled: "User enabled",
    disable: "Disable",
    enable: "Enable",
    disableUser: "Disable User",
    enableUser: "Enable User",
    disableUserDesc: "This user will no longer be able to log in. You can re-enable their account at any time.",
    enableUserDesc: "This user will regain access and be able to log in again.",
    backToUsers: "Back to Users",
    newUserDesc: "Create a new staff account and assign a role.",
    fullName: "Full Name",
    username: "Username",
    nameIsLoginId: "This name is used to sign in — must be unique",
    emailAddress: "Email Address",
    password: "Password",
    minimum8Characters: "Minimum 8 characters",
    createUser: "Create User",
    // User permissions
    moduleAccess: "Module Access",
    editPermissions: "Permissions",
    savePermissions: "Save Permissions",
    permissionsUpdated: "Permissions updated",
    adminFullAccess: "Admin always has full access — permissions cannot be restricted.",
    selfProtectedModules: "Dashboard, Users and Settings are always enabled for your own account.",
    allModules: "All Modules",
    // User security / lockout
    locked: "Locked",
    accountLockedDesc: "Your account has been locked due to too many failed login attempts. Please wait 30 minutes or ask an administrator to unlock your account.",
    unlock: "Unlock",
    unlockUser: "Unlock User",
    unlockUserDesc: "This will immediately clear the login lockout and reset the failed attempt counter.",
    userUnlocked: "User unlocked",
    // User profile
    editProfile: "Edit Profile",
    profileUpdated: "Profile updated",
    department: "Department",
    position: "Position",
    saveProfile: "Save Profile",
    displayName: "Display Name",
    // Dashboard homepage
    welcomeBack: "Welcome back, {name}",
    dashboardIntro: "Select a module below to get started.",
    alertsLabel: "Alerts",
    customersDesc: "Manage customer records and branches.",
    stockDesc: "Track spare parts and stock levels.",
    tasksDesc: "Assign and track team tasks.",
    usersDesc: "Manage staff accounts and roles.",
    activeTasksLabel: "Active Tasks",
    lowStockItemsLabel: "Low Stock Items",
    unpaidSalesBalanceLabel: "Unpaid Sales Balance",
    activeQuotationsLabel: "Active Quotations",
    invoicesLabel: "Invoices",
    equipmentQuantityLabel: "Equipment Quantity",
    consumptionQuantityLabel: "Consumption Quantity",
    partsQuantityLabel: "Parts Quantity",
    currentMonthIncomeLabel: "Current Month Income",
    currentMonthExpenseLabel: "Current Month Expense",
    currentMonthShopExpenseLabel: "Current Month Shop Expense",
    recentQuotationsLabel: "Recent Quotations",
    recentSalesLabel: "Recent Sales",
    recentTasksLabel: "Recent Tasks",
    recentShopEntriesLabel: "Recent Shop Account Entries",
    businessOverviewSection: "Business Overview",
    stockOverviewSection: "Stock Overview",
    financialOverviewSection: "Financial Overview",
    recentActivitySection: "Recent Activity",
    noRecentRecords: "No recent records",
    viewAllLink: "View all →",
    mainContactName: "Main Contact Name",
    mainContactPhone: "Main Contact Phone",
    mainContactEmail: "Main Contact Email",
    mainAddress: "Main Address",
    notes: "Notes",
    companyInformation: "Company Information",
    headOfficeContact: "Head Office Contact",
    projectsAndContacts: "Projects & Contacts",
    addProject: "+ Add Project",
    editProject: "Edit Project",
    removeProject: "Remove Project",
    projectName: "Project Name",
    contactName: "Contact Name",
    contactPhone: "Contact Phone",
    contactEmail: "Contact Email",
    projectAddress: "Project Address",
    headOfficeMainContact: "Head Office / Main Contact",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    confirmDeactivateProject: "Deactivate this project? It will be hidden from new job/quotation pickers, but historical records referencing it are unaffected.",
    noProjectsYet: "No projects added yet. This customer uses the head office contact only.",
    numberOfProjects: "Projects",
    numberOfDocuments: "Documents",
    inactiveLabel: "Inactive",
    documents: "Documents",
    uploadFile: "Upload File",
    documentType: "Document Type",
    relatedProject: "Related Project",
    generalDocument: "General (Company)",
    uploadDate: "Upload Date",
    uploadedBy: "Uploaded By",
    noDocumentsYet: "No documents uploaded yet.",
    confirmDeleteDocument: "Delete this document? This cannot be undone.",
    documentTypeContract: "Contract",
    documentTypeIdDocument: "ID Document",
    documentTypeCorrespondence: "Correspondence",
    documentTypeOther: "Other",
    customerDocuments: "Customer Documents",
    registrationCertificate: "Registration Certificate",
    pinCertificate: "PIN Certificate",
    cr12: "CR12",
    vatCertificate: "VAT Certificate",
    companyProfile: "Company Profile",
    dropboxFileName: "Dropbox File Name",
    dropboxPath: "Dropbox Path",
    originalLabel: "Original",
    documentTypeRequired: "Document type is required",
    documentNotUploaded: "Not uploaded",
    replace: "Replace",
    documentUploaded: "Document uploaded",
    documentUploadFailed: "Failed to upload document",
    documentDeleted: "Document deleted",
    documentDeleteFailed: "Failed to delete document",
    documentTypeNotAllowed: "Only JPG, PNG, WEBP, PDF, and Word documents are allowed",
    documentTooLarge: "File exceeds 10MB limit",
    pleaseChooseFile: "Please choose a file",
    replaceDocumentPartial: "New file uploaded, but the old one could not be removed",
    otherDocuments: "Other Documents",
    viewCustomer: "View Customer",
    customerShortNameRequiredForUpload: "This customer has no Short Name yet. Edit the customer to add one before uploading documents.",
    dropboxFiles: "Dropbox Files",
    notYetSyncedToDropbox: "Not yet synced to Dropbox",
    syncToDropbox: "Sync to Dropbox",
    etrTaxInvoice: "ETR Tax Invoice",
    etrTypeNotAllowed: "Only PDF, JPG, and PNG files are allowed",
    confirmDeleteEtr: "Delete this ETR? This cannot be undone.",
    etrUploadFailed: "ETR upload failed",
    dropboxSyncSuccess: "Synced to Dropbox",
    quotationShortNameRequiredForSync: "Customer Short Name is required before syncing quotation to Dropbox.",
    adjustQuotation: "Adjust Quotation",
    retrySync: "Retry Sync",
    dropboxSyncFailedBanner: "Quotation saved, but Dropbox sync failed.",
    pdfConversionUnavailableBanner: "PDF conversion is not available for this version yet.",
    invoiceDropboxSyncFailedBanner: "Invoice saved, but Dropbox sync failed.",
    invoicePdfConversionUnavailableBanner: "PDF conversion is not available for this invoice yet.",
    final: "FINAL",
    current: "Current",
    historical: "Historical",
    historicalDataUnavailable: "Historical data snapshot unavailable for this version.",
    backToCurrentVersion: "Back to Current Version",
    confirmApprove: "Are you sure you want to approve this quotation?",
  },
  zh: {
    // Common
    dashboard: "仪表盘",
    customers: "客户",
    equipment: "设备",
    jobs: "工单",
    quotations: "报价单",
    invoice: "发票",
    invoiceModule: "发票模块",
    invoiceStatusDraft: "草稿",
    invoiceStatusConfirmed: "已确认",
    invoiceStatusCancelled: "已取消",
    shopAccount: "店铺账目",
    inventory: "库存",
    reports: "报表",
    productivity: "生产力",
    settings: "设置",
    users: "用户",
    login: "登录",
    logout: "退出登录",
    save: "保存",
    cancel: "取消",
    create: "新建",
    edit: "编辑",
    delete: "删除",
    search: "搜索",
    filter: "筛选",
    actions: "操作",
    export: "导出",
    download: "下载",
    downloadPdf: "下载PDF",
    downloadExcel: "下载Excel",
    exportPdf: "导出PDF",
    print: "打印",
    // Customers
    customerName: "联系人",
    companyName: "公司名称",
    shortName: "简称",
    pinNumber: "PIN 号",
    phone: "电话",
    email: "邮箱",
    address: "地址",
    // Equipment
    brand: "品牌",
    model: "型号",
    itemName: "物品名称",
    serialNumber: "序列号",
    assetNumber: "资产编号",
    // Jobs
    jobNumber: "工单编号",
    status: "状态",
    engineer: "工程师",
    problemReported: "报告的问题",
    diagnosis: "诊断",
    workPerformed: "已完成的工作",
    // Quotations
    quotationNumber: "报价单号",
    vat: "增值税",
    total: "总计",
    approved: "已批准",
    rejected: "已拒绝",
    // Inventory
    partNumber: "零件编号",
    partName: "零件名称",
    quantity: "数量",
    minimumQuantity: "最低数量",
    supplier: "供应商",
    unitCost: "单位成本",
    sellingPrice: "销售价格",
    unitSingular: "台",
    unitPlural: "台",
    consumableSingular: "耗材",
    consumablePlural: "耗材",
    specification: "规格说明",
    picture: "图片",
    removePicture: "移除图片",
    pictureUpdated: "图片已更新",
    pictureRemoved: "图片已移除",
    viewPicture: "查看图片",
    quantityCannotBeNegative: "数量不能为负数",
    // General / page chrome
    view: "查看",
    clear: "清除",
    noResultsFor: '未找到与"{search}"相关的结果。',
    tryDifferentSearchTerm: "请尝试其他搜索词。",
    tryAdjustingFilters: "请尝试调整筛选条件。",
    exportCsv: "导出CSV",
    registered: "注册日期",
    detail: "详情",
    overview: "概览",
    branches: "分支机构",
    name: "名称",
    type: "类型",
    category: "分类",
    date: "日期",
    selectDate: "选择日期",
    reference: "参考",
    job: "工单",
    by: "操作人",
    role: "角色",
    code: "编码",
    branch: "分支机构",
    description: "描述",
    priority: "优先级",
    searchCustomersPlaceholder: "按名称、编号或公司搜索…",
    searchJobsPlaceholder: "工单号、客户、设备…",
    searchQuotationsPlaceholder: "按报价单号或客户搜索…",
    searchPartsPlaceholder: "按品牌、名称或型号搜索…",
    // Customer detail
    contactInformation: "联系信息",
    summary: "摘要",
    customerCode: "客户编码",
    totalJobs: "工单总数",
    newQuotation: "新建报价单",
    newJob: "新建工单",
    newCustomer: "新建客户",
    newUser: "新建用户",
    inYourCompany: "位于贵公司",
    addPart: "新增零件",
    noServiceJobs: "暂无服务工单",
    createJobForCustomerDesc: "当设备需要维修时，为该客户创建工单。",
    noQuotations: "暂无报价单",
    createQuotationDesc: "为该客户创建报价单。",
    // Equipment detail
    deviceDetails: "设备详情",
    purchaseDate: "购买日期",
    warrantyExpiry: "保修到期日",
    owner: "所有者",
    specifications: "规格说明",
    meterReadings: "读数记录",
    black: "黑白",
    colour: "彩色",
    source: "来源",
    recordedBy: "记录人",
    serviceHistory: "服务历史",
    noServiceHistory: "暂无服务记录",
    serviceJobsWillAppear: "创建后服务工单将显示在此处。",
    received: "接收日期",
    completed: "完成日期",
    warranty: "保修",
    noMeterReadings: "暂无读数记录。",
    manual: "手动",
    // Job detail
    customer: "客户",
    jobDetails: "工单详情",
    assignedTo: "指派给",
    due: "截止日期",
    createdBy: "创建人",
    problemDescription: "问题描述",
    internalNotes: "内部备注",
    technicianNotes: "技术员备注",
    statusHistory: "状态历史",
    photos: "照片",
    signature: "签名",
    repairReport: "维修报告",
    warrantyTo: "保修至",
    // Quotation detail
    details: "详情",
    createdLabel: "创建时间",
    validUntil: "有效期至",
    unitPrice: "单价",
    subtotal: "小计",
    remarks: "备注",
    convertedToJob: "已转换为工单",
    costSummary: "费用汇总",
    parts: "备件",
    // Inventory detail / list
    compatibleWith: "适用型号",
    storageLocation: "存储位置",
    stock: "库存",
    currentQuantity: "当前数量",
    stockValue: "库存价值（按成本）",
    lastCounted: "最后盘点日期",
    transactionHistory: "交易记录",
    noStockTransactions: "暂无库存交易记录。",
    archived: "已归档",
    location: "位置",
    minQty: "最低数量",
    inStock: "有库存",
    lowStock: "库存不足",
    outOfStock: "缺货",
    noPartsFound: "未找到零件",
    addFirstPart: "添加第一个备件以开始跟踪库存。",
    inCatalog: "在库",
    equipmentEmptyTitle: "未找到设备",
    equipmentEmptyDesc: "添加您的第一个设备以开始跟踪库存。",
    consumptionEmptyTitle: "未找到耗材",
    consumptionEmptyDesc: "添加您的第一个耗材以开始跟踪库存。",
    partsEmptyTitle: "未找到零件",
    partsEmptyDesc: "添加您的第一个零件以开始跟踪库存。",
    addEquipmentItem: "新增设备",
    addConsumptionItem: "新增耗材",
    addPartItem: "新增零件",
    // List pages — empty states & filters
    noCustomersFound: "未找到客户",
    registerFirstCustomer: "注册第一个客户以开始使用。",
    noJobsFound: "未找到工单",
    createFirstJob: "创建第一个服务工单以开始使用。",
    noQuotationsFound: "未找到报价单",
    createFirstQuotation: "创建第一个报价单以开始使用。",
    createAndManageQuotations: "创建和管理客户报价单。",
    tryAdjustingSearchOrFilter: "请尝试调整搜索或筛选条件。",
    serviceJobs: "服务工单",
    allTypes: "所有类型",
    allCustomers: "所有客户",
    allStatuses: "所有状态",
    allPriorities: "所有优先级",
    allCategories: "所有分类",
    allStockLevels: "所有库存水平",
    allEngineers: "所有工程师",
    allStaff: "所有员工",
    allUsers: "所有用户",
    // Reports
    repairReports: "维修报告",
    inventoryReports: "库存报表",
    inventoryReportsDesc: "估值、低库存和库存变动报表。",
    inventoryValuation: "库存估值",
    lowStockReportTitle: "低库存报表",
    stockMovementReport: "库存变动报表",
    totalParts: "零件总数",
    stockValueAtCost: "库存价值（按成本）",
    stockValueAtSelling: "库存价值（按售价）",
    partsNeedingReorder: "需补货零件",
    engineerProductivity: "工程师生产力",
    engineerProductivityDesc: "追踪每位工程师完成的工单、平均完成时间、产生的收入和使用的备件。",
    days: "天",
    jobsCompleted: "已完成工单",
    jobsAssigned: "已分配工单",
    avgCompletionTime: "平均完成时间",
    revenueGenerated: "创造的收入",
    partsUsed: "已用零件",
    costValue: "成本价值",
    sellingValue: "销售价值",
    reportDate: "报告日期",
    totalCost: "总费用",
    serviceType: "服务类型",
    noPartsInInventory: "库存中暂无零件",
    addPartsToSeeValuation: "添加备件以查看其估值。",
    noLowStockItems: "暂无低库存项目",
    allPartsAboveMin: "所有零件库存均高于最低库存水平。",
    noStockMovementsFound: "未找到库存变动记录",
    currentQty: "当前数量",
    part: "零件",
    noRepairReportsFound: "未找到维修报告",
    noRepairReportsDesc: "请尝试调整筛选条件，或在工单完成后维修报告将显示在此处。",
    noQuotationsFoundReport: "未找到报价单",
    noQuotationsReportsDesc: "请尝试调整筛选条件，或在创建报价单后将显示在此处。",
    reportsDesc: "查看服务表现、收入和运营报表。",
    completedJobs: "已完成工单",
    inventoryValuationCost: "库存估值（成本）",
    lowStockItems: "低库存项目",
    viewReport: "查看报表",
    stockMovements: "库存变动",
    pdf: "PDF",
    noProductivityData: "未找到生产力数据",
    // Tasks
    tasks: "任务",
    taskNewTask: "新建任务",
    taskCreateTask: "创建任务",
    taskSelectATask: "选择任务",
    taskClickToView: "点击左侧任务查看工作流程",
    taskNoTasksYet: "暂无任务",
    taskNoTasksDesc: "创建第一个任务开始使用",
    taskNoTasksAssigned: "您没有被分配的任务",
    taskStatusActive: "进行中",
    taskStatusCompleted: "已完成",
    taskCreatedByLabel: "创建人",
    taskParticipantsLabel: "参与人",
    taskAddNextStep: "添加下一步",
    taskAddNextStepHint: "添加下一步...",
    taskMarkCompleted: "标记为完成",
    taskReopen: "重新打开",
    taskBy: "操作人",
    taskNoSteps: "暂无步骤",
    taskModalDesc: "创建一个新任务并分配参与人",
    taskTitleField: "任务标题",
    taskInitialStep: "初始步骤",
    taskStepTitleField: "步骤标题",
    taskSearchStaff: "搜索员工...",
    taskNoUsersFound: "未找到用户",
    taskAddStepAction: "添加步骤",
    taskAddStepModalDesc: "描述已完成的内容或下一步操作",
    taskCreatedSuccess: "任务创建成功",
    taskStepAdded: "步骤添加成功",
    taskCompletedSuccess: "任务已完成",
    taskReopenedSuccess: "任务已重新打开",
    taskDeletedSuccess: "任务已删除",
    taskTitleRequired: "请输入任务标题",
    taskStepTitleRequired: "请输入步骤标题",
    taskParticipantRequired: "请至少选择一个参与人",
    addParticipant: "添加参与人",
    addParticipantModalDesc: "选择一位或多位员工加入此任务。",
    removeParticipant: "移除",
    confirmRemoveParticipantQuestion: "确定要将此参与人从任务中移除吗？",
    participantAddedSuccess: "参与人已添加",
    participantRemovedSuccess: "参与人已移除",
    allUsersAlreadyParticipants: "所有用户均已是参与人",
    taskNoParticipantsYet: "暂无参与人",
    // Task step images
    taskUploadImages: "上传图片",
    taskImagesLabel: "图片",
    taskImagePreview: "预览",
    taskRemoveImage: "删除图片",
    taskImageUploadFailed: "部分图片上传失败",
    editProgressNode: "编辑进度节点",
    deleteProgressNode: "删除进度节点",
    confirmDeleteProgressNodeQuestion: "确定要删除这个进度节点吗？",
    actionCannotBeUndone: "此操作无法撤销。",
    progressNodeUpdated: "进度节点已更新。",
    progressNodeDeleted: "进度节点已删除。",
    noPermissionForAction: "您没有权限执行此操作。",
    // Invoices
    unit: "单位",
    exportExcel: "导出 Excel",
    generateInvoice: "生成发票",
    generateInvoiceDesc: "根据此报价单的项目生成发票。生成前可修改发票编号、日期、客户PIN和增值税率。",
    invoiceNumberLabel: "发票编号",
    invoiceDateLabel: "日期",
    invoiceCustomerPinLabel: "客户 PIN",
    invoiceVatPercentLabel: "增值税率 %",
    invoices: "发票",
    invoicesDesc: "由报价单生成的发票。",
    searchInvoicesPlaceholder: "搜索发票编号、客户或报价单…",
    noInvoicesFound: "暂无发票",
    noInvoicesDesc: "由已批准报价单生成的发票将显示在此处。",
    invoiceItems: "发票项目",
    receivedBy: "签收人",
    viewInvoice: "查看发票",
    directInvoice: "直接开票",
    fromQuotation: "来自报价单",
    createInvoice: "新建发票",
    paidAmount: "已付金额",
    applyToSalesRecords: "关联销售台账",
    allocateAmount: "分配",
    allocatedAmount: "已分配",
    unallocatedAmount: "未分配",
    receiptAllocation: "收款分配",
    paymentHistory: "收款记录",
    createSalesRecord: "加入销售台账",
    viewSalesRecord: "查看销售记录",
    confirm: "确认",
    receiptAmount: "收款金额",
    lineTotal: "小计",
    product: "产品",
    stockCategoryLabel: "库存分类",
    noItemsAdded: "尚未添加任何项目。请在上方搜索库存项目以添加。",
    invoiceDateLabel2: "发票日期",
    stockShortfallDesc: "一个或多个项目库存不足",
    confirmInvoiceConfirm: "确认此发票？所有关联库存的项目将扣减库存。",
    cancelInvoiceConfirm: "取消此发票？已扣减的库存将恢复。",
    deleteInvoiceConfirm: "删除此发票？此操作无法撤销。",
    invoiceDeleted: "发票已删除",
    deleteQuotationConfirmTitle: "确定要删除这份报价单吗？",
    deleteQuotationConfirmDesc: "此操作会将报价单从系统中移除。",
    quotationDeleted: "报价单已删除",
    invoiceConfirmed: "发票已确认",
    invoiceCancelled: "发票已取消",
    salesRecordCreated: "销售记录已创建",
    stockStatus: "库存状态",
    salesLedgerLinkage: "销售台账",
    notLinkedToSalesLedger: "尚未加入销售台账",
    noUnpaidInvoicesForCustomer: "该客户没有未付款或部分付款的发票",
    allocationExceedsBalance: "分配金额不能超过该发票的余额",
    allocationExceedsReceipt: "分配总额不能超过收款金额",
    amountReceivedLockedHint: "由收款分配自动计算 — 请通过对应的收入记录修改",
    salesLedgerDetail: "销售台账详情",
    backToSalesLedger: "销售台账",
    // Notification popup
    overdueTasksLabel: "超期任务",
    taskOverdueNotice: "任务已超期",
    lastActivityLabel: "最后活动时间",
    daysInactiveLabel: "无活动天数",
    viewTask: "查看任务",
    lowStockAlertsLabel: "低库存提醒",
    overdueTaskAlertsLabel: "任务超期提醒",
    noAlertsLabel: "暂无提醒",
    noDashboardInformationForPermissions: "您当前的权限下暂无可显示的仪表盘信息。",
    // Ledger
    ledger: "台账",
    ledgerDesc: "追踪公司收支与销售发票。",
    incomeExpenseBook: "收支账",
    incomeExpenseBookDesc: "简单记录公司的收入与支出。",
    salesLedger: "销售账",
    salesLedgerDesc: "追踪销售发票和客户付款状态。",
    income: "收入",
    expense: "支出",
    amount: "金额",
    paymentMethod: "支出方式",
    referenceNo: "参考编号",
    remark: "备注",
    totalIncome: "总收入",
    totalExpense: "总支出",
    addIncome: "新增收入",
    addExpense: "新增支出",
    editEntry: "编辑记录",
    archiveRecord: "归档",
    restoreRecord: "恢复",
    addCategory: "新增分类",
    categoryName: "分类名称",
    newCategory: "+ 新建分类…",
    noLedgerEntriesFound: "未找到记录",
    noLedgerEntriesDesc: "添加第一笔收入或支出记录以开始使用。",
    deleteEntryConfirm: "确定要删除此记录吗？此操作无法撤销。",
    receivingMethod: "收款方式",
    paymentOrReceivingMethod: "收付方式",
    allPaymentMethods: "所有付款方式",
    paymentMethodMpesa: "MPESA",
    paymentMethodCash: "现金",
    paymentMethodBankTransfer: "银行转账",
    paymentMethodCheque: "支票",
    paymentMethodCard: "银行卡",
    paymentMethodOther: "其他",
    salesCustomerName: "客户名称",
    orderNo: "订单号 / 参考编号",
    invoiceAmount: "发票金额",
    amountReceived: "已收金额",
    balance: "余额",
    paymentStatus: "付款状态",
    paid: "已付款",
    partial: "部分付款",
    unpaid: "未付款",
    allPaymentStatuses: "所有付款状态",
    totalInvoiceAmount: "总发票金额",
    totalReceived: "总已收金额",
    totalBalance: "总余额",
    // Shop Account
    shopAccountDesc: "店铺日常采购、支出和收入 — 独立于公司总账。",
    supplierPayee: "供应商 / 收款方",
    attachment: "收据 / 附件",
    attachmentUploadLabel: "拖放收据（图片或PDF），或点击浏览",
    attachmentUploaded: "附件已上传",
    attachmentRemoved: "附件已移除",
    recordSaved: "记录已保存",
    recordUpdated: "记录已更新",
    recordDeleted: "记录已删除",
    noShopAccountEntriesFound: "未找到店铺账目记录",
    noShopAccountEntriesDesc: "添加第一条收入或支出记录以开始使用。",
    amountMustBeGreaterThanZero: "金额必须大于零",
    insufficientStock: "库存不足",
    invoiceAlreadyConfirmed: "发票已确认",
    invoiceAlreadyCancelled: "发票已取消",
    fileUploadFailed: "文件上传失败",
    permissionDenied: "无权限",
    nameAlreadyExists: "名称已存在",
    quotationNumberExists: "报价编号已存在。",
    invoiceNumberExists: "发票编号已存在。",
    nameRequired: "名称为必填项",
    addSalesRecord: "新增销售记录",
    editSalesRecord: "编辑销售记录",
    noSalesLedgerFound: "未找到销售账记录",
    noSalesLedgerDesc: "添加第一笔销售记录以开始使用。",
    searchSalesLedgerPlaceholder: "按客户名称或订单号搜索…",
    searchLedgerPlaceholder: "搜索收入或支出…",
    currentMonth: "本月",
    fromDate: "起始日期",
    toDate: "结束日期",
    statusActive: "进行中",
    statusArchived: "已归档",
    // Settings
    companySettings: "公司设置",
    companySettingsDesc: "管理您的公司资料、品牌和区域设置。",
    phoneNumber: "电话号码",
    website: "网站",
    kraPin: "KRA PIN",
    vatPercentage: "增值税百分比",
    currency: "货币",
    timezone: "时区",
    uploadLogo: "上传徽标",
    saveChanges: "保存更改",
    companySettingsSaved: "公司设置已保存",
    logoUpdated: "徽标已更新",
    failedToUploadLogo: "徽标上传失败",
    logoFormatHint: "PNG、JPG 或 WEBP 格式，最大 5MB。",
    fullCompanyAddress: "公司完整地址",
    // Dropbox Integration
    dropboxIntegration: "Dropbox 集成",
    dropboxIntegrationDesc: "连接 Dropbox 以存储 Customer、Quotation 和 Invoice 文件。",
    dropboxConfiguration: "配置状态",
    dropboxConfigured: "已配置",
    dropboxConfigMissing: "配置缺失",
    dropboxConfigMissingDesc: "服务器未设置 Dropbox 环境变量，请联系管理员。",
    dropboxConnectionStatus: "连接状态",
    dropboxConnected: "已连接",
    dropboxDisconnected: "未连接",
    dropboxAccount: "账户",
    dropboxEmail: "邮箱",
    dropboxRootFolder: "根目录",
    dropboxLastConnected: "最近连接时间",
    connectDropbox: "连接 Dropbox",
    testConnection: "测试连接",
    initializeFolders: "初始化目录",
    disconnectDropbox: "断开连接",
    dropboxDisconnectConfirmTitle: "断开 Dropbox 连接？",
    dropboxDisconnectConfirmDesc: "断开连接将停止同步，但不会删除已存储在 Dropbox 中的文件。",
    dropboxConnectionSuccessful: "连接成功",
    dropboxFoldersInitialized: "Dropbox 目录初始化成功",
    dropboxConnectedToast: "Dropbox 已连接",
    // Users
    active: "启用",
    disabledStatus: "已禁用",
    joined: "加入日期",
    you: "你",
    noUsersFound: "未找到用户",
    createFirstStaffAccount: "创建第一个员工账户以开始使用。",
    roleUpdated: "角色已更新",
    userDisabled: "用户已禁用",
    userEnabled: "用户已启用",
    disable: "禁用",
    enable: "启用",
    disableUser: "禁用用户",
    enableUser: "启用用户",
    disableUserDesc: "该用户将无法再登录。您可以随时重新启用其账户。",
    enableUserDesc: "该用户将恢复访问权限并可重新登录。",
    backToUsers: "返回用户列表",
    newUserDesc: "创建新的员工账户并分配角色。",
    fullName: "全名",
    username: "用户名",
    nameIsLoginId: "该名称将用于登录，必须唯一",
    emailAddress: "电子邮箱",
    password: "密码",
    minimum8Characters: "至少8个字符",
    createUser: "创建用户",
    // User permissions
    moduleAccess: "模块权限",
    editPermissions: "权限",
    savePermissions: "保存权限",
    permissionsUpdated: "权限已更新",
    adminFullAccess: "管理员始终拥有全部权限，无法限制。",
    selfProtectedModules: "仪表盘、用户和设置始终对您自己的账户启用。",
    allModules: "所有模块",
    // User security / lockout
    locked: "已锁定",
    accountLockedDesc: "您的账号因多次登录失败已被锁定，请等待30分钟后重试，或联系管理员解锁。",
    unlock: "解锁",
    unlockUser: "解锁用户",
    unlockUserDesc: "将立即清除登录锁定并重置失败次数。",
    userUnlocked: "用户已解锁",
    // User profile
    editProfile: "编辑资料",
    profileUpdated: "资料已更新",
    department: "部门",
    position: "职位",
    saveProfile: "保存资料",
    displayName: "显示名称",
    // Dashboard homepage
    welcomeBack: "欢迎回来，{name}",
    dashboardIntro: "选择以下模块开始使用。",
    alertsLabel: "提醒",
    customersDesc: "管理客户档案与分支。",
    stockDesc: "追踪备件与库存水平。",
    tasksDesc: "分配并跟踪团队任务。",
    usersDesc: "管理员工账户与角色。",
    activeTasksLabel: "进行中任务",
    lowStockItemsLabel: "低库存物品",
    unpaidSalesBalanceLabel: "未收销售余额",
    activeQuotationsLabel: "有效报价",
    invoicesLabel: "发票数量",
    equipmentQuantityLabel: "设备库存数量",
    consumptionQuantityLabel: "耗材库存数量",
    partsQuantityLabel: "零件库存数量",
    currentMonthIncomeLabel: "本月收入",
    currentMonthExpenseLabel: "本月支出",
    currentMonthShopExpenseLabel: "本月店铺支出",
    recentQuotationsLabel: "最近报价",
    recentSalesLabel: "最近销售",
    recentTasksLabel: "最近任务",
    recentShopEntriesLabel: "最近店铺账目",
    businessOverviewSection: "业务概览",
    stockOverviewSection: "库存概览",
    financialOverviewSection: "财务概览",
    recentActivitySection: "最近动态",
    noRecentRecords: "暂无最近记录",
    viewAllLink: "查看全部 →",
    mainContactName: "总部联系人姓名",
    mainContactPhone: "总部联系人电话",
    mainContactEmail: "总部联系人邮箱",
    mainAddress: "总部地址",
    notes: "备注",
    companyInformation: "公司信息",
    headOfficeContact: "总部联系方式",
    projectsAndContacts: "项目与联系人",
    addProject: "+ 添加项目",
    editProject: "编辑项目",
    removeProject: "移除项目",
    projectName: "项目名称",
    contactName: "联系人姓名",
    contactPhone: "联系人电话",
    contactEmail: "联系人邮箱",
    projectAddress: "项目地址",
    headOfficeMainContact: "总部 / 主要联系人",
    deactivate: "停用",
    reactivate: "启用",
    confirmDeactivateProject: "停用此项目？停用后将不再出现在新建工单/报价单的选择列表中，但历史记录不受影响。",
    noProjectsYet: "暂无项目，该客户仅使用总部联系方式。",
    numberOfProjects: "项目数",
    numberOfDocuments: "文件数",
    inactiveLabel: "已停用",
    documents: "文件",
    uploadFile: "上传文件",
    documentType: "文件类型",
    relatedProject: "关联项目",
    generalDocument: "通用（公司）",
    uploadDate: "上传日期",
    uploadedBy: "上传人",
    noDocumentsYet: "暂无上传文件。",
    confirmDeleteDocument: "删除此文件？此操作无法撤销。",
    documentTypeContract: "合同",
    documentTypeIdDocument: "证件",
    documentTypeCorrespondence: "往来函件",
    documentTypeOther: "其他",
    customerDocuments: "客户资料",
    registrationCertificate: "注册证书",
    pinCertificate: "PIN证书",
    cr12: "CR12文件",
    vatCertificate: "增值税证书",
    companyProfile: "公司简介",
    dropboxFileName: "Dropbox 文件名",
    dropboxPath: "Dropbox 路径",
    originalLabel: "原始文件",
    documentTypeRequired: "请选择文件类型",
    documentNotUploaded: "尚未上传",
    replace: "替换",
    documentUploaded: "文件已上传",
    documentUploadFailed: "文件上传失败",
    documentDeleted: "文件已删除",
    documentDeleteFailed: "文件删除失败",
    documentTypeNotAllowed: "仅支持 JPG、PNG、WEBP、PDF 和 Word 文件",
    documentTooLarge: "文件大小超过 10MB 限制",
    pleaseChooseFile: "请选择文件",
    replaceDocumentPartial: "新文件已上传，但旧文件删除失败",
    otherDocuments: "其他文件",
    viewCustomer: "查看客户",
    customerShortNameRequiredForUpload: "该客户还没有简称（Short Name），请先编辑客户补充简称，再上传文件。",
    dropboxFiles: "Dropbox 文件",
    notYetSyncedToDropbox: "尚未同步到 Dropbox",
    syncToDropbox: "同步到 Dropbox",
    etrTaxInvoice: "ETR 完税凭证",
    etrTypeNotAllowed: "仅支持 PDF、JPG 和 PNG 文件",
    confirmDeleteEtr: "删除此 ETR 文件？此操作无法撤销。",
    etrUploadFailed: "ETR 上传失败",
    dropboxSyncSuccess: "已同步到 Dropbox",
    quotationShortNameRequiredForSync: "该客户还没有简称（Short Name），请先补充后再同步报价单到 Dropbox。",
    adjustQuotation: "调整报价单",
    retrySync: "重试同步",
    dropboxSyncFailedBanner: "报价单已保存，但同步到 Dropbox 失败。",
    pdfConversionUnavailableBanner: "该版本的 PDF 转换暂不可用。",
    invoiceDropboxSyncFailedBanner: "发票已保存，但同步到 Dropbox 失败。",
    invoicePdfConversionUnavailableBanner: "该发票的 PDF 转换暂不可用。",
    final: "最终版",
    current: "当前",
    historical: "历史版本",
    historicalDataUnavailable: "该版本的历史数据快照不可用。",
    backToCurrentVersion: "返回当前版本",
    confirmApprove: "确定要批准这份报价单吗？",
  },
}
