export interface User {
  id: string
  email: string
  fullName: string
  avatarUrl?: string
  bio?: string
  bikeSetup?: {
    frame: string
    fork: string
    drivetrain: string
  }
}
