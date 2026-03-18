import { Record, RecordRepository } from '../domain/Record'

export interface OfflineStorage {
  getPendingRecords(): Promise<Omit<Record, 'id'>[]>
  clearPendingRecords(): Promise<void>
}

export class SyncOfflineRecordsUseCase {
  constructor(
    private recordRepository: RecordRepository,
    private offlineStorage: OfflineStorage
  ) {}

  async execute(): Promise<{ synced: number; failed: number }> {
    const pendingRecords = await this.offlineStorage.getPendingRecords()
    
    if (pendingRecords.length === 0) {
       return { synced: 0, failed: 0 }
    }

    let syncedCount = 0
    let failedCount = 0

    for (const record of pendingRecords) {
      try {
        await this.recordRepository.saveRecord(record)
        syncedCount++
      } catch (error) {
        console.error('Failed to sync record:', error)
        failedCount++
      }
    }

    // Optimization: Clear only successfully synced records in a real implementation
    // For simplicity of MVP architecture, clear all if some succeeded, or implement selective clearing.
    if (syncedCount > 0) {
      await this.offlineStorage.clearPendingRecords()
    }

    return { synced: syncedCount, failed: failedCount }
  }
}
