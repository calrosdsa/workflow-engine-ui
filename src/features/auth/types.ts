export interface User {
  user_id: string
  email: string
}

export interface Membership {
  client_id: string
  app_id?: string
  role: string
  permissions: string[]
}

export interface Me {
  user_id: string
  email: string
  memberships: Membership[]
}
