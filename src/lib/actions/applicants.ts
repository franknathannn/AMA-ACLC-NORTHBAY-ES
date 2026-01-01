"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * SWITCH STUDENT SECTION
 * Updates the student's assigned section in real-time.
 */
export async function updateStudentSection(id: string, sectionId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('students')
    .update({ section_id: sectionId })
    .eq('id', id)

  if (error) {
    console.error("🔥 Section Switch Error:", error.message)
    throw new Error(error.message)
  }

  revalidatePath("/admin/sections")
  return { success: true }
}

/**
 * DELETE/UN-ENROLL APPLICANT
 * Permanently removes the student and their associated logs.
 * This prevents Foreign Key constraint errors.
 */
export async function deleteApplicant(id: string) {
  const supabase = await createClient()

  // 1. CLEAR LOGS FIRST: Delete activity logs linked to this student
  // This is the "Cleanup" step that allows the student record to be deleted.
  const { error: logError } = await supabase
    .from('activity_logs')
    .delete()
    .eq('student_id', id)

  if (logError) {
    console.warn("⚠️ Activity logs cleanup warning:", logError.message)
    // We continue anyway, as logs might not exist for some students
  }

  // 2. DELETE STUDENT: Now remove the actual student record
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)

  if (error) {
    console.error("🔥 Deletion Error:", error.message)
    throw new Error(error.message)
  }

  // Refresh all Matrix views
  revalidatePath("/admin/applicants")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sections") 
  
  return { success: true }
}

/**
 * UPDATE APPLICANT STATUS
 * Handles sequential alphabetical assignment and 50/50 gender balancing.
 * Supports custom registrar feedback for rejections.
 */
export async function updateApplicantStatus(id: string, newStatus: string, feedback?: string) {
  const supabase = await createClient()
  let sectionIdToAssign: string | null = null
  
  // Normalize Status
  const dbStatus = newStatus === "Accepted" ? "Approved" : newStatus;

  if (dbStatus === "Approved") {
    // 1. Get the student's strand and gender
    const { data: student } = await supabase
      .from('students')
      .select('strand, gender')
      .eq('id', id)
      .single()

    if (student) {
      // 2. Fetch all sections for this strand, ordered A-Z
      const { data: sections } = await supabase
        .from('sections')
        .select('id, capacity')
        .eq('strand', student.strand)
        .order('section_name', { ascending: true })

      if (sections) {
        for (const sec of sections) {
          const maxGenderCapacity = Math.ceil(sec.capacity / 2)

          const { count: currentGenderCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('section_id', sec.id)
            .eq('gender', student.gender)
            .eq('status', 'Approved')

          if ((currentGenderCount || 0) < maxGenderCapacity) {
            sectionIdToAssign = sec.id
            break 
          }
        }
      }
    }
  } else {
    // If set to Pending or Rejected, they lose their section assignment
    sectionIdToAssign = null
  }

  // 3. Update the student record
  const { error } = await supabase
    .from('students')
    .update({ 
      status: dbStatus, 
      section_id: sectionIdToAssign,
      // Logic: Clear feedback if Approved, otherwise save the provided feedback
      registrar_feedback: dbStatus === "Approved" ? null : (feedback || null)
    })
    .eq('id', id)

  if (error) {
    console.error("🔥 Update Error:", error.message)
    throw new Error(error.message)
  }

  // 4. Refresh all relevant views
  revalidatePath("/admin/applicants")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sections") 
  revalidatePath("/admin/status") 
  
  return { success: true }
}