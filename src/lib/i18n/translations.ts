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
  | "export"
  | "downloadPdf"
  | "exportPdf"
  | "print"
  // Customers
  | "customerName"
  | "companyName"
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

export const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  en: {
    // Common
    dashboard: "Dashboard",
    customers: "Customers",
    equipment: "Equipment",
    jobs: "Jobs",
    quotations: "Quotations",
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
    export: "Export",
    downloadPdf: "Download PDF",
    exportPdf: "Export PDF",
    print: "Print",
    // Customers
    customerName: "Contact Name",
    companyName: "Company Name",
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
    searchPartsPlaceholder: "Part number, name, brand…",
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
  },
  zh: {
    // Common
    dashboard: "仪表盘",
    customers: "客户",
    equipment: "设备",
    jobs: "工单",
    quotations: "报价单",
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
    export: "导出",
    downloadPdf: "下载PDF",
    exportPdf: "导出PDF",
    print: "打印",
    // Customers
    customerName: "联系人",
    companyName: "公司名称",
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
    searchPartsPlaceholder: "零件编号、名称、品牌…",
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
  },
}
