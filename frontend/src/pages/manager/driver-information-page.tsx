import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  Tag,
  TrendingUp,
  TrendingDown,
  Truck,
  User,
  Wrench,
  X,
  Trash2,
  Brain,
  Sparkles,
  Fuel,
} from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/fx/page";
import { GlassPanel } from "@/components/fx/glass-panel";
import { StatCard } from "@/components/fx/stat-card";
import { StatusPill, type Tone } from "@/components/fx/status-pill";
import { MagneticButton } from "@/components/fx/magnetic-button";
import { getDriverIntelligence } from "@/services/manager.service";
import {
  getDriverDocuments,
  approveDocument,
  rejectDocument,
  subscribeDocuments,
  type DriverDocument,
  type DocumentVerificationStatus,
} from "@/data/documents";
import {
  driverEmployment,
  driverMonthlyScore,
  drivingBehaviour,
  deliveries,
  requests,
  deleteDriver,
  type Driver,
} from "@/data/fleet";
import { getConcerns, subscribeConcerns, type DriverConcern } from "@/data/concerns";
import { fadeUp } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

const toneClass = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
};

const getDocStatusTone = (status: DocumentVerificationStatus): Tone => {
  switch (status) {
    case "Verified":
      return "success";
    case "Pending Verification":
      return "primary";
    case "Expired":
      return "warning";
    case "Rejected":
      return "destructive";
    case "Pending Upload":
    default:
      return "muted";
  }
};

const getDocIcon = (type: string) => {
  switch (type) {
    case "Driving Licence":
      return <CreditCard className="size-4 text-primary shrink-0" />;
    case "Vehicle RC":
      return <Truck className="size-4 text-primary shrink-0" />;
    case "Insurance Policy":
      return <ShieldCheck className="size-4 text-primary shrink-0" />;
    case "Medical Certificate":
      return <FileCheck className="size-4 text-primary shrink-0" />;
    case "Police Clearance Certificate":
    default:
      return <FileText className="size-4 text-primary shrink-0" />;
  }
};

const handleDownloadDoc = (doc: DriverDocument) => {
  const fileName = doc.uploadedFileName || `${doc.docType.toLowerCase().replace(/\s+/g, '_')}_${doc.driverId}.pdf`;
  const content = `FLEETHUB VERIFIED COMPLIANCE CERTIFICATE\n=========================================\nDriver Name: ${doc.driverName} (${doc.driverId})\nDocument Type: ${doc.docType}\nDocument Number: ${doc.docNumber}\nVerification Status: ${doc.status}\nIssue Date: ${doc.issueDate}\nExpiry Date: ${doc.expiryDate}\nUploaded On: ${doc.uploadedAt || 'N/A'}\nReviewed By: ${doc.reviewedBy || 'N/A'}\n${doc.rejectionReason ? `Rejection Reason: ${doc.rejectionReason}\n` : ''}\nOfficial digital compliance document issued & verified by FleetHub Fleet Management System.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Downloading ${fileName}`, {
    description: "Compliance document file downloaded successfully.",
  });
};

interface DriverAssignment {
  id: string;
  status: "in-transit" | "assigned" | "completed";
  pickup: string;
  drop: string;
  expected: string;
  priority: "Urgent" | "High" | "Normal";
  createdOn: string;
}

export function ManagerDriverDetailPage({ driver }: { driver: Driver }) {
  const navigate = useNavigate();
  const employment = driverEmployment[driver.id] || {
    employeeId: "Not provided",
    joinedOn: "Not provided",
    contractType: "Not provided",
    shift: "Not provided",
    depot: "Not assigned",
    reportingManager: "Not assigned",
    licenceNo: "Not provided",
    licenceExpiry: "Not provided",
    emergencyContact: "Not provided",
    address: "Not provided",
  };

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assignedToast, setAssignedToast] = useState<string | null>(null);

  // AI Driver Intelligence Profile state
  const [intelligence, setIntelligence] = useState<any>(() => {
    const rawScore = driver.score || 85;
    const isTop = rawScore >= 93;
    const isMod = rawScore < 88;
    return {
      overall_score: rawScore,
      safety_score: Math.min(100, Math.round((rawScore - 0.5) * 10) / 10),
      consistency_score: isTop ? 96.0 : isMod ? 82.0 : 89.0,
      delivery_reliability_score: isTop ? 97.5 : isMod ? 88.0 : 93.0,
      fragile_suitability_score: isTop ? 96.2 : isMod ? 74.0 : 86.0,
      long_distance_suitability_score: rawScore >= 90 ? 92.0 : 82.0,
      fuel_efficiency_score: isTop ? 94.0 : 85.0,
      risk_classification: isMod ? "Moderate" : "Low",
      safety_grade: rawScore >= 90 ? "A" : "B",
      harsh_braking_rate: isTop ? 0.3 : isMod ? 1.9 : 0.8,
      rapid_acceleration_rate: isTop ? 0.2 : isMod ? 1.4 : 0.6,
      speeding_rate: isTop ? 0.1 : isMod ? 1.1 : 0.4,
      assessment_summary:
        rawScore >= 90
          ? `Generally a safe and reliable driver. Demonstrates excellent braking discipline and consistent delivery performance. Recommended for fragile and high-value deliveries.`
          : `Reliable operational driver with solid on-time punctuality. Telemetry indicates occasional rapid acceleration or braking variability under dense traffic.`,
      key_strengths: isTop
        ? ["Exemplary braking discipline", "Fragile cargo handling certified", "High highway endurance"]
        : ["Punctual arrivals", "Fast turnaround", "Flexible scheduling"],
      improvement_areas: isTop
        ? ["Maintain safe following distance in peak traffic"]
        : ["Speed boundary compliance in peri-urban zones", "Reduce harsh braking frequency"],
      is_improving: true,
    };
  });

  useEffect(() => {
    let isMounted = true;
    getDriverIntelligence(driver.id)
      .then((res) => {
        if (isMounted && res.data) {
          setIntelligence(res.data);
        }
      })
      .catch((err) => {
        console.warn("Could not load driver intelligence from API:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [driver.id]);

  const handleConfirmDeleteDriver = () => {
    deleteDriver(driver.id);
    setShowDeleteModal(false);
    toast.error(`Driver ${driver.name} (${driver.id}) deleted successfully.`, {
      description: "Profile and associated compliance records removed.",
    });
    navigate({ to: "/manager/drivers" });
  };

  // Driver Documents state & live subscription
  const [driverDocs, setDriverDocs] = useState<DriverDocument[]>(() => getDriverDocuments(driver.id));
  const [selectedDocForReview, setSelectedDocForReview] = useState<DriverDocument | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  useEffect(() => {
    const update = () => {
      setDriverDocs(getDriverDocuments(driver.id));
    };
    const unsub = subscribeDocuments(update);
    return () => unsub();
  }, [driver.id]);

  const handleApproveDoc = (docId: string) => {
    const updated = approveDocument(docId, "Amit Rao");
    if (updated) {
      toast.success(`${updated.docType} approved & verified!`, {
        description: `Driver ${driver.name} has been notified.`,
      });
      setSelectedDocForReview(null);
    }
  };

  const handleRejectDoc = (docId: string) => {
    if (!rejectionReasonText.trim()) {
      toast.error("Please enter a reason for rejection.");
      return;
    }
    const updated = rejectDocument(docId, rejectionReasonText.trim(), "Amit Rao");
    if (updated) {
      toast.error(`${updated.docType} rejected`, {
        description: `Driver ${driver.name} notified with rejection reason.`,
      });
      setSelectedDocForReview(null);
      setShowRejectInput(false);
      setRejectionReasonText("");
    }
  };

  // Dynamic assignments for driver from global deliveries
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>(() => {
    return deliveries
      .filter((d) => d.driver.toLowerCase() === driver.name.toLowerCase())
      .map((d) => ({
        id: d.id,
        status: d.status === "in-transit" ? "in-transit" : d.status === "completed" ? "completed" : "assigned",
        pickup: d.pickup,
        drop: d.drop,
        expected: d.expected,
        priority: "High",
        createdOn: d.createdOn,
      }));
  });

  // Dynamic driver concerns from concerns store
  const [allConcerns, setAllConcerns] = useState<DriverConcern[]>(() => getConcerns());
  useEffect(() => {
    const unsub = subscribeConcerns(() => setAllConcerns(getConcerns()));
    return () => unsub();
  }, []);

  const driverConcerns = allConcerns.filter(
    (c) => c.driverId === driver.id || c.driverName.toLowerCase() === driver.name.toLowerCase()
  );

  const handleAssignDelivery = (reqId: string, clientName: string) => {
    const newAssignment: DriverAssignment = {
      id: `DEL-2026-08${Math.floor(18 + Math.random() * 80)}`,
      status: "assigned",
      pickup: `${clientName} Hub, Mumbai`,
      drop: "Regional Depot, Pune",
      expected: "Tomorrow, 02:00 PM",
      priority: "High",
      createdOn: "May 10, 2026",
    };
    setDriverAssignments((prev) => [newAssignment, ...prev]);
    setShowAssignModal(false);
    setAssignedToast(`Assigned new delivery ${newAssignment.id} to ${driver.name}`);
    setTimeout(() => setAssignedToast(null), 4500);
  };

  const getPriorityTone = (priority: string): Tone => {
    if (priority === "Urgent") return "destructive";
    if (priority === "High") return "warning";
    return "muted";
  };

  const getStatusTone = (status: string): Tone => {
    if (status === "in-transit") return "primary";
    if (status === "assigned") return "info";
    if (status === "completed") return "success";
    return "muted";
  };

  const getConcernStatusTone = (status: string): Tone => {
    if (status === "Pending Review" || status === "Pending") return "warning";
    if (status === "Reviewed & Verified" || status === "Resolved") return "success";
    if (status === "Dismissed") return "muted";
    return "info";
  };

  const getConcernTypeIcon = (category: string) => {
    switch (category) {
      case "Package Issue":
        return <Package className="size-4 text-warning" />;
      case "Pickup Issue":
        return <MapPin className="size-4 text-info" />;
      case "Delivery Issue":
        return <Truck className="size-4 text-primary" />;
      case "Incorrect System Detection":
        return <AlertTriangle className="size-4 text-destructive" />;
      default:
        return <Info className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <Page
      title={driver.name}
      description={`${driver.id} · ${driver.city || "Not provided"} · ${driver.trips > 0 ? `${driver.trips.toLocaleString()} lifetime trips` : "New driver (0 trips)"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/manager/drivers"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-xs md:text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to drivers
          </Link>
          <MagneticButton variant="primary" icon={<Phone className="size-4" />}>
            Call driver
          </MagneticButton>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs md:text-sm font-semibold text-destructive hover:bg-destructive/20 transition-all cursor-pointer"
          >
            <Trash2 className="size-4" /> Delete Driver
          </button>
        </div>
      }
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {assignedToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="mb-4 flex items-center justify-between rounded-xl border border-primary/40 bg-surface/90 backdrop-blur-xl px-4 py-3 text-sm text-foreground shadow-[var(--shadow-glow)]"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 text-primary shrink-0" />
              <span className="truncate">{assignedToast}</span>
            </div>
            <button onClick={() => setAssignedToast(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. DRIVER HEADER & KEY PERFORMANCE METRIC CARDS */}
      <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Driver Score"
          value={driver.trips > 0 && driver.score > 0 ? String(driver.score) : "N/A"}
          unit={driver.trips > 0 && driver.score > 0 ? "/100" : ""}
          delta={driver.trips > 0 && driver.score > 0 ? "+2.1" : undefined}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Availability"
          value={String(driver.availability ?? 100)}
          unit="%"
          sub="next 7 days"
          icon={<BadgeCheck className="size-4" />}
        />
        <StatCard
          label="Rating"
          value={driver.trips > 0 && driver.rating > 0 ? driver.rating.toFixed(1) : "N/A"}
          unit={driver.trips > 0 && driver.rating > 0 ? "/5" : ""}
          sub={driver.trips > 0 && driver.rating > 0 ? "client feedback" : "0 trips"}
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Trips"
          value={driver.trips.toLocaleString()}
          sub="lifetime"
          icon={<Car className="size-4" />}
        />
      </div>

      {/* AI DRIVER INTELLIGENCE & SUITABILITY PROFILE SECTION */}
      {intelligence && (
        <motion.div variants={fadeUp} className="mt-4">
          <GlassPanel
            title="AI Driver Intelligence Profile"
            subtitle="Machine Learning driving safety evaluation, task suitability indices & telematics assessment"
            actions={
              <div className="flex items-center gap-2">
                <StatusPill tone={intelligence.risk_classification?.toLowerCase() === "low" ? "success" : "warning"}>
                  {intelligence.risk_classification} Risk Profile
                </StatusPill>
                <span className="rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                  Safety Grade {intelligence.safety_grade}
                </span>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Assessment Narrative */}
              <div className="rounded-2xl border border-primary/30 bg-surface-2/40 p-4 space-y-1.5 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Brain className="size-4" /> AI Performance Remarks
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    {intelligence.is_improving ? (
                      <>
                        <TrendingUp className="size-3.5 text-success" /> Trajectory Improving
                      </>
                    ) : (
                      <>
                        <TrendingDown className="size-3.5 text-warning" /> Requires Coaching
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground leading-relaxed font-medium pt-1">
                  "{intelligence.assessment_summary}"
                </p>
              </div>

              {/* 6 Suitability & Performance Score Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Safety Score</span>
                  <span className="text-xl font-extrabold text-success mt-0.5 block">{intelligence.safety_score}/100</span>
                  <span className="text-[10px] text-muted-foreground">Defensive Index</span>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Consistency</span>
                  <span className="text-xl font-extrabold text-foreground mt-0.5 block">{intelligence.consistency_score}%</span>
                  <span className="text-[10px] text-muted-foreground">Speed & G-force</span>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Reliability</span>
                  <span className="text-xl font-extrabold text-foreground mt-0.5 block">{intelligence.delivery_reliability_score}%</span>
                  <span className="text-[10px] text-muted-foreground">On-Time Rate</span>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-surface-2/30 p-3 text-center shadow-[0_0_15px_rgba(6,182,212,0.06)]">
                  <span className="text-[10px] uppercase font-bold text-primary block">Fragile Cargo</span>
                  <span className="text-xl font-extrabold text-primary mt-0.5 block">{intelligence.fragile_suitability_score}%</span>
                  <span className="text-[10px] text-muted-foreground">Smooth Braking</span>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-info block">Long-Distance</span>
                  <span className="text-xl font-extrabold text-info mt-0.5 block">{intelligence.long_distance_suitability_score}%</span>
                  <span className="text-[10px] text-muted-foreground">Highway Corridor</span>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Fuel Efficiency</span>
                  <span className="text-xl font-extrabold text-foreground mt-0.5 block">{intelligence.fuel_efficiency_score}</span>
                  <span className="text-[10px] text-muted-foreground">Eco Modulation</span>
                </div>
              </div>

              {/* Telematics Violation Rates & Coaching */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Granular Telemetry Indicators */}
                <div className="rounded-2xl border border-border/80 bg-surface-2/20 p-3.5 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Telemetry Safety Indicators (per 100 km)
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-surface/50 p-2 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block">Harsh Braking</span>
                      <span className="font-bold text-foreground text-sm">{intelligence.harsh_braking_rate}</span>
                    </div>
                    <div className="rounded-xl bg-surface/50 p-2 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block">Rapid Accel</span>
                      <span className="font-bold text-foreground text-sm">{intelligence.rapid_acceleration_rate}</span>
                    </div>
                    <div className="rounded-xl bg-surface/50 p-2 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block">Speed Alerts</span>
                      <span className="font-bold text-foreground text-sm">{intelligence.speeding_rate}</span>
                    </div>
                  </div>
                </div>

                {/* AI Coaching & Recommendations */}
                <div className="rounded-2xl border border-border/80 bg-surface-2/20 p-3.5 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Strengths & Recommended Tasks
                  </span>
                  <div className="space-y-1">
                    {(intelligence.key_strengths || []).map((s: string) => (
                      <div key={s} className="flex items-center gap-1.5 text-foreground/90 font-medium">
                        <CheckCircle2 className="size-3.5 text-success shrink-0" />
                        <span className="truncate">{s}</span>
                      </div>
                    ))}
                    {(intelligence.improvement_areas || []).map((im: string) => (
                      <div key={im} className="flex items-center gap-1.5 text-amber-300 font-medium">
                        <AlertTriangle className="size-3.5 text-warning shrink-0" />
                        <span className="truncate">{im}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* 2. DRIVER INFORMATION (FIRST MAIN CONTENT SECTION) */}
      <motion.div variants={fadeUp} className="mt-4">
        <GlassPanel
          title="Driver Information"
          subtitle="Personal, contact, employment & vehicle record"
        >
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Subsection 1. Personal & Contact Information */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/20 p-4 min-w-0">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                <User className="size-4 shrink-0" /> Personal & Contact Info
              </h4>
              <dl className="space-y-2.5 text-sm">
                {[
                  { icon: Phone, label: "Phone", value: driver.phone || "Not provided" },
                  { icon: Mail, label: "Email", value: driver.email || "Not provided" },
                  { icon: MapPin, label: "Base City", value: driver.city || "Not provided" },
                  { icon: MapPin, label: "Address", value: employment.address || "Not provided" },
                  { icon: User, label: "Emergency Contact", value: employment.emergencyContact || "Not provided" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-2.5 pt-1 min-w-0">
                    <row.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium">
                        {row.label}
                      </dt>
                      <dd className="text-sm font-medium text-foreground break-words">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Subsection 2. Employment Information */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/20 p-4 min-w-0">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                <Briefcase className="size-4 shrink-0" /> Employment Details
              </h4>
              <dl className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-1">
                {[
                  { label: "Employee ID", value: employment.employeeId || "Not provided" },
                  { label: "Joined On", value: employment.joinedOn || "Not provided" },
                  { label: "Contract Type", value: employment.contractType || "Not provided" },
                  { label: "Shift", value: employment.shift || "Not provided" },
                  { label: "Depot", value: employment.depot || "Not assigned" },
                  { label: "Reporting Manager", value: employment.reportingManager || "Not assigned" },
                ].map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-medium text-foreground break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Subsection 3. Vehicle & Operational Information */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/20 p-4 min-w-0 md:col-span-2 lg:col-span-1">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                <Car className="size-4 shrink-0" /> Vehicle & Operational Info
              </h4>
              <dl className="space-y-3 text-sm">
                {[
                  { label: "Assigned Vehicle", value: driver.vehicle || "Not assigned" },
                  { label: "Licence Number", value: employment.licenceNo || "Not provided" },
                  { label: "Licence Expiry", value: employment.licenceExpiry || "Not provided" },
                ].map((row) => (
                  <div key={row.label} className="rounded-xl border border-border/60 bg-surface/40 p-3 min-w-0">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* 3. ASSIGNMENTS */}
      <motion.div variants={fadeUp} className="mt-4">
        <GlassPanel
          title="Assignments"
          subtitle="Active & scheduled delivery assignments for this driver"
          actions={
            <button
              onClick={() => setShowAssignModal(true)}
              className="group inline-flex items-center gap-2 rounded-xl bg-primary/14 px-3.5 sm:px-4 py-2 text-xs font-semibold text-primary border border-primary/30 shadow-[var(--shadow-glow)] hover:bg-primary hover:text-primary-foreground transition-all duration-300 cursor-pointer shrink-0"
            >
              <Plus className="size-4 transition-transform group-hover:rotate-90 duration-300" />
              <span>Assign Delivery</span>
            </button>
          }
        >
          {driverAssignments.length > 0 ? (
            <div className="space-y-3">
              {driverAssignments.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2/30 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-primary/40 min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primary text-sm sm:text-base">{a.id}</span>
                      <StatusPill tone={getPriorityTone(a.priority)}>{a.priority}</StatusPill>
                      <StatusPill tone={getStatusTone(a.status)} pulse={a.status === "in-transit"}>
                        {a.status === "in-transit" ? "Progress" : a.status === "assigned" ? "Assigned" : "Completed"}
                      </StatusPill>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:border-l sm:border-border sm:pl-3 min-w-0">
                      <p className="flex items-center gap-1.5 text-foreground/90 min-w-0">
                        <Package className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">{a.pickup}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-foreground/90 min-w-0">
                        <MapPin className="size-3.5 shrink-0 text-success" />
                        <span className="truncate">{a.drop}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" /> <span className="truncate">{a.expected}</span>
                    </span>
                    <Link
                      to="/manager/deliveries/$deliveryId"
                      params={{ deliveryId: a.id }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors shrink-0"
                    >
                      View Details
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-surface-2/20 p-8 text-center space-y-2">
              <Package className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No Delivery Assignments</p>
              <p className="text-xs text-muted-foreground">This driver has no active or scheduled delivery assignments.</p>
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* 4. DRIVER CONCERNS & UPDATES */}
      <motion.div variants={fadeUp} className="mt-4">
        <GlassPanel
          title="Driver Concerns & Updates"
          subtitle="Manager action inbox: leave requests, vehicle notices & operational notes"
        >
          {driverConcerns.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {driverConcerns.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-surface-2/25 p-4 transition-colors hover:border-border/80 min-w-0"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-semibold min-w-0">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 border border-border">
                          {getConcernTypeIcon(c.category)}
                        </span>
                        <span className="text-foreground truncate">{c.category}</span>
                      </span>
                      <StatusPill tone={getConcernStatusTone(c.status)}>{c.status}</StatusPill>
                    </div>

                    <h4 className="mt-3 text-sm font-semibold text-foreground leading-snug break-words">
                      {c.description ? (c.description.length > 65 ? c.description.slice(0, 65) + "..." : c.description) : "Driver Concern"}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed break-words">{c.description}</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{c.submittedAt}</span>
                    {c.deliveryId && (
                      <span className="font-mono text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                        {c.deliveryId}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-surface-2/20 p-8 text-center space-y-2">
              <MessageSquare className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No Driver Concerns</p>
              <p className="text-xs text-muted-foreground">No leave requests, vehicle notices, or operational concerns reported for this driver.</p>
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* 5. DRIVING BEHAVIOUR & PERFORMANCE TREND */}
      <div className="mt-4 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <GlassPanel title="Driving behaviour" subtitle="Rolling 30-day telematics">
          {driver.trips > 0 ? (
            <div className="space-y-4">
              {drivingBehaviour.map((b, i) => (
                <div key={b.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-medium">{b.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.value}%` }}
                      transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                      className={cn("h-full rounded-full", toneClass[b.tone])}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-surface-2/20 p-8 text-center space-y-2 py-12">
              <Car className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No Telematics Data</p>
              <p className="text-xs text-muted-foreground max-w-xs">Driving behaviour metrics will be recorded after completing trips.</p>
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="lg:col-span-2 min-w-0" title="Performance trend" subtitle="Driver score over the last 6 months">
          {driver.trips > 0 ? (
            <div className="h-[200px] sm:h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={driverMonthlyScore} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="driverScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[60, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} fill="url(#driverScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] sm:h-[220px] w-full min-w-0 flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-surface-2/20 p-8 text-center space-y-2">
              <TrendingUp className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No Performance History</p>
              <p className="text-xs text-muted-foreground max-w-xs">Monthly performance trend graphs will generate after completing trips.</p>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* 6. COMPLIANCE & DOCUMENT VERIFICATION SECTION */}
      <motion.div variants={fadeUp} className="mt-4">
        <GlassPanel
          title="Compliance & Document Verification"
          subtitle="Review driver compliance credentials, expiry dates, and verification status"
          actions={
            <StatusPill tone={driverDocs.some((d) => d.status === "Pending Verification") ? "warning" : "success"}>
              {driverDocs.filter((d) => d.status === "Pending Verification").length > 0
                ? `${driverDocs.filter((d) => d.status === "Pending Verification").length} Action Required`
                : "All Compliant"}
            </StatusPill>
          }
        >
          <div className="space-y-3">
            {driverDocs.map((doc, i) => {
              const hasFile = Boolean(doc.uploadedFileUrl || doc.uploadedFileName);
              const isPendingVerification = doc.status === "Pending Verification";

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2/30 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-border/80 min-w-0"
                >
                  {/* Left Side: Icon, Name, Required Pill, Document Number */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/14 border border-primary/25 text-primary">
                      {getDocIcon(doc.docType)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-foreground text-sm truncate">{doc.docType}</h4>
                        {doc.required !== undefined && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md tracking-wider border",
                              doc.required
                                ? "bg-warning/15 text-warning border-warning/30"
                                : "bg-surface-2 text-muted-foreground border-border"
                            )}
                          >
                            {doc.required ? "Required" : "Optional"}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block truncate mt-0.5">
                        {doc.docNumber}
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Expiry Date, StatusPill, Actions */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-xs text-muted-foreground">
                      <span>Expires: </span>
                      <strong className={cn(doc.status === "Expired" ? "text-destructive" : "text-foreground")}>
                        {doc.expiryDate}
                      </strong>
                    </div>

                    <StatusPill tone={getDocStatusTone(doc.status)}>
                      {doc.status}
                    </StatusPill>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* VIEW BUTTON: ENABLED IF FILE EXISTS REGARDLESS OF STATUS */}
                      <button
                        disabled={!hasFile}
                        onClick={() => {
                          if (!hasFile) return;
                          setSelectedDocForReview(doc);
                          setShowRejectInput(false);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-xs font-semibold transition-all",
                          hasFile
                            ? "text-foreground hover:border-primary/50 hover:text-primary cursor-pointer"
                            : "text-muted-foreground/40 border-border/40 cursor-not-allowed opacity-40"
                        )}
                        title={hasFile ? "View PDF" : "No file uploaded"}
                      >
                        <Eye className="size-3.5" /> View
                      </button>

                      {/* DOWNLOAD BUTTON: ENABLED IF FILE EXISTS REGARDLESS OF STATUS */}
                      <button
                        disabled={!hasFile}
                        onClick={() => {
                          if (!hasFile) return;
                          handleDownloadDoc(doc);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-xs font-semibold transition-all",
                          hasFile
                            ? "text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
                            : "text-muted-foreground/40 border-border/40 cursor-not-allowed opacity-40"
                        )}
                        title={hasFile ? "Download PDF" : "No file uploaded"}
                      >
                        <Download className="size-3.5" />
                      </button>

                      {/* APPROVE / REJECT: ONLY FOR Pending Verification */}
                      {isPendingVerification && (
                        <>
                          <button
                            onClick={() => handleApproveDoc(doc.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-success-foreground shadow-sm hover:bg-success/90 transition-all cursor-pointer"
                            title="Approve & Verify"
                          >
                            <CheckCircle2 className="size-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDocForReview(doc);
                              setShowRejectInput(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all cursor-pointer"
                            title="Reject"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>

      {/* 7. STRENGTHS & AREAS TO IMPROVE */}
      <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2">
        <GlassPanel title="Strengths" subtitle="What this driver does exceptionally well">
          {driver.strengths && driver.strengths.length > 0 ? (
            <ul className="space-y-2">
              {driver.strengths.map((s: string) => (
                <li key={s} className="flex items-start gap-2 rounded-xl bg-success/8 p-3 text-sm">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="break-words">{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-border/60 bg-surface-2/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">No performance strengths recorded yet.</p>
            </div>
          )}
        </GlassPanel>

        <GlassPanel title="Areas to improve" subtitle="Coaching recommendations from AI">
          {driver.improvements && driver.improvements.length > 0 ? (
            <ul className="space-y-2">
              {driver.improvements.map((s: string) => (
                <li key={s} className="flex items-start gap-2 rounded-xl bg-warning/8 p-3 text-sm">
                  <TrendingUp className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span className="break-words">{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-border/60 bg-surface-2/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">No coaching recommendations recorded yet.</p>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* ASSIGN DELIVERY MODAL */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-lg rounded-3xl border border-border/80 glass-strong p-4 sm:p-6 shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Assign New Delivery</h3>
                  <p className="text-xs text-muted-foreground">
                    Select an unassigned delivery request for <span className="font-semibold text-primary">{driver.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-2/40 p-3.5 sm:p-4 transition-colors hover:border-primary/50 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-primary text-sm">{req.id}</span>
                        <StatusPill tone={getPriorityTone(req.priority)}>{req.priority}</StatusPill>
                        <span className="text-xs text-muted-foreground truncate">{req.client}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-foreground/90 truncate">
                        {req.pickup} → {req.drop}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Package: {req.package} ({req.weight})
                      </p>
                    </div>

                    <button
                      onClick={() => handleAssignDelivery(req.id, req.client)}
                      className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 transition-all cursor-pointer text-center"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOCUMENT REVIEW & VERIFICATION MODAL */}
      <AnimatePresence>
        {selectedDocForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedDocForReview(null);
                setShowRejectInput(false);
              }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-xl rounded-3xl border border-border/80 glass-strong p-5 sm:p-6 shadow-2xl z-10 space-y-4 overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/30">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">{selectedDocForReview.docType}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{selectedDocForReview.docNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedDocForReview(null);
                    setShowRejectInput(false);
                  }}
                  className="rounded-xl border border-border p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Actual PDF Viewer & Verification Card */}
              <div className="rounded-2xl border border-border bg-surface-2/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-border/50 pb-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="size-4 text-primary" /> Certificate #: {selectedDocForReview.docNumber}
                  </span>
                  <StatusPill tone={getDocStatusTone(selectedDocForReview.status)}>
                    {selectedDocForReview.status}
                  </StatusPill>
                </div>

                {selectedDocForReview.uploadedFileUrl ? (
                  <div className="rounded-xl border border-border bg-black/60 overflow-hidden space-y-2">
                    <div className="flex items-center justify-between px-3.5 py-2 bg-surface-2/80 border-b border-border/60 text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <BadgeCheck className="size-4 text-success" /> Verified PDF Document Viewer
                      </span>
                      <button
                        onClick={() => window.open(selectedDocForReview.uploadedFileUrl, "_blank")}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        <ExternalLink className="size-3.5" /> Open in New Tab
                      </button>
                    </div>
                    <iframe
                      src={selectedDocForReview.uploadedFileUrl}
                      title={selectedDocForReview.docType}
                      className="w-full h-[50vh] min-h-[300px] border-none bg-background/90"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/80 bg-background/90 p-8 text-center space-y-2">
                    <AlertTriangle className="size-8 text-warning mx-auto" />
                    <p className="text-sm font-semibold text-foreground">No Document File Uploaded</p>
                    <p className="text-xs text-muted-foreground">The driver has not submitted a certificate file for this item yet.</p>
                  </div>
                )}

                <div className="rounded-xl border border-border/80 bg-background/90 p-3.5 space-y-1 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <p>Driver: <strong className="text-foreground">{selectedDocForReview.driverName}</strong></p>
                    <p>ID: <strong className="text-foreground font-mono">{selectedDocForReview.driverId}</strong></p>
                    <p>Issue Date: <strong className="text-foreground">{selectedDocForReview.issueDate}</strong></p>
                    <p>Expiry Date: <strong className="text-foreground">{selectedDocForReview.expiryDate}</strong></p>
                  </div>
                </div>

                {selectedDocForReview.rejectionReason && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <strong>Current Rejection Reason:</strong> "{selectedDocForReview.rejectionReason}"
                  </div>
                )}

                {showRejectInput && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <label className="text-xs font-bold text-destructive flex items-center gap-1">
                      <AlertTriangle className="size-3.5" /> Enter Rejection Reason
                    </label>
                    <textarea
                      placeholder="e.g. Image resolution too low, expiry date unreadable, missing official seal..."
                      value={rejectionReasonText}
                      onChange={(e) => setRejectionReasonText(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-destructive/40 bg-surface/60 p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-destructive resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                <button
                  disabled={!selectedDocForReview.uploadedFileUrl}
                  onClick={() => handleDownloadDoc(selectedDocForReview)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:border-primary/50 transition-all",
                    selectedDocForReview.uploadedFileUrl ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Download className="size-4 text-primary" /> Download PDF
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedDocForReview(null);
                      setShowRejectInput(false);
                    }}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Close
                  </button>

                  {showRejectInput ? (
                    <button
                      onClick={() => handleRejectDoc(selectedDocForReview.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground shadow-md hover:bg-destructive/90 transition-all cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveDoc(selectedDocForReview.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-bold text-success-foreground shadow-[var(--shadow-glow)] hover:bg-success/90 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="size-4" /> Approve & Verify
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE DRIVER CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl border border-destructive/40 glass-strong p-5 sm:p-6 shadow-2xl z-10 space-y-4 overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive/50 to-transparent"
              />
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-destructive/15 text-destructive border border-destructive/30">
                    <Trash2 className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">Delete Driver Profile</h3>
                    <p className="text-xs text-muted-foreground">Confirm permanent deletion</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-xl border border-border p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Are you sure you want to delete <strong className="text-foreground">{driver.name}</strong> (<span className="font-mono">{driver.id}</span>)?
                </p>
                <p className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-destructive font-medium">
                  This action will permanently remove the driver's profile, credentials, and active assignments. This action cannot be undone.
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteDriver}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-2 text-xs font-bold text-destructive-foreground shadow-md hover:bg-destructive/90 transition-all cursor-pointer"
                >
                  <Trash2 className="size-4" /> Yes, Delete Driver
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Page>
  );
}
