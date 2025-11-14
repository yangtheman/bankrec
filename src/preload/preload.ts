import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  saveData: (data: any) => ipcRenderer.invoke("save-data", data),
  loadData: () => ipcRenderer.invoke("load-data"),
  exportData: (path: string, password: string) =>
    ipcRenderer.invoke("export-data", path, password),
  importData: (path: string, password: string) =>
    ipcRenderer.invoke("import-data", path, password),
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  saveFileDialog: () => ipcRenderer.invoke("dialog:saveFile"),
  openCsvFile: () => ipcRenderer.invoke("dialog:openCsvFile"),

  // Transaction API
  updateTransaction: (transactionId: string, updates: any) =>
    ipcRenderer.invoke("update-transaction", transactionId, updates),
  deleteTransaction: (transactionId: string) =>
    ipcRenderer.invoke("delete-transaction", transactionId),

  // Reconciliation API
  findUnreconciledByAmount: (
    userId: number,
    amount: number,
    dateFrom: string | null,
    dateTo: string | null
  ) =>
    ipcRenderer.invoke(
      "db:find-unreconciled-by-amount",
      userId,
      amount,
      dateFrom,
      dateTo
    ),
  findByAmount: (
    userId: number,
    amount: number,
    dateFrom: string | null,
    dateTo: string | null
  ) =>
    ipcRenderer.invoke("db:find-by-amount", userId, amount, dateFrom, dateTo),
  markReconciled: (transactionId: string, isReconciled: boolean) =>
    ipcRenderer.invoke("db:mark-reconciled", transactionId, isReconciled),
  getUnreconciled: (userId: number) =>
    ipcRenderer.invoke("db:get-unreconciled", userId),

  // Encryption Key Management API
  encryptionGenerateKey: () => ipcRenderer.invoke("encryption:generate-key"),
  encryptionStoreKey: (key: string) =>
    ipcRenderer.invoke("encryption:store-key", key),
  encryptionHasKey: () => ipcRenderer.invoke("encryption:has-key"),
  encryptionFormatKey: (key: string) =>
    ipcRenderer.invoke("encryption:format-key", key),

  // Database Path Configuration API
  dbGetPath: () => ipcRenderer.invoke("db:get-path"),
  dbChoosePath: () => ipcRenderer.invoke("db:choose-path"),
  dbSetPath: (path: string) => ipcRenderer.invoke("db:set-path", path),
  dbChangePath: (newPath: string) =>
    ipcRenderer.invoke("db:change-path", newPath),
});
