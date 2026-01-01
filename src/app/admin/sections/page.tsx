"use client"

import { useEffect, useState, useMemo, useCallback, memo, useRef, useLayoutEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { addSection, deleteAndCollapseSection } from "@/lib/actions/sections"
import { updateApplicantStatus, deleteApplicant, updateStudentSection } from "@/lib/actions/applicants"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { 
  Users2, Plus, Trash2, Loader2, Cpu, BookOpen, Layers, 
  ArrowLeft, Search, Eye, RefreshCcw, Check, User, Phone, 
  GraduationCap, ShieldCheck, ChevronDown, ChevronUp, FileDown, 
  MapPin, Mail, FileText, ScrollText, UserCircle2, Settings2, 
  Sparkles, Filter, AlertTriangle, RotateCw, Download, ExternalLink, RefreshCw, X, ZoomIn, Maximize2,
  UserMinus, CheckSquare, Square, ArrowRightLeft, Undo2, UserX, Trash
} from "lucide-react"
import { toast } from "sonner"
import { ThemedCard } from "@/components/ThemedCard"
import { ThemedText } from "@/components/ThemedText"
import { useTheme } from "@/hooks/useTheme"
import { themeColors } from "@/lib/themeColors"

// ===== MAIN COMPONENT =====
export default function SectionsPage() {
  const [config, setConfig] = useState<any>(null)
  const { isDarkMode: themeDarkMode } = useTheme()
  const [isDarkMode, setIsDarkMode] = useState(themeDarkMode)
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [strandFilter, setStrandFilter] = useState<"ALL" | "ICT" | "GAS">("ALL")
  
  const [sectionSelection, setSectionSelection] = useState<Set<string>>(new Set())
  const [confirmAdd, setConfirmAdd] = useState<{isOpen: boolean, strand: "ICT" | "GAS" | null}>({isOpen: false, strand: null})
  const [confirmDeleteSelect, setConfirmDeleteSelect] = useState(false)

  const [ictExpanded, setIctExpanded] = useState(true)
  const [gasExpanded, setGasExpanded] = useState(true)

  // ===== PERSISTENCE LOGIC =====
  useEffect(() => {
    // Restore Expanded State
    const savedIct = localStorage.getItem("section_ict_expanded")
    const savedGas = localStorage.getItem("section_gas_expanded")
    if (savedIct !== null) setIctExpanded(savedIct === "true")
    if (savedGas !== null) setGasExpanded(savedGas === "true")

    // Restore Scroll Position
    const savedScroll = sessionStorage.getItem("sections_scroll_pos")
    if (savedScroll) {
      setTimeout(() => window.scrollTo({ top: parseInt(savedScroll), behavior: 'instant' }), 100)
    }

    const handleScroll = () => {
      sessionStorage.setItem("sections_scroll_pos", window.scrollY.toString())
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => { localStorage.setItem("section_ict_expanded", ictExpanded.toString()) }, [ictExpanded])
  useEffect(() => { localStorage.setItem("section_gas_expanded", gasExpanded.toString()) }, [gasExpanded])

  // PERSISTENCE FOR FILTER TAB
  useEffect(() => {
    const savedFilter = localStorage.getItem("sections_strand_filter")
    if (savedFilter) setStrandFilter(savedFilter as any)
  }, [])

  useEffect(() => {
    localStorage.setItem("sections_strand_filter", strandFilter)
  }, [strandFilter])

  const [exitingRows, setExitingRows] = useState<Record<string, boolean>>({})
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set())
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const prevStudentIdsRef = useRef<Set<string>>(new Set())
  const prevStudentsMapRef = useRef<Map<string, any>>(new Map())
  const [ghostStudents, setGhostStudents] = useState<any[]>([])
  const prevSectionRef = useRef<string | null>(null)

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewingFile, setViewingFile] = useState<{url: string, label: string} | null>(null)
  const [rotation, setRotation] = useState(0)

  const [unenrollOpen, setUnenrollOpen] = useState(false)
  const [activeUnenrollStudent, setActiveUnenrollStudent] = useState<any>(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<any>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<string>('Initializing...')
  const [lastUpdate, setLastUpdate] = useState<string>('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const saved = localStorage.getItem("registrar_active_matrix")
    if (saved) setSelectedSectionName(saved)
  }, [])

  useEffect(() => {
    if (selectedSectionName) localStorage.setItem("registrar_active_matrix", selectedSectionName)
    else localStorage.removeItem("registrar_active_matrix")
  }, [selectedSectionName])

  useEffect(() => {
    setHiddenRows(new Set())
    setExitingRows({})
    setGhostStudents([])
  }, [selectedSectionName])

  useEffect(() => {
    setExitingRows({})
  }, [sections])
  

  const handleExit = useCallback((id: string, callback: () => void) => {
    setExitingRows(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setHiddenRows(prev => { const next = new Set(prev); next.add(id); return next })
      callback()
    }, 300)
  }, [])

  const handleOpenFile = useCallback((url: string, label: string) => {
    setViewingFile({ url, label })
    setRotation(0)
    setViewerOpen(true)
  }, [])

  const handleViewProfile = useCallback((student: any) => {
    setActiveProfile(student)
    setProfileOpen(true)
  }, [])

  const handleUnenroll = useCallback((student: any) => {
    setActiveUnenrollStudent(student)
    setUnenrollOpen(true)
  }, [])

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

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('system_config').select('*').single()
      if (error) throw error
      setConfig(data)
    } catch (err) {
      console.error("Config fetch error:", err)
    }
  }, [])

  const fetchSections = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    console.log(`🔄 Fetching sections... (background: ${isBackground})`)
    
    try {
      const { data, error } = await supabase
        .from('sections')
        .select(`*, students ( * )`)
        .order('section_name', { ascending: true })
  
      if (error) throw error
      
      // Reduced logging for performance
      
      setSections(data || [])
    } catch (err) {
      console.error("❌ Sync Error:", err)
      if (!isBackground) toast.error("Registrar Sync Error")
    } finally {
      if (!isBackground) setLoading(false)
    }
  }, [])

  // ===== REAL-TIME SUBSCRIPTIONS (OPTIMIZED) =====
// Replace the entire useEffect block that handles real-time subscriptions
// (around line 185-250 in your original code)

 // COMPLETE REPLACEMENT for the real-time useEffect in sections/page.tsx
// Replace EVERYTHING from line ~185 to ~250

  useEffect(() => { 
    fetchSections() 
    fetchConfig()
    
    const channel = supabase
      .channel('sections_realtime_complete')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'students' 
      }, (payload) => {
        console.log('🔔 Students table change:', payload.eventType, payload)
        setRealtimeStatus(`🔄 ${payload.eventType}`)
        setLastUpdate(new Date().toLocaleTimeString())
        fetchSections(true)
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sections' 
      }, (payload) => {
        console.log('🔔 Sections table change:', payload.eventType, payload)
        setRealtimeStatus(`📋 Section ${payload.eventType}`)
        setLastUpdate(new Date().toLocaleTimeString())
        fetchSections(true)
      })
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time updates ACTIVE!')
          setRealtimeStatus('🟢 Live')
          setLastUpdate(new Date().toLocaleTimeString())
        } else if (status === 'CHANNEL_ERROR') {
          setRealtimeStatus('🔴 Error')
          setTimeout(() => fetchSections(true), 2000)
        } else if (status === 'TIMED_OUT') {
          setRealtimeStatus('⏱️ Timeout')
          setTimeout(() => fetchSections(true), 2000)
        } else {
          setRealtimeStatus(`⚠️ ${status}`)
        }
      })

    return () => { 
      console.log('🧹 Cleaning up subscription')
      supabase.removeChannel(channel) 
    }
  }, [fetchConfig, fetchSections])

  const ictSections = useMemo(() => sections.filter(s => s.strand === 'ICT'), [sections])
  const gasSections = useMemo(() => sections.filter(s => s.strand === 'GAS'), [sections])

  const calculateStrandLoad = useCallback((strandSections: any[]) => {
    const totalCapacity = strandSections.reduce((acc, s) => acc + (s.capacity || 40), 0)
    const totalEnrolled = strandSections.reduce((acc, s) => {
      const active = s.students?.filter((st: any) => st.status === 'Accepted' || st.status === 'Approved').length || 0
      return acc + active
    }, 0)
    return { totalCapacity, totalEnrolled, percent: totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0 }
  }, [])

  const ictLoad = useMemo(() => calculateStrandLoad(ictSections), [ictSections, calculateStrandLoad])
  const gasLoad = useMemo(() => calculateStrandLoad(gasSections), [gasSections, calculateStrandLoad])

  const currentSection = useMemo(() => {
    const section = sections.find(s => s.section_name === selectedSectionName)
    console.log(`🔍 Current section "${selectedSectionName}":`, section?.students?.length || 0, 'students')
    return section
  }, [sections, selectedSectionName])
  
  
  const activeStudents = useMemo(() => {
    if (!currentSection?.students) return []
    
    const filtered = currentSection.students.filter((s: any) => {
      const isActive = s.status === 'Accepted' || s.status === 'Approved'
      return isActive
    })
    
    console.log(`📊 Active students in ${selectedSectionName}:`, filtered.length)
    return filtered
  }, [currentSection?.students, selectedSectionName])

  // ===== ENTRANCE ANIMATION TRIGGER =====
  useLayoutEffect(() => {
    if (!selectedSectionName) {
      prevStudentIdsRef.current = new Set()
      prevSectionRef.current = null
      prevStudentsMapRef.current = new Map()
      setGhostStudents([])
      return
    }
  
    // If section changed, reset tracking
    if (selectedSectionName !== prevSectionRef.current) {
      prevSectionRef.current = selectedSectionName
      prevStudentIdsRef.current = new Set(activeStudents.map((s: any) => s.id))
      prevStudentsMapRef.current = new Map(activeStudents.map((s: any) => [s.id, s]))
      setGhostStudents([])
      return
    }
  
    const currentIds = new Set(activeStudents.map((s: any) => s.id))
    const currentMap = new Map(activeStudents.map((s: any) => [s.id, s]))
    
    // 1. Find NEW students (entrance animation)
    const newIds = activeStudents
      .filter((s: any) => !prevStudentIdsRef.current.has(s.id))
      .map((s: any) => s.id)
  
    if (newIds.length > 0) {
      console.log('✨ Animating ENTRANCE for:', newIds.length, 'students')
      
      setHiddenRows(prev => {
        const next = new Set(prev)
        newIds.forEach((id: string) => next.delete(id))
        return next
      })
      
      setExitingRows(prev => {
        const next = { ...prev }
        newIds.forEach((id: string) => delete next[id])
        return next
      })
      
      setAnimatingIds(prev => {
        const next = new Set(prev)
        newIds.forEach((id: string) => next.add(id))
        return next
      })
      
      setTimeout(() => {
        setAnimatingIds(prev => {
          const next = new Set(prev)
          newIds.forEach((id: string) => next.delete(id))
          return next
        })
      }, 500)
    }
    
    // 2. Find REMOVED students (exit animation) - NEW!
    const removedStudents: any[] = []
    prevStudentsMapRef.current.forEach((s, id) => {
      if (!currentIds.has(id)) {
        removedStudents.push(s)
      }
    })
  
    if (removedStudents.length > 0) {
      console.log('🚪 Animating EXIT for:', removedStudents.length, 'students')
      
      // Add to ghosts to keep them visible during animation
      setGhostStudents(prev => [...prev, ...removedStudents])
      
      // Trigger exit animation
      setExitingRows(prev => {
        const next = { ...prev }
        removedStudents.forEach((s: any) => { next[s.id] = true })
        return next
      })
      
      // After animation completes, remove from ghosts
      setTimeout(() => {
        setGhostStudents(prev => prev.filter(g => !removedStudents.find(r => r.id === g.id)))
        
        // Clean up exiting state
        setExitingRows(prev => {
          const next = { ...prev }
          removedStudents.forEach((s: any) => { delete next[s.id] })
          return next
        })
      }, 300) // Match the animation duration
    }
    
    // Update tracking for next render
    prevStudentIdsRef.current = new Set(activeStudents.map((s: any) => s.id))
    prevStudentsMapRef.current = new Map(activeStudents.map((s: any) => [s.id, s]))
  }, [activeStudents, selectedSectionName])

  const initiateAdd = useCallback((strand: "ICT" | "GAS") => {
    setConfirmAdd({ isOpen: true, strand })
  }, [])

  const executeAdd = useCallback(async () => {
    if (!confirmAdd.strand) return
    setIsProcessing(true)
    try {
      const result = await addSection(confirmAdd.strand)
      toast.success(`Generated ${result.name}`)
      
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'APPROVED',
        student_name: 'N/A',
        details: `Created new ${confirmAdd.strand} section: ${result.name}`
      }])

      setConfirmAdd({ isOpen: false, strand: null })
      await fetchSections()
    } catch (err: any) { 
      toast.error(err.message) 
    } finally { 
      setIsProcessing(false) 
    }
  }, [confirmAdd.strand, fetchSections])

  const toggleSelection = useCallback((id: string) => {
    setSectionSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((ids: string[]) => {
    setSectionSelection(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => prev.has(id))
      
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }, [])

  const executeBulkDelete = useCallback(async () => {
    setConfirmDeleteSelect(false)
    setIsProcessing(true)
    try {
      const targets = sections.filter(s => sectionSelection.has(s.id))
      for (const t of targets) {
        await deleteAndCollapseSection(t.id, t.strand)
      }
      
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'DELETED',
        student_name: 'N/A',
        details: `Bulk deleted ${targets.length} section matrices`
      }])

      toast.success(`Removed ${targets.length} matrices.`)
      setSectionSelection(new Set())
      await fetchSections()
    } catch (e) { 
      toast.error("Bulk delete failed") 
    } finally { 
      setIsProcessing(false) 
    }
  }, [sectionSelection, sections, fetchSections])

  const handleDeleteSection = useCallback(async (id: string, name: string, strand: "ICT" | "GAS") => {
    if (!confirm(`WARNING: Deleting ${name} shifts matrix sequence. Proceed?`)) return
    setIsProcessing(true)
    try {
      await deleteAndCollapseSection(id, strand)
      
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'DELETED',
        student_name: 'N/A',
        details: `Deleted section matrix: ${name} (${strand})`
      }])

      toast.success(`Matrix Sequence Updated.`)
      await fetchSections()
    } catch (err: any) { 
      toast.error(err.message) 
    } finally { 
      setIsProcessing(false) 
    }
  }, [fetchSections])

  const handleClearAllStudents = useCallback(async () => {
    const confirmName = prompt("Type 'DELETE ALL' to PERMANENTLY wipe the student database.")
    if (confirmName !== "DELETE ALL") return
    setIsProcessing(true)
    try {
      const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
      
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'DELETED',
        student_name: 'ALL STUDENTS',
        details: "Executed complete registry wipe (Factory Reset)"
      }])

      toast.success("Student database purged.")
      await fetchSections()
    } catch (err: any) { 
      toast.error(err.message) 
    } finally { 
      setIsProcessing(false) 
    }
  }, [fetchSections])

  const handleReturnToPending = useCallback(async (id: string, name: string) => {
    try {
      await updateApplicantStatus(id, 'Pending')
      
      const { data: { user } } = await supabase.auth.getUser()
      const student = sections.flatMap(s => s.students).find((s: any) => s.id === id)
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'PENDING',
        student_name: name,
        student_id: id,
        student_image: student?.two_by_two_url || student?.profile_2x2_url,
        details: "Student Returned to Pending"
      }])

      toast.success(`${name} returned to Pending queue.`)
      fetchSections()
    } catch (err) { 
      toast.error("Action failed") 
    }
  }, [sections, fetchSections])

  const handleConfirmUnenroll = useCallback(async () => {
    if (!activeUnenrollStudent) return
    setUnenrollOpen(false)
    
    handleExit(activeUnenrollStudent.id, async () => {
      const toastId = toast.loading(`Purging ${activeUnenrollStudent.first_name}...`)
      try {
        const result = await deleteApplicant(activeUnenrollStudent.id)
        if (result.success) {
          const { data: { user } } = await supabase.auth.getUser()
          await supabase.from('activity_logs').insert([{
            admin_id: user?.id,
            admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
            action_type: 'DELETED',
            student_name: `${activeUnenrollStudent.first_name} ${activeUnenrollStudent.last_name}`,
            student_id: null,
            student_image: activeUnenrollStudent.two_by_two_url || activeUnenrollStudent.profile_2x2_url,
            details: "Deleted from the list"
          }])

          toast.success(`Record Erased Successfully`, { id: toastId })
          setActiveUnenrollStudent(null)
          fetchSections()
        }
      } catch (err) { 
        toast.error("Database purge failed") 
      }
    })
  }, [activeUnenrollStudent, fetchSections, handleExit])

  const handleSwitch = useCallback(async (id: string, newSectionName: string) => {
    try {
      const targetSec = sections.find(s => s.section_name === newSectionName)
      if (!targetSec) return
      await updateStudentSection(id, targetSec.id)
      
      const { data: { user } } = await supabase.auth.getUser()
      const student = sections.flatMap(s => s.students).find((s: any) => s.id === id)
      await supabase.from('activity_logs').insert([{
        admin_id: user?.id,
        admin_name: user?.user_metadata?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Authorized Admin',
        action_type: 'SWITCHED',
        student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
        student_id: id,
        student_image: student?.two_by_two_url || student?.profile_2x2_url,
        details: `Transferred to matrix ${newSectionName}`
      }])

      toast.success(`Moved to ${newSectionName}`)
      fetchSections()
    } catch (err) { 
      toast.error("Transfer failed") 
    }
  }, [sections, fetchSections])

  const exportSectionCSV = useCallback((sectionName: string, students: any[]) => {
    const headers = ["FULL NAME", "LRN", "GENDER", "STRAND", "EMAIL", "ADDRESS"]
    const rows = students.map(s => [
      `${s.last_name.toUpperCase()}, ${s.first_name.toUpperCase()} ${s.middle_name?.[0] || ''}.`,
      `'${s.lrn}`,
      s.gender,
      s.strand,
      s.email,
      `"${s.address}"`
    ])
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Masterlist_${sectionName}.csv`
    link.click()
  }, [])

  if (loading && sections.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
      <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      <p className="text-[10px] font-black uppercase tracking-widest text-center">Syncing Class Matrices...</p>
    </div>
  )

  return (
    <div className="relative min-h-screen [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-colors duration-500 overflow-x-hidden max-w-[100vw]">
      <style jsx global>{`
        body { overflow-y: auto; }
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* REAL-TIME STATUS INDICATOR */}
      <div className="fixed bottom-4 right-4 z-50">
        <div 
          className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${realtimeStatus.includes('🟢') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{realtimeStatus}</span>
          </div>
          {lastUpdate && (
            <>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-[9px] font-bold text-slate-400">{lastUpdate}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="space-y-6 md:space-y-12 animate-in fade-in duration-700 pb-20 relative z-10 w-full overflow-x-hidden">
      
      {selectedSectionName ? (() => {
        if (!currentSection) return (
           <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">Locating Section Matrix...</p>
           </div>
        )

        const activeIds = new Set(activeStudents.map((s: any) => s.id))
        const uniqueGhosts = ghostStudents.filter(g => !activeIds.has(g.id))
        const sortedStudents = [...activeStudents, ...uniqueGhosts].sort((a, b) => a.last_name.localeCompare(b.last_name))
        const mCount = activeStudents.filter((s: any) => s.gender === 'Male').length
        const fCount = activeStudents.filter((s: any) => s.gender === 'Female').length
        const capacity = currentSection.capacity || 40
        const fillPercent = (activeStudents.length / capacity) * 100

        return (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedSectionName(null)} 
                className="rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
              >
                <ArrowLeft className="mr-2" size={16}/> Back to Registry
              </Button>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button 
                  onClick={() => fetchSections(false)} 
                  variant="ghost" 
                  className="h-12 w-12 p-0 rounded-2xl text-slate-400 hover:text-blue-600 transition-all"
                >
                  <RefreshCw className={loading ? "animate-spin" : ""} size={20}/>
                </Button>
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search Class List..." 
                    className="pl-10 rounded-2xl h-12 font-bold placeholder:text-slate-400 focus-visible:ring-blue-500" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '#ffffff', 
                      borderColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(203 213 225)', 
                      color: isDarkMode ? '#ffffff' : '#000000' 
                    }}
                  />                
                </div>
                <Button 
                  onClick={() => exportSectionCSV(selectedSectionName, sortedStudents)} 
                  className="rounded-2xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest h-12 px-6 hover:bg-blue-600 shadow-xl transition-all"
                >
                  <FileDown size={14} className="mr-2" /> Export Masterlist
                </Button>
              </div>
            </div>

            <div className="bg-blue-600 dark:bg-slate-900 p-4 md:p-12 rounded-[24px] md:rounded-[48px] text-white relative overflow-hidden shadow-2xl border border-white/5">
              <div className={`absolute top-0 right-0 w-96 h-96 blur-[100px] opacity-20 rounded-full ${currentSection.strand === 'ICT' ? 'bg-blue-500' : 'bg-orange-500'}`} />
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
                 <div>
                    <h1 className="text-xl md:text-5xl lg:text-7xl font-black tracking-tighter uppercase leading-none break-words">{selectedSectionName}</h1>
                    <div className="flex items-center gap-4 mt-6">
                       <Badge className="bg-white/10 text-white border-white/10 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">{currentSection.strand} Section</Badge>
                       <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest italic opacity-80">AMA ACLC S.Y. {config?.school_year || "UNSET"} Admissions</p>
                    </div>
                 </div>
                 <div className="bg-white/5 backdrop-blur-md p-8 rounded-[32px] border border-white/10">
                    <div className="flex justify-between items-end mb-4">
                       <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Classroom Progress</p>
                        <p className="text-3xl font-black mt-1">{activeStudents.length} <span className="text-slate-500 text-lg">/ {capacity} Seats</span></p>
                       </div>
                       <p className="text-xl font-black text-white">{Math.round(fillPercent)}%</p>
                    </div>
                    <Progress value={fillPercent} className="h-3 bg-white/10 [&>div]:bg-blue-500" />
                 </div>
              </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
            <TabsList 
              className="p-1.5 rounded-[24px] mb-8 border w-full md:w-fit flex items-center gap-1 overflow-x-auto" 
              style={{ 
                backgroundColor: isDarkMode ? 'rgb(15 23 42)' : 'rgb(226 232 240)', 
                borderColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(203 213 225)' 
              }}
            >                
              <TabsTrigger value="all" className="rounded-[20px] px-4 md:px-10 font-black uppercase text-[10px] tracking-widest text-black dark:text-slate-400 data-[state=active]:!bg-slate-900 dark:data-[state=active]:!bg-slate-800 data-[state=active]:!text-white dark:data-[state=active]:!text-white whitespace-nowrap">
                <span className="hidden md:inline">All ({activeStudents.length})</span>
                <span className="md:hidden flex items-center gap-1"><Users2 size={14} /> {activeStudents.length}</span>
              </TabsTrigger>
              <TabsTrigger value="males" className="rounded-[20px] px-4 md:px-10 font-black uppercase text-[10px] tracking-widest text-black dark:text-slate-400 data-[state=active]:!bg-slate-900 dark:data-[state=active]:!bg-slate-800 data-[state=active]:!text-white dark:data-[state=active]:!text-blue-400 whitespace-nowrap">
                <span className="hidden md:inline">Males ({mCount})</span>
                <span className="md:hidden flex items-center gap-1">♂ {mCount}</span>
              </TabsTrigger>
              <TabsTrigger value="females" className="rounded-[20px] px-4 md:px-10 font-black uppercase text-[10px] tracking-widest text-black dark:text-slate-400 data-[state=active]:!bg-slate-900 dark:data-[state=active]:!bg-slate-800 data-[state=active]:!text-white dark:data-[state=active]:!text-pink-400 whitespace-nowrap">
                <span className="hidden md:inline">Females ({fCount})</span>
                <span className="md:hidden flex items-center gap-1">♀ {fCount}</span>
              </TabsTrigger>
              <div className="w-px h-4 mx-2 opacity-50" style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(203 213 225)' }} />
              <Button 
                variant="ghost" 
                onClick={() => setSelectedSectionName(null)} 
                className="rounded-[20px] px-3 md:px-6 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
              >
                <ArrowLeft size={14} className="md:mr-2"/>
                <span className="hidden md:inline">Back to Registry</span>
              </Button>
            </TabsList>
              {['all', 'males', 'females'].map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <StudentTable 
                    students={sortedStudents.filter(s => {
                      const match = `${s.first_name} ${s.last_name}`.toLowerCase().includes(debouncedSearch.toLowerCase())
                      if (tab === 'all') return match
                      return match && s.gender === (tab === 'males' ? 'Male' : 'Female')
                      // Use trim() to handle potential whitespace issues in database
                      return match && s.gender?.trim() === (tab === 'males' ? 'Male' : 'Female')
                    })} 
                    onReturn={handleReturnToPending} 
                    onUnenroll={handleUnenroll}
                    onSwitch={handleSwitch} 
                    allSections={sections.filter(s => s.strand === currentSection.strand)}
                    onOpenFile={handleOpenFile}
                    onViewProfile={handleViewProfile}
                    isDarkMode={isDarkMode}
                    exitingRows={exitingRows}
                    hiddenRows={hiddenRows}
                    handleExit={handleExit}
                    animatingIds={animatingIds}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )
      })() : (
        <>
          <ThemedCard 
            className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 p-6 md:p-10 rounded-[48px] backdrop-blur-sm shadow-lg border transition-colors duration-500"
            style={{
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'
            }}
          >
            <div className="space-y-3">
              <ThemedText variant="h1" className="text-4xl md:text-5xl font-black tracking-tight" isDarkMode={isDarkMode}>
                School Units
              </ThemedText>
              <ThemedText variant="body" className="text-base font-medium opacity-70" isDarkMode={isDarkMode}>
                Managing AMA ACLC Northbay Enrollment Distribution
              </ThemedText>
            </div>
            <div 
              className="flex p-2 rounded-[24px] border shadow-inner transition-all duration-300"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'
              }}
            >
               <FilterButton 
                 label="All" 
                 active={strandFilter === 'ALL'} 
                 onClick={() => setStrandFilter('ALL')} 
                 icon={<Layers size={16}/>} 
                 type="ALL" 
                 isDarkMode={isDarkMode} 
               />
               <FilterButton 
                 label="ICT" 
                 active={strandFilter === 'ICT'} 
                 onClick={() => setStrandFilter('ICT')} 
                 icon={<Cpu size={16}/>} 
                 type="ICT" 
                 isDarkMode={isDarkMode} 
               />
               <FilterButton 
                 label="GAS" 
                 active={strandFilter === 'GAS'} 
                 onClick={() => setStrandFilter('GAS')} 
                 icon={<BookOpen size={16}/>} 
                 type="GAS" 
                 isDarkMode={isDarkMode} 
               />
            </div>
            <div className="flex flex-wrap gap-4">
              {sectionSelection.size > 0 && (
                 <Button 
                   onClick={() => setConfirmDeleteSelect(true)} 
                   variant="destructive" 
                   className="rounded-2xl h-12 px-6 font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-100 transition-all animate-in fade-in zoom-in"
                 >
                    <Trash className="mr-2" size={18}/> Delete ({sectionSelection.size})
                 </Button>
              )}
              <DeleteManagementDialog 
                sections={sections} 
                onDelete={handleDeleteSection} 
                onClearStudents={handleClearAllStudents} 
                isDarkMode={isDarkMode} 
              />
              <Button 
                onClick={() => initiateAdd('ICT')} 
                disabled={isProcessing} 
                className="rounded-2xl bg-blue-600 hover:bg-blue-700 h-12 px-6 font-bold uppercase text-xs tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Plus className="mr-2" size={18}/> Add ICT Section
              </Button>
              <Button 
                onClick={() => initiateAdd('GAS')} 
                disabled={isProcessing} 
                className="rounded-2xl bg-orange-600 hover:bg-orange-700 h-12 px-6 font-bold uppercase text-xs tracking-wider shadow-lg shadow-orange-500/20 transition-all active:scale-95"
              >
                <Plus className="mr-2" size={18}/> Add GAS Section
              </Button>
            </div>
          </ThemedCard>
          
          
          {['ICT', 'GAS'].map(strand => (strandFilter === 'ALL' || strandFilter === strand) && (
            <SectionGroup 
              key={strand} 
              title={strand === 'ICT' ? "Information Technology" : "General Academics"}
              mobileTitle={strand === 'ICT' ? "ICT Program" : "GAS Program"}
              icon={strand === 'ICT' ? <Cpu/> : <BookOpen/>} 
              color={strand === 'ICT' ? 'blue' : 'orange'} 
              sections={strand === 'ICT' ? ictSections : gasSections} 
              load={strand === 'ICT' ? ictLoad : gasLoad} 
              onSelect={setSelectedSectionName} 
              onDelete={handleDeleteSection} 
              isExpanded={strand === 'ICT' ? ictExpanded : gasExpanded} 
              onToggle={strand === 'ICT' ? () => setIctExpanded(!ictExpanded) : () => setGasExpanded(!gasExpanded)}
              selection={sectionSelection}
              onToggleSelect={toggleSelection}
              onSelectAll={handleSelectAll}
              isDarkMode={isDarkMode}
              config={config}
            />
          ))}
        </>
      )}

      {/* GLOBAL DOCUMENT VIEWER */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] md:h-[95vh] p-0 rounded-[32px] md:rounded-[40px] overflow-hidden border-none shadow-2xl bg-slate-950/95 flex flex-col z-[10000]">
          <div className="p-6 bg-slate-900 border-b border-white/5 flex items-center justify-between shrink-0">
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Registrar Inspection Matrix</p>
              <DialogTitle className="text-white font-black uppercase text-xl leading-none">{viewingFile?.label}</DialogTitle>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setRotation(r => (r + 90) % 360)} 
                className="rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <RotateCw size={20}/>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => window.open(viewingFile?.url, '_blank')} 
                className="rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <Download size={20}/>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewerOpen(false)} 
                className="rounded-full bg-red-500 hover:bg-red-600 text-white"
              >
                <X size={20}/>
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full h-full flex items-center justify-center p-12 overflow-auto custom-scrollbar bg-grid-white/[0.02]">
            {viewingFile?.url.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={viewingFile.url} 
                className="w-full h-full rounded-2xl bg-white border-none" 
                title="PDF Viewer" 
              />
            ) : (
              <div 
                className="relative group cursor-zoom-in transition-transform duration-300" 
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <img 
                  src={viewingFile?.url} 
                  alt="Inspection" 
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500" 
                />
              </div>
            )}
          </div>
          <div className="p-6 bg-slate-900/50 backdrop-blur-xl border-t border-white/5 flex items-center justify-center shrink-0">
             <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-[9px] tracking-widest">
                 <Maximize2 size={12}/> High Fidelity Rendering
               </div>
               <div className="w-[1px] h-4 bg-white/10" />
               <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest italic text-center">
                 Rotate and Maximize for precise verification
               </p>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GLOBAL UNENROLL MODAL */}
      <Dialog open={unenrollOpen} onOpenChange={setUnenrollOpen}>
        <DialogContent 
          className="w-[95vw] md:w-full max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl z-[10000] transition-colors duration-500"
          style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
        >
          <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 flex items-center gap-4 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/10 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div className="relative z-10">
              <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none text-white drop-shadow-sm">Confirm Purge</DialogTitle>
              <DialogDescription className="text-red-100 text-xs mt-1 font-medium italic opacity-90">Permanent Database Deletion</DialogDescription>
            </div>
          </div>

          <div className="p-8 space-y-6 text-center">
             <div className={`p-6 rounded-[32px] border ${isDarkMode ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-sm font-bold leading-relaxed ${isDarkMode ? 'text-red-200' : 'text-red-900'}`}>
                  Are you sure you want to permanently erase <br/>
                  <span className="text-lg uppercase font-black underline decoration-2">
                    {activeUnenrollStudent?.last_name}, {activeUnenrollStudent?.first_name}
                  </span>?
                </p>
                <p className="text-[10px] font-black uppercase text-red-500 mt-4 tracking-widest">
                  Student data will be removed from all matrices.
                </p>
             </div>
             <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button 
                  onClick={handleConfirmUnenroll} 
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Execute Database Purge
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setUnenrollOpen(false)} 
                  className="w-full h-12 rounded-2xl text-slate-400 font-black uppercase text-[10px]"
                >
                  Cancel
                </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* GLOBAL PROFILE MODAL */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent 
          className="w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] md:rounded-[48px] p-0 border-none shadow-2xl transition-colors duration-500 [&>button]:text-red-500"
          style={{ backgroundColor: isDarkMode ? themeColors.dark.background : themeColors.light.background }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Identity Profile</DialogTitle>
          </DialogHeader>
          {activeProfile && (
            <StudentDossier 
              student={activeProfile} 
              onOpenFile={handleOpenFile} 
              isDarkMode={isDarkMode} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ADD CONFIRMATION MODAL */}
      <Dialog 
        open={confirmAdd.isOpen} 
        onOpenChange={(open) => !open && setConfirmAdd({ ...confirmAdd, isOpen: false })}
      >
        <DialogContent 
          className="w-[95vw] md:w-full max-w-sm rounded-[32px] p-8 border-none shadow-2xl transition-colors duration-500"
          style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
        >
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                Create New Matrix?
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">
                 Adding a new {confirmAdd.strand} section will expand the total capacity.
              </DialogDescription>
           </DialogHeader>
           <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button 
                onClick={() => setConfirmAdd({ ...confirmAdd, isOpen: false })} 
                variant="ghost" 
                className="rounded-xl font-black uppercase text-[10px] text-slate-400"
              >
                Cancel
              </Button>
              <Button 
                onClick={executeAdd} 
                className="rounded-xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-6"
              >
                Confirm Creation
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <Dialog open={confirmDeleteSelect} onOpenChange={setConfirmDeleteSelect}>
         <DialogContent 
            className="w-[95vw] md:w-full max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500"
            style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
         >
            <div className="bg-red-600 p-8 text-white">
              <DialogTitle className="text-xl font-black uppercase">
                Delete {sectionSelection.size} Matrices?
              </DialogTitle>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="p-8 space-y-6">
               <p className="text-sm font-bold text-slate-600">
                 You are about to delete <span className="text-red-600">{sectionSelection.size}</span> sections. 
                 This will shift the sequence of remaining sections.
               </p>
               <div className="flex gap-3">
                 <Button 
                   onClick={() => setConfirmDeleteSelect(false)} 
                   variant="ghost" 
                   className="flex-1 rounded-xl font-black uppercase text-[10px]"
                 >
                   Cancel
                 </Button>
                 <Button 
                   onClick={executeBulkDelete} 
                   className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px]"
                 >
                   Confirm Delete
                 </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>

      {isProcessing && <ProcessingOverlay />}
    </div>
    </div>
  )
}

// ===== FILTER BUTTON =====
const FilterButton = memo(function FilterButton({ label, active, onClick, icon, type, isDarkMode }: any) {
  const hoverClass = type === 'ICT' ? 'hover:bg-blue-100 hover:text-blue-600' : 
                     type === 'GAS' ? 'hover:bg-orange-100 hover:text-orange-600' : 'hover:text-slate-600'
  
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-6 py-2.5 rounded-[18px] font-black uppercase text-[10px] tracking-widest transition-[background-color,color,transform,box-shadow] duration-300 ${
        active 
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md scale-105' 
          : `text-slate-600 dark:text-slate-400 ${hoverClass}`
      }`}
    >
      {icon} {label}
    </button>
  )
})

// ===== STUDENT TABLE =====
const StudentTable = memo(function StudentTable({ 
  students, 
  onReturn, 
  onUnenroll, 
  onSwitch, 
  allSections, 
  onOpenFile, 
  onViewProfile, 
  isDarkMode, 
  exitingRows, 
  hiddenRows, 
  handleExit, 
  animatingIds 
}: any) {
  return (
    <>
      {/* Mobile Card View - Compact & Optimized (Applicants Style) */}
      {/* Mobile Card View - Compact & Optimized (Applicants Style) */}
      <div className="md:hidden space-y-3 px-2 max-w-md mx-auto">
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50">
            <UserX size={48} strokeWidth={1} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No Records Found</p>
          </div>
        ) : (
          students.map((s: any) => {
            if (hiddenRows.has(s.id)) return null
            const isAnimatingIn = animatingIds?.has(s.id)
            const isMale = s.gender === 'Male'
            
            return (
              <div 
                key={s.id}
                className={`rounded-2xl p-4 border relative transition-all duration-300 ${
                  isMale 
                    ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' 
                    : 'bg-pink-50/50 border-pink-100 dark:bg-pink-900/10 dark:border-pink-900/30'
                } ${exitingRows[s.id] ? 'animate-out slide-out-to-right fade-out duration-300' : ''} ${isAnimatingIn ? 'animate-in slide-in-from-right fade-in duration-500' : ''}`}
                onClick={() => onViewProfile(s)}
              >
                <div className="flex items-start gap-3">
                    <div className={`w-14 h-14 rounded-xl shrink-0 overflow-hidden border-2 ${isMale ? 'border-blue-200' : 'border-pink-200'}`}>
                      <img 
                        src={s.two_by_two_url || s.profile_2x2_url || s.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${s.last_name}`} 
                        className="w-full h-full object-cover" 
                        alt="Profile" 
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className={`font-black text-sm uppercase leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {s.last_name}, {s.first_name}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">LRN: {s.lrn}</p>
                          </div>
                          <Badge variant="outline" className={`text-[8px] font-black uppercase px-2 py-0.5 shrink-0 ${isMale ? 'text-blue-500 border-blue-200' : 'text-pink-500 border-pink-200'}`}>
                            {s.gender}
                          </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className={`px-2 py-1.5 rounded-lg text-center border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                            <p className="text-[8px] font-black uppercase text-slate-400">Category</p>
                            <p className={`text-[10px] font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{s.student_category || "Reg"}</p>
                          </div>
                          <div className={`px-2 py-1.5 rounded-lg text-center border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                            <p className="text-[8px] font-black uppercase text-slate-400">GWA</p>
                            <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{s.gwa_grade_10 || "N/A"}</p>
                          </div>
                      </div>
                    </div>
                </div>
                
                {/* Compact Action Bar */}
                <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200/50'}`}>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={(e) => {e.stopPropagation(); handleExit(s.id, () => onReturn(s.id, s.first_name))}} 
                      className="flex-1 h-9 rounded-lg text-[9px] font-black uppercase text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-2"
                    >
                      <Undo2 size={12} className="mr-1"/> Return
                    </Button>
                    <div onClick={(e) => e.stopPropagation()} className="flex-1">
                      <SwitchDialog 
                        student={s} 
                        allSections={allSections} 
                        onSwitch={(id: string, target: string) => handleExit(id, () => onSwitch(id, target))} 
                        isDarkMode={isDarkMode} 
                        className="w-full h-9 text-[9px] rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 justify-center text-blue-500 font-black uppercase px-2" 
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={(e) => {e.stopPropagation(); onUnenroll(s)}} 
                      className="h-9 w-9 p-0 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                    >
                      <UserX size={14} />
                    </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div 
        className="hidden md:block rounded-[48px] border overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-x-auto transition-all duration-500" 
        style={{ 
          backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '#ffffff', 
          borderColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(241 245 249)' 
        }}
      >
        <Table className="border-separate border-spacing-y-6 px-6">
        <TableHeader 
          className="transition-colors duration-500" 
          style={{ backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#ffffff' }}
        >
           <TableRow className="border-none hover:bg-transparent">
              <TableHead 
                className="px-10 py-6 font-black uppercase text-[10px] tracking-widest" 
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
              >
                Full Matrix Identity
              </TableHead>
              <TableHead 
                className="px-6 py-6 font-black uppercase text-[10px] tracking-widest text-center" 
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
              >
                Gender
              </TableHead>
              <TableHead 
                className="px-6 py-6 font-black uppercase text-[10px] tracking-widest text-center" 
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
              >
                Identity
              </TableHead>
              <TableHead 
                className="text-right px-10 font-black uppercase text-[10px] tracking-widest" 
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
              >
                Actions
              </TableHead>
           </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-32 text-slate-300 italic font-medium">
                No records found for this segment.
              </TableCell>
            </TableRow>
          ) : (
            students.map((s: any) => {
              if (hiddenRows.has(s.id)) return null
              const isAnimatingIn = animatingIds?.has(s.id)
              
              return (
                <TableRow 
                  key={s.id} 
                  className={`border-b border-slate-300 dark:border-slate-700 group transition-colors duration-300 relative hover:shadow-sm will-change-transform ${
                    s.gender === 'Male' ? 'hover:bg-blue-200 dark:hover:bg-blue-900/40' : 'hover:bg-pink-200 dark:hover:bg-pink-900/40'
                  } ${exitingRows[s.id] ? 'animate-out slide-out-to-right-8 fade-out zoom-out-95 duration-300 pointer-events-none' : ''} ${
                    isAnimatingIn ? 'animate-in slide-in-from-right fade-in duration-500' : ''
                  }`}
                  style={exitingRows[s.id] ? { animationFillMode: 'forwards' } : undefined}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = s.gender === 'Male' ? 'rgb(191 219 254 / 0.6)' : 'rgb(251 207 232 / 0.6)'
                    e.currentTarget.style.transition = 'background-color 0.2s ease'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ''
                  }}
                >
                  <TableCell className="px-10 py-6 min-w-[350px] relative cursor-pointer" onClick={() => onViewProfile(s)}>
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all duration-300 ${
                      s.gender === 'Male' 
                        ? 'bg-blue-200 group-hover:bg-blue-500 group-hover:w-2 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                        : 'bg-pink-200 group-hover:bg-pink-500 group-hover:w-2 group-hover:shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                    }`} />
                    
                    <div className="flex items-center gap-6 pl-2 transition-transform duration-300 group-hover:translate-x-2">
                      <div className={`w-14 h-14 rounded-full bg-white p-1 border-2 transition-colors duration-300 shrink-0 ${
                        s.gender === 'Male' ? 'border-blue-100 group-hover:border-blue-300' : 'border-pink-100 group-hover:border-pink-300'
                      }`}>
                         <img 
                           src={s.two_by_two_url || s.profile_2x2_url || s.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${s.last_name}`} 
                           alt="2x2" 
                           className="w-full h-full object-cover rounded-full" 
                         />
                      </div>
                      <div>
                        <div 
                          className="font-black text-lg uppercase leading-none tracking-tighter group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" 
                          style={{ color: isDarkMode ? '#ffffff' : '#000000' }}
                        >
                          {s.last_name}, {s.first_name} {s.middle_name?.[0]}.
                        </div>
                        <div 
                          className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 group-hover:text-slate-600 transition-colors" 
                          style={{ color: isDarkMode ? 'rgb(148 163 184)' : '#000000' }}
                        >
                          LRN: {s.lrn}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-black text-[10px] uppercase">
                     <span className={`px-3 py-1 rounded-full ${
                       s.gender === 'Female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                     }`}>
                       {s.gender}
                     </span>
                  </TableCell>
                  <TableCell className="text-center">
                     <Badge variant="outline" className="border-slate-200 text-slate-400 text-[8px] font-black uppercase px-3 py-1">
                       {s.student_category || "Regular"}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right px-10 space-x-2 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        onClick={(e) => {e.stopPropagation(); handleExit(s.id, () => onReturn(s.id, s.first_name))}} 
                        variant="ghost" 
                        className="h-8 px-3 rounded-lg text-orange-400 font-black text-[9px] uppercase tracking-widest transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(249 115 22)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'rgb(251 146 60)'; }}
                      >
                        <Undo2 size={14} className="mr-1.5"/> Return
                      </Button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <SwitchDialog 
                          student={s} 
                          allSections={allSections} 
                          onSwitch={(id: string, target: string) => handleExit(id, () => onSwitch(id, target))} 
                          isDarkMode={isDarkMode}
                        />
                      </div>
                      <Button 
                        onClick={(e) => {e.stopPropagation(); onViewProfile(s)}} 
                        variant="ghost" 
                        className="h-8 px-3 rounded-lg text-slate-400 font-black text-[9px] uppercase tracking-widest transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(71 85 105)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'rgb(148 163 184)'; }}
                      >
                          <Eye size={14} className="mr-1.5"/> View
                      </Button>
                      <Button 
                        onClick={(e) => {e.stopPropagation(); onUnenroll(s)}} 
                        variant="ghost" 
                        className="h-8 px-3 rounded-lg text-red-300 font-black text-[9px] uppercase tracking-widest transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(239 68 68)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'rgb(252 165 165)'; }}
                      >
                        <UserX size={14} className="mr-1.5"/> Unenroll
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>
    </>
  )
})

// ===== SECTION GROUP =====
const SectionGroup = memo(function SectionGroup({ 
  title, 
  mobileTitle,
  icon, 
  color, 
  sections, 
  load, 
  onSelect, 
  onDelete, 
  isExpanded, 
  onToggle, 
  selection, 
  onToggleSelect, 
  onSelectAll,
  isDarkMode, 
  config
}: any) {
  const colorMap: any = { 
    blue: "bg-blue-50 text-blue-600 border-blue-100", 
    orange: "bg-orange-50 text-orange-600 border-orange-100" 
  }

  const allIds = useMemo(() => sections.map((s: any) => s.id), [sections])
  const isAllSelected = sections.length > 0 && sections.every((s: any) => selection.has(s.id))
  
  return (
    <section className="space-y-6 overflow-hidden w-full">
      <div 
        onClick={onToggle} 
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 group cursor-pointer border-b pb-8 hover:border-slate-300 transition-colors" 
        style={{ borderColor: isDarkMode ? 'rgb(30 41 59)' : '#e2e8f0' }}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={`p-4 rounded-2xl transition-transform group-hover:rotate-12 duration-500 flex-shrink-0 ${colorMap[color]}`}>
            {icon}
          </div>
          <h2 
            className="text-lg md:text-2xl tracking-widest uppercase truncate flex-shrink min-w-0 font-black"
            style={{ color: isDarkMode ? '#ffffff' : '#000000' }}
          >
            <span className="hidden md:inline">{title}</span>
            <span className="inline md:hidden">{mobileTitle || title}</span>
          </h2>
          <Badge className={`${color === 'blue' ? 'bg-blue-600' : 'bg-orange-600'} text-white rounded-full px-4 py-1.5 font-black text-[10px] whitespace-nowrap flex-shrink-0`}>
            {sections.length}
          </Badge>
        </div>
        <div 
          className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-3 md:p-5 rounded-[24px] md:rounded-[32px] border-none dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none w-full md:w-auto flex-shrink-0 relative bg-white dark:bg-slate-900" 
          style={{ backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '#ffffff' }}
        >
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Strand Capacity </span>
              <span>({Math.round(load.percent)}%)</span>
            </div>
            <Progress 
              value={load.percent} 
              className={`h-2 [&>div]:transition-all [&>div]:duration-1000 ${
                color === 'blue' ? '[&>div]:bg-blue-600' : '[&>div]:bg-orange-600'
              }`} 
              style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(226 232 240)' }} 
            />
          </div>
          <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 pl-0 sm:pl-6 border-slate-100 dark:border-slate-800 w-full sm:w-auto">
            <p className="text-sm font-black" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
              {load.totalEnrolled}/{load.totalCapacity}
            </p>
            <p className="text-[8px] font-bold text-slate-400 uppercase">Load Index</p>
          </div>
          <div className="text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors absolute top-5 right-5 sm:static">
            {isExpanded ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
          </div>
        </div>
      </div>
      
      <div className={`transition-all duration-300 ease-out ${
        isExpanded ? "opacity-100 max-h-[5000px] visible translate-y-0" : "opacity-0 max-h-0 invisible -translate-y-4 overflow-hidden"
      }`}>
        {sections.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[40px] text-slate-300 font-bold uppercase text-xs tracking-widest">
            No Active Matrices Found
          </div>
        ) : (
          <>
            {/* MOBILE: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4 px-4">
              {sections.map((sec: any, index: number) => (
                <div 
                  key={sec.id} 
                  className="relative group animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 fill-mode-backwards" 
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                   <div className="absolute top-4 right-6 z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(sec.id); }} 
                        className="text-slate-400 hover:text-blue-600 transition-colors p-2 -m-2"
                      >
                         {selection.has(sec.id) ? (
                           <CheckSquare size={14} className="text-blue-600 fill-blue-50" />
                         ) : (
                           <Square size={14} />
                         )}
                      </button>
                   </div>
                   <div onClick={() => onSelect(sec.section_name)} className="cursor-pointer h-full w-full">
                      <SectionCard 
                        section={sec} 
                        isSelected={selection.has(sec.id)} 
                        isDarkMode={isDarkMode} 
                        config={config}
                      />
                   </div>
                </div>
              ))}
            </div>

            {/* DESKTOP: Table */}
            <div className="hidden md:block animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Table className="border-separate border-spacing-y-6 px-2">
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent mb-4">
                    <TableHead className="w-16 pl-8">
                      <button onClick={(e) => { e.stopPropagation(); onSelectAll(allIds); }} className="hover:scale-110 transition-transform">
                         {isAllSelected ? (
                           <CheckSquare size={18} className={color === 'blue' ? "text-blue-600" : "text-orange-600"} />
                         ) : (
                           <Square size={18} className="text-slate-300" />
                         )}
                      </button>
                    </TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Section Identity</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Capacity Analytics</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Male</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Female</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">JHS</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">ALS</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-right pr-8">Section Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.map((sec: any, idx: number) => {
                    const activeStudents = sec.students?.filter((s: any) => s.status === 'Accepted' || s.status === 'Approved') || []
                    const mCount = activeStudents.filter((s: any) => s.gender === 'Male').length
                    const fCount = activeStudents.filter((s: any) => s.gender === 'Female').length
                    const jhsCount = activeStudents.filter((s: any) => s.student_category?.toLowerCase().includes('jhs') || s.student_category === 'Standard').length
                    const alsCount = activeStudents.filter((s: any) => s.student_category?.toLowerCase().includes('als')).length
                    const capacity = sec.capacity || 40
                    const fillPercent = Math.min((activeStudents.length / capacity) * 100, 100)
                    const mP = Math.min((mCount / capacity) * 100, 100)
                    const fP = Math.min((fCount / capacity) * 100, 100)
                    const isSelected = selection.has(sec.id)
                    const isICT = sec.strand === 'ICT'

                    return (
                      <TableRow 
                        key={sec.id}
                        onClick={() => onSelect(sec.section_name)}
                        className={`cursor-pointer transition-all duration-300 relative group overflow-hidden animate-in slide-in-from-right-4 fade-in fill-mode-backwards hover:shadow-xl hover:scale-[1.005] rounded-xl ${
                          isSelected 
                            ? (isICT ? (isDarkMode ? 'bg-gradient-to-r from-blue-900/40 to-slate-900' : 'bg-gradient-to-r from-blue-50 to-white') : (isDarkMode ? 'bg-gradient-to-r from-orange-900/40 to-slate-900' : 'bg-gradient-to-r from-orange-50 to-white'))
                            : (isDarkMode ? 'bg-gradient-to-r from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900' : 'bg-gradient-to-r from-white to-slate-50 hover:from-slate-50 hover:to-white')
                        }`}
                        style={{ animationDelay: `${idx * 50}ms`, boxShadow: isSelected ? undefined : (isDarkMode ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(148, 163, 184, 0.1)') }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                             e.currentTarget.style.backgroundColor = isICT 
                               ? (isDarkMode ? 'rgba(30, 58, 138, 0.4)' : 'rgba(239, 246, 255, 1)') 
                               : (isDarkMode ? 'rgba(124, 45, 18, 0.4)' : 'rgba(255, 247, 237, 1)')
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                             e.currentTarget.style.backgroundColor = ''
                          }
                        }}
                      >
                        <TableCell className="pl-8 py-4 relative">
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 ${isSelected ? `opacity-100 ${isICT ? 'shadow-[0_0_15px_rgba(59,130,246,0.8)]' : 'shadow-[0_0_15px_rgba(249,115,22,0.8)]'}` : 'opacity-30 group-hover:opacity-100 shadow-none'} ${isICT ? 'bg-blue-500' : 'bg-orange-500'}`} />
                          <div className="flex items-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); onToggleSelect(sec.id); }}>
                               {isSelected ? (
                                 <CheckSquare size={18} className={isICT ? "text-blue-600" : "text-orange-600"} />
                               ) : (
                                 <Square size={18} className="text-slate-300" />
                               )}
                            </button>
                            {isICT ? <Cpu size={16} className="text-blue-500/50" /> : <BookOpen size={16} className="text-orange-500/50" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div>
                            <p className={`font-black uppercase text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sec.section_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {isICT ? (
                                <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 shadow-md shadow-blue-500/20">ICT Strand</Badge>
                              ) : (
                                <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 shadow-md shadow-orange-500/20">GAS Strand</Badge>
                              )}
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">S.Y. {config?.school_year || "UNSET"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 w-[30%]">
                          <div className={`p-4 rounded-2xl border relative overflow-hidden group/progress transition-all duration-500 ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
                            {/* Blur/Glow Effect */}
                            <div className={`absolute inset-0 opacity-0 group-hover/progress:opacity-100 transition-opacity duration-500 ${isICT ? 'bg-blue-500/5' : 'bg-orange-500/5'}`} />
                            
                            <div className="flex justify-between items-end mb-2 relative z-10">
                               <span className="text-[10px] font-black text-blue-500 uppercase">{Math.round(mP)}% Male</span>
                               <span className="text-[10px] font-black text-purple-500 uppercase">{Math.round(fillPercent)}% Total</span>
                               <span className="text-[10px] font-black text-pink-500 uppercase">{Math.round(fP)}% Female</span>
                            </div>

                            <div className="relative h-3 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-inner">
                                {/* Waiting Animation */}
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                
                                {/* Center Line */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 z-10 -translate-x-1/2" />
                                
                                <div style={{ width: `${mP}%` }} className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-1000" />
                                <div style={{ width: `${fP}%` }} className="absolute right-0 top-0 bottom-0 bg-pink-500 transition-all duration-1000" />
                            </div>
                            
                            <div className="flex justify-between mt-2 relative z-10">
                               <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="text-[8px] font-bold text-slate-400 uppercase">{mCount} Male</span></div>
                               <div className="flex items-center gap-1"><span className="text-[8px] font-bold text-slate-400 uppercase">{fCount} Female</span><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /></div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                               <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                 {activeStudents.length} / {capacity} Students
                               </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                           <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-50 group-hover:bg-white group-hover:shadow-md'}`}>
                              <span className="text-[10px] font-black text-blue-500">M</span>
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mCount}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                           <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-50 group-hover:bg-white group-hover:shadow-md'}`}>
                              <span className="text-[10px] font-black text-pink-500">F</span>
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{fCount}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                           <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-50 group-hover:bg-white group-hover:shadow-md'}`}>
                              <span className="text-[8px] font-black text-purple-500 uppercase">JHS</span>
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{jhsCount}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                           <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-50 group-hover:bg-white group-hover:shadow-md'}`}>
                              <span className="text-[8px] font-black text-orange-500 uppercase">ALS</span>
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{alsCount}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4 pr-8 text-right">
                           <Badge className={`${fillPercent >= 100 ? 'bg-green-500 shadow-green-500/30' : 'bg-red-500 shadow-red-500/30'} text-white border-none font-black text-[9px] uppercase px-3 py-1 shadow-lg`}>
                             {fillPercent >= 100 ? 'COMPLETE' : 'INCOMPLETE'}
                           </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </section>
  )
})

// ===== SECTION CARD =====
const SectionCard = memo(function SectionCard({ section, isSelected, isDarkMode, config }: any) {
  const activeStudents = section.students?.filter((s: any) => s.status === 'Accepted' || s.status === 'Approved') || []
  const mCount = activeStudents.filter((s: any) => s.gender === 'Male').length
  const fCount = activeStudents.filter((s: any) => s.gender === 'Female').length
  const capacity = section.capacity || 40
  const mP = Math.min((mCount / capacity) * 100, 100)
  const fP = Math.min((fCount / capacity) * 100, 100)
  const isFull = (mCount + fCount) >= capacity

  return (
    <ThemedCard 
      className={`p-4 rounded-2xl hover:shadow-2xl hover:-translate-y-1 transition-[transform,background-color,border-color,box-shadow] duration-300 relative overflow-hidden group h-full bg-white dark:bg-slate-900 w-full max-w-full ${
        isSelected ? 'ring-2 md:ring-4 ring-blue-500 ring-offset-2 md:ring-offset-4 dark:ring-offset-slate-950' : ''
      }`}
      style={{
        backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface,
        borderColor: isDarkMode ? themeColors.dark.border : 'rgb(203 213 225)',
        borderWidth: '1px'
      }}
    >
      <div className={`absolute top-0 left-0 w-2.5 h-full ${section.strand === 'ICT' ? 'bg-blue-500' : 'bg-orange-500'}`} />
      <div className="flex justify-between items-start mb-5">
        <div>
        <ThemedText variant="h2" className="text-lg md:text-xl leading-none break-words" isDarkMode={isDarkMode}>
            {section.section_name}
          </ThemedText>
          <Badge variant="outline" className="mt-4 rounded-full font-black text-[10px] border-slate-100 dark:border-slate-800 text-slate-400 px-4 py-1 uppercase tracking-widest">
            S.Y. {config?.school_year || "UNSET"}
          </Badge>
        </div>
      </div>
      <div className="space-y-4 mb-6">
         <div className="flex justify-between items-end">
           <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
             <Layers size={16} /> Matrix Distribution
           </div>
           <span className="text-base font-black" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
             {activeStudents.length} <span className="text-slate-300 dark:text-slate-600">/ {capacity}</span>
           </span>
         </div>
         <div 
           className="relative h-4 w-full rounded-full overflow-hidden shadow-inner border-none dark:border-slate-700" 
           style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(248 250 252)' }}
         >
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 z-10" style={{ backgroundColor: isDarkMode ? '#ffffff' : '#94a3b8' }} />
            <div 
              style={{ width: `${mP}%` }} 
              className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out ${
                isFull ? '' : 'rounded-r-full'
              }`} 
            />
            <div 
              style={{ width: `${fP}%` }} 
              className={`absolute right-0 top-0 bottom-0 bg-gradient-to-l from-pink-600 to-pink-400 transition-all duration-1000 ease-out ${
                isFull ? '' : 'rounded-l-full'
              }`} 
            />
         </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
         <div 
           className="p-4 rounded-2xl text-center border-none dark:border-slate-700 transition-all group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20 group-hover:border-blue-200 dark:group-hover:border-blue-800" 
           style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(248 250 252)' }}
         >
           <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5">Males</p>
           <ThemedText variant="h3" className="text-lg" isDarkMode={isDarkMode}>{mCount}</ThemedText>
         </div>
         <div 
           className="p-4 rounded-2xl text-center border-none dark:border-slate-700 transition-all group-hover:bg-pink-50/50 dark:group-hover:bg-pink-900/20 group-hover:border-pink-200 dark:group-hover:border-pink-800" 
           style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(248 250 252)' }}
         >
           <p className="text-[8px] font-black text-pink-500 uppercase tracking-widest mb-1.5">Females</p>
           <ThemedText variant="h3" className="text-lg" isDarkMode={isDarkMode}>{fCount}</ThemedText>
         </div>
      </div>
    </ThemedCard>
  )
})

// ===== SWITCH DIALOG =====
const SwitchDialog = memo(function SwitchDialog({ student, allSections, onSwitch, isDarkMode, className }: any) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className={className || "h-8 px-3 rounded-lg text-blue-400 font-black text-[9px] uppercase tracking-widest transition-colors group"}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(37 99 235)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'rgb(96 165 250)'; }}
        >
          <ArrowRightLeft size={14} className="mr-1.5 group-hover:rotate-180 transition-transform duration-500" />
          Switch
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[32px] md:rounded-[40px] w-[95vw] md:w-full max-w-sm p-0 overflow-hidden border-none shadow-2xl bg-slate-900">
        <DialogHeader className="p-6 md:p-8 bg-blue-600 dark:bg-slate-900 text-white relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/30 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none" />
          
          <div className="relative z-10 w-full flex flex-col items-center">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6 animate-in fade-in slide-in-from-top-2">
              Transferring Subject
            </p>
            
            <div className="w-24 h-24 rounded-full p-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/30 mb-4 animate-in zoom-in duration-500">
               <img 
                 src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${student.last_name}`} 
                 alt="Student" 
                 className="w-full h-full object-cover rounded-full border-4 border-slate-900 bg-slate-800" 
               />
            </div>
            
            <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">
              {student.last_name}, {student.first_name}
            </DialogTitle>
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
              LRN: {student.lrn}
            </p>
          </div>
        </DialogHeader>
        
        <div className="p-4 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-800">
          <p className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Select Destination Matrix
          </p>
          {allSections.map((sec: any) => {
            const isCurrent = student.section_id === sec.id
            const currentCount = sec.students?.filter((s: any) => s.status === 'Accepted' || s.status === 'Approved').length || 0
            const capacity = sec.capacity || 40
            
            return (
            <button 
              key={sec.id} 
              disabled={isCurrent}
              onClick={() => !isCurrent && onSwitch(student.id, sec.section_name)} 
              className={`w-full group flex items-center justify-between p-3 md:p-4 rounded-2xl border transition-colors duration-300 relative overflow-hidden
                ${isCurrent 
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5'
                }`}
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${
                  isCurrent ? 'bg-slate-200 dark:bg-slate-950 text-slate-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors'
                }`}>
                   {sec.section_name.substring(0, 1)}
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className={`font-black uppercase text-xs tracking-tight ${
                    isCurrent ? 'text-slate-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {sec.section_name}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                    Capacity: {currentCount}/{capacity}
                  </span>
                </div>
              </div>
              
              {isCurrent ? (
                 <div className="px-3 py-1 bg-slate-200 rounded-lg text-[8px] font-black uppercase text-slate-500 tracking-widest">
                   Current
                 </div>
              ) : (
                 <div className="w-8 h-8 rounded-full bg-slate-530 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ArrowRightLeft size={14} />
                 </div>
              )}
            </button>
          )})}
        </div>
      </DialogContent>
    </Dialog>
  )
})

// ===== STUDENT DOSSIER =====
const StudentDossier = memo(function StudentDossier({ student, onOpenFile, isDarkMode }: { student: any, onOpenFile: (url: string, label: string) => void, isDarkMode: boolean }) {
  const isJHS = student.student_category?.toLowerCase().includes("jhs") || student.student_category === "Standard" || student.student_category === "JHS Graduate"
  const isALS = student.student_category?.toLowerCase().includes("als")
  const badgeColor = isALS ? "bg-orange-500" : "bg-blue-600"
  
  return (
    <div className="flex flex-col">
      <div className="bg-blue-600 dark:bg-slate-900 p-5 md:p-12 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 p-4 md:p-10 z-20">
           <StatusBadge status={student.status} />
        </div>

        <div className="absolute top-0 right-0 p-4 md:p-10">
          <Badge className={`${badgeColor} backdrop-blur-md text-white text-[10px] font-black px-3 md:px-5 py-2 md:py-2.5 uppercase tracking-widest border-none shadow-xl`}>
            {student.student_category || "Regular"}
          </Badge>
        </div>
        <div className="relative z-10 mb-6 md:mb-8 scale-100 md:scale-110">
          <div 
            className="w-32 h-32 md:w-44 md:h-44 bg-slate-800 rounded-[32px] md:rounded-[40px] border-4 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center cursor-zoom-in group" 
            onClick={(e) => { 
              e.stopPropagation(); 
              onOpenFile(student.two_by_two_url || student.profile_2x2_url || student.profile_picture, "Identity Matrix 2x2"); 
            }}
          >
            {student.two_by_two_url || student.profile_2x2_url || student.profile_picture ? (
              <img 
                src={student.two_by_two_url || student.profile_2x2_url || student.profile_picture} 
                alt="2x2" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
              />
            ) : (
              <div className="flex flex-col items-center text-slate-500">
                <User size={56} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase mt-3">Identity Missing</p>
              </div>
            )}
          </div>
        </div>
        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">
          {student.first_name} {student.last_name}
        </h2>
        <p className="text-blue-400 font-bold uppercase tracking-[0.4em] text-[11px] mt-4 opacity-80">
          Registry ID: {student.lrn}
        </p>
      </div>
      
      <div className="p-5 md:p-12 space-y-8 md:space-y-16 text-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
          <div className="space-y-8">
            <h3 className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-4" style={{ borderColor: '#ffffff' }}>
              <User size={16} className="text-blue-500" /> Personal Identity
            </h3>
            <div className="grid grid-cols-2 gap-y-8">
              <InfoBlock label="First Name" value={student.first_name} isDarkMode={isDarkMode} />
              <InfoBlock label="Middle Initial" value={student.middle_name?.[0] ? `${student.middle_name[0]}.` : "N/A"} isDarkMode={isDarkMode} />
              <InfoBlock label="Last Name" value={student.last_name} isDarkMode={isDarkMode} />
              <InfoBlock label="Full Legal Name" value={`${student.first_name} ${student.middle_name || ''} ${student.last_name}`} isDarkMode={isDarkMode} />
              <InfoBlock label="Gender" value={student.gender} isDarkMode={isDarkMode} />
              <InfoBlock label="Age" value={student.age?.toString()} isDarkMode={isDarkMode} />
              <InfoBlock label="Birth Date" value={student.birth_date} isDarkMode={isDarkMode} />
              <InfoBlock label="Civil Status" value={student.civil_status} isDarkMode={isDarkMode} />
              <div className="col-span-2">
                <InfoBlock label="Full Address" value={student.address} icon={<MapPin size={12} />} isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            <h3 className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-4" style={{ borderColor: '#ffffff' }}>
              <Mail size={16} className="text-indigo-500" /> Communication Matrix
            </h3>
            <div className="space-y-8">
              <InfoBlock label="Email Address" value={student.email} icon={<Mail size={12} />} isDarkMode={isDarkMode} />
              <InfoBlock label="Primary Phone" value={student.phone || student.contact_no} icon={<Phone size={12} />} isDarkMode={isDarkMode} />
              <div 
                className="p-4 rounded-2xl border" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgb(15 23 42)' : 'rgb(248 250 252)', 
                  borderColor: isDarkMode ? 'rgb(30 41 59)' : '#ffffff' 
                }}
              >
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Database ID</p>
                <p className="text-[10px] font-bold truncate" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                  {student.id}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
           <div className="space-y-8">
             <h3 className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-4" style={{ borderColor: '#ffffff' }}>
               <ShieldCheck size={16} className="text-emerald-500" /> Guardian Matrix
             </h3>
             <div className="space-y-6">
               <InfoBlock 
                 label="Guardian Full Name" 
                 value={`${student.guardian_first_name || student.guardian_name || ''} ${student.guardian_last_name || ''}`} 
                 isDarkMode={isDarkMode} 
               />
               <InfoBlock 
                 label="Guardian Contact" 
                 value={student.guardian_phone || student.guardian_contact} 
                 icon={<Phone size={12} />} 
                 isDarkMode={isDarkMode} 
               />
             </div>
           </div>
           
          <div className="space-y-8">
            <h3 className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-4" style={{ borderColor: '#ffffff' }}>
              <GraduationCap size={16} className="text-orange-500" /> Academic Matrix
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div 
                className="col-span-2 p-6 rounded-3xl border shadow-sm" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgb(15 23 42)' : 'rgb(248 250 252)', 
                  borderColor: isDarkMode ? 'rgb(30 41 59)' : '#ffffff' 
                }}
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Origin Institution</p>
                <p className="font-black uppercase text-sm truncate" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                  {student.last_school_attended || "Not Disclosed"}
                </p>
              </div>
              <div 
                className="p-6 rounded-3xl border text-center" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.2)' : 'rgba(219, 234, 254)', 
                  borderColor: isDarkMode ? 'rgb(30 58 138)' : 'rgb(219 234 254)' 
                }}
              >
                <p className="text-[10px] font-black text-blue-400 uppercase mb-2">GWA Index</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{student.gwa_grade_10 || "0.00"}</p>
              </div>
              <div 
                className="p-6 rounded-3xl border text-center" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(124, 45, 18, 0.2)' : 'rgb(255, 237, 213)', 
                  borderColor: isDarkMode ? 'rgb(124, 45, 18)' : 'rgb(255, 237, 213)' 
                }}
              >
                <p className="text-[10px] font-black text-orange-400 uppercase mb-2">Target Strand</p>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{student.strand}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-8 pb-12">
          <h3 className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-4" style={{ borderColor: '#ffffff' }}>
            <ScrollText size={16} className="text-blue-500" /> Registrar Credential Vault
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {isJHS ? (
              <>
                <CredentialCard label="Form 138" url={student.form_138_url} onOpen={onOpenFile} isDarkMode={isDarkMode} />
                <CredentialCard label="Good Moral" url={student.good_moral_url} onOpen={onOpenFile} isDarkMode={isDarkMode} />
              </>
            ) : (
              <>
                <CredentialCard label="ALS COR Rating" url={student.cor_url} onOpen={onOpenFile} isDarkMode={isDarkMode} />
                <CredentialCard label="Diploma" url={student.diploma_url} onOpen={onOpenFile} isDarkMode={isDarkMode} />
                <CredentialCard label="AF5 Form" url={student.af5_url} onOpen={onOpenFile} isDarkMode={isDarkMode} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// ===== INFO BLOCK =====
const InfoBlock = memo(function InfoBlock({ label, value, icon, isDarkMode }: { label: string, value: string, icon?: React.ReactNode, isDarkMode: boolean }) {
  return (
    <div>
      <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] mb-1">{label}</p>
      <p className="font-bold flex items-center gap-2.5 text-base" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
        {icon}{value || "—"}
      </p>
    </div>
  )
})

// ===== CREDENTIAL CARD =====
const CredentialCard = memo(function CredentialCard({ label, url, onOpen, isDarkMode }: { label: string, url: string, onOpen?: (url: string, label: string) => void, isDarkMode: boolean }) {
  if (!url) return (
    <div 
      className="p-6 rounded-[32px] border border-dashed opacity-50 flex flex-col items-center justify-center text-slate-400 h-40" 
      style={{ 
        backgroundColor: isDarkMode ? 'rgb(15 23 42)' : 'rgb(248 250 252)', 
        borderColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(226 232 240)' 
      }}
    >
      <FileText size={24} className="mb-3" />
      <p className="text-[9px] font-black uppercase tracking-widest text-center">{label}</p>
    </div>
  )
  
  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onOpen && onOpen(url, label); }} 
      className="cursor-pointer group"
    >
      <div 
        className="p-2.5 rounded-[32px] border hover:border-blue-400 hover:shadow-2xl transition-all h-full relative" 
        style={{ 
          backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '#ffffff', 
          borderColor: isDarkMode ? 'rgb(30 41 59)' : '#cbd5e1' 
        }}
      >
        <div className="h-32 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
          {url.toLowerCase().endsWith('.pdf') ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-700">
              <FileText size={32} className="text-slate-400" />
              <p className="text-[8px] font-black uppercase text-slate-500 mt-2">PDF Document</p>
            </div>
          ) : (
            <img 
              src={url} 
              alt={label} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            />
          )}
          <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ZoomIn className="text-white" size={24} />
          </div>
        </div>
        <p className="text-[10px] font-black text-center mt-4 uppercase tracking-widest leading-tight" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
          {label}
        </p>
      </div>
    </div>
  )
})

// ===== PROCESSING OVERLAY =====
const ProcessingOverlay = memo(function ProcessingOverlay() {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[10000] flex items-center justify-center">
      <div className="bg-slate-900 text-white p-10 rounded-[48px] flex items-center gap-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <Loader2 className="animate-spin text-blue-400 w-8 h-8" />
        <span className="font-black uppercase text-sm tracking-[0.2em]">Updating Matrix Data...</span>
      </div>
    </div>
  )
})

// ===== STATUS BADGE =====
const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const styles: any = { 
    Pending: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", 
    Accepted: "bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20", 
    Approved: "bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20", 
    Rejected: "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" 
  }
  
  return (
    <div className={`mt-6 px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.3em] w-fit shadow-sm ${styles[status]}`}>
      {status === 'Approved' ? 'Accepted' : status}
    </div>
  )
})

// ===== DELETE MANAGEMENT DIALOG =====
const DeleteManagementDialog = memo(function DeleteManagementDialog({ sections, onDelete, onClearStudents, isDarkMode }: any) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest border-red-100 text-red-500 hover:bg-red-500 hover:text-white shadow-sm transition-all"
        >
          <Settings2 size={16} className="mr-2" /> Section Control
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="rounded-[32px] md:rounded-[48px] w-[95vw] max-w-xl p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500"
        style={{ backgroundColor: isDarkMode ? themeColors.dark.surface : themeColors.light.surface }}
      >
        <Tabs defaultValue="sections">
          <DialogHeader className="p-8 bg-blue-600 dark:bg-slate-900 text-white relative">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <DialogTitle className="font-black uppercase tracking-tighter text-2xl">Control Center</DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
                  Manage Sections and Deletion
                </DialogDescription>
              </div>
              <TabsList className="bg-white/10 p-1 rounded-2xl border border-white/5">
                <TabsTrigger 
                  value="sections" 
                  className="rounded-xl px-4 py-2 font-black uppercase text-[9px] data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Sections
                </TabsTrigger>
                <TabsTrigger 
                  value="danger" 
                  className="rounded-xl px-4 py-2 font-black uppercase text-[9px] data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Registry
                </TabsTrigger>
              </TabsList>
            </div>
          </DialogHeader>
          
          <TabsContent value="sections" className="p-8 mt-0">
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {sections.map((sec: any) => (
                <div 
                  key={sec.id} 
                  className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-slate-200 transition-all"
                >
                  <div>
                    <p className="font-black text-slate-900 uppercase tracking-tight">{sec.section_name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {sec.strand} Section
                    </p>
                  </div>
                  <Button 
                    onClick={() => onDelete(sec.id, sec.section_name, sec.strand)} 
                    size="sm" 
                    className="bg-white hover:bg-red-600 text-red-500 hover:text-white rounded-2xl h-10 w-10 p-0 shadow-sm border border-red-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="danger" className="p-8 mt-0">
            <div className={`p-8 rounded-[32px] border space-y-6 text-center ${isDarkMode ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
              <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center mx-auto text-white shadow-xl rotate-3">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-red-600 uppercase tracking-tighter text-xl leading-none">
                  Delete Student Registry
                </h3>
                <p className={`text-xs font-medium italic leading-relaxed ${isDarkMode ? 'text-red-300' : 'text-red-400'}`}>
                  This action is non-reversible. Every student record, including verified and pending applications, 
                  will be permanently erased from the database.
                </p>
              </div>
              <Button 
                onClick={onClearStudents} 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 transition-all"
              >
                Execute Registry Wipe
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})