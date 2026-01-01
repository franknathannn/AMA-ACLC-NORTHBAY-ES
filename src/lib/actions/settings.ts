"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * GET DETAILED SYSTEM STATUS
 * This is the "Bouncer" for your enrollment portal.
 * Checks Manual Switch + Opening Date + Closing Date + Capacity.
 */
export async function getEnrollmentStatus() {
  try {
    const supabase = await createClient()
    
    // 1. Fetch the single config row
    const { data: config, error } = await supabase
      .from('system_config')
      .select('*')
      .single()
    
    if (error || !config) {
      return { isOpen: false, reason: "System Configuration Missing", capacity: 1000, schoolYear: "2025-2026" };
    }

    // 2. Count current enrolled students
    const { count: approvedCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved');

    const now = new Date();
    const start = config.enrollment_start ? new Date(config.enrollment_start) : null;
    const end = config.enrollment_end ? new Date(config.enrollment_end) : null;

    // logic checks
    const isManualOpen = config.is_portal_active;
    const isPastStart = !start || now >= start;
    const isBeforeEnd = !end || now <= end;
    const isFull = (approvedCount || 0) >= config.capacity;

    // The portal is open ONLY if all conditions are met
    const isOpen = isManualOpen && isPastStart && isBeforeEnd && !isFull;

    // Determine reason for closing (for UI feedback)
    let reason = "Active";
    if (!isManualOpen) reason = "Manual Shutdown";
    else if (!isPastStart) reason = "Enrollment Not Yet Started";
    else if (!isBeforeEnd) reason = "Enrollment Period Over";
    else if (isFull) reason = "Capacity Reached";

    return { 
      isOpen,
      reason,
      closingTime: config.enrollment_end,
      openingTime: config.enrollment_start,
      capacity: config.capacity,
      schoolYear: config.school_year,
      currentCount: approvedCount || 0,
      isFull
    };
  } catch (err) {
    console.error("🔥 Critical Settings Error:", err);
    return { isOpen: false, reason: "Connection Error", capacity: 1000 };
  }
}

/**
 * SYNC SECTION CAPACITIES
 * Distributes the global capacity across all existing sections.
 */
export async function syncSectionCapacities() {
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('system_config')
    .select('capacity')
    .single()

  const globalLimit = config?.capacity || 1000

  const { data: sections } = await supabase
    .from('sections')
    .select('id, section_name')
    .order('section_name', { ascending: true })

  // 1. SAFE CHECK: Ensure sections exists AND has items to avoid division by zero
  if (!sections || sections.length === 0) {
    return { success: false, error: "No sections found to synchronize." }
  }

  const totalSections = sections.length
  const baseCapacity = Math.floor(globalLimit / totalSections)
  const remainder = globalLimit % totalSections

  // 2. MAPPING: Wrap the logic correctly inside the function scope
  const updatePromises = sections.map((sec, index) => {
    const finalCapacity = index < remainder ? baseCapacity + 1 : baseCapacity
    return supabase
      .from('sections')
      .update({ capacity: finalCapacity })
      .eq('id', sec.id)
  })

  try {
    await Promise.all(updatePromises)
    
    // 3. REVALIDATION: Must be inside the function brackets
    revalidatePath("/admin/sections")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/configuration")
    
    return { success: true }
  } catch (error) {
    console.error("Sync Error:", error)
    return { success: false, error: "Failed to update sections." }
  }
}

/**
 * FORCE SYNC
 */
export async function forceSyncCapacities() {
  try {
    await syncSectionCapacities()
    return { success: true }
  } catch (error) {
    console.error("Manual Sync Failed:", error)
    return { success: false }
  }
}

/**
 * UPDATE ENROLLMENT CAPACITY
 */
export async function updateCapacity(newCapacity: number) {
  if (newCapacity < 50) {
    throw new Error("Enrollment capacity cannot be lower than 50 students.");
  }

  const supabase = await createClient()
  
  const { error } = await supabase
    .from('system_config')
    .update({ 
      capacity: Math.abs(newCapacity),
      updated_at: new Date().toISOString() 
    })
    .not('id', 'is', null) // Updates the existing row

  if (error) throw new Error(error.message);

  // Trigger redistribution
  await syncSectionCapacities()
  
  revalidatePath("/enroll")
  revalidatePath("/admin/configuration")
  revalidatePath("/admin/dashboard")
  
  return { success: true }
}

/**
 * TOGGLE STATUS (Manual Switch)
 */
export async function toggleEnrollment(status: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('system_config')
    .update({ is_portal_active: status, updated_at: new Date().toISOString() })
    .not('id', 'is', null)

  if (error) throw new Error(error.message)
  
  revalidatePath("/enroll") 
  revalidatePath("/") 
  return { success: true }
}