export type UserRole = 'admin' | 'operations' | 'finance' | 'sales_marketing'

export interface Profile {
  id: string
  name: string
  role: UserRole
  linkedin_access_token?: string | null
  linkedin_profile_id?: string | null
  created_at: string
}

export type FunnelStatus = 'lead' | 'appointment' | 'presentation' | 'sale'

export interface Lead {
  id: string
  name: string
  organization: string | null
  email: string | null
  phone: string | null
  source: string | null
  funnel_status: FunnelStatus
  assigned_to: string | null
  notes: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  assignee?: Profile
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  status: 'active' | 'completed' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  description: string | null
  due_date: string | null
  status: 'pending' | 'completed'
  created_at: string
  project?: Project
}

export interface Task {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  status: TaskStatus
  position: number
  project_id: string | null
  milestone_id: string | null
  parent_task_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  assignee?: Profile
  project?: Project
  milestone?: Milestone
  comments?: TaskComment[]
  subtasks?: Task[]
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface SocialPost {
  id: string
  title: string | null
  content: string
  image_url: string | null
  image_caption: string | null
  scheduled_time: string | null
  scheduled_task_id: string | null
  platform: 'linkedin'
  status: PostStatus
  author_id: string
  linkedin_post_id: string | null
  created_at: string
  updated_at: string
  author?: Profile
}

export interface KPI {
  id: string
  user_id: string
  metric_type: string
  target_value: number
  actual_value: number
  week_start: string
  end_date: string | null
  created_at: string
  updated_at: string
  user?: Profile
}

export interface EmployeeOfMonth {
  id: string
  user_id: string
  assigned_by: string
  month: number
  year: number
  reason: string | null
  created_at: string
  employee?: Profile
  assigner?: Profile
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'task_assigned' | 'task_due' | 'task_overdue'
  task_id: string | null
  read: boolean
  created_at: string
}

export type LeaveType = 'annual' | 'sick' | 'emergency' | 'maternity' | 'paternity' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_requested: number
  reason: string | null
  status: LeaveStatus
  approved_by: string | null
  admin_note: string | null
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
  updated_at: string
  employee?: Profile
  approver?: Profile
}

export interface LeaveBalance {
  id: string
  employee_id: string
  year: number
  total_days: number
  days_taken: number
  created_at?: string
}

export type SMSStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface SMSLog {
  id: string
  recipient: string
  message_content: string
  status: SMSStatus
  sent_by: string
  sent_at: string
  sender?: Profile
}

export interface SMSTemplate {
  id: string
  name: string
  content: string
  funnel_stage: FunnelStatus | 'any' | null
  created_by: string
  created_at: string
}

export interface EmailAttachment {
  name: string
  url: string
  size: number
  type: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  funnel_stage: FunnelStatus | 'any' | null
  attachments: EmailAttachment[]
  created_by: string
  created_at: string
}

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_name: string | null
  subject: string
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  lead_id: string | null
  funnel_stage: string | null
  sent_by: string
  sent_at: string
}

export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'

export interface ContactLog {
  id: string
  lead_id: string
  contacted_by: string
  funnel_status: FunnelStatus
  interaction_type: 'initial' | 'follow_up'
  sequence_number: number
  meeting_duration_minutes: number | null
  sentiment: Sentiment | null
  notes: string | null
  contacted_at: string
}

export interface ContactLogFormData {
  interaction_type: 'initial' | 'follow_up'
  sequence_number: number
  contacted_at: string
  meeting_duration_minutes: number | null
  sentiment: Sentiment | null
  notes: string
}

export interface ConversionAnalytics {
  total_leads: number
  total_appointments: number
  total_presentations: number
  total_sales: number
  lead_to_appointment: number
  appointment_to_presentation: number
  presentation_to_sale: number
}
