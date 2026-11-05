import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calendar as CalendarIconIcon,
  CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  EyeOff,
  FileText,
  Info,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  PackagePlus,
  PackageSearch,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  X,
  Zap,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteDelivery as apiDeleteDelivery, recommendDrivers } from "@/services/manager.service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/fx/page";
import { GlassPanel } from "@/components/fx/glass-panel";
import { StatCard } from "@/components/fx/stat-card";
import { StatusPill, type Tone } from "@/components/fx/status-pill";
import { AnimatedSearch, FilterChips } from "@/components/fx/controls";
import { deliveries as rawDeliveries, requests as rawRequests } from "@/data/fleet";
import { getConcerns, updateConcernStatus, subscribeConcerns, type DriverConcern } from "@/data/concerns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AddressBlock, type AddressBlockValues, type AddressBlockErrors } from "@/components/client/address-block";
import { DataPagination } from "@/components/common/data-pagination";

export interface UnifiedDeliveryItem {
  id: string;
  client: string;
  clientCompanyId: string;
  pickup: string;
  drop: string;
  driver: string;
  manager: string;
  priority: "Urgent" | "High" | "Normal";
  status: "unassigned" | "assigned" | "in-transit" | "completed" | "cancelled";
  createdOn: string;
  requestDate: string;
  requestedDeliveryDate: string;
  deadlineType: "On a specific date" | "On or before a date" | "Flexible";
  preferredTime?: string;
  expected: string;
  amount: number;
  method: string;
  packageType: string;
  weight: string;
  distance: string;
  estTime: string;
  concern: boolean;
  specialInstructions?: string;
  deliveryNotes?: string;
  handlingReqs?: string;
  additionalDetails?: string;
  driverNotes?: string;
  managerNotes?: string;
  timelineStage?: number; // 1: Assigned, 2: Picked Up, 3: In Transit, 4: Checkpoint, 5: Delivered
}

interface RecommendedDriver {
  name: string;
  score: number;
  availability: string;
  suitability: number;
  reasons: string[];
}

const mockDriverRecommendations: RecommendedDriver[] = [
  {
    name: "Priya Nair",
    score: 94,
    availability: "Available Now",
    suitability: 96,
    reasons: ["Cold-chain certified", "Familiar with Bhiwandi-Thane route", "High safety rating (4.8/5)"],
  },
  {
    name: "Rahul Sharma",
    score: 87,
    availability: "Available in 30m",
    suitability: 92,
    reasons: ["Available immediately", "Perfect POD compliance", "Low risk profile"],
  },
  {
    name: "Imran Sheikh",
    score: 82,
    availability: "Available Today",
    suitability: 85,
    reasons: ["Long-haul experience", "Heavy cargo qualified", "On-time record (98%)"],
  },
];

type FilterTab = "all" | "unassigned" | "assigned" | "in-transit" | "completed" | "high-priority" | "driver-concerns";

const filterTabs: readonly { value: FilterTab; label: string; highlight?: boolean }[] = [
  { value: "all", label: "All Deliveries" },
  { value: "unassigned", label: "Pending Assignment", highlight: true },
  { value: "assigned", label: "Assigned" },
  { value: "in-transit", label: "Progress" },
  { value: "completed", label: "Completed" },
  { value: "high-priority", label: "High Priority" },
  { value: "driver-concerns", label: "Driver Concerns", highlight: true },
];

const initialAddress: AddressBlockValues = {
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

export function ManagerDeliveriesPage() {
  const navigate = useNavigate();
  const [concerns, setConcerns] = useState<DriverConcern[]>(() => getConcerns());

  useEffect(() => {
    return subscribeConcerns(() => {
      setConcerns([...getConcerns()]);
    });
  }, []);

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedDelivery, setSelectedDelivery] = useState<UnifiedDeliveryItem | null>(null);
  const [showAiRecommendations, setShowAiRecommendations] = useState(false);
  const [assignedToast, setAssignedToast] = useState<string | null>(null);

  // Dynamic ML Recommendations state
  const [dynamicRecommendations, setDynamicRecommendations] = useState<any[]>([]);
  const [loadingAiRecs, setLoadingAiRecs] = useState(false);
  const [recScenario, setRecScenario] = useState<string>("Standard Delivery");

  useEffect(() => {
    setShowAiRecommendations(false);
    setDynamicRecommendations([]);
  }, [selectedDelivery?.id]);

  const handleFetchAiRecommendations = async () => {
    if (!selectedDelivery) return;
    setShowAiRecommendations(true);
    setLoadingAiRecs(true);
    try {
      const isFragile =
        selectedDelivery.packageType?.toLowerCase().includes("fragile") ||
        selectedDelivery.handlingReqs?.toLowerCase().includes("fragile") ||
        selectedDelivery.packageType?.toLowerCase().includes("medical") ||
        selectedDelivery.packageType?.toLowerCase().includes("electronics");

      const parsedWeight = parseFloat(selectedDelivery.weight?.replace(/[^0-9.]/g, "") || "15");
      const parsedDist = parseFloat(selectedDelivery.distance?.replace(/[^0-9.]/g, "") || "45");

      const payload = {
        requestId: selectedDelivery.id,
        pickupAddress: selectedDelivery.pickup,
        dropAddress: selectedDelivery.drop,
        packageCategory: selectedDelivery.packageType,
        weightKg: isNaN(parsedWeight) ? 15.0 : parsedWeight,
        handleWithCare: isFragile,
        priority: selectedDelivery.priority.toLowerCase(),
        distanceKm: isNaN(parsedDist) ? 45.0 : parsedDist,
        estimatedCost: selectedDelivery.amount,
      };

      const res = await recommendDrivers(payload);
      if (res && res.data && res.data.top_recommendations && res.data.top_recommendations.length > 0) {
        setDynamicRecommendations(res.data.top_recommendations);
        setRecScenario(res.data.scenario || (isFragile ? "Fragile Delivery" : "Standard Delivery"));
        toast.success(`ML Engine evaluated eligible drivers for ${res.data.scenario}.`);
      } else {
        // Fallback demo drivers tailored to package type
        const fallbackList = isFragile
          ? [
              {
                driver_name: "Rahul Sharma",
                suitability_score: 96.8,
                safety_score: 96.0,
                risk_level: "Low",
                assigned_vehicle: "Tata Ace Gold EV",
                reason_summary: "Rahul demonstrates outstanding braking discipline and consistent delivery on fragile freight.",
                match_reasons: ["Zero harsh deceleration events recorded", "Fragile cargo handling certified", "High safety rating (96/100)"],
              },
              {
                driver_name: "Priya Nair",
                suitability_score: 91.5,
                safety_score: 94.0,
                risk_level: "Low",
                assigned_vehicle: "Tata Intra V30",
                reason_summary: "Priya maintains high driving consistency and reliable on-time delivery across sensitive cargo routes.",
                match_reasons: ["Smooth progressive braking", "Familiar with Bhiwandi-Thane route", "97% on-time rate"],
              },
              {
                driver_name: "Vikram Patil",
                suitability_score: 72.0,
                safety_score: 83.0,
                risk_level: "Moderate",
                assigned_vehicle: "Ashok Leyland Dost+",
                reason_summary: "Vikram is available and qualified, though historical telemetry shows slightly higher acceleration/braking variation.",
                match_reasons: ["Available immediately", "Vehicle capacity is compliant", "Moderate risk profile"],
              },
            ]
          : mockDriverRecommendations.map((d) => ({
              driver_name: d.name,
              suitability_score: d.suitability,
              safety_score: d.score,
              risk_level: "Low",
              assigned_vehicle: "Fleet Delivery Van",
              reason_summary: d.reasons.join(" • "),
              match_reasons: d.reasons,
            }));

        setDynamicRecommendations(fallbackList);
        setRecScenario(isFragile ? "Fragile Delivery" : "Standard Delivery");
      }
    } catch (err) {
      console.warn("Could not call recommendDrivers API, using fallback recommendations:", err);
      setDynamicRecommendations(
        mockDriverRecommendations.map((d) => ({
          driver_name: d.name,
          suitability_score: d.suitability,
          safety_score: d.score,
          risk_level: "Low",
          assigned_vehicle: "Fleet Delivery Van",
          reason_summary: d.reasons.join(" • "),
          match_reasons: d.reasons,
        }))
      );
    } finally {
      setLoadingAiRecs(false);
    }
  };

  // Manager Notes editing state
  const [editingNote, setEditingNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedToast, setNoteSavedToast] = useState<string | null>(null);

  // Create Delivery Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createClientName, setCreateClientName] = useState("");
  const [createClientCompanyId, setCreateClientCompanyId] = useState("");
  const [createDateMode, setCreateDateMode] = useState<"on" | "before" | "flexible">("on");
  const [createDate, setCreateDate] = useState<Date | undefined>();
  const [createPreferredTime, setCreatePreferredTime] = useState("");

  const [createPickup, setCreatePickup] = useState<AddressBlockValues>({
    address1: "Gate 4, Bhiwandi Logistics Hub",
    address2: "",
    city: "Bhiwandi",
    state: "Maharashtra",
    zip: "421302",
    country: "India",
  });

  const [createDrop, setCreateDrop] = useState<AddressBlockValues>({
    address1: "Tower 2, Magarpatta Cybercity",
    address2: "",
    city: "Pune",
    state: "Maharashtra",
    zip: "411028",
    country: "India",
  });

  const [createWeight, setCreateWeight] = useState("");
  const [createSize, setCreateSize] = useState("");
  const [createPackageType, setCreatePackageType] = useState("");
  const [createHandleWithCare, setCreateHandleWithCare] = useState("");
  const [createPriority, setCreatePriority] = useState("");
  const [createSpecialInstructions, setCreateSpecialInstructions] = useState("");
  const [createHandlingReqs, setCreateHandlingReqs] = useState("");
  const [createDeliveryNotes, setCreateDeliveryNotes] = useState("");
  const [createAdditionalDetails, setCreateAdditionalDetails] = useState("");

  const [createFormErrors, setCreateFormErrors] = useState<Record<string, boolean>>({});

  // Delete Delivery states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<UnifiedDeliveryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDeliveryClick = (delivery: UnifiedDeliveryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeliveryToDelete(delivery);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deliveryToDelete) return;
    setIsDeleting(true);
    try {
      await apiDeleteDelivery(deliveryToDelete.id).catch(() => {});
      setItems((prev) => prev.filter((item) => item.id !== deliveryToDelete.id));
      if (selectedDelivery?.id === deliveryToDelete.id) {
        setSelectedDelivery(null);
      }
      toast.success(`Delivery ${deliveryToDelete.id} deleted successfully.`);
    } catch (error) {
      toast.error("Failed to delete delivery.");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeliveryToDelete(null);
    }
  };

  // Combine rawDeliveries & rawRequests into a single unified dataset with rich request details
  const [items, setItems] = useState<UnifiedDeliveryItem[]>(() => {
    const fromDeliveries: UnifiedDeliveryItem[] = rawDeliveries.map((d, index) => ({
      id: d.id,
      client: index % 2 === 0 ? "Techlink Corp." : "Acme Logistics",
      clientCompanyId: `CLT-880${(index % 5) + 1}`,
      pickup: d.pickup,
      drop: d.drop,
      driver: d.driver === "—" ? "Unassigned" : d.driver,
      manager: d.manager,
      priority: index % 3 === 0 ? "Urgent" : index % 2 === 0 ? "High" : "Normal",
      status: d.status as UnifiedDeliveryItem["status"],
      createdOn: d.createdOn,
      requestDate: "May 08, 2026, 10:15 AM",
      requestedDeliveryDate: d.expected,
      deadlineType: index % 2 === 0 ? "On or before a date" : "On a specific date",
      preferredTime: "Before 18:00 PM",
      expected: d.expected,
      amount: d.amount,
      method: d.method,
      packageType: index % 2 === 0 ? "Electronics & Spares" : "Medical Equipment",
      weight: "18.5 kg",
      distance: "142 km",
      estTime: "3h 20m",
      concern: d.concern,
      specialInstructions: "Temperature-controlled storage required (4°C – 8°C).",
      deliveryNotes: "Customer requested back-gate access code #4091 for entry after 18:00 PM.",
      handlingReqs: "Fragile cargo. Do not stack heavy items on top.",
      additionalDetails: "Unloading dock height: 1.2m. Tailgate ramp required at drop-off.",
      driverNotes: "Customer requested back-gate access code #4091 for entry after 18:00 PM.",
      managerNotes: "AI Copilot verified route clearance on NH48 highway.",
      timelineStage: d.status === "completed" ? 5 : d.status === "in-transit" ? 3 : d.status === "assigned" ? 1 : 0,
    }));

    const fromRequests: UnifiedDeliveryItem[] = rawRequests.map((r, index) => ({
      id: r.id,
      client: r.client,
      clientCompanyId: `CLT-770${(index % 4) + 1}`,
      pickup: r.pickup,
      drop: r.drop,
      driver: "Unassigned",
      manager: "Amit Rao",
      priority: r.priority as "Urgent" | "High" | "Normal",
      status: r.status === "Assigned" ? "assigned" : "unassigned",
      createdOn: "May 10, 2026",
      requestDate: "May 10, 2026, 09:30 AM",
      requestedDeliveryDate: r.preferredDate,
      deadlineType: index % 3 === 0 ? "On a specific date" : index % 2 === 0 ? "On or before a date" : "Flexible",
      preferredTime: "Before 17:00 PM",
      expected: r.preferredDate,
      amount: 3200,
      method: "Pending UPI",
      packageType: r.package,
      weight: r.weight,
      distance: "98 km",
      estTime: "2h 45m",
      concern: false,
      specialInstructions: "Call receiving manager 30 mins prior to arrival at Gate B.",
      deliveryNotes: "Requires expedited unloading & digital POD verification upon arrival.",
      handlingReqs: "Moisture-sensitive packaging. Keep sealed until indoors.",
      additionalDetails: "Security pre-clearance completed. Driver must carry valid ID.",
      driverNotes: "Awaiting driver assignment.",
      managerNotes: "Incoming client shipment request awaiting manager review.",
      timelineStage: r.status === "Assigned" ? 1 : 0,
    }));

    return [...fromRequests, ...fromDeliveries];
  });

  // Sync editing note whenever a new delivery is selected
  useEffect(() => {
    if (selectedDelivery) {
      setEditingNote(selectedDelivery.managerNotes ?? "");
    }
  }, [selectedDelivery?.id]);

  // Calculate summary metric counts
  const totalCount = items.length;
  const pendingCount = items.filter((i) => i.status === "unassigned" || i.driver === "Unassigned").length;
  const activeCount = items.filter((i) => i.status === "in-transit" || i.status === "assigned").length;
  const highPriorityCount = items.filter((i) => i.priority === "High" || i.priority === "Urgent").length;

  // Filter rows based on search query & active tab
  const rows = items.filter((item) => {
    const q = (item.id + item.client + item.driver + item.pickup + item.drop + item.manager)
      .toLowerCase()
      .includes(query.toLowerCase());

    if (!q) return false;

    if (activeTab === "all") return true;
    if (activeTab === "unassigned") return item.status === "unassigned" || item.driver === "Unassigned";
    if (activeTab === "assigned") return item.status === "assigned";
    if (activeTab === "in-transit") return item.status === "in-transit";
    if (activeTab === "completed") return item.status === "completed";
    if (activeTab === "high-priority") return item.priority === "High" || item.priority === "Urgent";
    return true;
  });

  const PAGE_SIZE = 10;
  const [deliveriesPage, setDeliveriesPage] = useState(1);
  const [concernsPage, setConcernsPage] = useState(1);

  useEffect(() => {
    setDeliveriesPage(1);
  }, [query, activeTab]);

  useEffect(() => {
    setConcernsPage(1);
  }, [query, activeTab]);

  const totalDeliveriesPages = Math.ceil(rows.length / PAGE_SIZE);
  const paginatedRows = rows.slice((deliveriesPage - 1) * PAGE_SIZE, deliveriesPage * PAGE_SIZE);

  const totalConcernsPages = Math.ceil(concerns.length / PAGE_SIZE);
  const paginatedConcerns = concerns.slice((concernsPage - 1) * PAGE_SIZE, concernsPage * PAGE_SIZE);

  const tabOptions = filterTabs.map((t) => {
    let count = totalCount;
    if (t.value === "unassigned") count = pendingCount;
    if (t.value === "assigned") count = items.filter((i) => i.status === "assigned").length;
    if (t.value === "in-transit") count = items.filter((i) => i.status === "in-transit").length;
    if (t.value === "completed") count = items.filter((i) => i.status === "completed").length;
    if (t.value === "high-priority") count = highPriorityCount;
    if (t.value === "driver-concerns") count = concerns.length;

    return {
      value: t.value,
      label: t.label + ((t.value === "unassigned" || t.value === "driver-concerns") && count > 0 ? ` (${count})` : ""),
      count,
    };
  });

  const handleAssignDriver = (deliveryId: string, driverName: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === deliveryId
          ? {
              ...item,
              driver: driverName,
              status: "assigned",
              timelineStage: 1,
              driverNotes: `Assigned to ${driverName}. Awaiting pickup dispatch.`,
            }
          : item
      )
    );

    if (selectedDelivery && selectedDelivery.id === deliveryId) {
      setSelectedDelivery((prev) =>
        prev
          ? {
              ...prev,
              driver: driverName,
              status: "assigned",
              timelineStage: 1,
              driverNotes: `Assigned to ${driverName}. Awaiting pickup dispatch.`,
            }
          : null
      );
    }

    setAssignedToast(`Successfully assigned ${deliveryId} to ${driverName}`);
    setTimeout(() => setAssignedToast(null), 4500);
  };

  const handleSaveManagerNote = (deliveryId: string, note: string) => {
    setIsSavingNote(true);
    setTimeout(() => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === deliveryId
            ? { ...item, managerNotes: note }
            : item
        )
      );

      if (selectedDelivery && selectedDelivery.id === deliveryId) {
        setSelectedDelivery((prev) =>
          prev ? { ...prev, managerNotes: note } : null
        );
      }

      setIsSavingNote(false);
      setNoteSavedToast("Manager note saved successfully");
      setTimeout(() => setNoteSavedToast(null), 3000);
    }, 400);
  };

  const handleCreateDeliverySubmit = () => {
    const errors: Record<string, boolean> = {};

    if (!createClientName.trim()) errors["clientName"] = true;
    if (!createPickup.address1.trim()) errors["pickup.address1"] = true;
    if (!createPickup.city.trim()) errors["pickup.city"] = true;
    if (!createPickup.state.trim()) errors["pickup.state"] = true;
    if (!createPickup.zip.trim()) errors["pickup.zip"] = true;

    if (!createDrop.address1.trim()) errors["drop.address1"] = true;
    if (!createDrop.city.trim()) errors["drop.city"] = true;
    if (!createDrop.state.trim()) errors["drop.state"] = true;
    if (!createDrop.zip.trim()) errors["drop.zip"] = true;

    const parsedWeight = parseInt(createWeight.trim(), 10);
    if (!createWeight.trim() || isNaN(parsedWeight) || !/^\d+$/.test(createWeight.trim()) || parsedWeight <= 0) {
      errors["weight"] = true;
    }
    if (createSize.trim()) {
      const parsedSize = parseFloat(createSize.trim());
      if (isNaN(parsedSize) || !/^\d*\.?\d+$/.test(createSize.trim()) || parsedSize <= 0) {
        errors["size"] = true;
      }
    }
    if (!createPackageType) errors["packageType"] = true;
    if (!createPriority) errors["priority"] = true;

    if ((createDateMode === "on" || createDateMode === "before") && !createDate) {
      errors["date"] = true;
    }

    setCreateFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const generatedId = `DEL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const formattedPickup = `${createPickup.address1}, ${createPickup.city}, ${createPickup.state} ${createPickup.zip}`;
    const formattedDrop = `${createDrop.address1}, ${createDrop.city}, ${createDrop.state} ${createDrop.zip}`;

    const newDelivery: UnifiedDeliveryItem = {
      id: generatedId,
      client: createClientName.trim(),
      clientCompanyId: createClientCompanyId.trim() || `CLT-${Math.floor(1000 + Math.random() * 9000)}`,
      pickup: formattedPickup,
      drop: formattedDrop,
      driver: "Unassigned",
      manager: "Amit Rao",
      priority: createPriority === "urgent" ? "Urgent" : createPriority === "high" ? "High" : "Normal",
      status: "unassigned",
      createdOn: format(new Date(), "MMM dd, yyyy"),
      requestDate: format(new Date(), "MMM dd, yyyy, hh:mm a"),
      requestedDeliveryDate: createDate ? format(createDate, "MMM dd, yyyy") : "May 15, 2026",
      deadlineType: createDateMode === "on" ? "On a specific date" : createDateMode === "before" ? "On or before a date" : "Flexible",
      preferredTime: createPreferredTime.trim() || "Before 17:00 PM",
      expected: createDate ? format(createDate, "MMM dd, yyyy") : "May 15, 2026",
      amount: 2450,
      method: "Pending UPI",
      packageType: createPackageType ? createPackageType.charAt(0).toUpperCase() + createPackageType.slice(1) : "General Freight",
      weight: `${parsedWeight} kg`,
      distance: "110 km",
      estTime: "3h 15m",
      concern: false,
      specialInstructions: createSpecialInstructions.trim() || "No special instructions provided.",
      handlingReqs: createHandlingReqs.trim() || (createHandleWithCare === "yes" ? "Handle with care. Fragile items." : "Standard handling."),
      deliveryNotes: createSpecialInstructions.trim() || "Awaiting driver dispatch.",
      additionalDetails: "Standard security clearance required.",
      driverNotes: "Awaiting driver assignment.",
      managerNotes: "Created manually by Fleet Manager.",
      timelineStage: 0,
    };

    setItems((prev) => [newDelivery, ...prev]);
    setIsCreateModalOpen(false);
    setAssignedToast(`Delivery ${generatedId} created successfully as Pending Assignment.`);
    setTimeout(() => setAssignedToast(null), 5000);

    // Automatically open newly created delivery
    setSelectedDelivery(newDelivery);
  };

  const getPriorityTone = (priority: string): Tone => {
    if (priority === "Urgent") return "destructive";
    if (priority === "High") return "warning";
    return "muted";
  };

  const getStatusTone = (status: string, driver: string): Tone => {
    if (status === "unassigned" || driver === "Unassigned") return "muted";
    if (status === "in-transit") return "primary";
    if (status === "assigned") return "info";
    if (status === "completed") return "success";
    return "muted";
  };

  const getStatusLabel = (status: string, driver: string) => {
    if (status === "unassigned" || driver === "Unassigned") return "-";
    if (status === "in-transit") return "Progress";
    if (status === "assigned") return "Assigned";
    if (status === "completed") return "Completed";
    return status;
  };

  return (
    <Page
      title="List of Deliveries"
      description="Monitor live deliveries, review incoming requests, and assign drivers."
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
              <span>{assignedToast}</span>
            </div>
            <button onClick={() => setAssignedToast(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUMMARY CARDS */}
      <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Deliveries"
          value={String(totalCount)}
          sub="Active & requests"
          icon={<Truck className="size-4 text-primary" />}
        />
        <StatCard
          label="Pending Assignment"
          value={String(pendingCount)}
          sub="Requires manager action"
          icon={<AlertCircle className="size-4 text-warning animate-pulse" />}
        />
        <StatCard
          label="Active / Progress"
          value={String(activeCount)}
          sub="Currently on route"
          icon={<Clock className="size-4 text-primary" />}
        />
        <StatCard
          label="High Priority"
          value={String(highPriorityCount)}
          sub="Urgent dispatch"
          icon={<Zap className="size-4 text-destructive" />}
        />
      </div>

      {/* DELIVERY FILTERS, SEARCH & CREATE DELIVERY ACTION */}
      <div className="mt-6 flex w-full items-center justify-between gap-3 overflow-hidden">
        <AnimatedSearch
          value={query}
          onChange={setQuery}
          placeholder="Search ID, client, driver, pickup or destination…"
          className="w-44 lg:w-52 shrink-0"
        />
        <FilterChips
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val as FilterTab)}
          layoutId="manager-unified-delivery-filter"
          className="min-w-0 flex-1"
        />

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 transition-all cursor-pointer shrink-0 ml-auto whitespace-nowrap"
        >
          <Plus className="size-4" /> Create Delivery
        </button>
      </div>

      {/* MAIN CONTENT TABLE / DRIVER CONCERNS PANEL */}
      <GlassPanel className="mt-4 p-0" hoverable={false}>
        {activeTab === "driver-concerns" ? (
          <div className="overflow-x-auto p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-400" /> Driver Concerns & Telematics Overrides
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review driver-reported operational issues & explanations for system-detected events.
                </p>
              </div>
              <StatusPill tone="warning">{concerns.length} Concerns Recorded</StatusPill>
            </div>

            <div className="space-y-3">
              {paginatedConcerns.map((c: DriverConcern) => (
                <div key={c.id} className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-primary text-xs">{c.id}</span>
                      <StatusPill tone={c.category === "Incorrect System Detection" ? "warning" : "info"}>
                        {c.category}
                      </StatusPill>
                      {c.deliveryId && <span className="text-xs font-mono text-muted-foreground">· {c.deliveryId}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Driver: <strong className="text-foreground">{c.driverName}</strong> ({c.driverId})</span>
                      <span>{c.submittedAt}</span>
                      <StatusPill tone={c.status === "Reviewed & Verified" ? "success" : c.status === "Dismissed" ? "muted" : "warning"}>
                        {c.status}
                      </StatusPill>
                    </div>
                  </div>

                  {/* System Event & Driver Context Side-by-Side */}
                  {c.category === "Incorrect System Detection" && c.systemDetectedEvent && (
                    <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-surface/60 border border-border/60 p-3 text-xs">
                      <div className="space-y-1 border-r border-border/60 pr-3">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">1. System-Detected Event (Recorded)</span>
                        <div className="font-semibold text-foreground flex items-center justify-between">
                          <span>{c.systemDetectedEvent.type}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{c.systemDetectedEvent.timestamp}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{c.systemDetectedEvent.details} · {c.systemDetectedEvent.location}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 block">2. Driver's Explanation / Context</span>
                        <div className="font-semibold text-amber-300">
                          Reason: {c.contextReason || "Sudden obstacle"}
                        </div>
                        <p className="text-foreground text-[11px] leading-relaxed font-medium">"{c.description}"</p>
                      </div>
                    </div>
                  )}

                  {c.category !== "Incorrect System Detection" && (
                    <div className="rounded-xl bg-surface/60 border border-border/60 p-3 text-xs">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Driver's Reported Details</span>
                      <p className="text-foreground leading-relaxed">"{c.description}"</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {c.status !== "Reviewed & Verified" && (
                      <button
                        onClick={() => updateConcernStatus(c.id, "Reviewed & Verified")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/15 border border-success/30 text-xs font-semibold text-success hover:bg-success/25 cursor-pointer"
                      >
                        <CheckCircle2 className="size-3.5" /> Approve Context & Verify
                      </button>
                    )}
                    {c.status !== "Dismissed" && (
                      <button
                        onClick={() => updateConcernStatus(c.id, "Dismissed")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DataPagination
              currentPage={concernsPage}
              totalPages={totalConcernsPages}
              totalItems={concerns.length}
              pageSize={PAGE_SIZE}
              onPageChange={setConcernsPage}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-medium">
                <thead>
                  <tr className="border-b border-border/80 text-left text-xs uppercase tracking-wider text-muted-foreground/80 bg-surface-2/20">
                    <th className="px-3.5 py-3 font-semibold">Delivery ID</th>
                    <th className="px-3.5 py-3 font-semibold">Client</th>
                    <th className="px-3.5 py-3 font-semibold">Route</th>
                    <th className="px-3.5 py-3 font-semibold">Assigned Driver</th>
                    <th className="px-3.5 py-3 font-semibold">Priority</th>
                    <th className="px-3.5 py-3 font-semibold">ETA / Date</th>
                    <th className="px-3.5 py-3 font-semibold">Status</th>
                    <th className="px-3.5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <AnimatePresence mode="popLayout">
                    {paginatedRows.map((d, i) => {
                      const isUnassigned = d.status === "unassigned" || d.driver === "Unassigned";
                      return (
                        <motion.tr
                          key={d.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => setSelectedDelivery(d)}
                          className="cursor-pointer transition-colors hover:bg-surface-2/40"
                        >
                          <td className="px-3.5 py-3 font-mono font-bold text-primary text-xs">{d.id}</td>
                          <td className="px-3.5 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                            {d.client}
                          </td>
                          <td className="px-3.5 py-3 text-xs text-muted-foreground max-w-[220px] truncate">
                            <span className="text-foreground font-medium">{d.pickup}</span>
                            <span className="text-muted-foreground font-normal"> → {d.drop}</span>
                          </td>
                          <td className="px-3.5 py-3 text-xs">
                            {isUnassigned ? (
                              <span className="text-destructive font-semibold">Unassigned</span>
                            ) : (
                              <span className="text-foreground font-semibold">{d.driver}</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            <StatusPill tone={getPriorityTone(d.priority)}>{d.priority}</StatusPill>
                          </td>
                          <td className="px-3.5 py-3 text-xs text-muted-foreground whitespace-nowrap">{d.expected}</td>
                          <td className="px-3.5 py-3 text-xs">
                            {isUnassigned ? (
                              <span className="text-muted-foreground font-semibold text-sm px-1.5">-</span>
                            ) : (
                              <StatusPill
                                tone={getStatusTone(d.status, d.driver)}
                                pulse={d.status === "in-transit"}
                              >
                                {getStatusLabel(d.status, d.driver)}
                              </StatusPill>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDelivery(d);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                              <button
                                onClick={(e) => handleDeleteDeliveryClick(d, e)}
                                className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                                title="Delete Delivery"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <DataPagination
              currentPage={deliveriesPage}
              totalPages={totalDeliveriesPages}
              totalItems={rows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setDeliveriesPage}
            />

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <PackageSearch className="size-6" />
                </span>
                <p className="text-sm font-medium text-foreground">No deliveries match the filter</p>
                <p className="text-xs text-muted-foreground">Try clearing your search query or selecting a different tab.</p>
              </div>
            )}
          </>
        )}
      </GlassPanel>

      {/* CREATE DELIVERY FORM MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl border border-border/80 glass-strong p-5 sm:p-6 shadow-2xl z-10 overflow-y-auto flex flex-col justify-between overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
              <div className="space-y-5">
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-border pb-4 gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-foreground flex items-center gap-2">
                      <PackagePlus className="size-5 text-primary" /> Create New Delivery
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manually enter a client shipment request into the fleet management system.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Form Content */}
                <div className="space-y-4 text-xs">
                  {/* Client Details */}
                  <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                      Client & Company Details
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          <span>Client Name <span className="text-destructive">*</span></span>
                          {createFormErrors["clientName"] && <span className="text-destructive text-[10px]">Required</span>}
                        </Label>
                        <Input
                          placeholder="e.g. Techlink Corp."
                          value={createClientName}
                          onChange={(e) => setCreateClientName(e.target.value)}
                          className={cn("bg-surface/40", createFormErrors["clientName"] && "border-destructive")}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Client / Company ID</Label>
                        <Input
                          placeholder="e.g. CLT-8802"
                          value={createClientCompanyId}
                          onChange={(e) => setCreateClientCompanyId(e.target.value)}
                          className="bg-surface/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pickup & Drop Addresses */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AddressBlock
                      title="Pickup Location"
                      values={createPickup}
                      onChange={(field, val) => setCreatePickup((prev) => ({ ...prev, [field]: val }))}
                      errors={{
                        ...(createFormErrors["pickup.address1"] ? { address1: true } : {}),
                        ...(createFormErrors["pickup.city"] ? { city: true } : {}),
                        ...(createFormErrors["pickup.state"] ? { state: true } : {}),
                        ...(createFormErrors["pickup.zip"] ? { zip: true } : {}),
                      }}
                    />
                    <AddressBlock
                      title="Drop-off Location"
                      values={createDrop}
                      onChange={(field, val) => setCreateDrop((prev) => ({ ...prev, [field]: val }))}
                      errors={{
                        ...(createFormErrors["drop.address1"] ? { address1: true } : {}),
                        ...(createFormErrors["drop.city"] ? { city: true } : {}),
                        ...(createFormErrors["drop.state"] ? { state: true } : {}),
                        ...(createFormErrors["drop.zip"] ? { zip: true } : {}),
                      }}
                    />
                  </div>

                  {/* Package Details */}
                  <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                      Package & Cargo Details
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          <span>Weight (kg) <span className="text-destructive">*</span></span>
                          {createFormErrors["weight"] && <span className="text-destructive text-[10px]">Must be integer</span>}
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          placeholder="e.g. 18"
                          value={createWeight}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+$/.test(val)) {
                              setCreateWeight(val);
                            }
                          }}
                          className={cn("bg-surface/40", createFormErrors["weight"] && "border-destructive")}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          <span>Size / Dimensions (cm)</span>
                          {createFormErrors["size"] && <span className="text-destructive text-[10px]">Must be numeric</span>}
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="e.g. 45.5"
                          value={createSize}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setCreateSize(val);
                            }
                          }}
                          className={cn("bg-surface/40", createFormErrors["size"] && "border-destructive")}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          <span>Package Type <span className="text-destructive">*</span></span>
                          {createFormErrors["packageType"] && <span className="text-destructive text-[10px]">Required</span>}
                        </Label>
                        <Select value={createPackageType} onValueChange={setCreatePackageType}>
                          <SelectTrigger className={cn("bg-surface/40", createFormErrors["packageType"] && "border-destructive")}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Electronics", "Medicine", "Furniture", "Document", "Food", "Clothes", "Supplies", "Other"].map((t) => (
                              <SelectItem key={t} value={t.toLowerCase()}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Handle with Care</Label>
                        <Select value={createHandleWithCare} onValueChange={setCreateHandleWithCare}>
                          <SelectTrigger className="bg-surface/40">
                            <SelectValue placeholder="Yes / No" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          <span>Priority <span className="text-destructive">*</span></span>
                          {createFormErrors["priority"] && <span className="text-destructive text-[10px]">Required</span>}
                        </Label>
                        <Select value={createPriority} onValueChange={setCreatePriority}>
                          <SelectTrigger className={cn("bg-surface/40", createFormErrors["priority"] && "border-destructive")}>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Preferred Delivery Time</Label>
                        <Input
                          placeholder="e.g. Before 05:00 PM"
                          value={createPreferredTime}
                          onChange={(e) => setCreatePreferredTime(e.target.value)}
                          className="bg-surface/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Date & Flexibility Requirement */}
                  <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                      Delivery Schedule & Requirement
                    </h4>
                    <ToggleGroup
                      type="single"
                      value={createDateMode}
                      onValueChange={(val) => val && setCreateDateMode(val as any)}
                      className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
                    >
                      {[
                        { value: "on", label: "Deliver on", hint: "Select an exact date" },
                        { value: "before", label: "Deliver before", hint: "Select a deadline date" },
                        { value: "flexible", label: "Flexible", hint: "Date is optional" },
                      ].map((m) => (
                        <ToggleGroupItem
                          key={m.value}
                          value={m.value}
                          className={cn(
                            "h-auto w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-surface/40 px-4 py-2.5 text-left",
                            "data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
                          )}
                        >
                          <span className="text-xs font-bold">{m.label}</span>
                          <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    {createDateMode !== "flexible" && (
                      <div className="pt-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "flex h-9 w-full sm:w-64 items-center justify-between rounded-xl border border-border bg-surface/40 px-3 text-xs text-foreground",
                                !createDate && "text-muted-foreground",
                                createFormErrors["date"] && "border-destructive"
                              )}
                            >
                              {createDate ? format(createDate, "PPP") : <span>Pick a target date</span>}
                              <CalendarIconIcon className="size-4 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <CalendarPicker
                              mode="single"
                              selected={createDate}
                              onSelect={setCreateDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  {/* Client Instructions & Notes */}
                  <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                      Delivery & Handling Instructions
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Delivery Instructions</Label>
                        <Textarea
                          placeholder="e.g. Call receiving manager 30 mins prior to arrival, gate access code #4091..."
                          value={createSpecialInstructions}
                          onChange={(e) => setCreateSpecialInstructions(e.target.value)}
                          rows={3}
                          className="bg-surface/40 text-xs resize-none min-h-[85px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Handling Instructions</Label>
                        <Textarea
                          placeholder="e.g. Temperature-controlled storage required, keep upright, fragile cargo..."
                          value={createHandlingReqs}
                          onChange={(e) => setCreateHandlingReqs(e.target.value)}
                          rows={3}
                          className="bg-surface/40 text-xs resize-none min-h-[85px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-border mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeliverySubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 transition-all cursor-pointer"
                >
                  <Plus className="size-4" /> Create Delivery Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UNASSIGNED DELIVERY / REQUEST DETAILS POPUP OVERLAY */}
      <AnimatePresence>
        {selectedDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDelivery(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl border border-border/80 glass-strong p-5 sm:p-6 shadow-2xl z-10 overflow-y-auto flex flex-col justify-between overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
              <div className="space-y-5">
                {/* 1. TOP SECTION: REQUEST ID, PRIORITY, STATUS, REQUEST DATE */}
                <div className="flex items-start justify-between border-b border-border pb-4 gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {selectedDelivery.id}
                      </span>
                      <StatusPill tone={getPriorityTone(selectedDelivery.priority)}>
                        {selectedDelivery.priority} Priority
                      </StatusPill>
                      <StatusPill
                        tone={getStatusTone(selectedDelivery.status, selectedDelivery.driver)}
                        pulse={selectedDelivery.status === "in-transit"}
                      >
                        {getStatusLabel(selectedDelivery.status, selectedDelivery.driver)}
                      </StatusPill>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5" /> Request Date: <span className="font-medium text-foreground">{selectedDelivery.requestDate}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteDeliveryClick(selectedDelivery, e)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors cursor-pointer shrink-0"
                      title="Delete Delivery"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={() => setSelectedDelivery(null)}
                      className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>

                {/* 2. DELIVERY DETAILS SECTION: MULTI-COLUMN GRID WITH UNCHANGED PICKUP/DROP LAYOUT */}
                <div className="grid gap-5 grid-cols-1 lg:grid-cols-12">
                  {/* Left Column: EXACT UNCHANGED PICKUP / DROP LAYOUT */}
                  <div className="lg:col-span-5">
                    <div className="rounded-2xl border border-primary/30 bg-surface-2/40 p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4">
                      {/* Pickup Location - Unchanged Layout */}
                      <div className="flex items-start gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/30 shadow-[var(--shadow-glow)]">
                          <Package className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                            Pickup Location
                          </span>
                          <p className="mt-0.5 text-sm sm:text-base font-bold text-foreground leading-snug break-words">
                            {selectedDelivery.pickup}
                          </p>
                        </div>
                      </div>

                      {/* Route Connector Line - Unchanged */}
                      <div className="relative pl-5 py-0.5 flex items-center gap-2">
                        <div className="h-6 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-success ml-0.5" />
                        <span className="text-[10px] font-semibold text-muted-foreground bg-surface/80 px-2 py-0.5 rounded-full border border-border/60">
                          {selectedDelivery.distance} • ~{selectedDelivery.estTime} transit
                        </span>
                      </div>

                      {/* Drop-off Location - Unchanged Layout */}
                      <div className="flex items-start gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success border border-success/30 shadow-[var(--shadow-glow)]">
                          <MapPin className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-success flex items-center gap-1">
                            Drop-off Location
                          </span>
                          <p className="mt-0.5 text-sm sm:text-base font-bold text-foreground leading-snug break-words">
                            {selectedDelivery.drop}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: STRUCTURED MULTI-COLUMN DELIVERY SPECIFICATIONS */}
                  <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-surface-2/30 p-4 sm:p-5">
                    <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Client Name
                        </span>
                        <span className="text-sm sm:text-base font-bold text-foreground block mt-0.5">{selectedDelivery.client}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Client / Company ID
                        </span>
                        <span className="text-xs font-semibold text-primary font-mono block mt-0.5">{selectedDelivery.clientCompanyId}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Package Type
                        </span>
                        <span className="text-xs font-semibold text-foreground block mt-0.5">{selectedDelivery.packageType}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Package Weight
                        </span>
                        <span className="text-xs font-semibold text-foreground block mt-0.5">{selectedDelivery.weight}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Preferred Delivery Date
                        </span>
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1 block mt-0.5">
                          <CalendarIconIcon className="size-3.5 text-primary" /> {selectedDelivery.requestedDeliveryDate}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Delivery Requirement
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                          {selectedDelivery.deadlineType}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Preferred Delivery Time
                        </span>
                        <span className="text-xs font-semibold text-foreground block mt-0.5">
                          {selectedDelivery.preferredTime ?? "Flexible"}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Payment Information
                        </span>
                        <span className="text-xs font-semibold text-success block mt-0.5">
                          ₹{selectedDelivery.amount.toLocaleString()} ({selectedDelivery.method})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI DRIVER RECOMMENDATIONS (DARK/CYAN STYLING, HIDDEN BY DEFAULT WITH TOGGLE) */}
                {(selectedDelivery.status === "unassigned" || selectedDelivery.driver === "Unassigned") && (
                  <div className="rounded-2xl border border-primary/30 bg-surface-2/40 p-4 sm:p-5 space-y-4 shadow-[0_0_20px_rgba(6,182,212,0.06)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/30 shadow-[var(--shadow-glow)]">
                          <Sparkles className="size-5" />
                        </span>
                        <div>
                          <h4 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                            AI Driver Recommendations
                          </h4>
                          <p className="text-xs text-muted-foreground font-medium">Top matched available drivers based on route & schedule</p>
                        </div>
                      </div>

                      {!showAiRecommendations ? (
                        <button
                          onClick={handleFetchAiRecommendations}
                          disabled={loadingAiRecs}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Sparkles className={cn("size-4", loadingAiRecs && "animate-spin")} />
                          {loadingAiRecs ? "Evaluating ML Model..." : "Get AI Recommendations"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowAiRecommendations(false)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all cursor-pointer shrink-0"
                        >
                          <EyeOff className="size-4" /> Hide Recommendations
                        </button>
                      )}
                    </div>

                    {showAiRecommendations && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="space-y-4 pt-3 border-t border-border/50"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">Matched Scenario:</span>
                            <span className="text-primary font-bold">{recScenario}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Multi-criteria ML suitability ranking
                          </span>
                        </div>

                        {/* Horizontal 3-Column Recommendation Cards */}
                        <div className="grid gap-3.5 grid-cols-1 md:grid-cols-3">
                          {dynamicRecommendations.map((drv, idx) => {
                            const name = drv.driver_name || drv.name;
                            const suitability = drv.suitability_score ?? drv.suitability ?? 90;
                            const safety = drv.safety_score ?? drv.score ?? 90;
                            const reasons = drv.match_reasons || drv.reasons || [];
                            const vehicleInfo = drv.assigned_vehicle || "Tata Ace EV";
                            const risk = drv.risk_level || "Low";

                            return (
                              <div
                                key={name}
                                className={cn(
                                  "flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-all",
                                  idx === 0
                                    ? "border-primary bg-primary/5 shadow-[0_0_25px_rgba(6,182,212,0.12)]"
                                    : "border-primary/30 bg-surface/90 hover:border-primary/60"
                                )}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <span className="font-extrabold text-foreground text-base sm:text-lg block leading-tight">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {vehicleInfo}
                                      </span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-extrabold text-primary bg-primary/15 px-2.5 py-0.5 rounded-md border border-primary/30 shadow-[var(--shadow-glow)] shrink-0">
                                      {suitability}% Match
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">
                                      Safety: <strong className="text-success">{safety}/100</strong>
                                    </span>
                                    <span>•</span>
                                    <span className={cn("font-semibold text-[11px]", risk === "Low" ? "text-success" : "text-amber-400")}>
                                      {risk} Risk
                                    </span>
                                  </div>

                                  {drv.reason_summary && (
                                    <p className="text-[11px] text-foreground/80 leading-relaxed font-medium bg-surface-2/60 p-2 rounded-xl border border-border/50">
                                      "{drv.reason_summary}"
                                    </p>
                                  )}

                                  <div className="space-y-1 pt-1 border-t border-border/50 text-xs text-foreground/90 font-semibold">
                                    {reasons.slice(0, 3).map((r: string) => (
                                      <p key={r} className="flex items-center gap-1.5 leading-tight">
                                        <BadgeCheck className="size-4 text-success shrink-0" />
                                        <span className="truncate">{r}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleAssignDriver(selectedDelivery.id, name)}
                                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 px-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 transition-all cursor-pointer"
                                >
                                  <UserCheck className="size-4" /> Assign {name.split(" ")[0]}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/40 text-xs">
                          <span className="text-muted-foreground">
                            Prefer manual assignment?
                          </span>
                          <div className="flex items-center gap-2">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignDriver(selectedDelivery.id, e.target.value);
                                }
                              }}
                              defaultValue=""
                              className="bg-surface/80 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                            >
                              <option value="" disabled>Manual Select Eligible Driver...</option>
                              <option value="Rahul Sharma">Rahul Sharma (Available · 96/100)</option>
                              <option value="Priya Nair">Priya Nair (Available · 94/100)</option>
                              <option value="Vikram Patil">Vikram Patil (Available · 91/100)</option>
                            </select>
                            <Link
                              to="/manager/drivers"
                              className="inline-flex items-center gap-1 text-primary font-bold hover:underline shrink-0"
                            >
                              Drivers Directory <ArrowRight className="size-3.5" />
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ACTIVE DELIVERY TIMELINE & NOTES */}
                {(selectedDelivery.status === "in-transit" || selectedDelivery.status === "assigned") &&
                  selectedDelivery.driver !== "Unassigned" && (
                    <div className="space-y-4">
                      {/* Driver & Manager details */}
                      <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-medium">Assigned Driver</span>
                          <span className="text-base font-bold text-foreground">{selectedDelivery.driver}</span>
                          <span className="text-xs text-muted-foreground block mt-0.5">Tata Intra · MH04 GH 1120</span>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            to="/manager/drivers"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Users className="size-3.5" /> Driver Record
                          </Link>
                        </div>
                      </div>

                      {/* Delivery Timeline */}
                      <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 sm:p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
                            <Compass className="size-4.5 sm:size-5" /> Delivery Timeline Progress
                          </h4>
                          <span className="text-xs font-bold text-muted-foreground bg-surface/60 px-2.5 py-0.5 rounded-full border border-border/60">
                            Live Tracking
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1 sm:gap-2">
                          {(() => {
                            const stage = selectedDelivery.timelineStage ?? 1;
                            const steps = [
                              { title: "Assigned", step: 1, doneTime: "08:30 AM", estTime: "08:30 AM" },
                              { title: "Picked Up", step: 2, doneTime: "09:15 AM", estTime: "Est 09:30 AM" },
                              { title: "In Transit", step: 3, doneTime: "10:05 AM", estTime: "Est 10:15 AM" },
                              { title: "Checkpoint", step: 4, doneTime: "11:20 AM", estTime: "Est 11:30 AM" },
                              { title: "Delivered", step: 5, doneTime: "01:00 PM", estTime: "Est 01:00 PM" },
                            ];

                            return steps.map((t, index) => {
                              const isCompleted = stage > t.step;
                              const isCurrent = stage === t.step;
                              const isDoneOrCurrent = isCompleted || isCurrent;
                              const showArrow = index < steps.length - 1;
                              const nextStep = steps[index + 1];
                              const nextIsDoneOrCurrent = stage >= (nextStep?.step ?? 99);

                              return (
                                <div key={t.title} className="flex-1 flex items-center min-w-0">
                                  <div className="flex flex-col items-center text-center w-full min-w-0">
                                    {/* Step Bubble */}
                                    <div
                                      className={cn(
                                        "size-7 sm:size-8.5 rounded-full grid place-items-center text-xs sm:text-sm font-extrabold transition-all shrink-0",
                                        isCompleted
                                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                                          : isCurrent
                                          ? "bg-primary/20 text-primary border-2 border-primary animate-pulse shadow-[var(--shadow-glow)]"
                                          : "bg-surface-2 text-muted-foreground border border-border"
                                      )}
                                    >
                                      {isCompleted ? "✓" : t.step}
                                    </div>

                                    {/* Title */}
                                    <span
                                      className={cn(
                                        "mt-1.5 text-xs sm:text-sm leading-tight font-bold truncate w-full",
                                        isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                                      )}
                                    >
                                      {t.title}
                                    </span>

                                    {/* Timing Information */}
                                    <span
                                      className={cn(
                                        "mt-0.5 text-xs font-mono leading-none truncate w-full",
                                        isCompleted || isCurrent ? "text-primary font-semibold" : "text-muted-foreground/70"
                                      )}
                                    >
                                      {stage >= t.step ? t.doneTime : t.estTime}
                                    </span>
                                  </div>

                                  {/* Directional Connector Arrow */}
                                  {showArrow && (
                                    <div className="flex items-center justify-center shrink-0 px-0.5 -mt-4">
                                      <ChevronRight
                                        className={cn(
                                          "size-4 sm:size-5 transition-colors",
                                          isCompleted && nextIsDoneOrCurrent ? "text-primary stroke-[2.5]" : "text-border/60"
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Driver Notes (if available) */}
                      {selectedDelivery.driverNotes && (
                        <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3.5 space-y-1 text-xs">
                          <span className="font-bold text-foreground block">Driver Notes</span>
                          <p className="text-muted-foreground leading-relaxed">{selectedDelivery.driverNotes}</p>
                        </div>
                      )}
                    </div>
                  )}

                {/* INSTRUCTIONS & REQUIREMENTS (EXACTLY 2 HEADINGS: DELIVERY INSTRUCTIONS & HANDLING INSTRUCTIONS) */}
                <div className="rounded-2xl border border-border/70 bg-surface-2/20 p-4 sm:p-5 space-y-3">
                  <h4 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <FileText className="size-4.5" /> Delivery & Handling Instructions
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-surface/40 p-3.5 space-y-1">
                      <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">
                        Delivery Instructions
                      </span>
                      <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                        {selectedDelivery.specialInstructions || selectedDelivery.deliveryNotes || "No special instructions provided."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-surface/40 p-3.5 space-y-1">
                      <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">
                        Handling Instructions
                      </span>
                      <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                        {selectedDelivery.handlingReqs || "Standard cargo handling."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COMPLETED DELIVERY SUMMARY */}
                {selectedDelivery.status === "completed" && (
                  <div className="rounded-2xl border border-success/40 bg-success/5 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-success text-sm flex items-center gap-1.5">
                        <BadgeCheck className="size-4" /> Delivery Completed Successfully
                      </span>
                      <StatusPill tone="success">POD Verified</StatusPill>
                    </div>
                    <p className="text-muted-foreground">
                      Completed on May 08, 2026 at 05:42 PM by driver <span className="font-semibold text-foreground">{selectedDelivery.driver}</span>. Client feedback rating: <span className="font-bold text-warning">5.0 / 5 ⭐</span>.
                    </p>
                  </div>
                )}

                {/* EDITABLE MANAGER NOTES SECTION (FOR BOTH ASSIGNED & UNASSIGNED DELIVERIES) */}
                <div className="mt-5 rounded-2xl border border-primary/20 bg-surface-2/30 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="manager-note-textarea" className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 cursor-pointer">
                      <MessageSquare className="size-4" /> Manager Notes & Operational Comments
                    </label>
                    {noteSavedToast && (
                      <span className="text-xs font-bold text-success flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                        <CheckCircle2 className="size-3.5" /> Note Saved
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <textarea
                      id="manager-note-textarea"
                      value={editingNote}
                      onChange={(e) => setEditingNote(e.target.value)}
                      placeholder="Type manager notes, special route instructions, or operational remarks..."
                      rows={2}
                      className="w-full rounded-xl border border-border/80 bg-surface/90 p-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground text-[11px]">
                        Notes persist on the delivery record for dispatchers and fleet managers.
                      </span>
                      <button
                        onClick={() => handleSaveManagerNote(selectedDelivery.id, editingNote)}
                        disabled={isSavingNote}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                      >
                        <Save className="size-3.5" />
                        {isSavingNote ? "Saving..." : "Save Note"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-6 flex items-center justify-between">
                <button
                  onClick={(e) => handleDeleteDeliveryClick(selectedDelivery, e)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  <span>Delete Delivery</span>
                </button>
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[440px] border-destructive/40 bg-surface/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Trash2 className="size-5 text-destructive" />
              Confirm Delivery Deletion
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete delivery <strong className="text-foreground font-mono">{deliveryToDelete?.id}</strong>? This action is permanent and will remove the delivery request from the system.
            </DialogDescription>
          </DialogHeader>

          {deliveryToDelete && (
            <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3 text-xs space-y-1.5 my-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client:</span>
                <span className="font-bold text-foreground">{deliveryToDelete.client}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route:</span>
                <span className="font-medium text-foreground">{deliveryToDelete.pickup.split(",")[0]} → {deliveryToDelete.drop.split(",")[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <StatusPill tone={getStatusTone(deliveryToDelete.status, deliveryToDelete.driver)}>
                  {getStatusLabel(deliveryToDelete.status, deliveryToDelete.driver)}
                </StatusPill>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="font-bold"
            >
              {isDeleting ? "Deleting..." : "Delete Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
