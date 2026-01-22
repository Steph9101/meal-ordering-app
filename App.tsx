import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Image,
  Alert,
  Linking,
  Modal,
  FlatList,
} from "react-native";

/**
 * ✅ IMPORTANT
 * Put your JSON here (NOT in /public for Expo):
 *   /assets/menus.json
 *
 * Structure supported:
 * {
 *   "3": { "title": "...", "dateRange": "...", "days": { "Monday": { "Meat": {...}, "Veg": {...} } } },
 *   "4": { ... }
 * }
 */
// @ts-ignore
import menusJson from "./assets/menus.json";

type MealType = "Meat" | "Veg" | "Low Carb";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type DayName = (typeof DAYS)[number];

type MenuItem = {
  name: string;
  description: string;
};

type DayMenu = {
  // allow either capitalized or lowercase keys (we support both)
  Meat?: MenuItem;
  Veg?: MenuItem;
  meat?: MenuItem;
  veg?: MenuItem;

  // Optional note per day (e.g. "Closed")
  note?: string;
};

type WeeklyMenu = {
  title: string;
  dateRange?: string;
  // Optional per-week pricing overrides
  price?: number; // Meat/Veg base price
  lowCarbExtra?: number; // extra on top of base price
  days: Record<DayName, DayMenu>;
};

type MenusByWeek = Record<string, WeeklyMenu>;

const DEFAULT_BASE_PRICE = 90;
const DEFAULT_LOW_CARB_EXTRA = 10;

const WHATSAPP_PHONE_E164 = "27719531885"; // no +, no spaces

function clamp0(n: number) {
  return n < 0 ? 0 : n;
}

function formatRand(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function emptyWeekQuantities() {
  const q: Record<DayName, Record<MealType, number>> = {} as any;
  for (const d of DAYS) q[d] = { Meat: 0, Veg: 0, "Low Carb": 0 };
  return q;
}

function sumWeekMeals(quantities: Record<DayName, Record<MealType, number>>) {
  let total = 0;
  for (const d of DAYS) total += quantities[d]["Meat"] + quantities[d]["Veg"] + quantities[d]["Low Carb"];
  return total;
}

function sumWeekCost(
  quantities: Record<DayName, Record<MealType, number>>,
  basePrice: number,
  lowCarbExtra: number
) {
  let total = 0;
  for (const d of DAYS) {
    total += quantities[d]["Meat"] * basePrice;
    total += quantities[d]["Veg"] * basePrice;
    total += quantities[d]["Low Carb"] * (basePrice + lowCarbExtra);
  }
  return total;
}

/** ✅ Professional Low Carb note */
const LOW_CARB_NOTE =
  "Low Carb meals follow the same menu as above; however, starchy sides (e.g., potatoes, rice, pasta, couscous) will be substituted with a suitable low-carb alternative such as cauliflower rice or seasonal vegetables, where appropriate.";

export default function App() {
  // IMPORTANT: file must be exactly assets/logo.png (lowercase)
  const logo = require("./assets/logo.png");

  // ✅ Menus loaded from local JSON (no fetch, no 404, works on Web + Android)
  const menusByWeek: MenusByWeek = menusJson as any;

  const availableWeeks = useMemo(() => {
    const nums = Object.keys(menusByWeek)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    // if JSON empty, keep a sane fallback
    return nums.length ? nums : Array.from({ length: 48 }, (_, i) => i + 1);
  }, [menusByWeek]);

  const availableWeekSet = useMemo(() => new Set(availableWeeks), [availableWeeks]);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ Auto-select first available week on load (Week 03 if your JSON has 3 & 4)
  const [weekA, setWeekA] = useState<number>(() => availableWeeks[0] ?? 1);
  const [useWeekB, setUseWeekB] = useState(false);
  const [weekB, setWeekB] = useState<number>(() => {
    const first = availableWeeks[0] ?? 1;
    const second = availableWeeks.find((w) => w !== first);
    return second ?? (first === 48 ? 47 : first + 1);
  });

  // If menus.json changes and weekA/weekB aren't valid, fix them automatically
  useEffect(() => {
    if (!availableWeekSet.has(weekA)) setWeekA(availableWeeks[0] ?? 1);

    if (!availableWeekSet.has(weekB) || weekB === weekA) {
      const pick = availableWeeks.find((w) => w !== weekA);
      if (pick) setWeekB(pick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableWeeks.join("|")]);

  const [qtyA, setQtyA] = useState(() => emptyWeekQuantities());
  const [qtyB, setQtyB] = useState(() => emptyWeekQuantities());

  // Dropdown modal state
  const [weekPickerOpen, setWeekPickerOpen] = useState<null | "A" | "B">(null);

  const getMenuForWeek = (weekNumber: number): WeeklyMenu | null => {
    const m = (menusByWeek as any)?.[weekNumber] ?? (menusByWeek as any)?.[String(weekNumber)];
    return m ?? null;
  };

  const getPricingForWeek = (weekNumber: number) => {
    const m = getMenuForWeek(weekNumber);
    const basePrice = typeof m?.price === "number" ? m.price : DEFAULT_BASE_PRICE;
    const lowCarbExtra = typeof m?.lowCarbExtra === "number" ? m.lowCarbExtra : DEFAULT_LOW_CARB_EXTRA;
    return { basePrice, lowCarbExtra };
  };

  const { basePrice: basePriceA, lowCarbExtra: lowCarbExtraA } = useMemo(
    () => getPricingForWeek(weekA),
    [weekA, menusByWeek]
  );
  const { basePrice: basePriceB, lowCarbExtra: lowCarbExtraB } = useMemo(
    () => getPricingForWeek(weekB),
    [weekB, menusByWeek]
  );

  const weekATotalMeals = useMemo(() => sumWeekMeals(qtyA), [qtyA]);
  const weekBTotalMeals = useMemo(() => (useWeekB ? sumWeekMeals(qtyB) : 0), [qtyB, useWeekB]);

  const weekATotalCost = useMemo(() => sumWeekCost(qtyA, basePriceA, lowCarbExtraA), [qtyA, basePriceA, lowCarbExtraA]);
  const weekBTotalCost = useMemo(
    () => (useWeekB ? sumWeekCost(qtyB, basePriceB, lowCarbExtraB) : 0),
    [qtyB, useWeekB, basePriceB, lowCarbExtraB]
  );

  const totalMeals = weekATotalMeals + weekBTotalMeals;
  const totalCost = weekATotalCost + weekBTotalCost;

  const changeQty = (which: "A" | "B", day: DayName, meal: MealType, delta: number) => {
    const setter = which === "A" ? setQtyA : setQtyB;
    setter((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: clamp0(prev[day][meal] + delta),
      },
    }));
  };

  const clearOrder = () => {
    setName("");
    setNotes("");
    setUseWeekB(false);
    setQtyA(emptyWeekQuantities());
    setQtyB(emptyWeekQuantities());
    setWeekPickerOpen(null);

    // keep week selection but snap back to first available for convenience
    const first = availableWeeks[0] ?? 1;
    setWeekA(first);

    const second = availableWeeks.find((w) => w !== first);
    setWeekB(second ?? (first === 48 ? 47 : first + 1));
  };

  const buildOrderText = () => {
    const lines: string[] = [];
    lines.push("Meal Order");
    lines.push(`Name: ${name?.trim() ? name.trim() : "[name]"}`);
    lines.push("");

    const addWeekBlock = (
      weekNumber: number,
      quantities: Record<DayName, Record<MealType, number>>,
      weekMeals: number,
      weekCost: number
    ) => {
      const menu = getMenuForWeek(weekNumber);

      lines.push(`Week ${String(weekNumber).padStart(2, "0")}${menu?.title ? ` (${menu.title})` : ""}:`);
      for (const d of DAYS) {
        const parts: string[] = [];
        for (const m of ["Meat", "Veg", "Low Carb"] as MealType[]) {
          const q = quantities[d][m];
          if (q > 0) parts.push(`${q} ${m}`);
        }
        if (parts.length) lines.push(`- ${d}: ${parts.join(" + ")}`);
      }
      lines.push(`Total meals (Week ${String(weekNumber).padStart(2, "0")}): ${weekMeals}`);
      lines.push(`Cost (Week ${String(weekNumber).padStart(2, "0")}): ${formatRand(weekCost)}`);
      lines.push("");
    };

    addWeekBlock(weekA, qtyA, weekATotalMeals, weekATotalCost);

    if (useWeekB) addWeekBlock(weekB, qtyB, weekBTotalMeals, weekBTotalCost);

    lines.push(`Total meals: ${totalMeals}`);
    lines.push(`Total cost: ${formatRand(totalCost)}`);

    if (notes.trim()) {
      lines.push("");
      lines.push(`Notes: ${notes.trim()}`);
    }

    return lines.join("\n");
  };

  const sendWhatsApp = async () => {
    // Validate weeks exist (from JSON)
    if (!availableWeekSet.has(weekA)) {
      Alert.alert("Week A not available", "Please select an available week from the list.");
      return;
    }
    if (useWeekB) {
      if (!availableWeekSet.has(weekB)) {
        Alert.alert("Week B not available", "Please select an available week from the list.");
        return;
      }
      if (weekB === weekA) {
        Alert.alert("Week B must be different from Week A.");
        return;
      }
    }

    const text = buildOrderText();
    const encoded = encodeURIComponent(text);

    const deepLink = `whatsapp://send?phone=${WHATSAPP_PHONE_E164}&text=${encoded}`;
    const webLink = `https://wa.me/${WHATSAPP_PHONE_E164}?text=${encoded}`;

    try {
      if (Platform.OS !== "web") {
        const can = await Linking.canOpenURL("whatsapp://send");
        if (can) {
          await Linking.openURL(deepLink);
          return;
        }
      }
      await Linking.openURL(webLink);
    } catch (e) {
      Alert.alert("Could not open WhatsApp", "If WhatsApp does not open, please copy the preview text and send it manually.");
    }
  };

  const openWeekPicker = (which: "A" | "B") => setWeekPickerOpen(which);

  const pickWeek = (which: "A" | "B", value: number) => {
    if (which === "A") {
      if (useWeekB && value === weekB) {
        Alert.alert("Not allowed", "Week A cannot be the same as Week B.");
        return;
      }
      setWeekA(value);

      // If current weekB becomes invalid, pick next available
      if (useWeekB && (!availableWeekSet.has(weekB) || weekB === value)) {
        const next = availableWeeks.find((w) => w !== value);
        if (next) setWeekB(next);
      }
    } else {
      if (value === weekA) {
        Alert.alert("Not allowed", "Week B cannot be the same as Week A.");
        return;
      }
      setWeekB(value);
    }
    setWeekPickerOpen(null);
  };

  const WeekPickerModal = () => {
    if (!weekPickerOpen) return null;
    const which = weekPickerOpen;
    const selected = which === "A" ? weekA : weekB;
    const other = which === "A" ? weekB : weekA;
    const otherEnabled = which === "A" ? useWeekB : true;

    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => setWeekPickerOpen(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setWeekPickerOpen(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{which === "A" ? "Select Week A" : "Select Week B"}</Text>

            <FlatList
              data={availableWeeks}
              keyExtractor={(n) => String(n)}
              showsVerticalScrollIndicator
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => {
                const disabled = otherEnabled && item === other;
                const isSelected = item === selected;
                return (
                  <Pressable
                    onPress={() => !disabled && pickWeek(which, item)}
                    style={[
                      styles.modalItem,
                      isSelected && styles.modalItemSelected,
                      disabled && styles.modalItemDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                        disabled && styles.modalItemTextDisabled,
                      ]}
                    >
                      {String(item).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Pressable style={styles.modalCloseBtn} onPress={() => setWeekPickerOpen(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const WeekHeader = ({ titleWeekNumber }: { titleWeekNumber: number }) => {
    const menu = getMenuForWeek(titleWeekNumber);
    const pricing = getPricingForWeek(titleWeekNumber);

    const meatPriceLabel = `${formatRand(pricing.basePrice)}`;
    const vegPriceLabel = `${formatRand(pricing.basePrice)}`;
    const lowCarbPriceLabel = `${formatRand(pricing.basePrice + pricing.lowCarbExtra)}`;

    return (
      <View style={styles.weekHeaderBlock}>
        <Text style={styles.weekTitle}>Week {String(titleWeekNumber).padStart(2, "0")}</Text>
        <Text style={styles.weekMeta}>
          {menu?.title ? `${menu.title}${menu?.dateRange ? ` • ${menu.dateRange}` : ""}` : "Menu"}
        </Text>
        <Text style={styles.mealHeaderRow}>
          Meat {meatPriceLabel}   Veg {vegPriceLabel}   Low Carb {lowCarbPriceLabel}
        </Text>
      </View>
    );
  };

  const getRowText = (dayMenu: DayMenu | undefined, meal: MealType) => {
    if (dayMenu?.note) return dayMenu.note;

    if (meal === "Low Carb") return LOW_CARB_NOTE;

    // ✅ Support both key styles
    const item =
      meal === "Meat"
        ? (dayMenu?.Meat ?? (dayMenu as any)?.meat)
        : (dayMenu?.Veg ?? (dayMenu as any)?.veg);

    if (!item) return "Menu item coming soon.";
    return `${item.name} — ${item.description}`;
  };

  const WeekBlock = ({
    which,
    weekNumber,
    quantities,
    weekMeals,
    weekCost,
  }: {
    which: "A" | "B";
    weekNumber: number;
    quantities: Record<DayName, Record<MealType, number>>;
    weekMeals: number;
    weekCost: number;
  }) => {
    const menu = getMenuForWeek(weekNumber);

    const renderDay = (day: DayName) => {
      const dayMenu = menu?.days?.[day];

      return (
        <View key={day} style={styles.dayCard}>
          <Text style={styles.dayName}>{day}</Text>

          <View style={styles.dayGrid}>
            {/* LEFT: Text */}
            <View style={styles.dayTextCol}>
              <Text style={styles.rowLabel}>Meat:</Text>
              <Text style={styles.rowText}>{getRowText(dayMenu, "Meat")}</Text>

              <View style={styles.spacer8} />

              <Text style={styles.rowLabel}>Veg:</Text>
              <Text style={styles.rowText}>{getRowText(dayMenu, "Veg")}</Text>

              <View style={styles.spacer8} />

              <Text style={styles.rowLabel}>Low Carb:</Text>
              <Text style={styles.rowText}>{getRowText(dayMenu, "Low Carb")}</Text>
            </View>

            {/* RIGHT: Counters aligned */}
            <View style={styles.dayCounterCol}>
              {(["Meat", "Veg", "Low Carb"] as MealType[]).map((m) => (
                <View key={m} style={styles.counterRow}>
                  <Pressable style={styles.btn} onPress={() => changeQty(which, day, m, -1)}>
                    <Text style={styles.btnText}>−</Text>
                  </Pressable>
                  <Text style={styles.value}>{quantities[day][m]}</Text>
                  <Pressable style={styles.btn} onPress={() => changeQty(which, day, m, +1)}>
                    <Text style={styles.btnText}>+</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    };

    return (
      <View style={styles.weekCard}>
        <WeekHeader titleWeekNumber={weekNumber} />
        <Text style={styles.weekSub}>
          Total meals: {weekMeals} • Cost: {formatRand(weekCost)}
        </Text>

        {DAYS.map((d) => renderDay(d))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <WeekPickerModal />

        {/* Header */}
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.headerTitle}>MEAL ORDER FORM</Text>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="[name]"
            placeholderTextColor="#9aa3ad"
            style={styles.input}
          />
        </View>

        {/* Week selection */}
        <View style={styles.card}>
          <Text style={styles.label}>Select Week A</Text>
          <Pressable style={styles.dropdownBtn} onPress={() => openWeekPicker("A")}>
            <Text style={styles.dropdownText}>{String(weekA).padStart(2, "0")}</Text>
            <Text style={styles.dropdownChevron}>▾</Text>
          </Pressable>

          {/* Add Week B */}
          <View style={styles.instructionsBox}>
            <View style={styles.instructionsHeaderRow}>
              <Text style={styles.instructionsTitle}>Add Week B</Text>

              <Pressable
                onPress={() => setUseWeekB((v) => !v)}
                style={[
                  styles.toggleBtn,
                  useWeekB ? styles.toggleBtnOn : styles.toggleBtnOff,
                  styles.toggleBtnInHeader,
                ]}
              >
                <Text style={styles.toggleText}>{useWeekB ? "Yes" : "No"}</Text>
              </Pressable>
            </View>

            <Text style={styles.instructionsText}>Select “Yes” for a Biweekly Order</Text>
            <Text style={styles.instructionsText}>Select “No” for a Weekly Order Only</Text>
          </View>

          {useWeekB && (
            <>
              <Text style={[styles.label, { marginTop: 6 }]}>Select Week B</Text>
              <Pressable style={styles.dropdownBtn} onPress={() => openWeekPicker("B")}>
                <Text style={styles.dropdownText}>{String(weekB).padStart(2, "0")}</Text>
                <Text style={styles.dropdownChevron}>▾</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={clearOrder} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Order</Text>
          </Pressable>
        </View>

        {/* Weeks */}
        <WeekBlock which="A" weekNumber={weekA} quantities={qtyA} weekMeals={weekATotalMeals} weekCost={weekATotalCost} />
        {useWeekB && (
          <WeekBlock which="B" weekNumber={weekB} quantities={qtyB} weekMeals={weekBTotalMeals} weekCost={weekBTotalCost} />
        )}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Example: no alcohol in food, replace pork with chicken"
            placeholderTextColor="#9aa3ad"
            style={[styles.input, styles.notes]}
            multiline
          />
        </View>

        {/* Totals + Preview */}
        <View style={styles.card}>
          <View style={styles.totalsRow}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Meals</Text>
              <Text style={styles.totalValue}>{totalMeals}</Text>
            </View>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Cost</Text>
              <Text style={styles.totalValue}>{formatRand(totalCost)}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Preview</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{buildOrderText()}</Text>
          </View>
        </View>

        {/* ✅ WhatsApp moved ALL THE WAY to the bottom */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Send order via WhatsApp</Text>

          <Pressable onPress={sendWhatsApp} style={styles.whatsappBtn}>
            <Text style={styles.whatsappBtnText}>SEND MY MEAL ON WHATSAPP</Text>
          </Pressable>

          <Text style={styles.smallHint}>
            This will open WhatsApp and send the order to +{WHATSAPP_PHONE_E164}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  page: {
    padding: 14,
    gap: 12,
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 28,
  },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  logo: { width: 54, height: 54, borderRadius: 10 },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },

  card: {
    backgroundColor: "#121a24",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },

  label: { color: "#cbd5e1", fontWeight: "800" },
  input: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: "top" },

  dropdownBtn: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { color: "#ffffff", fontWeight: "900", fontSize: 16 },
  dropdownChevron: { color: "#ffffff", fontWeight: "900" },

  toggleBtn: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleBtnInHeader: { marginLeft: 12 },
  toggleBtnOn: { backgroundColor: "#0f2a16", borderColor: "#1f7a3a" },
  toggleBtnOff: { backgroundColor: "#0b1220", borderColor: "#233044" },
  toggleText: { color: "#ffffff", fontWeight: "900" },

  instructionsBox: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  instructionsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  instructionsTitle: { color: "#ffffff", fontWeight: "900" },
  instructionsText: { color: "#b7c0cc", fontWeight: "700" },

  clearBtn: {
    marginTop: 2,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearBtnText: { color: "#ffffff", fontWeight: "900" },

  weekCard: {
    backgroundColor: "#0f1621",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  weekHeaderBlock: { gap: 6 },
  weekTitle: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  weekMeta: { color: "#b7c0cc", fontWeight: "800" },
  mealHeaderRow: { color: "#e5e7eb", fontWeight: "900" },
  weekSub: { color: "#b7c0cc", fontWeight: "700" },

  dayCard: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  dayName: { color: "#ffffff", fontWeight: "900", fontSize: 16 },

  // ✅ Two-column layout: text left, counters right (aligned)
  dayGrid: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dayTextCol: { flex: 1, minWidth: 0 },
  dayCounterCol: {
    width: 118,
    alignItems: "flex-end",
    gap: 14,
    paddingTop: 2,
  },

  rowLabel: { color: "#93c5fd", fontWeight: "900" },
  rowText: { color: "#e5e7eb", fontWeight: "700", marginTop: 2 },

  spacer8: { height: 8 },

  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-end",
  },

  btn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#ffffff", fontWeight: "900", fontSize: 18 },
  value: { color: "#ffffff", fontWeight: "900", fontSize: 16, minWidth: 18, textAlign: "center" },

  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900" },

  whatsappBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  whatsappBtnText: { color: "#ffffff", fontWeight: "900" },
  smallHint: { color: "#b7c0cc", marginTop: 8 },

  totalsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 2 },
  totalBox: {
    flexGrow: 1,
    minWidth: 200,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  totalLabel: { color: "#cbd5e1", fontWeight: "800" },
  totalValue: { color: "#ffffff", fontSize: 18, fontWeight: "900", marginTop: 6 },

  previewBox: {
    marginTop: 6,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  previewText: { color: "#e5e7eb", fontFamily: Platform.OS === "web" ? "monospace" : undefined },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: "#ffffff", fontWeight: "900", fontSize: 16, marginBottom: 6 },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#233044",
    marginBottom: 8,
    backgroundColor: "#121a24",
  },
  modalItemSelected: { borderColor: "#16a34a" },
  modalItemDisabled: { opacity: 0.35 },
  modalItemText: { color: "#ffffff", fontWeight: "900" },
  modalItemTextSelected: { color: "#b9f6ca" },
  modalItemTextDisabled: { color: "#9aa3ad" },
  modalCloseBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#121a24",
    borderWidth: 1,
    borderColor: "#233044",
  },
  modalCloseText: { color: "#ffffff", fontWeight: "900" },
});
