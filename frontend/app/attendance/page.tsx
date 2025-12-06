'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, TrendingUp, Filter, Download, Search } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/app/context/AuthContext'

interface AttendanceRecord {
  id: number
  user_id: number
  user_name: string
  check_in_time: string | null
  check_out_time: string | null
  break_start: string | null
  break_end: string | null
  location: string | null
  status: string
  notes: string | null
  work_hours: string | null
  created_at: string
}

interface AttendanceAnalytics {
  total_records: number
  date_range: { from: string; to: string }
  status_breakdown: Record<string, number>
  daily_trend: { date: string; count: number }[]
  employee_stats: {
    user_id: number
    name: string
    email: string
    total_days: number
    present_days: number
    break_days: number
    attendance_rate: number
  }[]
  summary: {
    total_employees: number
    average_attendance_rate: number
    most_active_day: string | null
    total_check_ins: number
    total_breaks: number
  }
}

function AttendancePage() {
  const { user, token } = useAuth()
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'analytics'>('table')

  useEffect(() => {
    if (token) {
      fetchAttendanceData()
      fetchAnalytics()
    }
  }, [dateFrom, dateTo, statusFilter, token])

  const fetchAttendanceData = async () => {
    if (!token) return
    
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`http://localhost:8000/attendance?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAttendanceData(data)
      } else {
        console.error('Failed to fetch attendance data:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    if (!token) return
    
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`http://localhost:8000/attendance/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        console.error('Failed to fetch analytics:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    }
  }

  const filteredData = attendanceData.filter(record =>
    record.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (record.location && record.location.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'checked_in': 'bg-green-100 text-green-800',
      'checked_out': 'bg-gray-100 text-gray-800',
      'on_break': 'bg-yellow-100 text-yellow-800',
      'sick_leave': 'bg-red-100 text-red-800',
      'absent': 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-blue-100 text-blue-800'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Check In', 'Check Out', 'Break Start', 'Break End', 'Status', 'Location', 'Work Hours']
    const csvData = filteredData.map(record => [
      formatDate(record.created_at),
      record.user_name,
      formatTime(record.check_in_time),
      formatTime(record.check_out_time),
      formatTime(record.break_start),
      formatTime(record.break_end),
      record.status,
      record.location || '-',
      record.work_hours || '-'
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (!user || !token) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track and analyze employee attendance patterns</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
          >
            <Users className="h-4 w-4 mr-2" />
            Table View
          </Button>
          <Button
            variant={viewMode === 'analytics' ? 'default' : 'outline'}
            onClick={() => setViewMode('analytics')}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {viewMode === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.total_employees}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Attendance</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.average_attendance_rate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Check-ins</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.total_check_ins}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.total_records}</p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            </Card>
          </div>

          {/* Status Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(analytics.status_breakdown).map(([status, count]) => (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Employee Performance */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Employee Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Employee</th>
                    <th className="text-right py-2">Total Days</th>
                    <th className="text-right py-2">Present Days</th>
                    <th className="text-right py-2">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.employee_stats.map((emp) => (
                    <tr key={emp.user_id} className="border-b">
                      <td className="py-2">{emp.name}</td>
                      <td className="text-right py-2">{emp.total_days}</td>
                      <td className="text-right py-2">{emp.present_days}</td>
                      <td className="text-right py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          emp.attendance_rate >= 90 ? 'bg-green-100 text-green-800' :
                          emp.attendance_rate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {emp.attendance_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Filters and Search */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="on_break">On Break</option>
                <option value="sick_leave">Sick Leave</option>
              </select>

              <Input
                type="date"
                placeholder="From Date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />

              <Input
                type="date"
                placeholder="To Date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />

              <Button onClick={exportToCSV} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </Card>

          {/* Attendance Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Attendance Records</h3>
              <p className="text-sm text-gray-600">{filteredData.length} records</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Employee</th>
                    <th className="text-left p-3 font-semibold">Check In</th>
                    <th className="text-left p-3 font-semibold">Check Out</th>
                    <th className="text-left p-3 font-semibold">Break Start</th>
                    <th className="text-left p-3 font-semibold">Break End</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Location</th>
                    <th className="text-left p-3 font-semibold">Work Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{formatDate(record.created_at)}</td>
                      <td className="p-3 font-medium">{record.user_name}</td>
                      <td className="p-3">{formatTime(record.check_in_time)}</td>
                      <td className="p-3">{formatTime(record.check_out_time)}</td>
                      <td className="p-3">{formatTime(record.break_start)}</td>
                      <td className="p-3">{formatTime(record.break_end)}</td>
                      <td className="p-3">{getStatusBadge(record.status)}</td>
                      <td className="p-3">{record.location || '-'}</td>
                      <td className="p-3">{record.work_hours || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No attendance records found
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function AttendancePageWrapper() {
  return (
    <ProtectedRoute>
      <AttendancePage />
    </ProtectedRoute>
  )
}