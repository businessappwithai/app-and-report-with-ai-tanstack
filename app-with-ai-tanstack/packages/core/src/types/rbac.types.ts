export interface AD_User {
  ad_user_id: string;
  username: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AD_Role {
  ad_role_id: string;
  name: string;
  description?: string;
  is_manual: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AD_User_Roles {
  ad_user_id: string;
  ad_role_id: string;
  created_at: Date;
}

export interface AD_Access {
  ad_access_id: string;
  ad_role_id: string;
  ad_table_id: string;
  is_read_only: boolean;
  is_create_access: boolean;
  is_update_access: boolean;
  is_delete_access: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AD_Field_Access {
  ad_field_access_id: string;
  ad_role_id: string;
  ad_field_id: string;
  is_readonly: boolean;
  is_displayed: boolean;
  created_at: Date;
  updated_at: Date;
}
