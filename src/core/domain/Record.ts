import { User } from './User'
import { Route } from './Route'

export interface Record {
  id: string
  routeId: string
  userId: string
  timeSeconds: number
  maxSpeedKmh: number
  avgSpeedKmh: number
  dateRecorded: Date
  
  // Relations mapped by infrastructure
  user?: User
  route?: Route
}

export interface RecordRepository {
  getTopWeeklyRecords(routeId: string, limit: number): Promise<Record[]>
  saveRecord(record: Omit<Record, 'id'>): Promise<Record>
}
