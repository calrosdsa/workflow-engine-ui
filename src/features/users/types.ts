export interface UserMembership {
  app_id: string
  app_name: string
  role_id: string
  role_name: string
}

export interface TeamUser {
  id: string
  email: string
  first_name: string
  last_name: string
  status: string
  is_super_admin: boolean
  memberships: UserMembership[]
}
