const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8004') + '/api'

// Note: Debug endpoints available at /api/debug/* - remove before production!
// Example: curl -H "Authorization: Bearer <token>" http://127.0.0.1:8004/api/debug/config?user=<username>

interface ApiOptions extends RequestInit {
  token?: string
}

export async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  console.log('API Request:', `${API_BASE}${endpoint}`, { headers, body: fetchOptions.body })

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  console.log('API Response:', response.status, response.statusText)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    console.error('API Error:', error)
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  console.log('API Data:', data)
  return data
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; user: User; expires_in: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: (token: string) =>
    apiFetch<{ user: User }>('/auth/me', { token }),

  logout: (token: string) =>
    apiFetch<{ message: string }>('/auth/logout', { method: 'POST', token }),
}

// Employees API
export const employeesApi = {
  list: (token: string, params?: { search?: string; department_id?: number }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.department_id) query.set('department_id', String(params.department_id))
    const qs = query.toString()
    return apiFetch<PaginatedResponse<EmployeeListItem>>(`/employees${qs ? `?${qs}` : ''}`, { token })
  },

  get: (token: string, id: number) =>
    apiFetch<{ employee: EmployeeDetail }>(`/employees/${id}`, { token }),
}

// Departments API
export const departmentsApi = {
  list: (token: string) =>
    apiFetch<{ departments: Department[] }>('/departments', { token }),

  get: (token: string, id: number) =>
    apiFetch<{ department: DepartmentDetail }>(`/departments/${id}`, { token }),
}

// Dashboard API
export const dashboardApi = {
  stats: (token: string) =>
    apiFetch<{ stats: DashboardStats }>('/dashboard/stats', { token }),

  activity: (token: string) =>
    apiFetch<{ activity: ActivityItem[] }>('/dashboard/activity', { token }),
}

// Flag API
export const flagApi = {
  get: (token: string) =>
    apiFetch<{ flag: string }>('/flag', { token }),
}

// Types
export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'hr' | 'employee'
  department?: string
}

export interface EmployeeListItem {
  id: number
  employee_id: string
  position: string
  hire_date: string
  department: string
  salary?: number
  notes?: string
  user: {
    first_name: string
    last_name: string
    email: string
  }
}

export interface EmployeeDetail extends EmployeeListItem {
  phone?: string
  address?: string
  emergency_contact?: string
  notes?: string
}

export interface Department {
  id: number
  name: string
  code: string
  description?: string
  employees_count: number
}

export interface DepartmentDetail extends Department {
  employees: EmployeeListItem[]
  manager?: {
    id: number
    employee_id: string
    position: string
  }
}

export interface DashboardStats {
  total_employees: number
  total_departments: number
  total_users: number
  recent_hires?: number
  avg_salary?: number
  audit_logs_today?: number
  failed_logins_today?: number
}

export interface ActivityItem {
  id: number
  action: string
  resource_type: string
  resource_id?: number
  user?: string
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface PayData {
  employee_id: string
  username: string
  department: string
  position: string
  hire_date: string
  monthly_pay: number
  annual_pay: number
}

// Pay API
export const payApi = {
  getMy: (token: string) =>
    apiFetch<PayData>('/pay', { token }),

  show: (token: string, employeeId: string) =>
    apiFetch<PayData>(`/pay/${employeeId}`, { token }),
}
