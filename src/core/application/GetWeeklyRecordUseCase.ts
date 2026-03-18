import { Record, RecordRepository } from '../domain/Record'

export class GetWeeklyRecordUseCase {
  constructor(private recordRepository: RecordRepository) {}

  async execute(routeId: string): Promise<Record | null> {
    const records = await this.recordRepository.getTopWeeklyRecords(routeId, 1)
    if (records.length > 0) {
      return records[0]
    }
    return null
  }
}
