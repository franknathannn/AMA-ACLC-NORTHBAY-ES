"use client"

import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { 
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea" 
import { 
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import { 
 Eye, Loader2, Search, User, Phone, GraduationCap, 
 ShieldCheck, Trash2, FileDown, RotateCcw, CheckCircle2, 
 UserCircle2, XCircle, Square, CheckSquare, ListRestart,
 Mail, MapPin, Fingerprint, FileText, CalendarDays, ScrollText,
 AlertTriangle, Trash, X, ZoomIn, Maximize2, ExternalLink, 
 RotateCw, Download, RefreshCw, ArrowUpDown, ChevronDown, ArrowUp, ArrowDown
} from "lucide-react"
import { toast } from "sonner"
import { updateApplicantStatus, deleteApplicant } from "@/lib/actions/applicants"
import { format } from "date-fns"
import { ThemedCard } from "@/components/ThemedCard"
import { ThemedText } from "@/components/ThemedText"
import { useTheme } from "@/hooks/useTheme"
import { themeColors } from "@/lib/themeColors"

// Star Constellation Background Component
const StarConstellation = memo(function StarConstellation() {
 const [stars, setStars] = useState<Array<{x: number, y: number, size: number}>>([])
 const [connections, setConnections] = useState<Array<{x1: number, y1: number, x2: number, y2: number}>>([])

 useEffect(() => {
  // Generate stars
  const starCount = 50
  const newStars: Array<{x: number, y: number, size: number}> = []
  for (let i = 0; i < starCount; i++) {
   newStars.push({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1
   })
  }
  setStars(newStars)

  // Generate connections between nearby stars
  const newConnections: Array<{x1: number, y1: number, x2: number, y2: number}> = []
  for (let i = 0; i < newStars.length; i++) {
   for (let j = i + 1; j < newStars.length; j++) {
    const dx = newStars[i].x - newStars[j].x
    const dy = newStars[i].y - newStars[j].y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < 15) {
     newConnections.push({
      x1: newStars[i].x,
      y1: newStars[i].y,
      x2: newStars[j].x,
      y2: newStars[j].y
     })
    }
   }
  }
  setConnections(newConnections)
 }, [])

 return (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
   <svg className="w-full h-full opacity-30">
    {/* Connections */}
    {connections.map((conn, i) => (
     <line
      key={`conn-${i}`}
      x1={`${conn.x1}%`}
      y1={`${conn.y1}%`}
      x2={`${conn.x2}%`}
      y2={`${conn.y2}%`}
      stroke="rgb(59 130 246)"
      strokeWidth="0.5"
      strokeOpacity="0.3"
      className="animate-pulse"
      style={{ animationDelay: `${i * 0.1}s` }}
     />
    ))}
    {/* Stars */}
    {stars.map((star, i) => (
     <circle
      key={`star-${i}`}
      cx={`${star.x}%`}
      cy={`${star.y}%`}
      r={star.size}
      fill="rgb(59 130 246)"
      className="animate-pulse"
      style={{ animationDelay: `${i * 0.05}s` }}
     />
    ))}
   </svg>
  </div>
 )
})

export default function ApplicantsPage() {
 const { isDarkMode: themeDarkMode } = useTheme()
 const [isDarkMode, setIsDarkMode] = useState(themeDarkMode)
 const [viewerOpen, setViewerOpen] = useState(false)
 const [viewingFile, setViewingFile] = useState<{url: string, label: string} | null>(null)
 const [rotation, setRotation] = useState(0) // Logic for document rotation
 const [students, setStudents] = useState<any[]>([])
 const [config, setConfig] = useState<any>(null)
 const [loading, setLoading] = useState(true)
 const [searchTerm, setSearchTerm] = useState("")
 const [filter, setFilter] = useState<"Pending" | "Accepted" | "Rejected">("Pending")
 const [selectedIds, setSelectedIds] = useState<string[]>([])
 const [sortBy, setSortBy] = useState<string>("alpha")
 const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

 const [exitingRows, setExitingRows] = useState<Record<string, boolean>>({})
 const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set())

 // --- ANIMATION LOGIC: Smart Entrance ---
 const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
 const prevFilteredIdsRef = useRef<Set<string>>(new Set())
 const prevFilterRef = useRef(filter)
 const isInitialLoadRef = useRef(true)

 useEffect(() => {
   setIsDarkMode(themeDarkMode)
 }, [themeDarkMode])

 useEffect(() => {
   const handleThemeChange = (e: any) => {
     setIsDarkMode(e.detail.mode === 'dark')
   }
   window.addEventListener('theme-change', handleThemeChange)
   return () => window.removeEventListener('theme-change', handleThemeChange)
 }, [])

 const filteredStudents = useMemo(() => {
  const filtered = students.filter(s => {
   const matchesStatus = s.status === filter || (filter === 'Accepted' && s.status === 'Approved');
   const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.lrn.includes(searchTerm);
   return matchesStatus && matchesSearch;
  })

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'date_old': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'date_new': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'age': return (a.age || 0) - (b.age || 0);
      case 'gender': return a.gender.localeCompare(b.gender);
      case 'strand_ict': return a.strand === b.strand ? a.last_name.localeCompare(b.last_name) : (a.strand === 'ICT' ? -1 : 1);
      case 'strand_gas': return a.strand === b.strand ? a.last_name.localeCompare(b.last_name) : (a.strand === 'GAS' ? -1 : 1);
      case 'gwa_desc': return (parseFloat(b.gwa_grade_10) || 0) - (parseFloat(a.gwa_grade_10) || 0);
      case 'gwa_asc': return (parseFloat(a.gwa_grade_10) || 0) - (parseFloat(b.gwa_grade_10) || 0);
      case 'alpha_first': return a.first_name.localeCompare(b.first_name);
      case 'alpha': default: return a.last_name.localeCompare(b.last_name);
    }
  })
 }, [students, filter, searchTerm, sortBy])

 useEffect(() => {
   const currentIds = new Set(filteredStudents.map(s => s.id))
   
   // Skip animation on initial load or tab switch
   if (isInitialLoadRef.current || filter !== prevFilterRef.current) {
     isInitialLoadRef.current = false
     prevFilterRef.current = filter
     prevFilteredIdsRef.current = currentIds
     return
   }

   // Identify NEW IDs that appeared in this view
   const newIds = filteredStudents.filter(s => !prevFilteredIdsRef.current.has(s.id)).map(s => s.id)
   
   if (newIds.length > 0) {
     setAnimatingIds(prev => { const next = new Set(prev); newIds.forEach(id => next.add(id)); return next })
     // Clear animation class after it plays
     setTimeout(() => {
       setAnimatingIds(prev => { const next = new Set(prev); newIds.forEach(id => next.delete(id)); return next })
     }, 500)
   }
   prevFilteredIdsRef.current = currentIds
 }, [filteredStudents, filter])

 // BUG FIX: Clear hidden rows when switching filters so students appear in their new tab
 useEffect(() => {
  setHiddenRows(new Set())
  setExitingRows({})
 }, [filter])

 // FIX: Re-show students if they reappear in the list (e.g. from external updates)
 useEffect(() => {
  setHiddenRows(prev => {
    if (prev.size === 0) return prev
    const next = new Set(prev)
    let changed = false
    filteredStudents.forEach(s => {
      if (next.has(s.id)) {
        next.delete(s.id)
        changed = true
      }
    })
    return changed ? next : prev
  })

  setExitingRows(prev => {
    const next = { ...prev }
    let changed = false
    filteredStudents.forEach(s => {
      if (next[s.id]) {
        delete next[s.id]
        changed = true
      }
    })
    return changed ? next : prev
  })
 }, [filteredStudents])

 const handleExit = (id: string, callback: () => void) => {
  setExitingRows(prev => ({ ...prev, [id]: true }))
  setTimeout(() => {
    setHiddenRows(prev => { const next = new Set(prev); next.add(id); return next })
    callback()
  }, 200)
 }

 // --- MODAL STATES ---
 const [declineModalOpen, setDeclineModalOpen] = useState(false)
 const [activeDeclineStudent, setActiveDeclineStudent] = useState<any>(null)
 const [declineReason, setDeclineReason] = useState("")
 const [bulkDeclineModalOpen, setBulkDeclineModalOpen] = useState(false)
 const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

 const [deleteModalOpen, setDeleteModalOpen] = useState(false)
 const [activeDeleteStudent, setActiveDeleteStudent] = useState<any>(null)
 const [openStudentDialog, setOpenStudentDialog] = useState<string | null>(null)

 // QUICK-CLICK TEMPLATES
 const QUICK_REASONS = [
  "Blurry 2x2 Photo",
  "Invalid LRN / Not Found",
  "Missing Grade 10 Report Card",
  "Incorrect Strand Selection",
  "Incomplete Guardian Details"
 ];

 const fetchStudents = useCallback(async (isBackground = false) => {
  if (!isBackground) setLoading(true)
  try {
   const [studentsRes, configRes] = await Promise.all([
    supabase.from('students').select('*').order('created_at', { ascending: false }),
    supabase.from('system_config').select('school_year').single()
   ])

   if (studentsRes.error) throw studentsRes.error
   setStudents(studentsRes.data || [])
   if (configRes.data) setConfig(configRes.data)
  } catch (err) {
   console.error("Sync Error:", err)
   if (!isBackground) toast.error("Failed to load registrar database")
  } finally {
   if (!isBackground) setLoading(false)
  }
 }, [])

 // LIVE UPDATE LOGIC: Supabase Realtime
 useEffect(() => {
  fetchStudents()

  const channel = supabase
    .channel('admin_applicants_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
      fetchStudents(true)
    })
    .on('broadcast', { event: 'student_update' }, () => {
      fetchStudents(true)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        fetchStudents(true)
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
 }, [fetchStudents])

 // --- LOGIC: Status Transitions ---
 const handleStatusChange = async (studentId: string, name: string, status: any, feedback?: string) => {
  const toastId = toast.loading(`Processing ${name}...`)
  try {
   const result = await updateApplicantStatus(studentId, status, feedback);
   
   if (result.success) {
    const { data: { user } } = await supabase.auth.getUser();    
    const student = students.find(s => s.id === studentId);

    let description = `Manual status transition to ${status}`;
    if (status === 'Accepted') description = "Student Accepted";
    else if (status === 'Rejected') description = feedback ? `Student Rejected: ${feedback}` : "Student Rejected";
    else if (status === 'Pending') description = "Student Returned to Pending";
    else if (status === 'Deleted') description = "Deleted from the list";

    await supabase.from('activity_logs').insert([{
      admin_id: user?.id,
      admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
      action_type: status.toUpperCase(),
      student_name: name,
      student_id: status === 'Deleted' ? null : studentId,
      student_image: student?.two_by_two_url || student?.profile_2x2_url || student?.profile_picture,
      details: description
    }]);

    toast.success(`${name} updated to ${status}`, { id: toastId })
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: status } : s))
    
    setDeclineModalOpen(false)
    setDeclineReason("")
    setActiveDeclineStudent(null)
   }
  } catch (err: any) {
   toast.error(`Error: ${err.message}`, { id: toastId })
  }
 }

 // --- LOGIC: Delete Student (Spam/Troll Cleanup) ---
 const handleConfirmDelete = async () => {
  if (!activeDeleteStudent) return;
  const studentId = activeDeleteStudent.id;
  const name = `${activeDeleteStudent.first_name} ${activeDeleteStudent.last_name}`;
  const toastId = toast.loading(`Purging ${name} from core...`)
  
  try {
   const result = await deleteApplicant(studentId);
   if (result.success) {
    // Remove from UI state immediately
    setStudents(prev => prev.filter(s => s.id !== studentId));
    
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert([{
      admin_id: user?.id,
      admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
      action_type: 'DELETED',
      student_name: name,
      details: "Deleted from the list"
    }]);

    toast.success(`Record Erased: ${name}`, { id: toastId });
    setDeleteModalOpen(false);
    setActiveDeleteStudent(null);
   }
  } catch (err: any) {
   toast.error("Delete failed. Run SQL Policies.")
  }
 }

 // --- LOGIC: Bulk Operations ---
 const processBulkUpdate = async (newStatus: string, feedback?: string) => {
  const actionLabel = newStatus === 'Pending' ? "Resetting" : "Updating";
  const toastId = toast.loading(`${actionLabel} ${selectedIds.length} applicants...`)
  
  try {
   // 1. Trigger exit animations
   setExitingRows(prev => {
     const next = { ...prev }
     selectedIds.forEach(id => { next[id] = true })
     return next
   })
   
   // 2. Wait for animation
   await new Promise(resolve => setTimeout(resolve, 200))

   // 3. Hide visually (counts remain)
   setHiddenRows(prev => {
     const next = new Set(prev)
     selectedIds.forEach(id => next.add(id))
     return next
   })

   const targetStatus = newStatus === 'Accepted' ? 'Approved' : newStatus
   
   const { data: { user } } = await supabase.auth.getUser();
   const selectedStudents = students.filter(s => selectedIds.includes(s.id));
   
   const logEntries = selectedStudents.map(s => ({
    admin_id: user?.id,
    admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
    action_type: newStatus.toUpperCase(),
    student_name: `${s.first_name} ${s.last_name}`,
    student_id: s.id,
    student_image: s.two_by_two_url || s.profile_2x2_url,
    details: newStatus === 'Accepted' ? "Student Accepted" : (newStatus === 'Pending' ? "Student Returned to Pending" : `Batch update to ${newStatus}${feedback ? `: ${feedback}` : ''}`)
   }));

   // 4. Parallel execution
   await Promise.all(
     selectedIds.map(id => updateApplicantStatus(id, targetStatus, feedback))
   )

   await supabase.from('activity_logs').insert(logEntries);

   // 5. Update state (updates counts and moves students)
   setStudents(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, status: targetStatus } : s))
   
   // 6. Cleanup
   setSelectedIds([])
   setExitingRows(prev => {
     const next = { ...prev }
     selectedIds.forEach(id => delete next[id])
     return next
   })
   setHiddenRows(prev => {
     const next = new Set(prev)
     selectedIds.forEach(id => next.delete(id))
     return next
   })

   toast.success(`Batch Process Complete: ${newStatus}`, { id: toastId })
   
   // Close modal if open
   setBulkDeclineModalOpen(false)
   setDeclineReason("")
  } catch (err: any) {
   toast.error("Bulk action failed", { id: toastId })
   // Revert visual state on error
   setExitingRows(prev => { const next = { ...prev }; selectedIds.forEach(id => delete next[id]); return next })
   setHiddenRows(prev => { const next = new Set(prev); selectedIds.forEach(id => next.delete(id)); return next })
  }
 }

 const processBulkDelete = async () => {
  const toastId = toast.loading(`Purging ${selectedIds.length} records...`)
  
  try {
   // 1. Trigger exit animations
   setExitingRows(prev => {
     const next = { ...prev }
     selectedIds.forEach(id => { next[id] = true })
     return next
   })
   
   // 2. Wait for animation
   await new Promise(resolve => setTimeout(resolve, 200))

   // 3. Hide visually
   setHiddenRows(prev => {
     const next = new Set(prev)
     selectedIds.forEach(id => next.add(id))
     return next
   })

   const { data: { user } } = await supabase.auth.getUser();
   const selectedStudents = students.filter(s => selectedIds.includes(s.id));
   
   const logEntries = selectedStudents.map(s => ({
    admin_id: user?.id,
    admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
    action_type: 'DELETED',
    student_name: `${s.first_name} ${s.last_name}`,
    details: "Batch deletion from database"
   }));

   // 4. Parallel execution
   await Promise.all(
     selectedIds.map(id => deleteApplicant(id))
   )

   await supabase.from('activity_logs').insert(logEntries);

   // 5. Update state
   setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)))
   
   // 6. Cleanup
   setSelectedIds([])
   setExitingRows(prev => {
     const next = { ...prev }
     selectedIds.forEach(id => delete next[id])
     return next
   })
   setHiddenRows(prev => {
     const next = new Set(prev)
     selectedIds.forEach(id => next.delete(id))
     return next
   })

   toast.success(`Batch Deletion Complete`, { id: toastId })
   setBulkDeleteModalOpen(false)
  } catch (err: any) {
   toast.error("Bulk deletion failed", { id: toastId })
   // Revert visual state on error
   setExitingRows(prev => { const next = { ...prev }; selectedIds.forEach(id => delete next[id]); return next })
   setHiddenRows(prev => { const next = new Set(prev); selectedIds.forEach(id => next.delete(id)); return next })
  }
 }

 const handleBulkAction = (newStatus: string) => {
  if (newStatus === 'Rejected') {
    setBulkDeclineModalOpen(true)
  } else {
    processBulkUpdate(newStatus)
  }
 }

 const toggleSelect = (id: string) => {
  setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
 }

 const toggleSelectAll = () => {
  if (selectedIds.length === filteredStudents.length) setSelectedIds([])
  else setSelectedIds(filteredStudents.map(s => s.id))
 }

 const selectedStudentForDialog = useMemo(() => {
  if (!openStudentDialog) return null
  return filteredStudents.find(s => s.id === openStudentDialog) || students.find(s => s.id === openStudentDialog)
 }, [openStudentDialog, filteredStudents, students])

 const exportToCSV = () => {
  const headers = ["LRN", "Full Name", "Gender", "Strand", "GWA", "Status", "School Year"]
  const rows = filteredStudents.map(s => [
   s.lrn, `${s.first_name} ${s.last_name}`, s.gender, s.strand, s.gwa_grade_10, s.status, s.school_year
  ])
  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `ACLC_Applicants_${filter}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
 }

 if (loading && students.length === 0) return (
  <div className="h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
   <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
   <p className="text-[10px] font-black uppercase tracking-widest text-center">Syncing Admissions Matrix...</p>
  </div>
 )

 return (
  <div className="relative min-h-screen [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-colors duration-500">
   <style jsx global>{`
     body { overflow-y: auto; }
     ::-webkit-scrollbar { display: none; }
     * { -ms-overflow-style: none; scrollbar-width: none; }
   `}</style>

   {/* Star Constellation Background */}
   <StarConstellation />
   
   <div className="relative z-10 space-y-6 md:space-y-8 p-4 md:p-8 animate-in fade-in duration-700 pb-32">
    {/* HEADER SECTION */}
   <ThemedCard 
     className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6 p-6 md:p-8 rounded-[32px] backdrop-blur-sm transition-colors duration-500 border"
     style={{ 
      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
      borderColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9'
      }}
   >
    <div className="w-full md:w-auto">
    <ThemedText variant="h1" className={`text-3xl md:text-5xl animate-in slide-in-from-left duration-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} isDarkMode={isDarkMode}>Admissions</ThemedText>     <ThemedText variant="body" className="italic mt-2 text-xs md:text-sm lg:text-base flex items-center gap-2" isDarkMode={isDarkMode}>
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
      Student Enrollment Queue S.Y. {config?.school_year || "..."}
     </ThemedText>
    </div>
    
    <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto flex-wrap">
     <Button 
      onClick={() => fetchStudents(false)} 
      variant="ghost" 
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-12 w-12 p-0 rounded-2xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
     >
        <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
     </Button>
     <div className="relative flex-1 min-w-[200px] md:min-w-[300px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
      <Input 
       placeholder="Search LRN or Name..." 
       className="h-10 md:h-12 pl-10 w-full rounded-2xl bg-white dark:bg-slate-900/90 backdrop-blur-sm shadow-lg border font-bold text-sm text-black dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all duration-500" 
       value={searchTerm}
       onChange={(e) => setSearchTerm(e.target.value)}
       style={{ backgroundColor: isDarkMode ? undefined : '#ffffff', color: isDarkMode ? undefined : '#000000', borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9' }}
      />
     </div>
     <Button 
      onClick={exportToCSV} 
      className="h-10 md:h-12 px-3 md:px-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-black uppercase text-[10px] tracking-widest hover:from-blue-600 hover:to-blue-700 transition-all shadow-xl shadow-blue-500/20 shrink-0 transform hover:scale-105 flex items-center justify-center gap-2 border border-slate-700/50"
     >
      <FileDown size={16} />
      <span className="hidden sm:inline">Export CSV</span>
     </Button>
    </div>
   </ThemedCard>

   {/* FILTER TABS */}
   <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full relative z-20">
    <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-gradient-to-r from-slate-900 to-slate-800' : 'bg-white'} backdrop-blur-sm p-1.5 rounded-[24px] w-full md:w-fit overflow-x-auto shadow-xl shadow-blue-500/5 transition-all duration-500 border`} style={{ borderColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9' }}>
      {["Pending", "Accepted", "Rejected"].map((tab: any) => (
       <button
        key={tab}
        onClick={() => { setFilter(tab); setSelectedIds([]); }}
        className={`px-4 md:px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-[background-color,color,border-color,transform,box-shadow] duration-300 whitespace-nowrap transform hover:scale-105 ${
          filter === tab 
            ? `${isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-white shadow-lg text-blue-600'} scale-105` 
            : `${isDarkMode ? 'text-slate-400' : 'text-slate-500'} hover:shadow-md hover:!text-blue-600 hover:!bg-blue-50`
        }`}
       >
        {tab} <span className="opacity-60">({students.filter(s => s.status === tab || (tab === 'Accepted' && s.status === 'Approved')).length})</span>
       </button>
      ))}
    </div>

    {/* SORTING DROPDOWN */}
    <div className="relative">
      <Button 
        onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
        className={`h-12 px-5 rounded-[20px] font-black uppercase text-[10px] tracking-widest border transition-all flex items-center gap-2 shadow-lg ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
      >
        <ArrowUpDown size={14} className="text-blue-500" />
        <span className="hidden sm:inline">
          {sortBy === 'alpha' ? 'Alphabetical (Surname)' : 
           sortBy === 'date_new' ? 'Last To Enroll' : 
           sortBy === 'date_old' ? 'First To Enroll' : 
           sortBy === 'age' ? 'Age Based' : 
           sortBy === 'gender' ? 'Gender-Based' : 
           sortBy === 'strand_ict' ? 'ICT Priority' : 
           sortBy === 'strand_gas' ? 'GAS Priority' : 
           sortBy === 'gwa_desc' ? 'GWA Descending' : 
           sortBy === 'gwa_asc' ? 'GWA Ascending' : 'Alphabetical (First Name)'}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${sortDropdownOpen ? 'rotate-180' : ''}`} />
      </Button>

      {sortDropdownOpen && (
        <div className={`absolute top-full left-0 md:left-auto md:right-0 mt-2 w-56 rounded-2xl shadow-2xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="p-1.5 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
            {[
              { id: 'alpha', label: 'Alphabetical (Surname)' },
              { id: 'date_old', label: 'First To Enroll' },
              { id: 'date_new', label: 'Last To Enroll' },
              { id: 'age', label: 'Age Based' },
              { id: 'gender', label: 'Gender-Based' },
              { id: 'strand_ict', label: 'ICT Strand / GAS' },
              { id: 'strand_gas', label: 'GAS Strand / ICT' },
              { id: 'gwa_desc', label: 'GWA Descending' },
              { id: 'gwa_asc', label: 'GWA Ascending' },
              { id: 'alpha_first', label: 'Alphabetical (First Name)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setSortBy(opt.id); setSortDropdownOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors text-left ${sortBy === opt.id ? (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}
              >
                {opt.label}
                {sortBy === opt.id && <CheckCircle2 size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
   </div>

   {/* APPLICANT TABLE */}
   <ThemedCard 
    className="rounded-[32px] md:rounded-[48px] shadow-2xl shadow-slate-200/50 dark:shadow-blue-500/10 overflow-hidden transition-colors duration-500 border"
    style={{    
    backgroundColor: isDarkMode ? themeColors.dark.surface : '#ffffff',
    borderColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9'
  }}
   >
    {/* MOBILE CARD VIEW */}
    <div className="md:hidden p-4 space-y-4">
        <div className="flex items-center justify-between px-2 pb-2">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 
                ? <CheckSquare className="text-blue-600" size={16} /> 
                : <Square className={isDarkMode ? "text-slate-500" : "text-slate-400"} size={16} />
                }
                <span>Select All</span>
            </button>
            <span className="text-[10px] font-bold text-slate-400">{filteredStudents.length} Records</span>
        </div>

        {filteredStudents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 italic">No applicants match this criteria.</div>
        ) : filteredStudents.map((student) => {
            if (hiddenRows.has(student.id)) return null
            const isMale = student.gender !== 'Female'
            const isSelected = selectedIds.includes(student.id)
            const isAnimatingIn = animatingIds.has(student.id)
            
            return (
                <div 
                    key={student.id}
                    className={`rounded-3xl p-5 border relative transition-all duration-300 ${
                        isSelected 
                            ? (isMale ? 'bg-blue-50/90 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-pink-50/90 border-pink-200 dark:bg-pink-900/30 dark:border-pink-800')
                            : (isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-100')
                    } ${exitingRows[student.id] ? 'animate-out slide-out-to-right fade-out duration-200' : ''} ${isAnimatingIn ? 'animate-in slide-in-from-right fade-in duration-500' : ''}`}
                    onClick={() => setOpenStudentDialog(student.id)}
                >
                    <div className="flex items-start gap-4">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(student.id); }} className="mt-1">
                            {selectedIds.includes(student.id) ? <CheckSquare className="text-blue-600" size={20} /> : <Square className="text-slate-300" size={20} />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative shrink-0">
                                        <div className={`w-12 h-12 rounded-2xl overflow-hidden ${isMale ? 'bg-blue-100' : 'bg-pink-100'}`}>
                                            <img 
                                                src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture || "https://api.dicebear.com/7.x/initials/svg?seed=" + student.last_name} 
                                                alt="Avatar" 
                                                className="w-full h-full object-cover" 
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase tracking-widest text-white shadow-sm z-10 ${
                                            student.student_category?.toLowerCase().includes('als') 
                                                ? 'bg-orange-500' 
                                                : 'bg-blue-500'
                                        }`}>
                                            {student.student_category?.toLowerCase().includes('als') ? 'ALS' : 'JHS'}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className={`font-black text-sm uppercase leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {student.last_name}, {student.first_name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 tracking-wider">LRN: {student.lrn}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <div className={`px-2 py-1.5 rounded-xl text-center border ${isMale ? 'bg-blue-50/50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-pink-50/50 border-pink-100 text-pink-600 dark:bg-pink-900/20 dark:border-pink-800 dark:text-pink-400'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-70">Gender</p>
                                    <p className="text-[10px] font-black uppercase mt-0.5">{student.gender}</p>
                                </div>
                                <div className={`px-2 py-1.5 rounded-xl text-center border ${student.strand === 'ICT' ? 'bg-indigo-50/50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400' : 'bg-orange-50/50 border-orange-100 text-orange-600 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-70">Strand</p>
                                    <p className="text-[10px] font-black uppercase mt-0.5">{student.strand}</p>
                                </div>
                                <div className={`px-2 py-1.5 rounded-xl text-center border ${isDarkMode ? 'bg-slate-700/30 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-70">GWA</p>
                                    <p className="text-[10px] font-black uppercase mt-0.5">{student.gwa_grade_10 || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-4 pt-3 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <Button onClick={(e) => { e.stopPropagation(); setOpenStudentDialog(student.id); }} variant="ghost" size="sm" className="flex-1 h-9 rounded-xl text-slate-500 font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800"><Eye size={14} className="mr-1.5"/> View</Button>

                        {student.status === 'Pending' && (
                            <>
                                <Button onClick={(e) => { e.stopPropagation(); handleExit(student.id, () => handleStatusChange(student.id, `${student.first_name} ${student.last_name}`, 'Accepted')); }} variant="ghost" size="sm" className="flex-1 h-9 rounded-xl text-green-600 font-black text-[9px] uppercase tracking-widest hover:bg-green-50 dark:hover:bg-green-900/20">Approve</Button>
                                <Button onClick={(e) => { e.stopPropagation(); setActiveDeclineStudent(student); setDeclineModalOpen(true); }} variant="ghost" size="sm" className="flex-1 h-9 rounded-xl text-red-600 font-black text-[9px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20">Decline</Button>
                            </>
                        )}

                        {(student.status === 'Accepted' || student.status === 'Approved' || student.status === 'Rejected') && (
                            <Button onClick={(e) => { e.stopPropagation(); handleExit(student.id, () => handleStatusChange(student.id, `${student.first_name} ${student.last_name}`, 'Pending')); }} variant="ghost" size="sm" className="flex-1 h-9 rounded-xl text-amber-600 font-black text-[9px] uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20"><RotateCcw size={12} className="mr-1.5"/> Reset</Button>
                        )}

                        {(student.status === 'Pending' || student.status === 'Rejected') && (
                            <Button onClick={(e) => { e.stopPropagation(); setActiveDeleteStudent(student); setDeleteModalOpen(true); }} variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14}/></Button>
                        )}
                    </div>
                </div>
            )
        })}
    </div>

    <div className="hidden md:block">
    <Table className="min-w-full table-fixed">
     <TableHeader className={`${isDarkMode ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900' : 'bg-white'} backdrop-blur-sm`}>
      <TableRow className="border-none hover:bg-transparent">
       <TableHead className="w-12 min-w-[48px] max-w-[48px] pl-4 md:pl-8" style={{ color: 'grey' }}>
        <button onClick={toggleSelectAll}>
         {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 
          ? <CheckSquare className="text-blue-600" size={18} /> 
          : <Square className={isDarkMode ? "text-slate-500" : "text-slate-400"} size={18} />
         }
        </button>
       </TableHead>
       <TableHead className={`w-[280px] min-w-[280px] px-3 md:px-6 py-6 font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} style={{ color: 'grey' }}>Applicant Identity</TableHead>
       {/* NEW: GENDER CATEGORY */}
       <TableHead className={`w-[100px] min-w-[100px] font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-center`} style={{ color: 'grey' }}>Gender</TableHead>
       <TableHead className={`w-[120px] min-w-[120px] font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-center`} style={{ color: 'grey' }}>Strand</TableHead>
       <TableHead className={`w-[80px] min-w-[80px] font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-center`} style={{ color: 'grey' }}>GWA</TableHead>
       <TableHead className={`w-[280px] min-w-[280px] text-right px-4 md:px-8 font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} style={{ color: 'grey' }}>Actions</TableHead>
      </TableRow>
</TableHeader>
     <TableBody>
      {filteredStudents.length === 0 ? (
       <TableRow><TableCell colSpan={6} className="py-32 text-center text-slate-400 italic">No applicants match this criteria.</TableCell></TableRow>
      ) : filteredStudents.map((student) => {
       if (hiddenRows.has(student.id)) return null
       const isMale = student.gender !== 'Female'
       const isSelected = selectedIds.includes(student.id)
       // Override default TableRow hover:bg-muted/50 with gender-based hover
       // Lighter hover colors, brighter selected colors
       const baseBg = isSelected ? (isMale ? 'bg-blue-100/80 dark:bg-blue-900/40' : 'bg-pink-100/80 dark:bg-pink-900/40') : ''
       const genderHoverBg = isMale 
         ? (isSelected ? 'hover:!bg-blue-300 dark:hover:!bg-blue-800' : 'hover:!bg-blue-200 dark:hover:!bg-blue-900/40') 
         : (isSelected ? 'hover:!bg-pink-300 dark:hover:!bg-pink-800' : 'hover:!bg-pink-200 dark:hover:!bg-pink-900/40')
       
       const isAnimatingIn = animatingIds.has(student.id)

       return (
        <TableRow 
         key={student.id} 
         className={`transition-colors duration-300 border-b group relative ${baseBg} ${genderHoverBg} hover:shadow-sm will-change-transform ${exitingRows[student.id] ? 'animate-out slide-out-to-right fade-out duration-200 pointer-events-none' : ''} ${isAnimatingIn ? 'animate-in slide-in-from-right fade-in duration-500' : ''}`}
         onMouseEnter={(e) => {
          if (isSelected) {
           // Brighter color when selected and hovering
           e.currentTarget.style.backgroundColor = isMale ? 'rgb(219 234 254 / 0.8)' : 'rgb(252 231 243 / 0.8)'
          } else {
           // Lighter color when just hovering (not selected)
           e.currentTarget.style.backgroundColor = isMale ? 'rgb(191 219 254 / 0.6)' : 'rgb(251 207 232 / 0.6)'
          }
          e.currentTarget.style.transition = 'background-color 0.2s ease'
         }}
         onMouseLeave={(e) => {
          if (isSelected) {
           // Keep brighter gender-based highlight when selected
           e.currentTarget.style.backgroundColor = isMale ? 'rgb(219 234 254 / 0.8)' : 'rgb(252 231 243 / 0.8)'
          } else {
           e.currentTarget.style.backgroundColor = ''
          }
         }}
         style={{
           borderColor: isDarkMode ? 'rgba(77, 87, 100, 0.4)' : 'rgba(231, 229, 229, 0.53)',
           ...(isSelected ? { backgroundColor: isMale ? 'rgb(219 234 254 / 0.8)' : 'rgb(252 231 243 / 0.8)' } : undefined),
           ...(exitingRows[student.id] ? { animationFillMode: 'forwards' } : undefined)
         }}
        >
         <TableCell className="pl-4 md:pl-8">
          <button onClick={() => toggleSelect(student.id)}>
           {selectedIds.includes(student.id) ? <CheckSquare className="text-blue-600" size={18} /> : <Square className="text-slate-200" size={18} />}
          </button>
         </TableCell>
         <TableCell className="px-3 md:px-6 py-5 relative">
          <div 
           onClick={() => setOpenStudentDialog(student.id)} 
           className="flex items-center gap-3 md:gap-4 cursor-pointer hover:opacity-90 transition-opacity group/name"
          >
           <div className="relative">
           <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden border border-white shadow-lg shrink-0 ring-2 transition-all group-hover/name:scale-105 ${
             isMale 
               ? 'ring-blue-400/60 group-hover/name:ring-blue-500' 
               : 'ring-pink-400/40 group-hover/name:ring-pink-500'
           }`}>
            <img 
             src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture || "https://api.dicebear.com/7.x/initials/svg?seed=" + student.last_name} 
             alt="Avatar" 
             className="w-full h-full object-cover" 
             loading="lazy"
            />
           </div>
            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[6px] md:text-[7px] font-black uppercase tracking-widest text-white shadow-sm z-10 whitespace-nowrap ${
              student.student_category?.toLowerCase().includes('als') 
                ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-500/30' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/30'
            }`}>
              {student.student_category?.toLowerCase().includes('als') ? 'ALS' : 'JHS'}
            </div>
           </div>
           <div className="min-w-0">
            <ThemedText variant="h3" className="text-sm md:text-base leading-none group-hover/name:text-blue-600 dark:group-hover/name:text-blue-400 transition-colors" isDarkMode={isDarkMode} style={{ color: isDarkMode ? '#ffffff' : 'black' }}>{student.first_name} {student.last_name}</ThemedText>
            <ThemedText variant="label" className="mt-1 text-slate-500 dark:text-slate-400" isDarkMode={isDarkMode}>LRN: {student.lrn}</ThemedText>
           </div>
          </div>
         </TableCell>
         {/* GENDER COLUMN */}
         <TableCell className="text-center font-black text-[10px] uppercase text-slate-500">
            <span className={student.gender === 'Female' ? 'text-pink-500' : 'text-blue-500'}>{student.gender}</span>
         </TableCell>
         <TableCell className="text-center">
          <Badge className={`border-none px-2 md:px-3 py-1 text-[9px] font-black uppercase ${student.strand === 'ICT' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
           {student.strand}
          </Badge>
         </TableCell>
         <TableCell className="text-center"><ThemedText variant="body" className="font-black" isDarkMode={isDarkMode} style={{ color: isDarkMode ? undefined : 'black' }}>{student.gwa_grade_10 || 'N/A'}</ThemedText></TableCell>
         <TableCell className="text-right px-4 md:px-8">
          <div className="flex items-center justify-end gap-1.5 md:gap-2 flex-nowrap">
           <Button 
            onClick={() => setOpenStudentDialog(student.id)} 
            variant="ghost"
            className="h-9 px-3 rounded-xl text-slate-500 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 flex items-center justify-center"
            onMouseEnter={(e) => {
             e.currentTarget.style.backgroundColor = 'rgb(71 85 105)'
             e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
             e.currentTarget.style.backgroundColor = ''
             e.currentTarget.style.color = 'rgb(100 116 139)'
            }}
           >
            <Eye size={16}/>
           </Button>

           {student.status === 'Pending' && (
            <>
             <Button 
              onClick={() => handleExit(student.id, () => handleStatusChange(student.id, `${student.first_name} ${student.last_name}`, 'Accepted'))} 
              variant="ghost" 
              className="h-9 px-2 md:px-3 rounded-xl text-green-600 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 whitespace-nowrap"
              onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'rgb(22 163 74)'
               e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = ''
               e.currentTarget.style.color = 'rgb(22 163 74)'
              }}
             >
              <span className="hidden sm:inline">Approve</span><span className="sm:hidden">✓</span>
             </Button>
             <Button 
              onClick={() => {
               setActiveDeclineStudent(student);
               setDeclineModalOpen(true);
              }} 
              variant="ghost" 
              className="h-9 px-2 md:px-3 rounded-xl text-red-600 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 whitespace-nowrap"
              onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'rgb(220 38 38)'
               e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = ''
               e.currentTarget.style.color = 'rgb(220 38 38)'
              }}
             >
              <span className="hidden sm:inline">Decline</span><span className="sm:hidden">✗</span>
             </Button>
            </>
           )}

           {(student.status === 'Accepted' || student.status === 'Approved') && (
            <>
             <Button 
              onClick={() => handleExit(student.id, () => handleStatusChange(student.id, `${student.first_name} ${student.last_name}`, 'Pending'))} 
              variant="ghost" 
              className="h-9 px-2 md:px-3 rounded-xl text-amber-600 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 whitespace-nowrap"
              onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'rgb(245 158 11)'
               e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = ''
               e.currentTarget.style.color = 'rgb(217 119 6)'
              }}
             >
              <RotateCcw size={12} className="mr-1"/> <span className="hidden sm:inline">Reset</span>
             </Button>
            </>
           )}

           {student.status === 'Rejected' && (
            <Button 
             onClick={() => handleExit(student.id, () => handleStatusChange(student.id, `${student.first_name} ${student.last_name}`, 'Pending'))} 
             variant="ghost" 
             className="h-9 px-3 md:px-4 rounded-xl text-amber-600 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 whitespace-nowrap"
             onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(245 158 11)'
              e.currentTarget.style.color = 'white'
             }}
             onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.color = 'rgb(217 119 6)'
             }}
            >
             <RotateCcw size={14} className="mr-1 md:mr-2"/> <span className="hidden sm:inline">Reset</span>
            </Button>
           )}

           {(student.status === 'Pending' || student.status === 'Rejected') && (
            <Button 
             onClick={() => {
              setActiveDeleteStudent(student);
              setDeleteModalOpen(true);
             }}
             variant="ghost" 
             className="h-9 px-3 rounded-xl text-red-600 dark:text-red-400 font-black text-[9px] uppercase tracking-widest transition-colors shrink-0 flex items-center justify-center"
             onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(220 38 38)'
              e.currentTarget.style.color = 'white'
             }}
             onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.color = ''
             }}
            >
             <Trash2 size={16}/>
            </Button>
           )}

          </div>
         </TableCell>
        </TableRow>
       )
      })}
     </TableBody>
    </Table>
    </div>
   </ThemedCard>

   {/* STUDENT INSPECTION DIALOG */}
   {selectedStudentForDialog && (
    <Dialog open={!!openStudentDialog} onOpenChange={(open) => !open && setOpenStudentDialog(null)}>
     <DialogContent className="w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] md:rounded-[48px] p-0 border-none shadow-2xl [&>button]:text-red-500">
      <DialogHeader className="sr-only">
       <DialogTitle>Profile Detail: {selectedStudentForDialog.first_name} {selectedStudentForDialog.last_name}</DialogTitle>
       <DialogDescription>Verification matrix for applicant {selectedStudentForDialog.lrn}</DialogDescription>
      </DialogHeader>
      <StudentDossier 
       student={selectedStudentForDialog} 
       onOpenFile={(url, label) => {
        setViewingFile({ url, label });
        setRotation(0);
        setViewerOpen(true);
       }}
       isDarkMode={isDarkMode}
      />
     </DialogContent>
    </Dialog>
   )}

   {/* --- INTEGRATED HIGH-FIDELITY DOCUMENT VIEWER --- */}
   <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
    <DialogContent className="max-w-[95vw] w-full h-[90vh] md:h-[95vh] p-0 rounded-[32px] md:rounded-[40px] overflow-hidden border-none shadow-2xl bg-slate-950/95 flex flex-col [&>button]:hidden">
     {/* HEADER BAR (Prevents title overlap) */}
     <div className="p-6 bg-slate-900 border-b border-white/5 flex items-center justify-between shrink-0">
      <div>
       <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Registrar Inspection Matrix</p>
       <DialogTitle className="text-white font-black uppercase text-xl leading-none">
        {viewingFile?.label}
       </DialogTitle>
       <DialogDescription className="hidden">High-resolution document view</DialogDescription>
      </div>
      <div className="flex gap-3">
       {/* ROTATE & DOWNLOAD TOOLS */}
       <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="rounded-full bg-white/10 hover:bg-white/20 text-white"><RotateCw size={20}/></Button>
       <Button variant="ghost" size="icon" onClick={() => window.open(viewingFile?.url, '_blank')} className="rounded-full bg-white/10 hover:bg-white/20 text-white"><Download size={20}/></Button>
       <Button variant="ghost" size="icon" onClick={() => setViewerOpen(false)} className="rounded-full bg-red-500 hover:bg-red-600 text-white"><X size={20}/></Button>
      </div>
     </div>

     {/* INSPECTION AREA */}
     <div className="flex-1 w-full flex items-center justify-center p-12 overflow-auto custom-scrollbar">
      {viewingFile?.url.toLowerCase().endsWith('.pdf') ? (
       <iframe src={viewingFile.url} className="w-full h-full rounded-2xl bg-white border-none" title="PDF Viewer" />
      ) : (
       <div className="relative group cursor-zoom-in transition-transform duration-300" style={{ transform: `rotate(${rotation}deg)` }}>
        <img src={viewingFile?.url} alt="Inspection" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500" />
       </div>
      )}
     </div>
     
     <div className="p-6 bg-slate-900/50 backdrop-blur-xl border-t border-white/5 flex items-center justify-center shrink-0">
       <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-[9px] tracking-widest"><Maximize2 size={12}/> Document Render: Active</div>
        <div className="w-[1px] h-4 bg-white/10" />
        <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest italic text-center">Rotate or Download for secondary inspection tools</p>
       </div>
     </div>
    </DialogContent>
   </Dialog>

   {/* --- MODAL: DECLINE --- */}
   <Dialog open={declineModalOpen} onOpenChange={setDeclineModalOpen}>
    <DialogContent 
      className="rounded-[32px] w-[95vw] max-w-md p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
    >
     <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 flex items-center gap-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/10 shrink-0"><AlertTriangle size={24} /></div>
      <div className="relative z-10"><DialogTitle className="text-xl font-black uppercase tracking-tight leading-none text-white drop-shadow-sm">Admission Rejection</DialogTitle><DialogDescription className="text-red-100 text-xs mt-1 font-medium italic opacity-90">Record why this student was declined.</DialogDescription></div>
     </div>
     <div className="p-8 space-y-6">
      <div className={`flex items-center gap-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
       <div className="h-10 w-10 rounded-xl bg-slate-200 overflow-hidden shrink-0 ring-2 ring-white dark:ring-slate-700 shadow-sm"><img src={activeDeclineStudent?.two_by_two_url || activeDeclineStudent?.profile_2x2_url || activeDeclineStudent?.profile_picture} className="w-full h-full object-cover" /></div>
       <div className="flex flex-col"><span className={`text-xs font-black uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeDeclineStudent?.first_name} {activeDeclineStudent?.last_name}</span><span className="text-[10px] font-bold text-slate-400 mt-1">LRN: {activeDeclineStudent?.lrn}</span></div>
      </div>
      <div className="space-y-4">
       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quick Reasons</label>
       <div className="flex flex-wrap gap-2">
         {QUICK_REASONS.map(reason => (
           <button 
             key={reason} 
             onClick={() => setDeclineReason(reason)} 
             className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${
               declineReason === reason 
                 ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/30' 
                 : isDarkMode 
                   ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400' 
                   : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-red-200 hover:text-red-600'
             }`}
           >
             {reason}
           </button>
         ))}
       </div>
       <div className="pt-2">
         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Registrar Feedback</label>
         <Textarea 
           placeholder="Provide specific feedback..." 
           className={`min-h-[100px] mt-2 rounded-2xl focus:ring-red-600 font-bold text-sm resize-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-900'}`} 
           value={declineReason} 
           onChange={(e) => setDeclineReason(e.target.value)} 
         />
       </div>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-col"><Button onClick={() => handleExit(activeDeclineStudent.id, () => handleStatusChange(activeDeclineStudent.id, `${activeDeclineStudent.first_name} ${activeDeclineStudent.last_name}`, 'Rejected', declineReason || "Incomplete requirements."))} className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">Confirm Rejection</Button><Button variant="ghost" onClick={() => setDeclineModalOpen(false)} className={`w-full h-12 rounded-2xl font-black uppercase text-[10px] ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>Cancel</Button></DialogFooter>
     </div>
    </DialogContent>
   </Dialog>

   {/* --- MODAL: BULK DECLINE --- */}
   <Dialog open={bulkDeclineModalOpen} onOpenChange={setBulkDeclineModalOpen}>
    <DialogContent 
      className="rounded-[24px] md:rounded-[32px] w-[95vw] max-w-2xl p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500 max-h-[90vh] flex flex-col"
      style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
    >
     {/* Header with Gradient */}
     <div className="bg-gradient-to-br from-red-600 to-red-700 p-5 md:p-8 flex items-center gap-4 md:gap-5 text-white relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/10 shrink-0">
        <AlertTriangle size={20} className="text-white drop-shadow-md md:w-7 md:h-7" />
      </div>
      <div className="relative z-10">
        <DialogTitle className="text-lg md:text-2xl font-black uppercase tracking-tight leading-none text-white drop-shadow-sm">Batch Rejection</DialogTitle>
        <DialogDescription className="text-red-100 text-[10px] md:text-xs mt-1 md:mt-1.5 font-bold uppercase tracking-widest opacity-90">
          Processing {selectedIds.length} applicants for removal
        </DialogDescription>
      </div>
     </div>

     <div className="p-5 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
      
      {/* SCROLLABLE STUDENT LIST */}
      <div className={`rounded-2xl md:rounded-3xl border overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
        <div className={`px-4 md:px-6 py-3 md:py-4 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-100/50'}`}>
           <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">Target List</p>
           <Badge variant="outline" className="text-[8px] md:text-[9px] h-5 border-slate-200 dark:border-slate-700 text-slate-400">{selectedIds.length} Selected</Badge>
        </div>
        <div className="max-h-[180px] md:max-h-[240px] overflow-y-auto custom-scrollbar p-2 md:p-3 space-y-2">
           {students.filter(s => selectedIds.includes(s.id)).map(student => (
             <div key={student.id} className={`flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl md:rounded-2xl transition-all border ${isDarkMode ? 'hover:bg-slate-800 border-transparent hover:border-slate-700' : 'hover:bg-white border-transparent hover:border-slate-200 hover:shadow-sm'}`}>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-slate-200 overflow-hidden shrink-0 ring-2 ring-white dark:ring-slate-700 shadow-sm">
                   <img src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${student.last_name}`} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                   <span className={`text-[10px] md:text-xs font-black uppercase leading-none truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{student.first_name} {student.last_name}</span>
                   <span className="text-[8px] md:text-[9px] font-bold text-slate-400 mt-0.5 md:mt-1 tracking-wider">LRN: {student.lrn}</span>
                </div>
             </div>
           ))}
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
       <div className="flex items-center justify-between">
         <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reason for Rejection</label>
         <span className="text-[8px] md:text-[9px] font-bold text-red-500 uppercase tracking-wider opacity-80">Required</span>
       </div>
       
       <div className="flex flex-wrap gap-1.5 md:gap-2">
         {QUICK_REASONS.map(reason => (
           <button 
             key={reason} 
             onClick={() => setDeclineReason(reason)} 
             className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border text-[8px] md:text-[9px] font-bold uppercase tracking-wide transition-all ${
               declineReason === reason 
                 ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/30 transform scale-105' 
                 : isDarkMode 
                   ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400' 
                   : 'bg-white border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50'
             }`}
           >
             {reason}
           </button>
         ))}
       </div>
       
       <div className="pt-1 md:pt-2 relative">
         <Textarea 
           placeholder="Provide specific feedback regarding the rejection..." 
           className={`min-h-[100px] md:min-h-[120px] rounded-2xl md:rounded-3xl p-4 md:p-5 font-bold text-xs md:text-sm resize-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-0 transition-all ${
             isDarkMode 
               ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' 
               : 'bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400'
           }`} 
           value={declineReason} 
           onChange={(e) => setDeclineReason(e.target.value)} 
         />
         <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 pointer-events-none">
           <FileText size={12} className={`md:w-3.5 md:h-3.5 ${isDarkMode ? "text-slate-700" : "text-slate-300"}`} />
         </div>
       </div>
      </div>
      <DialogFooter className="flex-col gap-2 md:gap-3 sm:flex-col pt-2">
        <Button 
          onClick={() => processBulkUpdate('Rejected', declineReason || "Incomplete requirements.")} 
          className="w-full h-12 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-[10px] md:text-[11px] tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Confirm Batch Rejection
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => setBulkDeclineModalOpen(false)} 
          className={`w-full h-10 md:h-12 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
        >
          Cancel Operation
        </Button>
      </DialogFooter>
     </div>
    </DialogContent>
   </Dialog>

   {/* --- MODAL: DELETE --- */}
   <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
    <DialogContent 
      className="rounded-[32px] w-[95vw] max-w-md p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
    >
     <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 flex items-center gap-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/10 shrink-0"><Trash2 size={24} /></div>
      <div className="relative z-10"><DialogTitle className="text-xl font-black uppercase tracking-tight leading-none text-white drop-shadow-sm">Record Deletion</DialogTitle><DialogDescription className="text-red-100 text-xs mt-1 font-medium italic opacity-90">This action is irreversible.</DialogDescription></div>
     </div>
     <div className="p-8 space-y-6 text-center">
      <div className={`p-6 rounded-[32px] border ${isDarkMode ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
       <p className={`text-sm font-bold leading-relaxed text-center ${isDarkMode ? 'text-red-200' : 'text-red-900'}`}>Are you sure you want to permanently erase <br/><span className="underline decoration-2 underline-offset-4">{activeDeleteStudent?.first_name} {activeDeleteStudent?.last_name}</span>?</p>
       <p className="text-[10px] font-black uppercase text-red-500 mt-2 tracking-widest leading-relaxed">This will purge all documents and database entries.</p>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-col">
        <Button onClick={() => handleExit(activeDeleteStudent.id, handleConfirmDelete)} className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">Delete Permanently</Button>
        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className={`w-full h-12 rounded-2xl font-black uppercase text-[10px] ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>Cancel</Button>
      </DialogFooter>
     </div>
    </DialogContent>
   </Dialog>

   {/* --- MODAL: BULK DELETE --- */}
   <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
    <DialogContent 
      className="rounded-[32px] w-[95vw] max-w-md p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
    >
     <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 flex items-center gap-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/10 shrink-0"><Trash2 size={24} /></div>
      <div className="relative z-10"><DialogTitle className="text-xl font-black uppercase tracking-tight leading-none text-white drop-shadow-sm">Batch Deletion</DialogTitle><DialogDescription className="text-red-100 text-xs mt-1 font-medium italic opacity-90">Permanently remove {selectedIds.length} records.</DialogDescription></div>
     </div>
     <div className="p-8 space-y-6 text-center">
      <div className={`p-6 rounded-[32px] border ${isDarkMode ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
       <p className={`text-sm font-bold leading-relaxed text-center ${isDarkMode ? 'text-red-200' : 'text-red-900'}`}>Are you sure you want to permanently erase <br/><span className="text-lg font-black">{selectedIds.length}</span> selected applicants?</p>
       <p className="text-[10px] font-black uppercase text-red-500 mt-2 tracking-widest leading-relaxed">This will purge all documents and database entries.</p>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-col">
        <Button onClick={processBulkDelete} className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">Confirm Batch Deletion</Button>
        <Button variant="ghost" onClick={() => setBulkDeleteModalOpen(false)} className={`w-full h-12 rounded-2xl font-black uppercase text-[10px] ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>Cancel</Button>
      </DialogFooter>
     </div>
    </DialogContent>
   </Dialog>

   {/* FLOATING BULK ACTIONS BAR */}
   {selectedIds.length > 0 && (
    <div className="fixed bottom-4 md:bottom-10 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500 max-w-4xl md:mx-auto">
     <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 md:px-8 py-3 md:py-4 rounded-[32px] shadow-2xl shadow-blue-500/20 flex flex-col md:flex-row items-center gap-4 md:gap-8 border border-white/20 backdrop-blur-xl ring-2 ring-blue-500/10">
      <div className="flex flex-col text-center md:text-left"><span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Batch Matrix control</span><span className="text-sm font-black tracking-tight">{selectedIds.length} Selected</span></div>
      <div className="hidden md:block h-8 w-[1px] bg-white/10" />
      <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
       {filter === 'Pending' && (
        <>
         <Button onClick={() => handleBulkAction('Accepted')} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl font-black text-[10px] uppercase h-10 md:h-11 px-4 md:px-6 shadow-lg shadow-green-500/20 transition-all transform hover:scale-105">
          <CheckCircle2 size={14} className="mr-1 md:mr-2"/> <span className="hidden sm:inline">Mass Approve</span><span className="sm:hidden">Approve</span>
         </Button>
         <Button onClick={() => handleBulkAction('Rejected')} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl font-black text-[10px] uppercase h-10 md:h-11 px-4 md:px-6 shadow-lg shadow-red-500/20 transition-all transform hover:scale-105">
          <XCircle size={14} className="mr-1 md:mr-2"/> <span className="hidden sm:inline">Mass Reject</span><span className="sm:hidden">Reject</span>
         </Button>
        </>
       )}
       {(filter === 'Accepted' || filter === 'Rejected') && (
        <Button onClick={() => handleBulkAction('Pending')} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-black text-[10px] uppercase h-10 md:h-11 px-4 md:px-6 shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105">
         <ListRestart size={14} className="mr-1 md:mr-2"/> <span className="hidden sm:inline">Reset to Pending</span><span className="sm:hidden">Reset</span>
        </Button>
       )}
       {filter === 'Rejected' && (
        <Button onClick={() => setBulkDeleteModalOpen(true)} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl font-black text-[10px] uppercase h-10 md:h-11 px-4 md:px-6 shadow-lg shadow-red-500/20 transition-all transform hover:scale-105">
         <Trash2 size={14} className="mr-1 md:mr-2"/> <span className="hidden sm:inline">Mass Deletion</span><span className="sm:hidden">Delete</span>
        </Button>
       )}
       <Button onClick={() => setSelectedIds([])} variant="ghost" className="text-slate-400 hover:text-white font-black text-[10px] uppercase h-10 md:h-11 px-4 transition-all hover:bg-white/10">Cancel</Button>
      </div>
     </div>
    </div>
   )}
   </div>
  </div>
 )
}

const StudentDossier = memo(({ student, onOpenFile, isDarkMode }: { student: any, onOpenFile: (url: string, label: string) => void, isDarkMode: boolean }) => {
 const isJHS = student.student_category?.toLowerCase().includes("jhs") || student.student_category === "Standard";
 const isALS = student.student_category?.toLowerCase().includes("als");

 const headerColor = isALS ? "bg-gradient-to-br from-orange-500 to-orange-600" : "bg-gradient-to-br from-slate-800 to-slate-900";
 const badgeColor = isALS ? "bg-orange-500" : "bg-blue-600";

 return (
  <div className="flex flex-col">
       <div className={`${headerColor} p-6 md:p-10 flex flex-col items-center text-center relative overflow-hidden transition-colors duration-500`} style={{ background: 'linear-gradient(135deg, #1e3a8a, #0f172a)' }}>
    <div className="absolute top-0 left-0 p-4 md:p-8 flex flex-col gap-2 items-start">
     <Badge className={`${badgeColor} text-white backdrop-blur-md text-[10px] font-black px-3 md:px-4 py-2 uppercase tracking-widest border-none`}>{student.student_category || "Standard"}</Badge>
     <Badge variant="outline" className="text-white/80 border-white/40 text-[9px] uppercase font-bold">{student.school_year}</Badge>
    </div>
    <div className="relative z-10 mb-6">
     <div className="w-32 h-32 md:w-44 md:h-44 bg-slate-800 rounded-3xl border-4 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center cursor-zoom-in group hover:ring-2 hover:ring-blue-400/50 transition-all" onClick={() => onOpenFile(student.two_by_two_url || student.profile_2x2_url || student.profile_picture, "Applicant 2x2 Image")}>
      {student.two_by_two_url || student.profile_2x2_url || student.profile_picture ? (<img src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture} alt="2x2" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />) : (<div className="flex flex-col items-center text-slate-500"><User size={48} strokeWidth={1} /><p className="text-[8px] font-bold uppercase mt-2">No Photo Provided</p></div>)}
     </div>
    </div>
    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">{student.first_name} {student.last_name}</h2>
    <p className="text-white/80 font-bold uppercase tracking-[0.3em] text-[10px] mt-3">LRN: {student.lrn}</p>
    <StatusBadge status={student.status} isDarkMode={isDarkMode} />
   </div>

   <div className="p-6 md:p-10 space-y-8 md:space-y-12 transition-colors duration-500" style={{ backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '#ffffff' }}>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 text-sm">
     <div className={`space-y-6 p-4 md:p-6 rounded-2xl transition-colors border border-transparent cursor-pointer ${isDarkMode ? 'hover:!bg-slate-800 hover:!border-slate-700' : 'hover:!bg-blue-50 hover:!border-blue-200'}`}>
      <h3 className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest border-b pb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`} style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#94a3b8' }}><User size={14} className="text-blue-500" /> Personal Identity</h3>
      <div className="grid grid-cols-2 gap-y-6">
       {/* SEPARATED NAMES AS REQUESTED */}
       <InfoBlock label="First Name" value={student.first_name} isDarkMode={isDarkMode} />
       <InfoBlock label="Middle Name" value={student.middle_name || "N/A"} isDarkMode={isDarkMode} />
       <InfoBlock label="Last Name" value={student.last_name} isDarkMode={isDarkMode} />
       <InfoBlock label="Full Name" value={`${student.first_name} ${student.middle_name || ''} ${student.last_name}`} isDarkMode={isDarkMode} />
       
       <InfoBlock label="Gender" value={student.gender} isDarkMode={isDarkMode} />
       <InfoBlock label="Age" value={student.age?.toString()} isDarkMode={isDarkMode} />
       <InfoBlock label="Birth Date" value={student.birth_date} isDarkMode={isDarkMode} />
       <InfoBlock label="Civil Status" value={student.civil_status} isDarkMode={isDarkMode} />
       <InfoBlock label="Religion" value={student.religion} isDarkMode={isDarkMode} />
       <div className="col-span-2"><InfoBlock label="Home Address" value={student.address} icon={<MapPin size={10} />} isDarkMode={isDarkMode} /></div>
      </div>
     </div>
     <div className={`space-y-6 p-4 md:p-6 rounded-2xl transition-colors border border-transparent cursor-pointer ${isDarkMode ? 'hover:!bg-slate-800 hover:!border-slate-700' : 'hover:!bg-indigo-50 hover:!border-indigo-200'}`}>
      <h3 className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest border-b pb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`} style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#94a3b8' }}><Mail size={14} className="text-indigo-500" /> Communication</h3>
      <div className="space-y-6"><InfoBlock label="Email Address" value={student.email} icon={<Mail size={10} />} isDarkMode={isDarkMode} /><InfoBlock label="Student Phone" value={student.phone || student.contact_no} icon={<Phone size={10} />} isDarkMode={isDarkMode} /><div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Database ID</p><p className={`text-[10px] font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{student.id}</p></div></div>
     </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 text-sm">
     <div className={`space-y-6 p-4 md:p-6 rounded-2xl transition-colors border border-transparent cursor-pointer ${isDarkMode ? 'hover:!bg-slate-800 hover:!border-slate-700' : 'hover:!bg-emerald-50 hover:!border-emerald-200'}`}>
      <h3 className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest border-b pb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`} style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#94a3b8' }}><ShieldCheck size={14} className="text-emerald-500" /> Guardian Matrix</h3>
      <div className="space-y-4"><InfoBlock label="Full Guardian Name" value={`${student.guardian_first_name || student.guardian_name || ''} ${student.guardian_last_name || ''}`} isDarkMode={isDarkMode} /><InfoBlock label="Guardian Contact" value={student.guardian_phone || student.guardian_contact} icon={<Phone size={10} />} isDarkMode={isDarkMode} /></div>
     </div>
     <div className={`space-y-6 p-4 md:p-6 rounded-2xl transition-colors border border-transparent cursor-pointer ${isDarkMode ? 'hover:!bg-slate-800 hover:!border-slate-700' : 'hover:!bg-orange-50 hover:!border-orange-200'}`}>
      <h3 className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest border-b pb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`} style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#94a3b8' }}><GraduationCap size={14} className="text-orange-500" /> Academic Standing</h3>
      <div className="grid grid-cols-2 gap-4"><div className={`col-span-2 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Origin School</p><p className={`font-black uppercase text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{student.last_school_attended || "Not Provided"}</p></div><div className={`p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-blue-900/20 border-blue-900/30' : 'bg-blue-50 border-blue-100'}`}><p className="text-[9px] font-bold text-blue-400 uppercase mb-1">GWA Matrix</p><p className={`text-2xl font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{student.gwa_grade_10 || "0.0"}</p></div><div className={`p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-orange-900/20 border-orange-900/30' : 'bg-orange-50 border-orange-100'}`}><p className="text-[9px] font-bold text-orange-400 uppercase mb-1">Target Strand</p><p className={`text-2xl font-black ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{student.strand}</p></div></div>
     </div>
    </div>

    <div className={`space-y-6 pb-8 p-4 md:p-6 rounded-2xl transition-colors border border-transparent cursor-pointer ${isDarkMode ? 'hover:!bg-slate-800 hover:!border-slate-700' : 'hover:!bg-blue-50 hover:!border-blue-200'}`}>
     <h3 className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest border-b pb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`} style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#94a3b8' }}><ScrollText size={14} className="text-blue-500" /> Registrar Credential Check</h3>
     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {isJHS && (<><CredentialCard label="Form 138" url={student.form_138_url} onOpen={onOpenFile} isDarkMode={isDarkMode} /><CredentialCard label="Good Moral" url={student.good_moral_url} onOpen={onOpenFile} isDarkMode={isDarkMode} /></>)}
      {isALS && (<><CredentialCard label="ALS COR Rating" url={student.cor_url} onOpen={onOpenFile} isDarkMode={isDarkMode} /><CredentialCard label="Diploma" url={student.diploma_url} onOpen={onOpenFile} isDarkMode={isDarkMode} /><CredentialCard label="AF5 Form" url={student.af5_url} onOpen={onOpenFile} isDarkMode={isDarkMode} /></>)}
      {!isJHS && !isALS && (<div className="col-span-full p-6 bg-amber-50 border border-amber-100 rounded-3xl text-center"><p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Unknown Category: Manual Verification Required</p></div>)}
     </div>
    </div>
   </div>
  </div>
 )
})
StudentDossier.displayName = "StudentDossier"

const InfoBlock = memo(({ label, value, icon, isDarkMode }: { label: string, value: string, icon?: React.ReactNode, isDarkMode: boolean }) => {
 return (<div><ThemedText variant="label" className="mb-1" isDarkMode={isDarkMode}>{label}</ThemedText><ThemedText variant="body" className="font-bold flex items-center gap-2" isDarkMode={isDarkMode} style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>{icon}{value || "NOT PROVIDED"}</ThemedText></div>)
})
InfoBlock.displayName = "InfoBlock"

const CredentialCard = memo(({ label, url, onOpen, isDarkMode }: { label: string, url: string, onOpen: (url: string, label: string) => void, isDarkMode?: boolean }) => {
 if (!url) return (<div className={`p-4 rounded-2xl border border-dashed flex flex-col items-center justify-center opacity-50 h-32 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'}`}><FileText className="text-slate-400 mb-2" size={24} /><p className="text-[8px] font-black text-center uppercase text-slate-500 tracking-widest">{label}</p></div>);
 return (
  <div onClick={() => onOpen(url, label)} className="cursor-pointer group">
   <div className={`p-2 rounded-2xl border hover:border-blue-400 hover:shadow-xl transition-all h-full relative ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
    <div className={`h-28 rounded-xl overflow-hidden relative ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
     {url.toLowerCase().endsWith('.pdf') ? (<div className={`w-full h-full flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><FileText size={32} className="text-slate-400" /><p className="text-[8px] font-black uppercase text-slate-500 mt-2">PDF Document</p></div>) : (<img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />)}
     <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><ZoomIn className="text-white" size={20} /></div>
    </div>
    <p className={`text-[9px] font-black text-center mt-3 uppercase tracking-widest leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
   </div>
  </div>
 )
})
CredentialCard.displayName = "CredentialCard"

const StatusBadge = memo(({ status, isDarkMode }: { status: string, isDarkMode: boolean }) => {
  const styles: any = { Pending: isDarkMode ? "dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200", Accepted: isDarkMode ? "dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20" : "bg-green-50 text-green-600 border-green-200", Approved: isDarkMode ? "dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20" : "bg-green-50 text-green-600 border-green-200", Rejected: isDarkMode ? "dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-red-50 text-red-600 border-red-200" }
  return (<div className={`mt-6 px-6 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-[0.3em] w-fit ${styles[status]}`}>{status === 'Approved' ? 'Accepted' : status}</div>)
})

StatusBadge.displayName = "StatusBadge"