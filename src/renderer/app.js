// BankRec - Frontend Application Logic

// Global state
let appData = {
  user: null,
  transactions: [],
  categories: { income: [], expense: [] },
  balance: 0,
};

let currentPage = 1;
const itemsPerPage = 20;
let filteredTransactions = [];
let saveAndAddAnother = false;
let editingTransactionId = null;

// Initialize app on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App loaded, checking for existing data...');
  
  try {
    const keyResult = await window.electronAPI.encryptionHasKey();
    
    if (keyResult.success && keyResult.hasKey) {
      const result = await window.electronAPI.loadData();
      
      if (result.success && result.data) {
        console.log('Existing data found, loading main screen');
        appData = result.data;
        showScreen('main-screen');
        renderUI();
      } else {
        console.log('No user data found, showing onboarding');
        showScreen('onboarding-screen');
      }
    } else {
      console.log('No encryption key found, showing onboarding');
      showScreen('onboarding-screen');
    }
  } catch (error) {
    console.error('Error initializing app:', error);
    showScreen('onboarding-screen');
  }
  
  setupEventListeners();
});

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function setupEventListeners() {
  document.getElementById('onboarding-form').addEventListener('submit', handleOnboardingSubmit);
  
  document.getElementById('choose-db-path-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.dbChoosePath();
    if (result.success && result.path) {
      document.getElementById('db-path-input').value = result.path;
      await window.electronAPI.dbSetPath(result.path);
    }
  });
  
  document.getElementById('copy-key-btn').addEventListener('click', copyEncryptionKey);
  document.getElementById('key-saved-checkbox').addEventListener('change', (e) => {
    document.getElementById('continue-to-app-btn').disabled = !e.target.checked;
  });
  document.getElementById('continue-to-app-btn').addEventListener('click', continueToApp);
  
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('add-transaction-btn').addEventListener('click', openTransactionModal);
  document.getElementById('export-btn').addEventListener('click', openExportDialog);
  document.getElementById('import-btn').addEventListener('click', openImportDialog);
  document.getElementById('import-csv-btn').addEventListener('click', openCsvImport);
  document.getElementById('start-reconciliation-btn').addEventListener('click', startReconciliation);
  
  document.getElementById('transaction-form').addEventListener('submit', saveTransaction);
  document.getElementById('save-and-add-another-btn').addEventListener('click', saveAndAddAnotherTransaction);
  document.getElementById('cancel-transaction-btn').addEventListener('click', closeTransactionModal);
  document.getElementById('add-category-btn').addEventListener('click', openCategoryModal);
  
  document.getElementById('save-category-btn').addEventListener('click', saveCategory);
  document.getElementById('cancel-category-btn').addEventListener('click', closeCategoryModal);
  
  document.getElementById('export-password-form').addEventListener('submit', confirmExport);
  document.getElementById('cancel-export-btn').addEventListener('click', closeExportPasswordModal);
  
  document.getElementById('import-password-form').addEventListener('submit', confirmImport);
  document.getElementById('cancel-import-btn').addEventListener('click', closeImportConfirmModal);
  
  document.getElementById('csv-select-all').addEventListener('change', toggleCsvSelectAll);
  document.getElementById('import-csv-confirm-btn').addEventListener('click', confirmCsvImport);
  document.getElementById('cancel-csv-import-btn').addEventListener('click', closeCsvImportModal);
  
  document.getElementById('reconcile-all-checkbox').addEventListener('change', toggleReconcileAll);
  document.getElementById('save-reconciliation-btn').addEventListener('click', saveReconciliation);
  document.getElementById('cancel-reconciliation-btn').addEventListener('click', closeReconciliationModal);
  
  document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);
  document.getElementById('change-db-path-btn').addEventListener('click', changeDbPath);
  
  document.getElementById('search-box').addEventListener('input', filterTransactions);
  document.getElementById('start-date').addEventListener('change', filterTransactions);
  document.getElementById('end-date').addEventListener('change', filterTransactions);
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
  
  document.getElementById('prev-page-btn').addEventListener('click', () => changePage(-1));
  document.getElementById('next-page-btn').addEventListener('click', () => changePage(1));
  
  // Event delegation for edit and delete transaction buttons
  document.getElementById('transactions-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-transaction-btn');
    const deleteBtn = e.target.closest('.delete-transaction-btn');
    
    if (editBtn) {
      const transactionId = editBtn.getAttribute('data-transaction-id');
      editTransaction(transactionId);
    } else if (deleteBtn) {
      const transactionId = deleteBtn.getAttribute('data-transaction-id');
      deleteTransaction(transactionId);
    }
  });
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  
  try {
    const keyResult = await window.electronAPI.encryptionGenerateKey();
    
    if (!keyResult.success) {
      alert('Error generating encryption key: ' + keyResult.error);
      return;
    }
    
    const encryptionKey = keyResult.key;
    const storeResult = await window.electronAPI.encryptionStoreKey(encryptionKey);
    
    if (!storeResult.success) {
      alert('Error storing encryption key: ' + storeResult.error);
      return;
    }
    
    const saveResult = await window.electronAPI.saveData({
      user: { firstName, lastName, email },
      transactions: [],
    });
    
    if (!saveResult.success) {
      alert('Error saving user data: ' + saveResult.error);
      return;
    }
    
    appData.user = { id: saveResult.user.id, firstName, lastName, email };
    
    const formattedKey = await window.electronAPI.encryptionFormatKey(encryptionKey);
    document.getElementById('encryption-key-display').value = formattedKey.formatted || encryptionKey;
    document.getElementById('key-saved-checkbox').checked = false;
    document.getElementById('continue-to-app-btn').disabled = true;
    
    showScreen('encryption-key-screen');
  } catch (error) {
    console.error('Onboarding error:', error);
    alert('Error during onboarding: ' + error.message);
  }
}

async function copyEncryptionKey() {
  const keyDisplay = document.getElementById('encryption-key-display');
  const btn = document.getElementById('copy-key-btn');
  
  try {
    // Use modern Clipboard API
    await navigator.clipboard.writeText(keyDisplay.value);
    
    // Visual feedback
    const originalHTML = btn.innerHTML;
    btn.classList.remove('btn-ghost');
    btn.classList.add('btn-success');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      Copied!
    `;
    
    // Revert after 2 seconds
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('btn-success');
      btn.classList.add('btn-ghost');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy key:', err);
    // Fallback to select and show error
    keyDisplay.select();
    btn.classList.add('btn-error');
    btn.innerHTML = 'Copy Failed';
    setTimeout(() => {
      btn.classList.remove('btn-error');
      btn.classList.add('btn-ghost');
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy
      `;
    }, 2000);
  }
}

async function continueToApp() {
  try {
    const result = await window.electronAPI.loadData();
    
    if (result.success && result.data) {
      appData = result.data;
      showScreen('main-screen');
      renderUI();
    } else {
      alert('Error loading data. Please restart the application.');
    }
  } catch (error) {
    console.error('Error loading app:', error);
    alert('Error loading application: ' + error.message);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  html.setAttribute('data-theme', newTheme);
  
  document.getElementById('theme-icon-sun').classList.toggle('hidden');
  document.getElementById('theme-icon-moon').classList.toggle('hidden');
}

function renderUI() {
  calculateBalance();
  renderTransactions();
  renderCategories();
  checkUnreconciledTransactions();
}

function calculateBalance() {
  let balance = 0;
  
  appData.transactions.forEach(t => {
    if (t.type === 'credit') {
      balance += parseFloat(t.amount);
    } else {
      balance -= parseFloat(t.amount);
    }
  });
  
  appData.balance = balance;
  document.getElementById('current-balance').textContent = '$' + balance.toFixed(2);
}

function renderTransactions() {
  filterTransactions();
}

function filterTransactions() {
  const searchTerm = document.getElementById('search-box').value.toLowerCase();
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  
  filteredTransactions = appData.transactions.filter(t => {
    const matchesSearch = !searchTerm || 
      t.payee.toLowerCase().includes(searchTerm) ||
      (t.category && t.category.toLowerCase().includes(searchTerm)) ||
      (t.checkNumber && t.checkNumber.includes(searchTerm));
    
    const matchesStartDate = !startDate || t.date >= startDate;
    const matchesEndDate = !endDate || t.date <= endDate;
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });
  
  filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  currentPage = 1;
  renderPaginatedTransactions();
}

function renderPaginatedTransactions() {
  const tbody = document.getElementById('transactions-body');
  tbody.innerHTML = '';
  
  if (filteredTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-base-content/60">No transactions found</td></tr>';
    document.getElementById('transaction-count').textContent = 'Showing 0 transactions';
    updatePaginationControls();
    return;
  }
  
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredTransactions.length);
  const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  let balance = 0;
  
  for (let i = 0; i < startIndex; i++) {
    const t = filteredTransactions[i];
    if (t.type === 'credit') {
      balance += parseFloat(t.amount);
    } else {
      balance -= parseFloat(t.amount);
    }
  }
  
  pageTransactions.forEach(transaction => {
    if (transaction.type === 'credit') {
      balance += parseFloat(transaction.amount);
    } else {
      balance -= parseFloat(transaction.amount);
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${transaction.date}</td>
      <td>${transaction.checkNumber || '-'}</td>
      <td>${transaction.payee}</td>
      <td>${transaction.category || '-'}</td>
      <td>${transaction.type === 'debit' ? '$' + parseFloat(transaction.amount).toFixed(2) : '-'}</td>
      <td>${transaction.type === 'credit' ? '$' + parseFloat(transaction.amount).toFixed(2) : '-'}</td>
      <td>$${balance.toFixed(2)}</td>
      <td>
        <span class="badge ${transaction.isReconciled ? 'badge-success' : 'badge-warning'}">
          ${transaction.isReconciled ? 'Reconciled' : 'Unreconciled'}
        </span>
      </td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-xs btn-ghost edit-transaction-btn" data-transaction-id="${transaction.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="btn btn-xs btn-ghost text-error delete-transaction-btn" data-transaction-id="${transaction.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('transaction-count').textContent = 
    `Showing ${startIndex + 1}-${endIndex} of ${filteredTransactions.length} transactions`;
  
  updatePaginationControls();
}

function updatePaginationControls() {
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  document.getElementById('prev-page-btn').disabled = currentPage === 1;
  document.getElementById('next-page-btn').disabled = currentPage === totalPages || totalPages === 0;
  document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

function changePage(direction) {
  currentPage += direction;
  renderPaginatedTransactions();
}

function clearFilters() {
  document.getElementById('search-box').value = '';
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  filterTransactions();
}

function renderCategories() {
  const categorySelect = document.getElementById('category');
  categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
  
  if (appData.categories.income.length > 0) {
    const incomeGroup = document.createElement('optgroup');
    incomeGroup.label = 'Income';
    appData.categories.income.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      incomeGroup.appendChild(option);
    });
    categorySelect.appendChild(incomeGroup);
  }
  
  if (appData.categories.expense.length > 0) {
    const expenseGroup = document.createElement('optgroup');
    expenseGroup.label = 'Expenses';
    appData.categories.expense.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      expenseGroup.appendChild(option);
    });
    categorySelect.appendChild(expenseGroup);
  }
  
  const payeeList = document.getElementById('payee-list');
  payeeList.innerHTML = '';
  const uniquePayees = [...new Set(appData.transactions.map(t => t.payee))];
  uniquePayees.forEach(payee => {
    const option = document.createElement('option');
    option.value = payee;
    payeeList.appendChild(option);
  });
}

function checkUnreconciledTransactions() {
  const unreconciledCount = appData.transactions.filter(t => !t.isReconciled).length;
  const section = document.getElementById('reconciliation-section');
  
  if (unreconciledCount > 0) {
    document.getElementById('unreconciled-count').textContent = unreconciledCount;
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

function openTransactionModal() {
  editingTransactionId = null;
  document.getElementById('transaction-form').reset();
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('add-transaction-modal').classList.add('modal-open');
}

function closeTransactionModal() {
  document.getElementById('add-transaction-modal').classList.remove('modal-open');
  editingTransactionId = null;
  saveAndAddAnother = false;
}

async function saveTransaction(e) {
  e.preventDefault();
  saveAndAddAnother = false;
  await submitTransaction();
}

async function saveAndAddAnotherTransaction() {
  saveAndAddAnother = true;
  await submitTransaction();
}

async function submitTransaction() {
  const date = document.getElementById('txDate').value;
  const checkNumber = document.getElementById('checkNumber').value.trim();
  const payee = document.getElementById('payee').value.trim();
  const type = document.getElementById('txType').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const reconciled = document.getElementById('reconciled').checked;
  
  if (!payee || !amount) {
    alert('Please fill in all required fields');
    return;
  }
  
  const transactionData = {
    date,
    description: payee,
    payee,
    amount,
    type,
    category: category || null,
    checkNumber: checkNumber || null,
    isReconciled: reconciled,
    accountId: null,
  };
  
  try {
    if (editingTransactionId) {
      const result = await window.electronAPI.updateTransaction(editingTransactionId, transactionData);
      
      if (!result.success) {
        alert('Error updating transaction: ' + result.error);
        return;
      }
    } else {
      const result = await window.electronAPI.saveData({
        user: appData.user,
        transactions: [transactionData],
      });
      
      if (!result.success) {
        alert('Error saving transaction: ' + result.error);
        return;
      }
    }
    
    const loadResult = await window.electronAPI.loadData();
    if (loadResult.success && loadResult.data) {
      appData = loadResult.data;
      renderUI();
    }
    
    if (saveAndAddAnother) {
      document.getElementById('transaction-form').reset();
      document.getElementById('txDate').value = date;
      document.getElementById('txType').value = type;
      document.getElementById('category').value = category;
    } else {
      closeTransactionModal();
    }
  } catch (error) {
    console.error('Error saving transaction:', error);
    alert('Error saving transaction: ' + error.message);
  }
}

function editTransaction(transactionId) {
  const transaction = appData.transactions.find(t => t.id === transactionId);
  
  if (!transaction) {
    alert('Transaction not found');
    return;
  }
  
  editingTransactionId = transactionId;
  
  document.getElementById('txDate').value = transaction.date;
  document.getElementById('checkNumber').value = transaction.checkNumber || '';
  document.getElementById('payee').value = transaction.payee;
  document.getElementById('txType').value = transaction.type;
  document.getElementById('amount').value = transaction.amount;
  document.getElementById('category').value = transaction.category || '';
  document.getElementById('reconciled').checked = transaction.isReconciled;
  
  document.getElementById('add-transaction-modal').classList.add('modal-open');
}

async function deleteTransaction(transactionId) {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.deleteTransaction(transactionId);
    
    if (!result.success) {
      alert('Error deleting transaction: ' + result.error);
      return;
    }
    
    const loadResult = await window.electronAPI.loadData();
    if (loadResult.success && loadResult.data) {
      appData = loadResult.data;
      renderUI();
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    alert('Error deleting transaction: ' + error.message);
  }
}

function openCategoryModal() {
  document.getElementById('category-modal').classList.add('modal-open');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('modal-open');
  document.getElementById('new-category-name').value = '';
  document.getElementById('new-category-type').value = 'expense';
}

async function saveCategory() {
  const name = document.getElementById('new-category-name').value.trim();
  const type = document.getElementById('new-category-type').value;
  
  if (!name) {
    alert('Please enter a category name');
    return;
  }
  
  if (appData.categories[type].includes(name)) {
    alert('Category already exists');
    return;
  }
  
  appData.categories[type].push(name);
  
  try {
    const result = await window.electronAPI.saveData({
      user: appData.user,
      transactions: [],
      categories: appData.categories,
    });
    
    if (!result.success) {
      alert('Error saving category: ' + result.error);
      return;
    }
    
    renderCategories();
    closeCategoryModal();
  } catch (error) {
    console.error('Error saving category:', error);
    alert('Error saving category: ' + error.message);
  }
}

async function openExportDialog() {
  document.getElementById('export-password-modal').classList.add('modal-open');
  document.getElementById('exportPassword').value = '';
}

function closeExportPasswordModal() {
  document.getElementById('export-password-modal').classList.remove('modal-open');
}

async function confirmExport(e) {
  e.preventDefault();
  
  const password = document.getElementById('exportPassword').value;
  
  if (!password) {
    alert('Please enter a password');
    return;
  }
  
  try {
    const fileResult = await window.electronAPI.saveFileDialog();
    
    if (!fileResult.success || !fileResult.filePath) {
      return;
    }
    
    const result = await window.electronAPI.exportData(fileResult.filePath, password);
    
    if (result.success) {
      alert('Data exported successfully!');
      closeExportPasswordModal();
    } else {
      alert('Error exporting data: ' + result.error);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data: ' + error.message);
  }
}

async function openImportDialog() {
  try {
    const fileResult = await window.electronAPI.openFileDialog();
    
    if (!fileResult.success || !fileResult.filePath) {
      return;
    }
    
    document.getElementById('import-file-path').textContent = fileResult.filePath;
    document.getElementById('import-password-modal').classList.add('modal-open');
    document.getElementById('importPassword').value = '';
  } catch (error) {
    console.error('Error opening import dialog:', error);
    alert('Error opening file: ' + error.message);
  }
}

function closeImportConfirmModal() {
  document.getElementById('import-password-modal').classList.remove('modal-open');
}

async function confirmImport(e) {
  e.preventDefault();
  
  const filePath = document.getElementById('import-file-path').textContent;
  const password = document.getElementById('importPassword').value;
  
  if (!password) {
    alert('Please enter the password');
    return;
  }
  
  try {
    const result = await window.electronAPI.importData(filePath, password);
    
    if (result.success) {
      const loadResult = await window.electronAPI.loadData();
      if (loadResult.success && loadResult.data) {
        appData = loadResult.data;
        renderUI();
      }
      
      alert('Data imported successfully!');
      closeImportConfirmModal();
    } else {
      alert('Error importing data: ' + result.error);
    }
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Error importing data: ' + error.message);
  }
}

function startReconciliation() {
  const unreconciledTransactions = appData.transactions.filter(t => !t.isReconciled);
  
  if (unreconciledTransactions.length === 0) {
    alert('No unreconciled transactions');
    return;
  }
  
  const list = document.getElementById('reconciliation-list');
  list.innerHTML = '';
  
  unreconciledTransactions.forEach(transaction => {
    const item = document.createElement('div');
    item.classList.add('form-control');
    item.innerHTML = `
      <label class="label cursor-pointer justify-start gap-3">
        <input type="checkbox" class="checkbox checkbox-primary reconcile-checkbox" data-id="${transaction.id}">
        <span class="label-text">
          ${transaction.date} - ${transaction.payee} - 
          ${transaction.type === 'debit' ? '-' : '+'}$${parseFloat(transaction.amount).toFixed(2)}
        </span>
      </label>
    `;
    list.appendChild(item);
  });
  
  document.getElementById('reconcile-all-checkbox').checked = false;
  document.getElementById('reconciliation-modal').classList.add('modal-open');
}

function toggleReconcileAll(e) {
  const checkboxes = document.querySelectorAll('.reconcile-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
  });
}

async function saveReconciliation() {
  const checkboxes = document.querySelectorAll('.reconcile-checkbox:checked');
  
  if (checkboxes.length === 0) {
    alert('Please select at least one transaction to reconcile');
    return;
  }
  
  try {
    for (const checkbox of checkboxes) {
      const transactionId = checkbox.dataset.id;
      await window.electronAPI.markReconciled(transactionId, true);
    }
    
    const loadResult = await window.electronAPI.loadData();
    if (loadResult.success && loadResult.data) {
      appData = loadResult.data;
      renderUI();
    }
    
    closeReconciliationModal();
    alert('Transactions reconciled successfully!');
  } catch (error) {
    console.error('Error reconciling transactions:', error);
    alert('Error reconciling transactions: ' + error.message);
  }
}

function closeReconciliationModal() {
  document.getElementById('reconciliation-modal').classList.remove('modal-open');
}

async function openSettings() {
  try {
    const result = await window.electronAPI.dbGetPath();
    if (result.success) {
      document.getElementById('current-db-path').value = result.path;
    }
  } catch (error) {
    console.error('Error getting DB path:', error);
  }
  
  document.getElementById('settings-modal').classList.add('modal-open');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('modal-open');
}

async function changeDbPath() {
  try {
    const result = await window.electronAPI.dbChoosePath();
    
    if (result.success && result.path) {
      const changeResult = await window.electronAPI.dbChangePath(result.path);
      
      if (changeResult.success) {
        document.getElementById('current-db-path').value = result.path;
        alert('Database location changed successfully! Please restart the application.');
      } else {
        alert('Error changing database location: ' + changeResult.error);
      }
    }
  } catch (error) {
    console.error('Error changing database path:', error);
    alert('Error changing database location: ' + error.message);
  }
}

// CSV Import functionality
let csvTransactions = [];

async function openCsvImport() {
  try {
    const result = await window.electronAPI.openCsvFile();
    
    if (!result.success) {
      return;
    }
    
    const csvContent = result.content;
    const parsedData = parseCSV(csvContent);
    
    if (parsedData.length === 0) {
      alert('No valid transactions found in CSV file');
      return;
    }
    
    csvTransactions = parsedData;
    displayCsvPreview(parsedData);
    document.getElementById('csv-import-modal').classList.add('modal-open');
  } catch (error) {
    console.error('Error opening CSV file:', error);
    alert('Error opening CSV file: ' + error.message);
  }
}

function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  // Find the header row by looking for "Date" column
  let headerIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const fields = parseCSVLine(lines[i]);
    const lowerFields = fields.map(f => f.toLowerCase().trim());
    
    if (lowerFields.some(f => f === 'date' || f.includes('date'))) {
      headerIndex = i;
      headers = lowerFields;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.warn('No header row found, using default format');
    headerIndex = 0;
    headers = ['date', 'description', 'amount'];
  }
  
  // Map column indices
  const columnMap = detectColumns(headers);
  const dataLines = lines.slice(headerIndex + 1);
  const transactions = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line);
    
    if (fields.length < 2) {
      console.warn(`Skipping line ${i + 1}: insufficient fields`);
      continue;
    }
    
    // Extract fields based on column mapping
    const dateStr = fields[columnMap.date] || fields[0];
    const descriptionStr = fields[columnMap.description] || fields[1];
    const amountStr = fields[columnMap.amount] || fields[2];
    
    // Skip summary/header rows
    if (!dateStr || !amountStr || 
        descriptionStr.toLowerCase().includes('beginning balance') ||
        descriptionStr.toLowerCase().includes('ending balance') ||
        descriptionStr.toLowerCase().includes('total credits') ||
        descriptionStr.toLowerCase().includes('total debits')) {
      continue;
    }
    
    const parsedDate = parseDate(dateStr);
    const parsedAmount = parseAmount(amountStr);
    
    if (!parsedDate || parsedAmount === null || parsedAmount === 0) {
      console.warn(`Skipping line ${i + 1}: invalid date or amount`);
      continue;
    }
    
    // Determine type from amount sign (negative = debit, positive = credit)
    const type = determineTypeFromAmount(amountStr);
    
    const transaction = {
      date: parsedDate,
      description: descriptionStr.trim(),
      payee: descriptionStr.trim(),
      amount: parsedAmount,
      type: type,
      category: columnMap.category >= 0 && fields[columnMap.category] ? fields[columnMap.category].trim() : null,
      checkNumber: columnMap.checkNumber >= 0 && fields[columnMap.checkNumber] ? fields[columnMap.checkNumber].trim() : null,
      isReconciled: false,
      accountId: null,
      selected: true,
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
}

function detectColumns(headers) {
  const map = {
    date: -1,
    description: -1,
    amount: -1,
    category: -1,
    checkNumber: -1,
  };
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();
    
    // Date column
    if (h === 'date' || h.includes('date')) {
      map.date = index;
    }
    // Description/Payee column
    else if (h === 'description' || h === 'payee' || h === 'memo' || h.includes('description')) {
      map.description = index;
    }
    // Amount column
    else if (h === 'amount' || h.includes('amt') || h === 'debit' || h === 'credit') {
      if (map.amount === -1) { // Use first amount-like column
        map.amount = index;
      }
    }
    // Category column
    else if (h === 'category' || h.includes('category')) {
      map.category = index;
    }
    // Check number column
    else if (h === 'check' || h === 'check number' || h === 'check #' || h.includes('check')) {
      map.checkNumber = index;
    }
  });
  
  return map;
}

function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  fields.push(currentField);
  return fields;
}

function parseDate(dateStr) {
  dateStr = dateStr.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try MM/DD/YYYY or M/D/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try parsing as Date object
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function parseAmount(amountStr) {
  if (!amountStr) return null;
  
  // Remove currency symbols, commas, quotes, and whitespace
  let cleaned = amountStr.replace(/[$,"'\s]/g, '').trim();
  
  // Handle parentheses as negative
  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  
  // Check for negative sign
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1);
  }
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  // Return absolute value - we'll determine type separately
  return Math.abs(num);
}

function determineTypeFromAmount(amountStr) {
  if (!amountStr) return 'debit';
  
  // Remove quotes and whitespace
  const cleaned = amountStr.replace(/["'\s]/g, '').trim();
  
  // Negative amount or parentheses = debit (withdrawal/expense)
  if (cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'))) {
    return 'debit';
  }
  
  // Positive amount = credit (deposit/income)
  return 'credit';
}

function determineType(amountStr, typeStr) {
  // If type is explicitly provided
  if (typeStr) {
    const type = typeStr.toLowerCase().trim();
    if (type === 'credit' || type === 'deposit' || type === 'income') {
      return 'credit';
    }
    if (type === 'debit' || type === 'withdrawal' || type === 'expense') {
      return 'debit';
    }
  }
  
  // Fall back to amount-based detection
  return determineTypeFromAmount(amountStr);
}

function displayCsvPreview(transactions) {
  const container = document.getElementById('csv-preview-body');
  container.innerHTML = '';
  
  const summary = document.getElementById('csv-summary');
  summary.textContent = `Found ${transactions.length} transaction(s) to import`;
  
  transactions.forEach((transaction, index) => {
    // Find possible matches from existing unreconciled transactions
    const matches = findMatchesForCsvRow(transaction);

    const card = document.createElement('div');
    card.classList.add('card', 'bg-base-100', 'border', 'border-base-300');
    
    // Build the card HTML
    let cardHTML = `
      <div class="card-body p-4">
        <div class="flex items-start gap-4">
          <input type="checkbox" 
                 class="checkbox checkbox-primary csv-transaction-checkbox mt-1" 
                 data-index="${index}" 
                 ${transaction.selected ? 'checked' : ''}>
          
          <div class="flex-1">
            <!-- CSV Transaction Info -->
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="font-semibold text-lg">${transaction.payee}</div>
                <div class="text-sm text-base-content/70">
                  ${transaction.date}
                  ${transaction.category ? `• ${transaction.category}` : ''}
                  ${transaction.checkNumber ? `• Check #${transaction.checkNumber}` : ''}
                </div>
              </div>
              <div class="text-right">
                <div class="font-bold text-lg ${transaction.type === 'debit' ? 'text-error' : 'text-success'}">
                  ${transaction.type === 'debit' ? '-' : '+'}$${parseFloat(transaction.amount).toFixed(2)}
                </div>
                <select class="select select-xs mt-1" data-index="${index}" onchange="updateCsvTransactionType(${index}, this.value)">
                  <option value="debit" ${transaction.type === 'debit' ? 'selected' : ''}>Debit</option>
                  <option value="credit" ${transaction.type === 'credit' ? 'selected' : ''}>Credit</option>
                </select>
              </div>
            </div>
            
            <!-- Matching Section -->
            <div class="border-t border-base-300 pt-3">
              <div class="font-semibold text-sm mb-2">Match with existing transaction:</div>
              
              <div class="space-y-2">
                <!-- Create New Transaction Option -->
                <label class="flex items-start gap-3 p-2 rounded hover:bg-base-200 cursor-pointer">
                  <input type="radio" 
                         name="csv-match-${index}" 
                         value="new" 
                         class="radio radio-primary radio-sm mt-0.5" 
                         ${matches.length === 0 ? 'checked' : ''}>
                  <div class="flex-1">
                    <div class="font-medium text-sm">Create New Transaction</div>
                    <div class="text-xs text-base-content/60">Import as a new reconciled transaction</div>
                  </div>
                </label>
    `;
    
    // Add matching transactions as radio options
    if (matches.length > 0) {
      cardHTML += `<div class="divider my-1 text-xs">OR match with existing transaction</div>`;
      
      matches.forEach((match, matchIdx) => {
        const tx = match.transaction;
        const txDate = new Date(tx.date);
        const csvDate = new Date(transaction.date);
        const daysDiff = Math.abs((csvDate - txDate) / (1000 * 60 * 60 * 24));
        const isReconciled = tx.isReconciled || tx.reconciled;
        
        cardHTML += `
          <label class="flex items-start gap-3 p-2 rounded hover:bg-base-200 cursor-pointer border ${isReconciled ? 'border-success/40 bg-success/5' : 'border-base-300'}">
            <input type="radio" 
                   name="csv-match-${index}" 
                   value="match:${tx.id}" 
                   class="radio radio-primary radio-sm mt-0.5"
                   ${matchIdx === 0 && !isReconciled ? 'checked' : ''}>
            <div class="flex-1">
              <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium">${tx.date}</span>
                    ${daysDiff > 0 ? `<span class="text-xs text-warning ml-1">(${Math.round(daysDiff)} day${daysDiff !== 1 ? 's' : ''} diff)</span>` : ''}
                    ${isReconciled ? `<span class="badge badge-success badge-xs">Already Reconciled</span>` : ''}
                  </div>
                  <div class="text-sm">${tx.payee}</div>
                  ${tx.category ? `<div class="text-xs text-base-content/60">Category: ${tx.category}</div>` : ''}
                  ${tx.checkNumber ? `<div class="text-xs text-base-content/60">Check #${tx.checkNumber}</div>` : ''}
                </div>
                <div class="font-bold ${tx.type === 'debit' ? 'text-error' : 'text-success'}">
                  ${tx.type === 'debit' ? '-' : '+'}$${parseFloat(tx.amount).toFixed(2)}
                </div>
              </div>
            </div>
          </label>
        `;
      });
    } else {
      cardHTML += `<div class="text-xs text-base-content/60 italic pl-2">No matching transactions found</div>`;
    }
    
    cardHTML += `
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    card.innerHTML = cardHTML;
    container.appendChild(card);
  });
  
  // Update select all checkbox
  document.getElementById('csv-select-all').checked = transactions.every(t => t.selected);
}

function findMatchesForCsvRow(csvRow) {
  const matches = [];
  if (!csvRow || typeof csvRow.amount === 'undefined') return matches;

  const targetAmount = Math.abs(parseFloat(csvRow.amount));
  const targetType = csvRow.type || null;
  const targetDate = csvRow.date ? new Date(csvRow.date) : null;

  // Search ALL transactions (including already reconciled ones)
  const candidates = appData.transactions;

  candidates.forEach(tx => {
    const txAmount = Math.abs(parseFloat(tx.amount));
    if (Math.abs(txAmount - targetAmount) > 0.01) return; // amount must match

    // Filter by date range: +/- 10 days
    if (targetDate && tx.date) {
      const txDate = new Date(tx.date);
      const daysDiff = Math.abs((targetDate - txDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 10) return; // Skip if outside date range
    }

    // Scoring: prefer same type and closer dates
    let score = 0;
    if (targetType && tx.type === targetType) score += 10;
    if (targetDate && tx.date) {
      const txDate = new Date(tx.date);
      const daysDiff = Math.abs((targetDate - txDate) / (1000 * 60 * 60 * 24));
      score += Math.max(0, 20 - daysDiff);
    }

    matches.push({ transaction: tx, score });
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 10);
}

window.updateCsvTransactionType = function(index, newType) {
  if (csvTransactions[index]) {
    csvTransactions[index].type = newType;
  }
};

function toggleCsvSelectAll(e) {
  const checked = e.target.checked;
  
  csvTransactions.forEach((transaction, index) => {
    transaction.selected = checked;
  });
  
  document.querySelectorAll('.csv-transaction-checkbox').forEach(checkbox => {
    checkbox.checked = checked;
  });
}

async function confirmCsvImport() {
  // Update selection state from checkboxes
  document.querySelectorAll('.csv-transaction-checkbox').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    if (csvTransactions[index]) {
      csvTransactions[index].selected = checkbox.checked;
    }
  });
  
  const selectedTransactions = csvTransactions.filter(t => t.selected);
  
  if (selectedTransactions.length === 0) {
    alert('Please select at least one transaction to import');
    return;
  }
  
  try {
    // Process each selected CSV transaction
    for (const transaction of selectedTransactions) {
      const idx = csvTransactions.indexOf(transaction);
      
      // Get the selected match radio button for this CSV row
      const selectedRadio = document.querySelector(`input[name="csv-match-${idx}"]:checked`);
      const matchValue = selectedRadio ? selectedRadio.value : 'new';

      if (matchValue && matchValue.startsWith('match:')) {
        // Mark the existing transaction as reconciled
        const matchedId = matchValue.split(':')[1];
        try {
          await window.electronAPI.markReconciled(matchedId, true);
        } catch (err) {
          console.error('Error marking matched transaction reconciled:', err);
        }
      } else {
        // Create new reconciled transaction
        const transactionData = {
          date: transaction.date,
          description: transaction.description,
          payee: transaction.payee,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          checkNumber: transaction.checkNumber,
          isReconciled: true,
          accountId: transaction.accountId,
        };

        try {
          const result = await window.electronAPI.saveData({
            user: appData.user,
            transactions: [transactionData],
          });
          if (!result.success) {
            console.error('Error saving transaction:', result.error);
          }
        } catch (err) {
          console.error('Error creating transaction:', err);
        }
      }
    }
    
    // Reload data
    const loadResult = await window.electronAPI.loadData();
    if (loadResult.success && loadResult.data) {
      appData = loadResult.data;
      renderUI();
    }
    
    closeCsvImportModal();
    alert(`Successfully imported ${selectedTransactions.length} transaction(s)!`);
  } catch (error) {
    console.error('Error importing CSV transactions:', error);
    alert('Error importing transactions: ' + error.message);
  }
}

function closeCsvImportModal() {
  document.getElementById('csv-import-modal').classList.remove('modal-open');
  csvTransactions = [];
}

