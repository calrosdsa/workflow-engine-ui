export interface User {
  user_id: string
  email: string
  first_name?: string
  last_name?: string
}

export interface Membership {
  client_id: string
  client_name?: string
  app_id?: string
  app_name?: string
  role_id: string
  role: string
  permissions: string[]
}

export interface Me {
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  memberships: Membership[]
}
