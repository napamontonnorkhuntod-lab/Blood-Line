"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package,
  Plus,
  Minus,
  Clock,
  User,
  History,
  CheckCircle2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Item {
  id: string;
  name: string;
  count: number;
  iconName: string;
  image?: string;
  badge: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  username: string;
  itemName: string;
  quantityAdded: number; // Positive for addition (+), Negative for withdrawal (-)
  remark?: string; // Notes / Recipient
}

interface DbItem {
  id: string | number;
  name: string;
  count: number;
  iconName?: string;
  icon_name?: string;
  image?: string;
  badge?: string;
}

interface DbLog {
  id: string | number;
  timestamp?: string;
  username?: string;
  item_name?: string;
  itemName?: string;
  quantity_added?: number;
  quantityAdded?: number;
  remark?: string;
  note?: string;
  created_at?: string;
}

const INITIAL_ITEMS: Item[] = [
  {
    id: "1",
    name: "กล่องตีแฟม",
    count: 0,
    iconName: "Package",
    image: "/image/1.png",
    badge: "Guild Box",
  },
  {
    id: "2",
    name: "กล่องตี",
    count: 0,
    iconName: "Boxes",
    image: "/image/2.png",
    badge: "Upgrade Box",
  },
  {
    id: "3",
    name: "Bolter",
    count: 0,
    iconName: "Zap",
    image: "/image/3.png",
    badge: "Special Gear",
  },
  {
    id: "4",
    name: "ยาเขียว",
    count: 0,
    iconName: "FlaskConical",
    image: "/image/4.png",
    badge: "Potion",
  },
  {
    id: "5",
    name: "supply",
    count: 0,
    iconName: "Shield",
    image: "/image/5.png",
    badge: "Supplies",
  },
  {
    id: "6",
    name: "การ์ด",
    count: 0,
    iconName: "CreditCard",
    image: "/image/6.png",
    badge: "Card Item",
  },
  {
    id: "7",
    name: "แฟรี่",
    count: 0,
    iconName: "Sparkles",
    image: "/image/7.png",
    badge: "Companion",
  },
];

const LOGS_PER_PAGE = 5;

// Helper function to sanitize text input
const sanitizeText = (input: string): string => {
  if (!input) return "";
  return input
    .trim()
    .replace(/[<>'"]/g, "") // Strip dangerous HTML/Quote characters
    .slice(0, 50); // Limit length
};

export default function StockManagerPage() {
  const [username, setUsername] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(true);
  const [inputName, setInputName] = useState<string>("");
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [quantities, setQuantities] = useState<{ [key: string]: string }>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState<boolean>(false);
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);

  // Separate Filter States
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterItem, setFilterItem] = useState<string>("");

  // Withdrawal Modal States
  const [withdrawModalItem, setWithdrawModalItem] = useState<Item | null>(null);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>("");
  const [withdrawRemarkInput, setWithdrawRemarkInput] = useState<string>("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Load Data from Supabase with localStorage fallback
  const loadData = useCallback(async () => {
    setShowModal(true);

    try {
      // 1. Load Items from Supabase
      const { data: dbItems, error: itemsErr } = await supabase
        .from("items")
        .select("*");

      if (itemsErr) {
        console.error("Supabase items fetch error:", itemsErr);
        setDbErrorMessage(`ไม่สามารถอ่านข้อมูลไอเทมจาก Supabase ได้ (${itemsErr.message})`);
      } else if (dbItems) {
        setIsDatabaseConnected(true);
        if (dbItems.length > 0) {
          const mappedItems: Item[] = dbItems.map((db: DbItem) => ({
            id: String(db.id),
            name: db.name || "Item",
            count: Number(db.count) || 0,
            iconName: db.iconName || db.icon_name || "Package",
            image: db.image || `/image/${db.id}.png`,
            badge: db.badge || "Stock",
          }));
          mappedItems.sort((a, b) => Number(a.id) - Number(b.id));
          setItems(mappedItems);
        }
      } else {
        // Fallback to local storage if Supabase query failed
        const savedItems = localStorage.getItem("fixed_items_stock");
        if (savedItems) {
          try {
            const parsed = JSON.parse(savedItems);
            const updated = INITIAL_ITEMS.map((initItem) => {
              const found = parsed.find((p: Item) => p.id === initItem.id || p.name === initItem.name);
              return found ? { ...initItem, count: found.count } : initItem;
            });
            setItems(updated);
          } catch {
            setItems(INITIAL_ITEMS);
          }
        } else {
          setItems(INITIAL_ITEMS);
        }
      }

      // 2. Load Logs from Supabase
      const { data: dbLogs, error: logsErr } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (logsErr) {
        console.error("Supabase logs fetch error:", logsErr);
        if (!itemsErr) setDbErrorMessage(`ไม่สามารถอ่าน Log จาก Supabase ได้ (${logsErr.message})`);
      } else if (dbLogs) {
        const mappedLogs: LogEntry[] = dbLogs.map((log: DbLog) => ({
          id: String(log.id),
          timestamp: log.timestamp || (log.created_at ? new Date(log.created_at).toLocaleString("th-TH") : ""),
          username: log.username || "Unknown",
          itemName: log.item_name || log.itemName || "Item",
          quantityAdded: Number(log.quantity_added ?? log.quantityAdded ?? 0),
          remark: log.remark || log.note || undefined,
        }));
        setLogs(mappedLogs);
      } else {
        const savedLogs = localStorage.getItem("fixed_activity_logs");
        if (savedLogs) {
          try {
            setLogs(JSON.parse(savedLogs));
          } catch {
            setLogs([]);
          }
        } else {
          setLogs([]);
        }
      }
    } catch (err: unknown) {
      console.warn("Supabase load fallback to localStorage", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDbErrorMessage(`เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase: ${msg}`);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter logs by date (YYYY-MM-DD input date), actor username, or item name
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Filter by Date
      if (filterDate) {
        const parts = filterDate.split("-");
        if (parts.length === 3) {
          const [yyyy, mm, dd] = parts;
          const beYear = String(Number(yyyy) + 543);
          const dayMonth = `${dd}/${mm}`;
          const matchCE = `${dd}/${mm}/${yyyy}`;
          const matchBE = `${dd}/${mm}/${beYear}`;

          const ts = log.timestamp;
          const matchesDate =
            ts.includes(matchCE) || ts.includes(matchBE) || ts.startsWith(dayMonth);
          if (!matchesDate) return false;
        }
      }

      // 2. Filter by Actor (Username)
      if (filterActor.trim()) {
        const actorTerm = filterActor.trim().toLowerCase();
        if (!log.username.toLowerCase().includes(actorTerm)) return false;
      }

      // 3. Filter by Item Name or Remark
      if (filterItem.trim()) {
        const itemTerm = filterItem.trim().toLowerCase();
        const matchItemName = log.itemName.toLowerCase().includes(itemTerm);
        const matchRemark = log.remark ? log.remark.toLowerCase().includes(itemTerm) : false;
        if (!matchItemName && !matchRemark) return false;
      }

      return true;
    });
  }, [logs, filterDate, filterActor, filterItem]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE)),
    [filteredLogs.length]
  );
  
  const startIndex = (currentPage - 1) * LOGS_PER_PAGE;

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterActor, filterItem]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleSaveUsername = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(inputName);
    if (!cleanName) return;

    setUsername(cleanName);
    setShowModal(false);
  }, [inputName]);

  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  }, []);

  // Handler for Adding Stock (+ Amount)
  const handleAddItemCount = useCallback(async (item: Item) => {
    const rawVal = quantities[item.id];
    const amount = parseInt(rawVal, 10);

    if (isNaN(amount) || amount <= 0) return;

    const newCount = item.count + amount;

    // Update UI immediately for fast response
    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, count: newCount } : i
    );
    setItems(updatedItems);
    localStorage.setItem("fixed_items_stock", JSON.stringify(updatedItems));

    const now = new Date();
    const formattedTimestamp = now.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const newEntry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      timestamp: formattedTimestamp,
      username: username || "Unknown User",
      itemName: item.name,
      quantityAdded: amount, // Positive for addition
      remark: "เพิ่มเข้าคลัง",
    };

    const updatedLogs = [newEntry, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem("fixed_activity_logs", JSON.stringify(updatedLogs));
    setCurrentPage(1);

    setQuantities((prev) => ({
      ...prev,
      [item.id]: "",
    }));

    // Async Update Supabase Database
    try {
      const { error: updateErr } = await supabase
        .from("items")
        .update({ count: newCount })
        .eq("id", String(item.id));

      if (updateErr) console.error("Supabase items update error:", updateErr.message);

      const { error: logErr } = await supabase
        .from("activity_logs")
        .insert([
          {
            timestamp: formattedTimestamp,
            username: username || "Unknown User",
            item_name: item.name,
            quantity_added: amount,
            remark: "เพิ่มเข้าคลัง",
          }
        ]);

      if (logErr) console.error("Supabase activity_logs insert error:", logErr.message);
    } catch (dbErr) {
      console.warn("Supabase async write warning:", dbErr);
    }
  }, [items, logs, quantities, username]);

  // Open Withdrawal Modal
  const handleOpenWithdrawModal = useCallback((item: Item) => {
    setWithdrawModalItem(item);
    setWithdrawAmountInput(quantities[item.id] || "1");
    setWithdrawRemarkInput("");
    setWithdrawError(null);
  }, [quantities]);

  // Handler for Confirming Item Withdrawal (- Amount)
  const handleConfirmWithdraw = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawModalItem) return;

    const amount = parseInt(withdrawAmountInput, 10);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("กรุณาระบุจำนวนที่จะเบิกให้ถูกต้อง (มากกว่า 0)");
      return;
    }

    if (amount > withdrawModalItem.count) {
      setWithdrawError(`จำนวนสินค้าคงเหลือไม่พอ (คงเหลือ ${withdrawModalItem.count} ชิ้น)`);
      return;
    }

    const cleanRemark = sanitizeText(withdrawRemarkInput);
    if (!cleanRemark) {
      setWithdrawError("กรุณาระบุว่าเบิกสินค้าให้ใคร หรือหมายเหตุการเบิก (จำเป็น)");
      return;
    }

    const newCount = withdrawModalItem.count - amount;

    // Update UI immediately
    const updatedItems = items.map((i) =>
      i.id === withdrawModalItem.id ? { ...i, count: newCount } : i
    );
    setItems(updatedItems);
    localStorage.setItem("fixed_items_stock", JSON.stringify(updatedItems));

    const now = new Date();
    const formattedTimestamp = now.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const newEntry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      timestamp: formattedTimestamp,
      username: username || "Unknown User",
      itemName: withdrawModalItem.name,
      quantityAdded: -amount, // Negative number for withdrawal e.g. -1
      remark: cleanRemark ? `เบิกให้: ${cleanRemark}` : "เบิกออก",
    };

    const updatedLogs = [newEntry, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem("fixed_activity_logs", JSON.stringify(updatedLogs));
    setCurrentPage(1);

    // Reset input states
    setQuantities((prev) => ({
      ...prev,
      [withdrawModalItem.id]: "",
    }));
    setWithdrawModalItem(null);
    setWithdrawAmountInput("");
    setWithdrawRemarkInput("");
    setWithdrawError(null);

    // Async Update Supabase Database
    try {
      const { error: updateErr } = await supabase
        .from("items")
        .update({ count: newCount })
        .eq("id", String(withdrawModalItem.id));

      if (updateErr) console.error("Supabase items update error:", updateErr.message);

      const { error: logErr } = await supabase
        .from("activity_logs")
        .insert([
          {
            timestamp: formattedTimestamp,
            username: username || "Unknown User",
            item_name: withdrawModalItem.name,
            quantity_added: -amount,
            remark: cleanRemark ? `เบิกให้: ${cleanRemark}` : "เบิกออก",
          }
        ]);

      if (logErr) console.error("Supabase activity_logs insert error:", logErr.message);
    } catch (dbErr) {
      console.warn("Supabase async write warning:", dbErr);
    }
  }, [items, logs, username, withdrawAmountInput, withdrawModalItem, withdrawRemarkInput]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-700 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>กำลังโหลดระบบคลังสินค้า...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top Header & Active User Box */}
        <header className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Inventory Stock Manager
                </h1>
                {isDatabaseConnected ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    🟢 Supabase Live
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    🟡 Local Mode
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                ระบบจัดการสต็อกสินค้าและบันทึกประวัติการเพิ่มสินค้า / เบิกสินค้า
              </p>
            </div>
          </div>

          {/* Active User Badge */}
          {username && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/80 border border-slate-200 self-start md:self-auto">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 font-medium">
                  ผู้ใช้งานปัจจุบัน
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {username}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInputName(username);
                  setShowModal(true);
                }}
                className="ml-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors text-xs font-medium flex items-center gap-1 cursor-pointer shadow-2xs"
                title="เปลี่ยนชื่อผู้ใช้"
              >
                <Pencil className="w-3 h-3 text-slate-500" />
                <span>เปลี่ยนชื่อ</span>
              </button>
            </div>
          )}
        </header>

        {/* Supabase Error Notice Banner */}
        {dbErrorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-2">
              <span className="text-base">⚠️</span> {dbErrorMessage}
            </span>
            <button
              onClick={() => setDbErrorMessage(null)}
              className="text-amber-800 hover:text-amber-950 font-bold underline ml-4 cursor-pointer text-xs"
            >
              ปิด
            </button>
          </div>
        )}

        {/* SECTION 1: Items Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              รายการไอเทมคงคลัง ({items.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 transition-all duration-200 hover:border-emerald-300 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Item Image */}
                  <div className="flex justify-center mb-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 p-2 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-html-element-suppression */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || `/image/${item.id}.png`}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Item Info & Count */}
                  <div className="space-y-2 mb-5">
                    <h3 className="text-base font-bold text-slate-900">
                      {item.name}
                    </h3>
                    <div className="flex items-baseline justify-between bg-emerald-50/60 rounded-xl p-3 border border-emerald-100/80">
                      <span className="text-xs text-emerald-800 font-medium">
                        จำนวนคงเหลือ
                      </span>
                      <span className="text-2xl font-black text-emerald-600 font-mono">
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Input & Action Buttons (เพิ่ม / เบิก) */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      placeholder="จำนวน"
                      value={quantities[item.id] || ""}
                      onChange={(e) =>
                        handleQuantityChange(item.id, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddItemCount(item);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddItemCount(item)}
                      disabled={!quantities[item.id] || parseInt(quantities[item.id], 10) <= 0}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1 transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      title="เพิ่มเข้าคลัง"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      เพิ่ม
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenWithdrawModal(item)}
                      disabled={item.count <= 0}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1 transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      title="เบิกสินค้าออก"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      เบิก
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: Activity Audit Logs Table with Date, Actor, Item Filter */}
        <section className="space-y-4 pt-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              บันทึกประวัติการทำรายการ (Activity Logs)
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-mono self-start md:self-auto shadow-2xs">
              {(filterDate || filterActor || filterItem)
                ? `พบ ${filteredLogs.length} / ทั้งหมด ${logs.length} รายการ`
                : `ทั้งหมด ${logs.length} รายการ`}
            </span>
          </div>

          {/* Filter Control Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center gap-3">
            {/* 1. Date Input Filter */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                วันที่ทำรายการ (Date)
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all"
              />
            </div>

            {/* 2. Actor Name Input Filter */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ชื่อผู้ทำรายการ (Actor)
              </label>
              <input
                type="text"
                placeholder="พิมพ์ชื่อผู้ใช้..."
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
              />
            </div>

            {/* 3. Item Name Input Filter */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ชื่อไอเทม (Item Name)
              </label>
              <input
                type="text"
                placeholder="พิมพ์ชื่อไอเทม..."
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
              />
            </div>

            {/* Reset Filters Button */}
            {(filterDate || filterActor || filterItem) && (
              <div className="sm:self-end pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate("");
                    setFilterActor("");
                    setFilterItem("");
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>ล้างตัวกรอง</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">วัน-เวลา (Date & Time)</th>
                    <th className="py-3.5 px-6">ผู้ทำรายการ (Actor)</th>
                    <th className="py-3.5 px-6">ชื่อไอเทม (Item Name)</th>
                    <th className="py-3.5 px-6">หมายเหตุ / เบิกให้ใคร</th>
                    <th className="py-3.5 px-6 text-right">จำนวน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-slate-400 font-medium"
                      >
                        {(filterDate || filterActor || filterItem)
                          ? "ไม่พบประวัติการทำรายการที่ตรงกับเงื่อนไขการกรอง"
                          : "ยังไม่มีประวัติการเพิ่มไอเทม"}
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-6 font-mono text-slate-500 text-xs flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {log.timestamp}
                        </td>
                        <td className="py-3.5 px-6 font-medium text-slate-800">
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs text-slate-700">
                            <User className="w-3 h-3 text-emerald-600" />
                            {log.username}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {log.itemName}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-medium">
                          {log.quantityAdded < 0 ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-lg font-medium">
                              {log.remark || "เบิกออก"}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              {log.remark || "เพิ่มเข้าคลัง"}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono font-bold">
                          {log.quantityAdded < 0 ? (
                            <span className="text-rose-600">{log.quantityAdded}</span>
                          ) : (
                            <span className="text-emerald-600">+{log.quantityAdded}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-mono">
                  แสดง {startIndex + 1} - {Math.min(startIndex + LOGS_PER_PAGE, filteredLogs.length)} จากทั้งหมด {filteredLogs.length} รายการ
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>ก่อนหน้า</span>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                          currentPage === page
                            ? "bg-emerald-600 text-white font-bold shadow-2xs"
                            : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>ถัดไป</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* WITHDRAWAL MODAL (เบิกสินค้า) */}
      {withdrawModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-2">
                <Minus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                เบิกสินค้า: {withdrawModalItem.name}
              </h2>
              <div className="inline-block bg-slate-100 border border-slate-200 rounded-xl px-3 py-1 text-xs text-slate-600 font-medium">
                คงเหลือในคลัง: <span className="font-bold text-emerald-600 font-mono text-sm">{withdrawModalItem.count}</span> ชิ้น
              </div>
            </div>

            {withdrawError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmWithdraw} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  จำนวนที่จะเบิก (Quantity)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={withdrawModalItem.count}
                  placeholder="ระบุจำนวน"
                  value={withdrawAmountInput}
                  onChange={(e) => setWithdrawAmountInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>เบิกให้ใคร / หมายเหตุ (Recipient / Note)</span>
                  <span className="text-rose-600 font-bold text-[11px]">* จำเป็น</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="เช่น เบิกให้ นาย A, ใช้งานในกิจกรรม"
                  value={withdrawRemarkInput}
                  onChange={(e) => {
                    setWithdrawRemarkInput(e.target.value);
                    if (withdrawError) setWithdrawError(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all text-sm font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawModalItem(null);
                    setWithdrawError(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!withdrawAmountInput || parseInt(withdrawAmountInput, 10) <= 0 || !withdrawRemarkInput.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                  เบิกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USERNAME INPUT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                ยินดีต้อนรับสู่ระบบคลัง
              </h2>
              <p className="text-sm text-slate-500">
                กรุณาระบุชื่อผู้ใช้งานของคุณเพื่อเริ่มต้นเข้าใช้งานระบบ
              </p>
            </div>

            <form onSubmit={handleSaveUsername} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  placeholder="เช่น Admin, Player1, Boss"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!inputName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                ยืนยันชื่อและเริ่มใช้งาน
              </button>
            </form>

            <div className="text-center">
              <span className="text-[11px] text-slate-400">
                ระบบจะให้ระบุชื่อใหม่ทุกครั้งที่เปิดหน้าเว็บขึ้นมา
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
