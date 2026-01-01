"use client"

import { useState, useEffect, useRef, memo } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Lock, Loader2, GraduationCap, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// --- 1. INTERACTIVE CONSTELLATION ENGINE ---
const LoginConstellation = memo(function LoginConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    let mouse = { x: -1000, y: -1000 };

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 1.5 + 1
      }));
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Theme-aware particle color
      const isDarkMode = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDarkMode ? "rgba(59, 130, 246, 0.4)" : "rgba(148, 163, 184, 0.4)";
      ctx.strokeStyle = isDarkMode ? "rgba(59, 130, 246, 0.15)" : "rgba(148, 163, 184, 0.15)";

      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect to mouse
        const dxMouse = p.x - mouse.x;
        const dyMouse = p.y - mouse.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distMouse < 200) {
          ctx.beginPath();
          ctx.lineWidth = (1 - distMouse / 200) * 1.2;
          ctx.strokeStyle = isDarkMode 
            ? `rgba(59, 130, 246, ${0.4 - distMouse / 500})` 
            : `rgba(37, 99, 235, ${0.3 - distMouse / 600})`;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        // Inter-particle connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.lineWidth = 0.4;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    init(); animate();
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
});

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const AUTHORIZED_EMAILS = [
    "adminaclc@edu.ph",
    "admissionoffice@gmail.com",
    "franknathan12@gmail.com"
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTHORIZED_EMAILS.includes(email.toLowerCase().trim())) {
      toast.error("Unauthorized: Identity not found in Admin Registry.")
      return
    }
    setLoading(true)
    const toastId = toast.loading("Authenticating credentials...")
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        toast.error("Access Denied: Invalid Security Key.", { id: toastId })
        setLoading(false)
      } else {
        toast.success("Identity Confirmed. Accessing Matrix...", { id: toastId })
        router.push("/admin/applicants") 
      }
    } catch (err) {
      toast.error("Connection Interrupted.", { id: toastId })
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* 🛠️ GLOBAL SCROLLBAR REMOVAL */}
      <style jsx global>{`
        body, html {
          overflow: hidden !important;
          height: 100%;
        }
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <LoginConstellation />
      
      {/* Dynamic Backdrops */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 dark:bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-indigo-100/30 dark:bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-10 relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="w-12 h-12 bg-slate-900 dark:bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95">
           <GraduationCap className="w-7 h-7 text-white" />
        </div>
        <div className="flex flex-col">
           <span className="font-black text-2xl tracking-tighter uppercase text-slate-900 dark:text-white leading-none italic">ACLC Northbay</span>
           <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold tracking-[0.4em] text-blue-600 dark:text-blue-400 uppercase">Admin Portal</span>
            <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
           </div>
        </div>
      </div>

      <Card className="max-w-md w-full p-10 rounded-[48px] border border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl relative z-10 transition-all duration-500 hover:shadow-blue-500/5">
        <div className="space-y-2 mb-10 text-center">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 dark:border-white/5 transition-transform hover:rotate-6">
             <Lock className="w-8 h-8 text-slate-900 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Login Panel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Verify Administrator Identity</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2 group">
            <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-4 tracking-widest group-focus-within:text-blue-500 transition-colors">Admin Email</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="registrar@matrix.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 rounded-2xl border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold focus:border-blue-600 px-6 transition-all focus:scale-[1.02]"
              required
            />
          </div>

          <div className="space-y-2 group">
            <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-4 tracking-widest group-focus-within:text-blue-500 transition-colors">Security Key</Label>
            <Input 
              id="password"
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 rounded-2xl border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold focus:border-blue-600 px-6 transition-all focus:scale-[1.02]"
              required
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-16 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] gap-3 shadow-2xl transition-all active:scale-95 group relative overflow-hidden"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                Verify Access 
                <ShieldCheck size={18} className="group-hover:rotate-12 transition-transform" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
          </Button>
        </form>
      </Card>
      
      <div className="mt-12 flex flex-col items-center gap-4 relative z-10">
        <div className="h-px w-20 bg-slate-200 dark:bg-slate-800" />
        <p className="text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-[0.5em] font-black italic">
          Registrar • ACLC Northbay
        </p>
      </div>
    </div>
  )
}